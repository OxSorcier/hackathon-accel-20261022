import { createHash } from 'node:crypto';
import type { CollectionResult, Collector, CollectorInput, SourceEvidence } from '../contracts/index.ts';
import { KEENABLE_SOURCE_URL, canonicalPublisherUrl, getSourceProfile, officialRegulationIdentifier } from './source-policy.ts';
import type { SourceProfile } from './source-policy.ts';
import { cancelBody, readBoundedJson, requestErrorCode, withAbort } from './http.ts';

export interface KeenableOptions {
  fetch?: typeof globalThis.fetch; now?: () => Date; getApiKey?: () => string | undefined;
  timeoutMs?: number; maxBytes?: number; limit?: number; maxFetches?: number; maxContentChars?: number;
}
interface SearchHit { url: string; title: string; description: string; snippet: string; publishedAt: string | null; indexedAt: string | null }
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('INVALID_SOURCE_ENVELOPE');
  return value as Record<string, unknown>;
}
function string(value: unknown, maximum: number, optional = false): string {
  if (optional && (value === null || value === undefined)) return '';
  if (typeof value !== 'string' || (!optional && value.trim().length === 0) || value.length > maximum) throw new Error('INVALID_SOURCE_ENVELOPE');
  return value.trim();
}
function budget(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw new Error('INVALID_COLLECTOR_BUDGET');
  return result;
}
function date(value: unknown, readingAt: string, unixSeconds = false): string | null {
  if (value === null || value === undefined || value === '') return null;
  let milliseconds: number;
  if (unixSeconds && typeof value === 'number' && Number.isFinite(value) && value >= 0) milliseconds = value * 1000;
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    const calendar = value.slice(0, 10); const day = new Date(`${calendar}T00:00:00.000Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== calendar) throw new Error('INVALID_SOURCE_DATE');
    milliseconds = Date.parse(value);
  }
  else throw new Error('INVALID_SOURCE_DATE');
  if (!Number.isFinite(milliseconds) || milliseconds > Date.parse(readingAt)) throw new Error('INVALID_SOURCE_DATE');
  return new Date(milliseconds).toISOString();
}
function hit(raw: unknown, profile: SourceProfile, at: string): SearchHit {
  const value = object(raw); const url = canonicalPublisherUrl(value.url, profile);
  if (!url) throw new Error('SOURCE_NOT_ALLOWED');
  return { url, title: string(value.title, 4000), description: string(value.description, 4000, true), snippet: string(value.snippet, 10_000, true),
    publishedAt: date(value.published_at, at), indexedAt: date(value.acquired_at, at) };
}

function visiblePublisherDate(url: string, content: string): string | null {
  const parsed = new URL(url);
  if (parsed.hostname !== 'www.rockwool.com' && parsed.hostname !== 'rockwool.com') return null;
  const match = decodeURIComponent(parsed.pathname).match(/actualite-du-(\d{2})-([a-zéû]+)-(\d{4})/i);
  if (!match) return null;
  const months: Record<string, string> = { janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12' };
  const normalize = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const day = match[1]; const month = normalize(match[2] ?? ''); const year = match[3]; const number = months[month];
  if (!day || !year || !number) return null;
  const body = normalize(content); const shortDay = String(Number(day)); const shortMonth = String(Number(number));
  if (!new RegExp(`\\b0?${shortDay}\\s+${month}\\s+${year}\\b|\\b0?${shortDay}[/.-]0?${shortMonth}[/.-]${year}\\b`).test(body)) return null;
  const calendar = `${year}-${number}-${day}`; const result = new Date(`${calendar}T00:00:00.000Z`);
  return Number.isFinite(result.getTime()) && result.toISOString().slice(0, 10) === calendar ? result.toISOString() : null;
}

export function createKeenableCollector(options: KeenableOptions = {}): Collector {
  const timeoutMs = budget(options.timeoutMs, 12_000, 1, 60_000); const maxBytes = budget(options.maxBytes, 512_000, 64, 2_000_000);
  const limit = budget(options.limit, 5, 1, 20); const maxFetches = budget(options.maxFetches, 3, 0, 5); const maxChars = budget(options.maxContentChars, 8000, 32, 8000);
  const now = options.now ?? ((): Date => new Date());
  return async (input: CollectorInput): Promise<CollectionResult> => {
    const startedAt = now().toISOString(); const profile = getSourceProfile(input.publicTopic);
    const finish = (status: CollectionResult['status'], evidence: SourceEvidence[], error: string | null): CollectionResult => ({ status, sources: [{ url: KEENABLE_SOURCE_URL, status, evidence, error }], startedAt, completedAt: now().toISOString() });
    if (!profile || !profile.sourceUrls.includes(KEENABLE_SOURCE_URL) || input.sourceUrls.length !== 1 || input.sourceUrls[0] !== KEENABLE_SOURCE_URL) return finish('not_run', [], 'PUBLIC_TOPIC_OR_SOURCE_NOT_ALLOWED');
    try {
      const timeout = AbortSignal.timeout(timeoutMs); const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      signal.throwIfAborted();
      const key = options.getApiKey?.();
      if (key !== undefined && (typeof key !== 'string' || key.length < 1 || key.length > 4096 || /[\r\n]/.test(key))) throw new Error('INVALID_API_CONFIGURATION');
      const headers: Record<string, string> = { accept: 'application/json', 'Content-Type': 'application/json' };
      if (key) headers['X-API-Key'] = key; else headers['X-Keenable-Title'] = 'Accel decision desk';
      const searchEndpoint = `${KEENABLE_SOURCE_URL}${key ? '' : '/public'}`;
      const fetchEndpoint = `https://api.keenable.ai/v1/fetch${key ? '' : '/public'}`;
      const fetcher = options.fetch ?? globalThis.fetch;
      const request = async (url: URL | string, init: RequestInit): Promise<unknown> => {
        signal.throwIfAborted();
        const response = await withAbort(fetcher(url, { ...init, headers, redirect: 'manual', signal }), signal);
        if (response.status !== 200) { await cancelBody(response.body, signal); throw new Error(`HTTP_${response.status}`); }
        return await readBoundedJson(response, maxBytes, signal);
      };
      const searchMode = profile.searchMode ?? 'realtime';
      const payload = object(await request(searchEndpoint, { method: 'POST', body: JSON.stringify({ query: profile.query, mode: searchMode, ...(profile.site ? { site: profile.site } : {}), ...(profile.publishedAfter ? { published_after: profile.publishedAfter } : {}), snippet_max_length: 1000, max_results: limit }) }));
      if (payload.query !== profile.query) throw new Error('QUERY_MISMATCH');
      if (payload.mode !== searchMode || !Array.isArray(payload.results) || payload.results.length > 50) throw new Error('INVALID_SOURCE_ENVELOPE');
      if (payload.results.length === 0 && !profile.priorityUrls?.length) return finish('empty', [], null);
      const hits = new Map<string, SearchHit>(); let partial = payload.results.length >= limit; let rejected = 0;
      for (const raw of profile.priorityUrls ?? []) {
        const url = canonicalPublisherUrl(raw, profile);
        if (url) hits.set(url, { url, title: profile.label, description: '', snippet: '', publishedAt: null, indexedAt: null });
      }
      for (const item of payload.results.slice(0, limit)) {
        try { const normalized = hit(item, profile, now().toISOString()); hits.set(normalized.url, normalized); } catch { rejected++; partial = true; }
      }
      const evidence: SourceEvidence[] = []; let fetchedCount = 0;
      if (hits.size > limit) partial = true;
      for (const item of [...hits.values()].slice(0, limit)) {
        let body = item.snippet || item.description; let title = item.title; let publishedAt = item.publishedAt;
        let method: 'fetch' | 'search_snippet' = 'search_snippet'; let endpoint = searchEndpoint; let truncated = false; let dateNote = '';
        if (fetchedCount < maxFetches) {
          fetchedCount++;
          try {
            const url = new URL(fetchEndpoint); url.searchParams.set('url', item.url); url.searchParams.set('max_chars', String(maxChars)); url.searchParams.set('live', 'false');
            const fetched = object(await request(url, { method: 'GET' }));
            if (canonicalPublisherUrl(fetched.url, profile) !== item.url) throw new Error('FETCH_URL_MISMATCH');
            const text = string(fetched.content, 100_000);
            if (text.length < 32) throw new Error('EMPTY_FETCH_CONTENT');
            const fetchedTitle = fetched.title === null || fetched.title === undefined || fetched.title === '' ? title : string(fetched.title, 4000);
            const fetchedDate = date(fetched.published_at, now().toISOString(), true);
            const publisherDate = visiblePublisherDate(item.url, `${fetchedTitle}\n${text}`);
            const dates = [item.publishedAt, fetchedDate, publisherDate].filter((value): value is string => value !== null);
            const conflict = new Set(dates.map((value) => value.slice(0, 10))).size > 1;
            const note = conflict ? `Date conflict: Search ${item.publishedAt ?? 'unknown'}, Fetch ${fetchedDate ?? 'unknown'}, visible publisher date ${publisherDate ?? 'unknown'}. Canonical publication date unknown; check the original.\n` : '';
            body = text; truncated = text.length >= maxChars; title = fetchedTitle;
            publishedAt = conflict ? null : publisherDate ?? fetchedDate ?? item.publishedAt;
            dateNote = note;
            if (conflict) partial = true;
            method = 'fetch'; endpoint = fetchEndpoint;
          } catch { partial = true; }
        }
        if (body.length === 0) { rejected++; partial = true; continue; }
        const regulation: SourceEvidence['regulation'] = profile.jurisdiction ? { jurisdiction: profile.jurisdiction,
          officialIdentifier: officialRegulationIdentifier(item.url, profile.jurisdiction), entryIntoForceAt: null, appliesFrom: null, deadlineAt: null, scope: null, applicability: 'to_verify' } : undefined;
        const header = `Original source: ${item.url}\nTitle: ${title}\nPublished: ${publishedAt ?? 'unknown'}\n${dateNote}Keenable retrieval: ${method === 'fetch' ? 'indexed copy; freshness not verified' : 'search excerpt; page not read'}.\n${regulation ? `${regulation.jurisdiction} legal source; applicability and deadlines require verification.\n` : ''}`;
        const footer = '\nUntrusted public information. This collection establishes no commercial relationship.';
        const marker = 'Truncated content.\n';
        const available = Math.max(0, Math.min(maxChars, 12_000 - header.length - footer.length - marker.length));
        truncated = truncated || body.length > available;
        const content = `${header}${truncated ? marker : ''}${body.slice(0, available)}${footer}`;
        if (method === 'search_snippet' || truncated || publishedAt === null) partial = true;
        evidence.push({ id: `keenable:${createHash('sha256').update(item.url).digest('hex')}`, url: item.url, title, content,
          publishedAt, collectedAt: now().toISOString(), contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct',
          family: profile.family, provenance: { provider: 'keenable', endpoint, method, profileId: profile.id, indexedAt: item.indexedAt, truncated }, ...(regulation ? { regulation } : {}) });
      }
      if (evidence.length === 0) return finish('error', [], 'NO_VALID_SOURCE_RECORD');
      return finish(partial || rejected > 0 ? 'partial' : 'success', evidence, partial || rejected > 0 ? 'BOUNDED_OR_INCOMPLETE_SOURCE' : null);
    } catch (error: unknown) { return finish('error', [], requestErrorCode(error)); }
  };
}
