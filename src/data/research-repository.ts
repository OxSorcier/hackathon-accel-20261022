import { createHash } from 'node:crypto';
import type { Actor, CollectionResult, Collector, EvidenceRef, SourceEvidence, SqlPort } from '../contracts/index.ts';
import type { ResearchContext, ResearchDependency, ResearchScope, ResearchState } from '../contracts/research.ts';
import { getSourceProfileById, BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL } from '../watch/source-policy.ts';
import { withAbort } from '../watch/http.ts';
import { DataWatchError, identifier, isoDate, validateCollectionResult } from './validation.ts';

export interface ResearchStore extends SqlPort { transaction<T>(work: (client: SqlPort) => Promise<T>): Promise<T> }
export interface ResearchPolicy { profileId: string; profileVersion: string; freshForMs: number; adoptWatchIds?: readonly string[]; acceptPartialObservations?: boolean }
export interface ResearchCollection { collect: Collector; externalCalls(): number }
export interface ResearchRepositoryOptions {
  profiles: readonly ResearchPolicy[];
  createCollection: () => ResearchCollection;
  now?: () => Date;
  timeoutMs?: number;
  onGenerationChange?: (client: SqlPort, companyId: string, scope: ResearchScope, generation: number) => Promise<void>;
  authorizeServiceLookup?: (client: SqlPort, companyId: string, scope: ResearchScope, principalId: string) => Promise<boolean>;
}
export interface ResearchRepository {
  lookupForService(companyId: string, scope: ResearchScope, principalId: string): Promise<ResearchContext>;
  lookup(actor: Actor, scope: ResearchScope): Promise<ResearchContext>;
  refresh(actor: Actor, scope: ResearchScope, operationKey: string): Promise<ResearchContext>;
  ingestControlled(actor: Actor, scope: ResearchScope, evidence: SourceEvidence, operationKey: string): Promise<ResearchContext>;
  validate(companyId: string, dependencies: ResearchDependency[], client?: SqlPort): Promise<boolean>;
}
interface Projection {
  generation: number; fingerprint: string; state: ResearchState; observedAt: string | null;
  observedPublicationSeq: string;
  validUntil: string | null; occurrenceId: string | null; refs: EvidenceRef[]; conditions: string[]; reason: string;
}
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function scopeKey(companyId: string, scope: ResearchScope): string[] { return [companyId, scope.profileId, scope.profileVersion, scope.namespace]; }
function watchId(companyId: string, scope: ResearchScope): string { return `research-watch:${digest(scopeKey(companyId, scope))}`; }
function contextMetadata(value: ResearchContext): Omit<ResearchContext, 'observations'> { const { observations: _observations, ...metadata } = value; return metadata; }
function referenceKey(ref: EvidenceRef): string { return JSON.stringify([ref.occurrenceId, ref.evidenceId, ref.contentHash]); }
function publicationSequence(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value) || BigInt(value) > 9223372036854775807n) throw new DataWatchError('INVALID_RESEARCH_STORAGE');
  return value;
}

export function createResearchRepository(store: ResearchStore, options: ResearchRepositoryOptions): ResearchRepository {
  const now = options.now ?? ((): Date => new Date());
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000 || options.profiles.length === 0) throw new DataWatchError('INVALID_RESEARCH_POLICY');
  const policies = options.profiles.map((policy): ResearchPolicy => {
    identifier(policy.profileId); identifier(policy.profileVersion);
    if (!getSourceProfileById(policy.profileId) || !Number.isSafeInteger(policy.freshForMs) || policy.freshForMs < 1000 || policy.freshForMs > 2_592_000_000) throw new DataWatchError('INVALID_RESEARCH_POLICY');
    if (policy.acceptPartialObservations && (!['soissons-project', 'public-contracts'].includes(policy.profileId) || policy.profileVersion !== 'v1')) throw new DataWatchError('INVALID_RESEARCH_POLICY');
    if (policy.adoptWatchIds && (policy.adoptWatchIds.length > 20 || policy.adoptWatchIds.some((id) => !identifier(id)))) throw new DataWatchError('INVALID_RESEARCH_POLICY');
    return { ...policy, ...(policy.adoptWatchIds ? { adoptWatchIds: [...policy.adoptWatchIds] } : {}) };
  });
  if (new Set(policies.map((policy) => JSON.stringify([policy.profileId, policy.profileVersion]))).size !== policies.length) throw new DataWatchError('INVALID_RESEARCH_POLICY');
  function policyFor(scope: ResearchScope): ResearchPolicy {
    if (!scope || (scope.namespace !== 'live' && scope.namespace !== 'controlled')) throw new DataWatchError('INVALID_RESEARCH_SCOPE');
    identifier(scope.profileId); identifier(scope.profileVersion);
    const policy = policies.find((value) => value.profileId === scope.profileId && value.profileVersion === scope.profileVersion);
    if (!policy) throw new DataWatchError('RESEARCH_SCOPE_NOT_AUTHORISED');
    return policy;
  }
  function publicContractPolicy(scope: ResearchScope, policy: ResearchPolicy): boolean {
    return scope.namespace === 'live' && policy.acceptPartialObservations === true && scope.profileId === 'public-contracts' && scope.profileVersion === 'v1';
  }
  function actorFor(actor: Actor, operatorOnly = false): void {
    identifier(actor.companyId); identifier(actor.actorId);
    if (!['direction', 'achats', 'logistique', 'operator'].includes(actor.role) || (operatorOnly && actor.role !== 'operator')) throw new DataWatchError('RESEARCH_FORBIDDEN');
  }
  async function lock(client: SqlPort, companyId: string): Promise<void> {
    identifier(companyId);
    if (!(await client.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [companyId])).rows.length) throw new DataWatchError('RESEARCH_COMPANY_NOT_FOUND');
  }
  async function projection(client: SqlPort, companyId: string, scope: ResearchScope): Promise<Projection | null> {
    const row = (await client.query('SELECT * FROM accel_research_scopes WHERE company_id=$1 AND profile_id=$2 AND profile_version=$3 AND namespace=$4', scopeKey(companyId, scope))).rows[0];
    if (!row) return null;
    const generation = Number(row.generation);
    if (!Number.isSafeInteger(generation) || generation < 0) throw new DataWatchError('INVALID_RESEARCH_STORAGE');
    return { generation, fingerprint: String(row.fingerprint), state: row.state as ResearchState,
      observedPublicationSeq: publicationSequence(row.observed_publication_seq),
      observedAt: row.observed_at === null ? null : isoDate(row.observed_at), validUntil: row.valid_until === null ? null : isoDate(row.valid_until),
      occurrenceId: row.occurrence_id === null ? null : String(row.occurrence_id), refs: row.evidence_refs as EvidenceRef[], conditions: row.conditions as string[], reason: String(row.reason) };
  }
  async function save(client: SqlPort, companyId: string, scope: ResearchScope, value: Omit<Projection, 'generation'>): Promise<Projection> {
    const previous = await projection(client, companyId, scope);
    const changed = previous ? previous.fingerprint !== value.fingerprint || previous.state !== value.state : value.state !== 'missing';
    const generation = (previous?.generation ?? 0) + (changed ? 1 : 0);
    if (!Number.isSafeInteger(generation)) throw new DataWatchError('INVALID_RESEARCH_GENERATION');
    // An identical observation keeps its exact prior refs. Observation time may advance.
    const pinned = !changed && previous ? { ...value, refs: previous.refs, occurrenceId: previous.occurrenceId } : value;
    await client.query(`INSERT INTO accel_research_scopes(company_id,profile_id,profile_version,namespace,generation,fingerprint,state,observed_at,valid_until,occurrence_id,evidence_refs,conditions,reason,observed_publication_seq)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::bigint)
      ON CONFLICT(company_id,profile_id,profile_version,namespace) DO UPDATE SET generation=EXCLUDED.generation,fingerprint=EXCLUDED.fingerprint,state=EXCLUDED.state,observed_at=EXCLUDED.observed_at,valid_until=EXCLUDED.valid_until,occurrence_id=EXCLUDED.occurrence_id,evidence_refs=EXCLUDED.evidence_refs,conditions=EXCLUDED.conditions,reason=EXCLUDED.reason,observed_publication_seq=EXCLUDED.observed_publication_seq`,
    [...scopeKey(companyId, scope), generation, pinned.fingerprint, pinned.state, pinned.observedAt, pinned.validUntil, pinned.occurrenceId, JSON.stringify(pinned.refs), JSON.stringify(pinned.conditions), pinned.reason, publicationSequence(pinned.observedPublicationSeq)]);
    if (changed && options.onGenerationChange) await options.onGenerationChange(client, companyId, scope, generation);
    return { ...pinned, generation };
  }
  async function asContext(client: SqlPort, companyId: string, scope: ResearchScope, value: Projection, reused = false, externalCalls = 0): Promise<ResearchContext> {
    let items: SourceEvidence[] = [];
    if (value.occurrenceId) {
      const row = (await client.query('SELECT result FROM accel_watch_occurrences WHERE company_id=$1 AND id=$2', [companyId, value.occurrenceId])).rows[0];
      if (!row) throw new DataWatchError('INVALID_RESEARCH_STORAGE');
      items = checkedResult(row.result as CollectionResult, scope).sources.flatMap((source) => source.evidence);
    }
    const observations = value.refs.map((ref) => {
      const evidence = items.find((item) => item.id === ref.evidenceId && item.contentHash === ref.contentHash);
      if (!evidence || ref.occurrenceId !== value.occurrenceId || evidence.mode !== (scope.namespace === 'live' ? 'direct' : 'test') || evidence.provenance?.profileId !== scope.profileId) throw new DataWatchError('INVALID_RESEARCH_STORAGE');
      return { ref, evidence, qualification: 'source_observation_only' as const, testOnly: scope.namespace === 'controlled', conditions: [...value.conditions] };
    });
    return { companyId, scope: { ...scope }, generation: value.generation, state: value.state, checkedAt: now().toISOString(), validUntil: value.state === 'reusable' ? value.validUntil : null,
      occurrenceId: value.occurrenceId, observations, conditions: [...value.conditions], reason: value.reason, reused, externalCalls };
  }
  async function current(client: SqlPort, companyId: string, scope: ResearchScope): Promise<ResearchContext> {
    const policy = policyFor(scope);
    let value = await projection(client, companyId, scope);
    if (!value) {
      const boundary = publicationSequence((await client.query('SELECT historical_seq FROM accel_research_publication_boundary WHERE singleton')).rows[0]?.historical_seq);
      const historical = scope.namespace === 'live' && policy.adoptWatchIds?.length && (await client.query(`SELECT 1 FROM accel_watch_occurrences WHERE company_id=$1 AND watch_id=ANY($2::text[]) AND publication_seq <= $3::bigint LIMIT 1`, [companyId, [...policy.adoptWatchIds], boundary])).rows.length > 0;
      value = await save(client, companyId, scope, { fingerprint: digest(historical ? ['historical-boundary', boundary] : ['missing']), state: historical ? 'stale' : 'missing', observedAt: null, observedPublicationSeq: boundary, validUntil: null, occurrenceId: null, refs: [], conditions: historical ? ['HISTORICAL_PUBLICATION_ORDER_UNVERIFIED', 'REFRESH_REQUIRED_AFTER_ORDER_MIGRATION'] : ['NO_RECEIVED_RESEARCH'], reason: historical ? 'Historical publication order was not established. Refresh or reconcile before reuse.' : 'No observation received in this exact company/profile/version/namespace.' });
    }
    const active = (await client.query(`SELECT status,expires_at FROM accel_research_commands WHERE company_id=$1 AND profile_id=$2 AND profile_version=$3 AND namespace=$4 AND status IN ('intent','uncertain') ORDER BY created_at DESC LIMIT 1`, scopeKey(companyId, scope))).rows[0];
    if (active) {
      if (active.status === 'intent' && Date.parse(isoDate(active.expires_at)) <= now().getTime()) await client.query(`UPDATE accel_research_commands SET status='uncertain' WHERE company_id=$1 AND profile_id=$2 AND profile_version=$3 AND namespace=$4 AND status='intent'`, scopeKey(companyId, scope));
      return await asContext(client, companyId, scope, value, false, 0);
    }
    if (scope.namespace === 'live' && policy.adoptWatchIds?.length) {
      const latest = (await client.query(`SELECT o.id,o.result,o.completed_at,o.status,o.error,o.publication_seq FROM accel_watch_occurrences o JOIN accel_watch_definitions w ON w.id=o.watch_id AND w.company_id=o.company_id
        WHERE o.company_id=$1 AND o.watch_id=ANY($2::text[]) AND o.publication_seq > $3::bigint AND o.status IN ('completed','error')
        ORDER BY o.publication_seq DESC LIMIT 1`, [companyId, [...policy.adoptWatchIds], value.observedPublicationSeq])).rows[0];
      if (latest) {
        const candidateAt = latest.completed_at === null ? null : isoDate(latest.completed_at);
        const sequence = publicationSequence(latest.publication_seq);
        let candidate: Omit<Projection, 'generation'> | null = null;
        if (latest.status === 'error' && latest.result === null) {
          candidate = { state: 'error', fingerprint: digest(['failed-adoption', latest.id, latest.error]), observedAt: candidateAt, observedPublicationSeq: sequence, validUntil: null, occurrenceId: null, refs: [], conditions: ['ADOPTED_COLLECTION_FAILED', 'NO_CURRENT_RECEIVED_RESULT'], reason: 'The latest adopted collection failed without a received result. Earlier source versions remain historical.' };
        } else try {
          const result = checkedResult(latest.result as CollectionResult, scope);
          // Explicit adoption is server-bound to this profile version. No content is copied.
          candidate = projected(result, scope, String(latest.id), sequence);
        } catch (error: unknown) {
          if (!(error instanceof DataWatchError)) throw error;
          candidate = { state: 'error', fingerprint: digest(['invalid-adoption', latest.id, error.code]), observedAt: candidateAt, observedPublicationSeq: sequence, validUntil: null, occurrenceId: null, refs: [], conditions: ['INVALID_ADOPTED_SOURCE_RESULT'], reason: 'The received source result is invalid or ambiguous. No observation is reusable.' };
        }
        if (candidate) value = await save(client, companyId, scope, candidate);
      }
    }
    if (publicContractPolicy(scope, policy) && value.occurrenceId && !value.conditions.includes('PUBLIC_NOTICE_LEAD_NOT_QUALIFIED_CRM_DEMAND')) {
      const boundary = publicationSequence((await client.query('SELECT historical_seq FROM accel_research_publication_boundary WHERE singleton')).rows[0]?.historical_seq);
      if (BigInt(value.observedPublicationSeq) > BigInt(boundary)) {
        const row = (await client.query('SELECT result FROM accel_watch_occurrences WHERE company_id=$1 AND id=$2', [companyId, value.occurrenceId])).rows[0];
        const result = checkedResult(row?.result as CollectionResult, scope);
        const candidate = projected(result, scope, value.occurrenceId, value.observedPublicationSeq, value.observedAt ?? result.completedAt);
        if (value.state === 'stale' && candidate.state === 'reusable') { candidate.state = 'stale'; candidate.validUntil = null; candidate.conditions.push('REFRESH_REQUIRED'); }
        value = await save(client, companyId, scope, candidate);
      }
    }
    if (value.state === 'reusable' && value.validUntil !== null && Date.parse(value.validUntil) <= now().getTime()) value = await save(client, companyId, scope, { ...value, state: 'stale', conditions: [...value.conditions, 'FRESHNESS_EXPIRED'], reason: 'Observation freshness expired; refresh before using it.' });
    return await asContext(client, companyId, scope, value);
  }
  async function existing(client: SqlPort, actor: Actor, scope: ResearchScope, key: string, hash: string): Promise<ResearchContext | null> {
    const command = (await client.query('SELECT request_hash FROM accel_research_commands WHERE company_id=$1 AND operation_key=$2', [actor.companyId, key])).rows[0];
    if (!command) return null;
    if (command.request_hash !== hash) throw new DataWatchError('RESEARCH_IDEMPOTENCY_CONFLICT');
    return { ...await current(client, actor.companyId, scope), reused: true, externalCalls: 0 };
  }
  async function ensureWatch(client: SqlPort, actor: Actor, scope: ResearchScope): Promise<string> {
    const profile = getSourceProfileById(scope.profileId); if (!profile) throw new DataWatchError('RESEARCH_SCOPE_NOT_AUTHORISED');
    const id = watchId(actor.companyId, scope);
    await client.query(`INSERT INTO accel_watch_definitions(id,company_id,actor_id,operation_key,public_topic,source_urls,cadence_minutes,enabled,next_run_at,created_at)
      VALUES($1,$2,$3,$4,$5,$6,10080,false,$7,$7) ON CONFLICT(id) DO NOTHING`, [id, actor.companyId, actor.actorId, `research:${digest(scopeKey(actor.companyId, scope))}`, profile.publicTopic, JSON.stringify(profile.sourceUrls), now().toISOString()]);
    return id;
  }
  function checkedResult(raw: CollectionResult, scope: ResearchScope): CollectionResult {
    const result = validateCollectionResult(raw); const profile = getSourceProfileById(scope.profileId); if (!profile) throw new DataWatchError('INVALID_RESEARCH_SCOPE');
    const identities = result.sources.flatMap((source) => source.evidence).map((item) => JSON.stringify([item.id, item.contentHash]));
    if (new Set(identities).size !== identities.length) throw new DataWatchError('INVALID_RESEARCH_DUPLICATE_IDENTITY');
    if (JSON.stringify(result.sources.map((source) => source.url).sort()) !== JSON.stringify([...profile.sourceUrls].sort()) || result.sources.flatMap((source) => source.evidence).length > 10 || result.sources.some((source) => source.evidence.some((item) => item.mode !== (scope.namespace === 'live' ? 'direct' : 'test') || item.provenance?.profileId !== scope.profileId))) throw new DataWatchError('INVALID_RESEARCH_RESULT_SCOPE');
    if (Date.parse(result.completedAt) > now().getTime()) throw new DataWatchError('INVALID_RESEARCH_RESULT_TIME');
    return result;
  }
  function projected(result: CollectionResult, scope: ResearchScope, occurrenceId: string, sequence: string, observedAt = result.completedAt): Omit<Projection, 'generation'> {
    const policy = policyFor(scope);
    const items = result.sources.flatMap((source) => source.evidence).sort((a, b) => a.id.localeCompare(b.id) || a.contentHash.localeCompare(b.contentHash));
    const partialAccepted = scope.namespace === 'live' && policy.acceptPartialObservations === true && result.status === 'partial';
    const publicContracts = publicContractPolicy(scope, policy);
    const selected = publicContracts ? items.filter((item) => item.dataOrigin === 'public' && item.mode === 'direct' && item.provenance?.provider === 'boamp' && item.provenance.method === 'api_record' && item.provenance.profileId === 'public-contracts' && item.provenance.truncated === false && item.publishedAt !== null)
      : partialAccepted ? items.filter((item) => item.provenance?.method === 'fetch' && item.provenance.truncated === false) : items;
    const baseState: ResearchState = (result.status === 'success' && (!publicContracts || selected.length > 0)) || (partialAccepted && selected.length > 0) ? 'reusable' : result.status === 'partial' || (publicContracts && result.status === 'success') ? 'partial' : result.status === 'empty' ? 'empty' : 'error';
    const expiry = new Date(Date.parse(observedAt) + policy.freshForMs).toISOString();
    const stale = baseState === 'reusable' && Date.parse(expiry) <= now().getTime();
    return { state: stale ? 'stale' : baseState,
      fingerprint: digest([result.status, result.sources.map((source) => [source.url, source.status, source.error]).sort(),
        items.map((item) => [item.id, item.contentHash, item.url, item.title, item.publishedAt, item.mode, item.family, item.regulation ?? null,
          item.provenance?.provider, item.provenance?.profileId, item.provenance?.method, item.provenance?.truncated]),
        selected.map((item) => [item.id, item.contentHash])]),
      observedAt, observedPublicationSeq: sequence, validUntil: baseState === 'reusable' ? expiry : null, occurrenceId,
      refs: selected.map((item): EvidenceRef => ({ occurrenceId, evidenceId: item.id, contentHash: item.contentHash })),
      conditions: ['SOURCE_OBSERVATION_ONLY', 'COMPANY_RELATION_AND_APPLICABILITY_UNVERIFIED', 'PUBLISHER_FRESHNESS_NOT_VERIFIED', ...(result.status === 'partial' || publicContracts ? ['PARTIAL_SOURCE_SET'] : []), ...(publicContracts ? ['PUBLIC_NOTICE_LEAD_NOT_QUALIFIED_CRM_DEMAND'] : []), ...(scope.namespace === 'controlled' ? ['CONTROLLED_TEST_NOT_A_PUBLIC_FACT'] : []), ...(baseState === 'reusable' ? [] : ['COLLECTION_NOT_COMPLETE']), ...(stale ? ['FRESHNESS_EXPIRED'] : [])],
      reason: stale ? 'Observation freshness expired; refresh before using it.' : baseState === 'reusable' ? 'Received source observations within the server freshness policy; no business fact inferred.' : `Received collection state: ${result.status}.` };
  }
  async function receive(client: SqlPort, actor: Actor, scope: ResearchScope, key: string, result: CollectionResult, calls: number): Promise<ResearchContext> {
    const id = `research-occurrence:${digest([actor.companyId, key])}`; const watch = await ensureWatch(client, actor, scope);
    const published = (await client.query(`INSERT INTO accel_watch_occurrences(id,watch_id,company_id,operation_key,status,scheduled_at,started_at,completed_at,result)
      VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING publication_seq`, [id, watch, actor.companyId, `research:${digest(key)}`, result.status === 'error' || result.status === 'not_run' ? 'error' : 'completed', result.startedAt, result.completedAt, JSON.stringify(result)])).rows[0];
    const sequence = publicationSequence(published?.publication_seq);
    const items = result.sources.flatMap((source) => source.evidence).sort((a, b) => a.id.localeCompare(b.id) || a.contentHash.localeCompare(b.contentHash));
    for (const item of items) await client.query(`INSERT INTO accel_watch_evidence(company_id,source_id,content_hash,evidence,first_seen_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$5)
      ON CONFLICT(company_id,source_id,content_hash) DO UPDATE SET last_seen_at=GREATEST(accel_watch_evidence.last_seen_at,EXCLUDED.last_seen_at)`, [actor.companyId, item.id, item.contentHash, JSON.stringify(item), item.collectedAt]);
    const value = await save(client, actor.companyId, scope, projected(result, scope, id, sequence));
    const context = await asContext(client, actor.companyId, scope, value, false, calls);
    await client.query(`UPDATE accel_research_commands SET status='done',receipt=$3 WHERE company_id=$1 AND operation_key=$2`, [actor.companyId, key, JSON.stringify(contextMetadata(context))]);
    return context;
  }
  return {
    async lookupForService(companyId, scope, principalId): Promise<ResearchContext> {
      identifier(companyId); identifier(principalId); policyFor(scope);
      const authorize = options.authorizeServiceLookup;
      if (scope.namespace !== 'live' || !authorize) throw new DataWatchError('RESEARCH_SERVICE_FORBIDDEN');
      return await store.transaction(async (client) => {
        await lock(client, companyId);
        if (await authorize(client, companyId, scope, principalId) !== true) throw new DataWatchError('RESEARCH_SERVICE_FORBIDDEN');
        const value = await current(client, companyId, scope);
        return { ...value, reused: value.state === 'reusable' };
      });
    },
    async lookup(actor, scope): Promise<ResearchContext> { actorFor(actor); policyFor(scope); return await store.transaction(async client => { await lock(client, actor.companyId); const value = await current(client, actor.companyId, scope); return { ...value, reused: value.state === 'reusable' }; }); },
    async refresh(actor, scope, operationKey): Promise<ResearchContext> {
      actorFor(actor); policyFor(scope); identifier(operationKey);
      if (actor.role === 'logistique') throw new DataWatchError('RESEARCH_FORBIDDEN');
      const hash = digest(['refresh', actor.actorId, scopeKey(actor.companyId, scope)]);
      const prior = await store.transaction(async client => {
        await lock(client, actor.companyId);
        const duplicate = await existing(client, actor, scope, operationKey, hash); if (duplicate) return duplicate;
        const value = await current(client, actor.companyId, scope);
        if (value.state === 'reusable') {
          const cached = { ...value, reused: true };
          await client.query(`INSERT INTO accel_research_commands(company_id,operation_key,actor_id,profile_id,profile_version,namespace,request_hash,status,created_at,expires_at,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,'done',$8,$8,$9)`, [actor.companyId, operationKey, actor.actorId, scope.profileId, scope.profileVersion, scope.namespace, hash, now().toISOString(), JSON.stringify(contextMetadata(cached))]);
          return cached;
        }
        if (scope.namespace === 'controlled' || value.state === 'uncertain') return value;
        const previous = await projection(client, actor.companyId, scope); if (!previous) throw new DataWatchError('INVALID_RESEARCH_STORAGE');
        await save(client, actor.companyId, scope, { ...previous, state: 'uncertain', validUntil: null, conditions: [...previous.conditions, 'EXTERNAL_ATTEMPT_IN_PROGRESS_OR_INTERRUPTED'], reason: 'Durable collection intent recorded. Do not retry an interrupted attempt automatically.' });
        await client.query(`INSERT INTO accel_research_commands(company_id,operation_key,actor_id,profile_id,profile_version,namespace,request_hash,status,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'intent',$8,$9)`, [actor.companyId, operationKey, actor.actorId, scope.profileId, scope.profileVersion, scope.namespace, hash, now().toISOString(), new Date(now().getTime() + timeoutMs + 1000).toISOString()]);
        return null;
      });
      if (prior) return prior;
      const abort = new AbortController(); const timer = setTimeout((): void => { abort.abort(); }, timeoutMs); let attempt: ResearchCollection | undefined;
      try {
        attempt = options.createCollection();
        const profile = getSourceProfileById(scope.profileId); if (!profile) throw new DataWatchError('INVALID_RESEARCH_SCOPE');
        const result = checkedResult(await withAbort(attempt.collect({ publicTopic: profile.publicTopic, sourceUrls: [...profile.sourceUrls], signal: abort.signal }), abort.signal), scope);
        const calls = attempt.externalCalls(); if (!Number.isSafeInteger(calls) || calls < 0 || calls > 100) throw new DataWatchError('INVALID_RESEARCH_CALL_COUNT');
        return await store.transaction(async client => {
          await lock(client, actor.companyId);
          const command = (await client.query('SELECT status,expires_at FROM accel_research_commands WHERE company_id=$1 AND operation_key=$2', [actor.companyId, operationKey])).rows[0];
          if (!command || command.status !== 'intent' || Date.parse(isoDate(command.expires_at)) <= now().getTime()) throw new DataWatchError('RESEARCH_INTENT_EXPIRED');
          return await receive(client, actor, scope, operationKey, result, calls);
        });
      } catch {
        return await store.transaction(async client => {
          await lock(client, actor.companyId);
          const command = (await client.query('SELECT status FROM accel_research_commands WHERE company_id=$1 AND operation_key=$2', [actor.companyId, operationKey])).rows[0];
          if (command?.status === 'done') return await current(client, actor.companyId, scope);
          await client.query(`UPDATE accel_research_commands SET status='uncertain' WHERE company_id=$1 AND operation_key=$2`, [actor.companyId, operationKey]);
          const value = await current(client, actor.companyId, scope);
          const calls = attempt?.externalCalls();
          return { ...value, conditions: [...value.conditions, 'RECONCILE_INTERRUPTED_COLLECTION_BEFORE_RETRY'], externalCalls: Number.isSafeInteger(calls) && calls !== undefined && calls >= 0 && calls <= 100 ? calls : 0 };
        });
      } finally { clearTimeout(timer); abort.abort(); }
    },
    async ingestControlled(actor, scope, evidence, operationKey): Promise<ResearchContext> {
      actorFor(actor, true); policyFor(scope); identifier(operationKey);
      if (scope.namespace !== 'controlled' || evidence.mode !== 'test' || !evidence.content.startsWith('CONTROLLED TEST')) throw new DataWatchError('CONTROLLED_RESEARCH_REQUIRED');
      const profile = getSourceProfileById(scope.profileId); if (!profile) throw new DataWatchError('INVALID_RESEARCH_SCOPE');
      const sourceUrl = evidence.provenance?.provider === 'boamp' ? BOAMP_SOURCE_URL : KEENABLE_SOURCE_URL;
      const result = checkedResult({ status: 'success', sources: profile.sourceUrls.map((url) => ({ url, status: url === sourceUrl ? 'success' : 'empty', evidence: url === sourceUrl ? [evidence] : [], error: null })), startedAt: evidence.collectedAt, completedAt: now().toISOString() }, scope);
      const hash = digest(['controlled', actor.actorId, scopeKey(actor.companyId, scope), result.sources.map((source) => source.evidence)]);
      return await store.transaction(async client => {
        await lock(client, actor.companyId);
        const duplicate = await existing(client, actor, scope, operationKey, hash); if (duplicate) return duplicate;
        await current(client, actor.companyId, scope);
        await client.query(`INSERT INTO accel_research_commands(company_id,operation_key,actor_id,profile_id,profile_version,namespace,request_hash,status,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'intent',$8,$8)`, [actor.companyId, operationKey, actor.actorId, scope.profileId, scope.profileVersion, scope.namespace, hash, now().toISOString()]);
        return await receive(client, actor, scope, operationKey, result, 0);
      });
    },
    async validate(companyId, dependencies, client): Promise<boolean> {
      identifier(companyId);
      if (!Array.isArray(dependencies) || dependencies.length > 10) return false;
      const check = async (connection: SqlPort): Promise<boolean> => {
        await lock(connection, companyId);
        for (const dep of dependencies) {
          let inputValidity: string | null;
          try {
            if (typeof dep !== 'object' || dep === null) return false;
            policyFor(dep.scope);
            if (!Number.isSafeInteger(dep.generation) || dep.generation < 0 || !Array.isArray(dep.evidenceRefs) || dep.evidenceRefs.length > 10) return false;
            if (dep.evidenceRefs.some((ref) => !ref || typeof ref.occurrenceId !== 'string' || typeof ref.evidenceId !== 'string' || typeof ref.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(ref.contentHash))) return false;
            inputValidity = dep.validUntil === null ? null : isoDate(dep.validUntil);
          } catch (error: unknown) { if (error instanceof DataWatchError) return false; throw error; }
          // Storage and invalidation failures must escape so the caller rolls back publication.
          const value = await current(connection, companyId, dep.scope);
          if (value.generation !== dep.generation || JSON.stringify(value.observations.map((item) => referenceKey(item.ref)).sort()) !== JSON.stringify(dep.evidenceRefs.map(referenceKey).sort())) return false;
          if (value.state === 'reusable' && (inputValidity === null || value.validUntil === null || Date.parse(inputValidity) <= now().getTime() || Date.parse(inputValidity) > Date.parse(value.validUntil))) return false;
          if (value.state !== 'reusable' && inputValidity !== null) return false;
        }
        return true;
      };
      return client ? await check(client) : await store.transaction(check);
    },
  };
}
