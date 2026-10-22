import { createHash } from 'node:crypto';
import type { Actor, CollectionResult, CollectionStatus, SourceEvidence, SourceResult, WatchInput } from '../contracts/index.ts';
import { aggregateCollectionStatus, BOAMP_SOURCE_URL, isAllowedSourceUrl, isPublicTopic } from '../watch/collector.ts';

export class DataWatchError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'DataWatchError'; this.code = code; }
}

export function identifier(value: unknown, maximum = 160): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || !/^[A-Za-z0-9:_.-]+$/.test(value)) throw new DataWatchError('INVALID_IDENTIFIER');
  return value;
}

export function isoDate(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new DataWatchError('INVALID_TIMESTAMP');
  return new Date(value).toISOString();
}

export function assertWatchActor(actor: Actor): void {
  identifier(actor.companyId); identifier(actor.actorId);
  if (actor.role !== 'direction' && actor.role !== 'achats') throw new DataWatchError('WATCH_FORBIDDEN');
}

export function validateWatchInput(value: WatchInput): WatchInput {
  if (!isPublicTopic(value.publicTopic) || !Array.isArray(value.sourceUrls) || value.sourceUrls.length !== 1 || !isAllowedSourceUrl(value.sourceUrls[0])) throw new DataWatchError('PUBLIC_TOPIC_OR_SOURCE_NOT_ALLOWED');
  if (!Number.isSafeInteger(value.cadenceMinutes) || value.cadenceMinutes < 5 || value.cadenceMinutes > 10_080) throw new DataWatchError('INVALID_CADENCE');
  return { publicTopic: value.publicTopic, sourceUrls: [BOAMP_SOURCE_URL], cadenceMinutes: value.cadenceMinutes };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DataWatchError('INVALID_COLLECTION_RESULT');
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) throw new DataWatchError('INVALID_COLLECTION_RESULT');
  return value;
}

function nullableText(value: unknown): string | null { return value === null ? null : boundedText(value, 300); }
function status(value: unknown): CollectionStatus {
  if (value !== 'success' && value !== 'empty' && value !== 'partial' && value !== 'error' && value !== 'not_run') throw new DataWatchError('INVALID_COLLECTION_RESULT');
  return value;
}

function evidence(value: unknown): SourceEvidence {
  const item = record(value);
  const id = identifier(item.id);
  if (!/^boamp:\d{2}-\d{1,10}$/.test(id)) throw new DataWatchError('INVALID_EVIDENCE_ID');
  const url = boundedText(item.url, 2000);
  if (url !== `https://www.boamp.fr/pages/avis/?q=${encodeURIComponent(`idweb:"${id.slice(6)}"`)}`) throw new DataWatchError('INVALID_EVIDENCE_URL');
  const content = boundedText(item.content, 12_000);
  const contentHash = createHash('sha256').update(content).digest('hex');
  const mode = item.mode;
  if (item.contentHash !== contentHash || item.dataOrigin !== 'public' || (mode !== 'direct' && mode !== 'replay' && mode !== 'test')) throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
  return { id, url, title: boundedText(item.title, 4000), content,
    contentHash, dataOrigin: 'public', mode,
    publishedAt: item.publishedAt === null ? null : isoDate(item.publishedAt), collectedAt: isoDate(item.collectedAt) };
}

export function validateCollectionResult(value: unknown): CollectionResult {
  const input = record(value);
  const startedAt = isoDate(input.startedAt); const completedAt = isoDate(input.completedAt);
  if (completedAt < startedAt || !Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 3) throw new DataWatchError('INVALID_COLLECTION_RESULT');
  const sources: SourceResult[] = input.sources.map((raw: unknown): SourceResult => {
    const source = record(raw); const sourceStatus = status(source.status);
    if (source.url !== BOAMP_SOURCE_URL || !Array.isArray(source.evidence) || source.evidence.length > 100) throw new DataWatchError('INVALID_COLLECTION_RESULT');
    const items = source.evidence.map(evidence);
    if (items.some((item) => item.collectedAt < startedAt || item.collectedAt > completedAt)) throw new DataWatchError('INVALID_EVIDENCE_TIME');
    if ((sourceStatus === 'success' && items.length === 0) || (['empty', 'not_run', 'error'].includes(sourceStatus) && items.length !== 0)) throw new DataWatchError('INVALID_COLLECTION_RESULT');
    return { url: BOAMP_SOURCE_URL, status: sourceStatus, evidence: items, error: nullableText(source.error) };
  });
  if (status(input.status) !== aggregateCollectionStatus(sources)) throw new DataWatchError('INVALID_COLLECTION_STATUS');
  return { status: status(input.status), sources, startedAt, completedAt };
}
