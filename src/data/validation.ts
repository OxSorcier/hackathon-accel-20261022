import { createHash } from 'node:crypto';
import type { Actor, CollectionResult, CollectionStatus, SourceEvidence, SourceResult, WatchInput } from '../contracts/index.ts';
import { aggregateCollectionStatus } from '../watch/collection-status.ts';
import { BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL, canonicalPublisherUrl, getSourceProfileById, isAllowedSourceUrl, isPublicTopic, sourceMatchesTopic } from '../watch/source-policy.ts';

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
  const calendar = value.slice(0, 10); const day = new Date(`${calendar}T00:00:00.000Z`);
  if (day.toISOString().slice(0, 10) !== calendar || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new DataWatchError('INVALID_TIMESTAMP');
  return new Date(value).toISOString();
}

export function assertWatchActor(actor: Actor): void {
  identifier(actor.companyId); identifier(actor.actorId);
  if (actor.role !== 'direction' && actor.role !== 'achats') throw new DataWatchError('WATCH_FORBIDDEN');
}

export function validateWatchInput(value: WatchInput): WatchInput {
  if (!isPublicTopic(value.publicTopic) || !Array.isArray(value.sourceUrls) || value.sourceUrls.length < 1 || value.sourceUrls.length > 2 || new Set(value.sourceUrls).size !== value.sourceUrls.length || value.sourceUrls.some((source) => !isAllowedSourceUrl(source) || !sourceMatchesTopic(source, value.publicTopic))) throw new DataWatchError('PUBLIC_TOPIC_OR_SOURCE_NOT_ALLOWED');
  if (!Number.isSafeInteger(value.cadenceMinutes) || value.cadenceMinutes < 5 || value.cadenceMinutes > 10_080) throw new DataWatchError('INVALID_CADENCE');
  return { publicTopic: value.publicTopic, sourceUrls: [...value.sourceUrls], cadenceMinutes: value.cadenceMinutes };
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

function evidence(value: unknown, sourceUrl: string): SourceEvidence {
  const item = record(value);
  const id = identifier(item.id);
  const url = boundedText(item.url, 2000);
  if (sourceUrl === BOAMP_SOURCE_URL) {
    if (!/^boamp:\d{2}-\d{1,10}$/.test(id)) throw new DataWatchError('INVALID_EVIDENCE_ID');
    if (url !== `https://www.boamp.fr/pages/avis/?q=${encodeURIComponent(`idweb:"${id.slice(6)}"`)}`) throw new DataWatchError('INVALID_EVIDENCE_URL');
  } else {
    if (sourceUrl !== KEENABLE_SOURCE_URL || canonicalPublisherUrl(url) !== url || id !== `keenable:${createHash('sha256').update(url).digest('hex')}`) throw new DataWatchError('INVALID_EVIDENCE_URL');
  }
  const content = boundedText(item.content, 12_000);
  const contentHash = createHash('sha256').update(content).digest('hex');
  const mode = item.mode;
  if (item.contentHash !== contentHash || item.dataOrigin !== 'public' || (mode !== 'direct' && mode !== 'replay' && mode !== 'test')) throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
  const result: SourceEvidence = { id, url, title: boundedText(item.title, 4000), content,
    contentHash, dataOrigin: 'public', mode,
    publishedAt: item.publishedAt === null ? null : isoDate(item.publishedAt), collectedAt: isoDate(item.collectedAt) };
  if (result.publishedAt !== null && result.publishedAt > result.collectedAt) throw new DataWatchError('INVALID_EVIDENCE_TIME');
  if (item.provenance !== undefined) {
    const provenance = record(item.provenance);
    const profileId = identifier(provenance.profileId);
    const profile = getSourceProfileById(profileId);
    if (!profile || !profile.sourceUrls.includes(sourceUrl) || typeof provenance.truncated !== 'boolean') throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
    if (sourceUrl === BOAMP_SOURCE_URL) {
      if (provenance.provider !== 'boamp' || provenance.endpoint !== BOAMP_SOURCE_URL || provenance.method !== 'api_record') throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
      result.provenance = { provider: 'boamp', endpoint: BOAMP_SOURCE_URL, method: 'api_record', profileId, indexedAt: null, truncated: provenance.truncated };
      if (item.family !== undefined && item.family !== 'public_contract') throw new DataWatchError('INVALID_EVIDENCE_FAMILY');
      result.family = 'public_contract';
    } else {
      if (provenance.provider !== 'keenable' || (provenance.method !== 'fetch' && provenance.method !== 'search_snippet') || item.family !== profile.family || canonicalPublisherUrl(url, profile) !== url) throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
      const path = provenance.method === 'fetch' ? 'fetch' : 'search';
      if (provenance.endpoint !== `https://api.keenable.ai/v1/${path}` && provenance.endpoint !== `https://api.keenable.ai/v1/${path}/public`) throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
      const indexedAt = provenance.indexedAt === null ? null : isoDate(provenance.indexedAt);
      if (indexedAt !== null && indexedAt > result.collectedAt) throw new DataWatchError('INVALID_EVIDENCE_TIME');
      result.provenance = { provider: 'keenable', endpoint: provenance.endpoint, method: provenance.method, profileId, indexedAt, truncated: provenance.truncated };
      result.family = profile.family;
    }
    if (profile.jurisdiction !== undefined && sourceUrl === KEENABLE_SOURCE_URL) {
      const regulation = record(item.regulation);
      if (regulation.jurisdiction !== profile.jurisdiction || (regulation.applicability !== 'unknown' && regulation.applicability !== 'to_verify')) throw new DataWatchError('INVALID_REGULATION_CONTEXT');
      result.regulation = { jurisdiction: profile.jurisdiction, officialIdentifier: regulation.officialIdentifier === null ? null : boundedText(regulation.officialIdentifier, 300),
        entryIntoForceAt: regulation.entryIntoForceAt === null ? null : isoDate(regulation.entryIntoForceAt), appliesFrom: regulation.appliesFrom === null ? null : isoDate(regulation.appliesFrom), deadlineAt: regulation.deadlineAt === null ? null : isoDate(regulation.deadlineAt),
        scope: regulation.scope === null ? null : boundedText(regulation.scope, 4000), applicability: regulation.applicability };
    } else if (item.regulation !== undefined) throw new DataWatchError('INVALID_REGULATION_CONTEXT');
  } else if (sourceUrl === KEENABLE_SOURCE_URL || item.family !== undefined || item.regulation !== undefined) throw new DataWatchError('INVALID_EVIDENCE_PROVENANCE');
  return result;
}

export function validateCollectionResult(value: unknown): CollectionResult {
  const input = record(value);
  const startedAt = isoDate(input.startedAt); const completedAt = isoDate(input.completedAt);
  if (completedAt < startedAt || !Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 3) throw new DataWatchError('INVALID_COLLECTION_RESULT');
  const sources: SourceResult[] = input.sources.map((raw: unknown): SourceResult => {
    const source = record(raw); const sourceStatus = status(source.status);
    if (!isAllowedSourceUrl(source.url) || !Array.isArray(source.evidence) || source.evidence.length > 100) throw new DataWatchError('INVALID_COLLECTION_RESULT');
    const sourceUrl = source.url;
    const items = source.evidence.map((item: unknown): SourceEvidence => evidence(item, sourceUrl));
    if (items.some((item) => item.collectedAt < startedAt || item.collectedAt > completedAt)) throw new DataWatchError('INVALID_EVIDENCE_TIME');
    if ((sourceStatus === 'success' && items.length === 0) || (['empty', 'not_run', 'error'].includes(sourceStatus) && items.length !== 0)) throw new DataWatchError('INVALID_COLLECTION_RESULT');
    return { url: sourceUrl, status: sourceStatus, evidence: items, error: nullableText(source.error) };
  });
  if (status(input.status) !== aggregateCollectionStatus(sources)) throw new DataWatchError('INVALID_COLLECTION_STATUS');
  return { status: status(input.status), sources, startedAt, completedAt };
}
