import { createHash } from 'node:crypto';
import type { CollectionResult, CollectionStatus, Collector, CollectorInput, SourceEvidence, SourceResult } from '../contracts/index.ts';

export const BOAMP_SOURCE_URL = 'https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records';
export const PUBLIC_TOPICS = ['isolants France perturbations production', 'marchés publics matériaux France'] as const;
const TOPIC_QUERIES: Readonly<Record<string, string>> = {
  'isolants France perturbations production': 'search(objet, "isolant")',
  'marchés publics matériaux France': 'search(objet, "matériaux")',
};

export interface CollectorOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
  maxBytes?: number;
  limit?: number;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPublicTopic(value: unknown): value is string {
  return typeof value === 'string' && Object.hasOwn(TOPIC_QUERIES, value);
}

export function isAllowedSourceUrl(value: unknown): value is string {
  return value === BOAMP_SOURCE_URL;
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
  const buyer = value.nomacheteur === null || value.nomacheteur === undefined ? 'non renseigné' : text(value.nomacheteur, 1000);
  const filename = value.filename === null || value.filename === undefined ? 'non renseigné' : text(value.filename, 300);
  const publishedAt = publication(value.dateparution);
  const content = `DILA, BOAMP. Avis ${nativeId}.\n${title}\nAcheteur public : ${buyer}\nFichier DILA : ${filename}\nPublication : ${publishedAt ?? 'inconnue'}\nPiste publique à qualifier. Aucun lien commercial vérifié avec les fournisseurs fictifs.`;
  return {
    id: `boamp:${nativeId}`, url: `https://www.boamp.fr/pages/avis/?q=${encodeURIComponent(`idweb:"${nativeId}"`)}`,
    title, content, publishedAt, collectedAt,
    contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct',
  };
}

async function readBody(response: Response, maxBytes: number): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) {
    if (response.body) await response.body.cancel();
    throw new Error('BODY_TOO_LARGE');
  }
  if (!response.body) throw new Error('EMPTY_HTTP_BODY');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  return parsed;
}

function errorCode(error: unknown): string {
  const admitted = ['BODY_TOO_LARGE', 'EMPTY_HTTP_BODY', 'INVALID_SOURCE_ENVELOPE'];
  if (error instanceof Error && admitted.includes(error.message)) return error.message;
  if (error instanceof Error && /^HTTP_\d{3}$/.test(error.message)) return error.message;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'COLLECTION_ABORTED';
  return 'SOURCE_REQUEST_OR_PAYLOAD_ERROR';
}

export function aggregateCollectionStatus(sources: readonly SourceResult[]): CollectionStatus {
  if (sources.length === 0 || sources.every((source) => source.status === 'not_run')) return 'not_run';
  if (sources.every((source) => source.status === 'error')) return 'error';
  if (sources.every((source) => source.status === 'empty')) return 'empty';
  if (sources.every((source) => source.status === 'success' || source.status === 'empty')) return 'success';
  return 'partial';
}

export function createPublicCollector(options: CollectorOptions = {}): Collector {
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
      if (!isAllowedSourceUrl(sourceUrl)) {
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
        const response = await fetcher(url, { method: 'GET', redirect: 'manual', signal, headers: { accept: 'application/json' } });
        if (!response.ok || response.status !== 200) {
          if (response.body) await response.body.cancel();
          throw new Error(`HTTP_${response.status}`);
        }
        const payload = await readBody(response, maxBytes);
        if (!object(payload) || !Number.isSafeInteger(payload.total_count) || Number(payload.total_count) < 0 || !Array.isArray(payload.results)) throw new Error('INVALID_SOURCE_ENVELOPE');
        const evidence = new Map<string, SourceEvidence>();
        let rejected = 0;
        for (const record of payload.results.slice(0, limit)) {
          try {
            const item = normalize(record, now().toISOString());
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
