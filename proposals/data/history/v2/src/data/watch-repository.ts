import { createHash } from 'node:crypto';
import type { Actor, CollectionResult, SqlPort, Watch, WatchInput, WatchOccurrence } from '../contracts/index.ts';
import { assertWatchActor, DataWatchError, identifier, isoDate, validateCollectionResult, validateWatchInput } from './validation.ts';
import { getSourceProfile } from '../watch/source-policy.ts';

export interface ClaimedOccurrence { occurrence: WatchOccurrence; watch: Watch; workerId: string }
export interface WatchRepository {
  createWatch(actor: Actor, input: WatchInput, operationKey: string, now?: Date): Promise<Watch>;
  listWatches(companyId: string): Promise<Watch[]>;
  listOccurrences(companyId: string, limit?: number): Promise<WatchOccurrence[]>;
  enqueueManual(actor: Actor, watchId: string, operationKey: string, now?: Date): Promise<WatchOccurrence>;
  enqueueDue(now?: Date, limit?: number): Promise<number>;
  claimNext(workerId: string, leaseMs: number, now?: Date): Promise<ClaimedOccurrence | null>;
  renew(claim: ClaimedOccurrence, leaseMs: number, now?: Date): Promise<boolean>;
  finish(claim: ClaimedOccurrence, result: CollectionResult, now?: Date): Promise<WatchOccurrence | null>;
  fail(claim: ClaimedOccurrence, now?: Date): Promise<WatchOccurrence | null>;
}

function stableId(prefix: string, parts: string[]): string {
  return `${prefix}:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new DataWatchError('INVALID_INTEGER');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new DataWatchError('INVALID_STORAGE_ROW');
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new DataWatchError('INVALID_STORAGE_ROW');
  return value as Record<string, unknown>;
}
function watch(row: Record<string, unknown>): Watch {
  const input = validateWatchInput({ publicTopic: string(row.public_topic), sourceUrls: row.source_urls as string[], cadenceMinutes: integer(row.cadence_minutes, 5, 10080) });
  if (typeof row.enabled !== 'boolean') throw new DataWatchError('INVALID_STORAGE_ROW');
  return { id: identifier(row.id), companyId: identifier(row.company_id), actorId: identifier(row.actor_id),
    ...input, enabled: row.enabled, nextRunAt: isoDate(row.next_run_at), createdAt: isoDate(row.created_at) };
}
function occurrence(row: Record<string, unknown>): WatchOccurrence {
  const status = row.status;
  if (status !== 'queued' && status !== 'running' && status !== 'completed' && status !== 'error') throw new DataWatchError('INVALID_STORAGE_ROW');
  return { id: identifier(row.id), watchId: identifier(row.watch_id), companyId: identifier(row.company_id), operationKey: identifier(row.operation_key), status,
    scheduledAt: isoDate(row.scheduled_at), startedAt: row.started_at === null ? null : isoDate(row.started_at),
    completedAt: row.completed_at === null ? null : isoDate(row.completed_at), fence: integer(row.fence, 0, 2147483647),
    leaseUntil: row.lease_until === null ? null : isoDate(row.lease_until),
    result: row.result === null ? null : validateCollectionResult(row.result), error: row.error === null ? null : string(row.error) };
}
function claimValues(claim: ClaimedOccurrence): unknown[] {
  return [identifier(claim.occurrence.id), identifier(claim.occurrence.companyId), identifier(claim.workerId), integer(claim.occurrence.fence, 1, 2147483647)];
}

export function createWatchRepository(sql: SqlPort): WatchRepository {
  async function query(text: string, values: unknown[] = []): Promise<Record<string, unknown>[]> {
    try { return (await sql.query(text, values)).rows; }
    catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' && text.includes('/* claim */')) return [];
      throw new DataWatchError('WATCH_STORAGE_ERROR');
    }
  }
  return {
    async createWatch(actor: Actor, raw: WatchInput, operationKey: string, now = new Date()): Promise<Watch> {
      assertWatchActor(actor); const input = validateWatchInput(raw); identifier(operationKey);
      const rows = await query(`INSERT INTO accel_watch_definitions
        (id, company_id, actor_id, operation_key, public_topic, source_urls, cadence_minutes, enabled, next_run_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,true,$8::timestamptz,$8::timestamptz)
        ON CONFLICT (company_id, operation_key) DO UPDATE SET operation_key = EXCLUDED.operation_key RETURNING *`,
      [stableId('watch', [actor.companyId, operationKey]), actor.companyId, actor.actorId, operationKey, input.publicTopic, JSON.stringify(input.sourceUrls), input.cadenceMinutes, isoDate(now)]);
      if (!rows[0]) throw new DataWatchError('WATCH_STORAGE_ERROR');
      const saved = watch(rows[0]);
      if (saved.actorId !== actor.actorId || saved.publicTopic !== input.publicTopic || saved.cadenceMinutes !== input.cadenceMinutes || JSON.stringify(saved.sourceUrls) !== JSON.stringify(input.sourceUrls)) throw new DataWatchError('IDEMPOTENCY_CONFLICT');
      return saved;
    },
    async listWatches(companyId: string): Promise<Watch[]> {
      return (await query('SELECT * FROM accel_watch_definitions WHERE company_id=$1 ORDER BY created_at,id LIMIT 200', [identifier(companyId)])).map(watch);
    },
    async listOccurrences(companyId: string, limit = 100): Promise<WatchOccurrence[]> {
      return (await query('SELECT * FROM accel_watch_occurrences WHERE company_id=$1 ORDER BY scheduled_at DESC,id LIMIT $2', [identifier(companyId), integer(limit, 1, 500)])).map(occurrence);
    },
    async enqueueManual(actor: Actor, watchId: string, operationKey: string, now = new Date()): Promise<WatchOccurrence> {
      assertWatchActor(actor); identifier(watchId); identifier(operationKey);
      const key = `manual:${operationKey}`; identifier(key);
      const rows = await query(`INSERT INTO accel_watch_occurrences
        (id,watch_id,company_id,operation_key,status,scheduled_at)
        SELECT $1,id,company_id,$4,'queued',$5::timestamptz FROM accel_watch_definitions WHERE id=$2 AND company_id=$3 AND enabled
        ON CONFLICT (company_id,watch_id,operation_key) DO UPDATE SET operation_key=EXCLUDED.operation_key RETURNING *`,
      [stableId('occ', [actor.companyId, watchId, key]), watchId, actor.companyId, key, isoDate(now)]);
      if (!rows[0]) throw new DataWatchError('WATCH_NOT_FOUND_OR_DISABLED');
      return occurrence(rows[0]);
    },
    async enqueueDue(now = new Date(), limit = 20): Promise<number> {
      const rows = await query(`WITH due AS MATERIALIZED (
        SELECT * FROM accel_watch_definitions WHERE enabled AND next_run_at <= $1::timestamptz
        ORDER BY next_run_at,id LIMIT $2 FOR UPDATE SKIP LOCKED
      ), inserted AS (
        INSERT INTO accel_watch_occurrences (id,watch_id,company_id,operation_key,status,scheduled_at)
        SELECT 'scheduled:'||id||':'||to_char(next_run_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS.US'), id,company_id,
          'schedule:'||to_char(next_run_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS.US'),'queued',next_run_at FROM due
        ON CONFLICT (company_id,watch_id,operation_key) DO NOTHING RETURNING id
      ), advanced AS (
        UPDATE accel_watch_definitions w SET next_run_at=w.next_run_at + make_interval(mins => w.cadence_minutes)
        FROM due WHERE w.id=due.id RETURNING w.id
      ) SELECT count(*)::integer AS count FROM inserted`, [isoDate(now), integer(limit, 1, 100)]);
      return integer(rows[0]?.count, 0, 100);
    },
    async claimNext(workerId: string, leaseMs: number, now = new Date()): Promise<ClaimedOccurrence | null> {
      const rows = await query(`/* claim */ WITH candidate AS MATERIALIZED (
        SELECT o.id FROM accel_watch_occurrences o JOIN accel_watch_definitions w ON w.id=o.watch_id AND w.company_id=o.company_id
        WHERE w.enabled AND o.scheduled_at <= $1::timestamptz AND (o.status='queued' OR (o.status='running' AND o.lease_until <= $1::timestamptz))
          AND NOT EXISTS (SELECT 1 FROM accel_watch_occurrences busy WHERE busy.watch_id=o.watch_id AND busy.company_id=o.company_id AND busy.id<>o.id AND busy.status='running')
        ORDER BY (o.status='running') DESC,o.scheduled_at,o.id LIMIT 1 FOR UPDATE OF o,w SKIP LOCKED
      ), claimed AS (
        UPDATE accel_watch_occurrences o SET status='running',worker_id=$2,fence=o.fence+1,
          lease_until=GREATEST($1::timestamptz,clock_timestamp()) + $3::integer * interval '1 millisecond',started_at=$1::timestamptz,error=NULL
        FROM candidate WHERE o.id=candidate.id RETURNING o.*
      ) SELECT claimed.*, to_jsonb(w) AS watch FROM claimed JOIN accel_watch_definitions w ON w.id=claimed.watch_id AND w.company_id=claimed.company_id`,
      [isoDate(now), identifier(workerId), integer(leaseMs, 1000, 300000)]);
      if (!rows[0]) return null;
      return { occurrence: occurrence(rows[0]), watch: watch(object(rows[0].watch)), workerId };
    },
    async renew(claim: ClaimedOccurrence, leaseMs: number, now = new Date()): Promise<boolean> {
      const rows = await query(`UPDATE accel_watch_occurrences SET lease_until=GREATEST($5::timestamptz,clock_timestamp()) + $6::integer * interval '1 millisecond'
        WHERE id=$1 AND company_id=$2 AND worker_id=$3 AND fence=$4 AND status='running' AND lease_until>GREATEST($5::timestamptz,clock_timestamp()) RETURNING id`,
      [...claimValues(claim), isoDate(now), integer(leaseMs, 1000, 300000)]);
      return rows.length === 1;
    },
    async finish(claim: ClaimedOccurrence, raw: CollectionResult, now = new Date()): Promise<WatchOccurrence | null> {
      const result = validateCollectionResult(raw);
      const profile = getSourceProfile(claim.watch.publicTopic);
      const expectedSources = [...claim.watch.sourceUrls].sort();
      if (!profile || JSON.stringify(result.sources.map((source) => source.url).sort()) !== JSON.stringify(expectedSources) || result.sources.some((source) => source.evidence.some((item) => item.provenance !== undefined && item.provenance.profileId !== profile.id))) throw new DataWatchError('INVALID_COLLECTION_SCOPE');
      const completedAt = isoDate(now);
      if (claim.occurrence.startedAt === null || result.startedAt < claim.occurrence.startedAt || result.completedAt > completedAt) throw new DataWatchError('INVALID_COLLECTION_TIME');
      const items = [...new Map(result.sources.flatMap((source) => source.evidence).map((item) => [`${item.id}:${item.contentHash}`, item])).values()];
      const rows = await query(`WITH finished AS (
        UPDATE accel_watch_occurrences SET status=$6,completed_at=$5::timestamptz,result=$7::jsonb,error=$8,lease_until=NULL,worker_id=NULL
        WHERE id=$1 AND company_id=$2 AND worker_id=$3 AND fence=$4 AND status='running' AND lease_until>GREATEST($5::timestamptz,clock_timestamp()) RETURNING *
      ), saved AS (
        INSERT INTO accel_watch_evidence (company_id,source_id,content_hash,evidence,first_seen_at,last_seen_at)
        SELECT finished.company_id,item->>'id',item->>'contentHash',item,(item->>'collectedAt')::timestamptz,(item->>'collectedAt')::timestamptz
        FROM finished CROSS JOIN jsonb_array_elements($9::jsonb) AS item
        ON CONFLICT (company_id,source_id,content_hash) DO UPDATE SET last_seen_at=GREATEST(accel_watch_evidence.last_seen_at,EXCLUDED.last_seen_at)
        RETURNING source_id
      ) SELECT * FROM finished`, [...claimValues(claim), completedAt, result.status === 'error' || result.status === 'not_run' ? 'error' : 'completed', JSON.stringify(result), result.status === 'error' || result.status === 'not_run' ? 'COLLECTION_INCOMPLETE' : null, JSON.stringify(items)]);
      return rows[0] ? occurrence(rows[0]) : null;
    },
    async fail(claim: ClaimedOccurrence, now = new Date()): Promise<WatchOccurrence | null> {
      const rows = await query(`UPDATE accel_watch_occurrences SET status='error',completed_at=$5::timestamptz,error='COLLECTION_FAILED',lease_until=NULL,worker_id=NULL
        WHERE id=$1 AND company_id=$2 AND worker_id=$3 AND fence=$4 AND status='running' AND lease_until>GREATEST($5::timestamptz,clock_timestamp()) RETURNING *`, [...claimValues(claim), isoDate(now)]);
      return rows[0] ? occurrence(rows[0]) : null;
    },
  };
}
