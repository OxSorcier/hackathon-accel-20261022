import { createHash } from 'node:crypto';
import type { CollectionResult, CollectionStatus, Collector, CollectorInput, SourceEvidence, SourceResult } from '../contracts/index.ts';
import { BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL, isAllowedSourceUrl, isPublicTopic, sourceMatchesTopic, getSourceProfile } from './source-policy.ts';
import { aggregateCollectionStatus } from './collection-status.ts';
import { cancelBody, readBoundedJson, requestErrorCode as errorCode, withAbort } from './http.ts';
import { createKeenableCollector } from './keenable.ts';
import type { KeenableOptions } from './keenable.ts';
export { BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL, PUBLIC_TOPICS, PUBLIC_SOURCE_URLS, PUBLIC_PROFILES, isPublicTopic, isPublicSource, isAllowedSourceUrl, getWatchCapabilities } from './source-policy.ts';
export { aggregateCollectionStatus } from './collection-status.ts';
export { createKeenableCollector } from './keenable.ts';

const TOPIC_QUERIES: Readonly<Record<string, string>> = {
  'isolants France perturbations production': 'search(objet, "isolant")',
  'marchés publics matériaux France': 'search(objet, "matériaux")',
};

export type CollectorOptions = KeenableOptions;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bounded(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error('INVALID_COLLECTOR_BUDGET');
  return value;
}

function publication(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('INVALID_PUBLICATION_DATE');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('INVALID_PUBLICATION_DATE');
  return date.toISOString();
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) throw new Error('INVALID_SOURCE_RECORD');
  return value.replace(/\s+/gu, ' ').trim();
}

function normalize(value: unknown, collectedAt: string): SourceEvidence {
  if (!object(value)) throw new Error('INVALID_SOURCE_RECORD');
  const nativeId = text(value.idweb, 40);
  if (!/^\d{2}-\d{1,10}$/.test(nativeId)) throw new Error('INVALID_SOURCE_ID');
  const title = text(value.objet, 4000);
  const buyer = value.nomacheteur === null || value.nomacheteur === undefined ? 'not provided' : text(value.nomacheteur, 1000);
  const filename = value.filename === null || value.filename === undefined ? 'not provided' : text(value.filename, 300);
  const publishedAt = publication(value.dateparution);
  const content = `DILA, BOAMP. Notice ${nativeId}.\n${title}\nPublic buyer: ${buyer}\nDILA file: ${filename}\nPublished: ${publishedAt ?? 'unknown'}\nPublic lead requiring qualification. No verified commercial relationship with the synthetic suppliers.`;
  return {
    id: `boamp:${nativeId}`, url: `https://www.boamp.fr/pages/avis/?q=${encodeURIComponent(`idweb:"${nativeId}"`)}`,
    title, content, publishedAt, collectedAt,
    contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct',
  };
}

function createBoampCollector(options: CollectorOptions = {}): Collector {
  const timeoutMs = bounded(options.timeoutMs, 12_000, 1, 60_000);
  const maxBytes = bounded(options.maxBytes, 512_000, 32, 2_000_000);
  const limit = bounded(options.limit, 20, 1, 100);
  const now = options.now ?? ((): Date => new Date());
  return async (input: CollectorInput): Promise<CollectionResult> => {
    const startedAt = now().toISOString();
    const sources: SourceResult[] = [];
    const urls = Array.isArray(input.sourceUrls) && input.sourceUrls.length <= 3 ? [...new Set(input.sourceUrls)] : [];
    if (!isPublicTopic(input.publicTopic) || urls.length === 0) {
      return { status: 'not_run', sources: [{ url: BOAMP_SOURCE_URL, status: 'not_run', evidence: [], error: 'PUBLIC_TOPIC_OR_SOURCE_NOT_ALLOWED' }], startedAt, completedAt: now().toISOString() };
    }
    for (const sourceUrl of urls) {
      if (sourceUrl !== BOAMP_SOURCE_URL || !sourceMatchesTopic(sourceUrl, input.publicTopic)) {
        sources.push({ url: BOAMP_SOURCE_URL, status: 'not_run', evidence: [], error: 'SOURCE_NOT_ALLOWED' });
        continue;
      }
      try {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
        signal.throwIfAborted();
        const url = new URL(BOAMP_SOURCE_URL);
        url.searchParams.set('select', 'idweb,objet,dateparution,nomacheteur,filename');
        url.searchParams.set('where', TOPIC_QUERIES[input.publicTopic] ?? 'false');
        url.searchParams.set('order_by', 'dateparution desc, idweb desc');
        url.searchParams.set('limit', String(limit));
        const fetcher = options.fetch ?? globalThis.fetch;
        const response = await withAbort(fetcher(url, { method: 'GET', redirect: 'manual', signal, headers: { accept: 'application/json' } }), signal);
        if (!response.ok || response.status !== 200) {
          await cancelBody(response.body, signal);
          throw new Error(`HTTP_${response.status}`);
        }
        const payload = await readBoundedJson(response, maxBytes, signal);
        if (!object(payload) || !Number.isSafeInteger(payload.total_count) || Number(payload.total_count) < 0 || !Array.isArray(payload.results)) throw new Error('INVALID_SOURCE_ENVELOPE');
        const evidence = new Map<string, SourceEvidence>();
        let rejected = 0;
        for (const record of payload.results.slice(0, limit)) {
          try {
            const item = normalize(record, now().toISOString());
            item.family = 'public_contract';
            item.provenance = { provider: 'boamp', endpoint: BOAMP_SOURCE_URL, method: 'api_record', profileId: getSourceProfile(input.publicTopic)?.id ?? 'public-contracts', indexedAt: null, truncated: false };
            evidence.set(`${item.id}:${item.contentHash}`, item);
          } catch { rejected++; }
        }
        const total = Number(payload.total_count);
        const incomplete = rejected > 0 || total > payload.results.length || payload.results.length > limit || total < payload.results.length;
        const status: CollectionStatus = payload.results.length === 0 && total === 0 ? 'empty' : evidence.size === 0 && rejected > 0 ? 'error' : incomplete ? 'partial' : 'success';
        sources.push({ url: BOAMP_SOURCE_URL, status, evidence: [...evidence.values()], error: status === 'error' ? 'NO_VALID_SOURCE_RECORD' : incomplete ? 'BOUNDED_OR_INVALID_RECORDS' : null });
      } catch (error: unknown) {
        sources.push({ url: BOAMP_SOURCE_URL, status: 'error', evidence: [], error: errorCode(error) });
      }
    }
    return { status: aggregateCollectionStatus(sources), sources, startedAt, completedAt: now().toISOString() };
  };
}

export function createPublicCollector(options: CollectorOptions = {}): Collector {
  const boamp = createBoampCollector(options);
  const keenable = createKeenableCollector({ ...options, limit: Math.min(options.limit ?? 5, 20), maxBytes: Math.max(options.maxBytes ?? 512_000, 64) });
  const now = options.now ?? ((): Date => new Date());
  return async (input: CollectorInput): Promise<CollectionResult> => {
    const startedAt = now().toISOString();
    const urls = Array.isArray(input.sourceUrls) && input.sourceUrls.length <= 3 ? [...new Set(input.sourceUrls)] : [];
    if (!isPublicTopic(input.publicTopic) || urls.length === 0) return { status: 'not_run', sources: [{ url: BOAMP_SOURCE_URL, status: 'not_run', evidence: [], error: 'PUBLIC_TOPIC_OR_SOURCE_NOT_ALLOWED' }], startedAt, completedAt: now().toISOString() };
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 12_000);
    const signal = input.signal ? AbortSignal.any([deadline, input.signal]) : deadline;
    const results = await Promise.all(urls.map(async (url): Promise<SourceResult[]> => {
      if (!isAllowedSourceUrl(url) || !sourceMatchesTopic(url, input.publicTopic)) return [{ url: isAllowedSourceUrl(url) ? url : BOAMP_SOURCE_URL, status: 'not_run', evidence: [], error: 'SOURCE_NOT_ALLOWED_FOR_TOPIC' }];
      const collector = url === BOAMP_SOURCE_URL ? boamp : keenable;
      return (await collector({ ...input, sourceUrls: [url], signal })).sources;
    }));
    const sources = results.flat();
    return { status: aggregateCollectionStatus(sources), sources, startedAt, completedAt: now().toISOString() };
  };
}
