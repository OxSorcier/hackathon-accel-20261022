import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { Actor, CollectionResult, SourceEvidence, SqlPort, SqlResult } from '../../src/contracts/index.ts';
import type { ResearchContext, ResearchDependency, ResearchScope } from '../../src/contracts/research.ts';
import { createResearchRepository, type ResearchRepository, type ResearchRepositoryOptions, type ResearchStore } from '../../src/data/research-repository.ts';
import { createWatchRepository } from '../../src/data/watch-repository.ts';
import { DataWatchError } from '../../src/data/validation.ts';
import { KEENABLE_SOURCE_URL } from '../../src/watch/source-policy.ts';

const schema = `research_test_${randomUUID().replaceAll('-', '')}`;
const scope: ResearchScope = { profileId: 'soissons-project', profileVersion: 'v1', namespace: 'controlled' };
const live: ResearchScope = { ...scope, namespace: 'live' };
const actor: Actor = { actorId: 'EMP-PAUL', companyId: 'CO-RESEARCH-A', role: 'direction', approvalCeilingEur: 2000 };
const operator: Actor = { ...actor, role: 'operator' };
let pool: Pool; let admin: Pool; let time: Date; let store: ResearchStore; let calls: number; let created = false;
function port(client: Pool | PoolClient): SqlPort {
  return { async query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> { const result = await client.query<T>(text, values); return { rows: result.rows, rowCount: result.rowCount }; } };
}
function evidence(version: string, mode: 'test' | 'direct' = 'test', suffix = ''): SourceEvidence {
  const url = `https://www.rockwool.com/fr/soissons/actualites/controlled-test-memory${suffix}/`;
  const content = `${mode === 'test' ? 'CONTROLLED TEST' : 'SIMULATED HTTP RESPONSE'}, not an actual publisher statement. Source version ${version}. No company supplier relation established.`;
  return { id: `keenable:${createHash('sha256').update(url).digest('hex')}`, url, title: 'Controlled source fixture', content,
    publishedAt: null, collectedAt: time.toISOString(), contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode, family: 'supplier',
    provenance: { provider: 'keenable', method: 'fetch', endpoint: 'https://api.keenable.ai/v1/fetch/public', profileId: scope.profileId, indexedAt: null, truncated: false } };
}
function collection(items: SourceEvidence[], status: CollectionResult['status'] = 'success'): CollectionResult {
  return { status, sources: [{ url: KEENABLE_SOURCE_URL, status, evidence: items, error: status === 'partial' ? 'BOUNDED_SOURCE_SET' : null }], startedAt: time.toISOString(), completedAt: time.toISOString() };
}
function dependency(context: ResearchContext): ResearchDependency { return { scope: context.scope, generation: context.generation, validUntil: context.validUntil, evidenceRefs: context.observations.map((item) => item.ref) }; }
function repository(overrides: Partial<ResearchRepositoryOptions> = {}): ResearchRepository {
  return createResearchRepository(store, { profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000 }, { profileId: scope.profileId, profileVersion: 'v2', freshForMs: 60_000 }],
    now: (): Date => time, createCollection: () => { let count = 0; return { externalCalls: (): number => count, collect: async (): Promise<CollectionResult> => { calls++; count += 3; return collection([evidence('live-v1', 'direct')]); } }; }, ...overrides });
}

describe.skipIf(!process.env.DATA_WATCH_TEST_DATABASE_URL)('Research memory, disposable real local PostgreSQL', (): void => {
  beforeAll(async (): Promise<void> => {
    const connectionString = process.env.DATA_WATCH_TEST_DATABASE_URL; assert.ok(connectionString);
    admin = new Pool({ connectionString, max: 1 }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE companies(company_id text PRIMARY KEY)');
    await pool.query(await readFile(new URL('../../proposals/data/watch-schema.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../../proposals/data/research-schema.sql', import.meta.url), 'utf8'));
    await pool.query('BEGIN');
    await pool.query(await readFile(new URL('../../proposals/data/research-publication-order.sql', import.meta.url), 'utf8'));
    await pool.query('COMMIT');
    store = { query: async <T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> => await port(pool).query<T>(text, values),
      async transaction<T>(work: (client: SqlPort) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(port(client)); await client.query('COMMIT'); return value; } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } } };
  });
  beforeEach(async (): Promise<void> => {
    await pool.query('TRUNCATE accel_research_commands,accel_research_scopes,accel_watch_evidence,accel_watch_occurrences,accel_watch_definitions,companies');
    await pool.query("INSERT INTO companies VALUES('CO-RESEARCH-A'),('CO-RESEARCH-B')"); time = new Date(); calls = 0;
  });
  afterAll(async (): Promise<void> => { if (pool) await pool.end(); if (admin) { try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin.end(); } } });

  test('missing generation0 stays valid until exact scope receives evidence', async (): Promise<void> => {
    const repo = repository(); const missing = await repo.lookup(actor, scope); assert.equal(missing.state, 'missing'); assert.equal(missing.generation, 0);
    assert.equal(await repo.validate(actor.companyId, [dependency(missing)]), true);
    await repo.ingestControlled(operator, scope, evidence('v1'), 'receive-v1');
    assert.equal(await repo.validate(actor.companyId, [dependency(missing)]), false);
    assert.equal((await repo.lookup({ ...actor, companyId: 'CO-RESEARCH-B' }, scope)).generation, 0);
  });

  test('R1 reconnect and new repository recover controlled knowledge without reinjecting its answer or external calls', async (): Promise<void> => {
    const first = await repository().ingestControlled(operator, scope, evidence('v1'), 'receive-v1');
    await pool.end(); pool = new Pool({ connectionString: process.env.DATA_WATCH_TEST_DATABASE_URL, max: 8, options: `-c search_path=${schema}` });
    const restarted = repository(); const read = await restarted.lookup(actor, scope);
    assert.equal(read.state, 'reusable'); assert.equal(read.observations[0]?.evidence.contentHash, first.observations[0]?.evidence.contentHash);
    assert.deepEqual(read.observations.map((item) => item.ref), first.observations.map((item) => item.ref)); assert.equal(read.observations[0]?.testOnly, true);
    const reused = await restarted.refresh(actor, scope, 'new-session'); assert.equal(reused.reused, true); assert.equal(reused.externalCalls, 0); assert.equal(calls, 0);
    assert.equal((await restarted.lookup(actor, live)).state, 'missing');
  });

  test('R2 changed source retains v1/v2, invalidates old dependency and identical v2 does not create a new generation', async (): Promise<void> => {
    const changes: number[] = []; const repo = repository({ onGenerationChange: async (client, companyId, _scope, generation): Promise<void> => {
      assert.equal((await client.query('SELECT company_id FROM companies WHERE company_id=$1', [companyId])).rows.length, 1); changes.push(generation);
    } });
    const first = await repo.ingestControlled(operator, scope, evidence('v1'), 'v1'); const second = await repo.ingestControlled(operator, scope, evidence('v2'), 'v2');
    assert.ok(second.generation > first.generation); assert.equal(first.observations[0]?.evidence.id, second.observations[0]?.evidence.id);
    assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false); assert.equal(await repo.validate(actor.companyId, [dependency(second)]), true);
    const same = await repo.ingestControlled(operator, scope, evidence('v2'), 'same-v2'); assert.equal(same.generation, second.generation); assert.deepEqual(same.observations.map((item) => item.ref), second.observations.map((item) => item.ref));
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_watch_evidence')).rows[0]?.count, 2); assert.deepEqual(changes, [1, 2]);
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_watch_occurrences')).rows[0]?.count, 3);
  });

  test('scope version, company, namespace and operator guards prevent cross-context reuse', async (): Promise<void> => {
    const repo = repository(); const value = await repo.ingestControlled(operator, scope, evidence('v1'), 'v1');
    assert.equal((await repo.lookup(actor, { ...scope, profileVersion: 'v2' })).state, 'missing');
    assert.equal((await repo.lookup({ ...actor, companyId: 'CO-RESEARCH-B' }, scope)).observations.length, 0);
    assert.equal(await repo.validate('CO-RESEARCH-B', [dependency(value)]), false);
    await assert.rejects(repo.lookup(actor, { ...scope, profileId: 'homonym-supplier' }), /RESEARCH_SCOPE_NOT_AUTHORISED/);
    await assert.rejects(repo.ingestControlled(actor, scope, evidence('v2'), 'forbidden'), /RESEARCH_FORBIDDEN/);
    await assert.rejects(repo.ingestControlled(operator, live, evidence('v2'), 'wrong-namespace'), /CONTROLLED_RESEARCH_REQUIRED/);
    await assert.rejects(repo.ingestControlled(operator, scope, { ...evidence('v2'), mode: 'direct' }, 'wrong-mode'), /CONTROLLED_RESEARCH_REQUIRED/);
    assert.equal(calls, 0);
  });

  test('durable intent precedes collection outside transaction; fresh live reuse performs zero extra collection', async (): Promise<void> => {
    const repo = repository({ createCollection: () => { let count = 0; return { externalCalls: (): number => count, collect: async (): Promise<CollectionResult> => {
      calls++; count += 2;
      assert.equal((await pool.query("SELECT status FROM accel_research_commands WHERE operation_key='live-v1'")).rows[0]?.status, 'intent');
      const client = await pool.connect(); try { await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout='100ms'"); await client.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [actor.companyId]); await client.query('COMMIT'); } finally { client.release(); }
      return collection([evidence('live-v1', 'direct')]);
    } }; } });
    const first = await repo.refresh(actor, live, 'live-v1'); assert.equal(first.state, 'reusable'); assert.equal(first.externalCalls, 2);
    const second = await repository().refresh(actor, live, 'new-run'); assert.equal(second.state, 'reusable'); assert.equal(second.reused, true); assert.equal(second.externalCalls, 0); assert.equal(calls, 1);
    assert.deepEqual(second.observations.map((item) => item.ref), first.observations.map((item) => item.ref));
    await assert.rejects(repo.refresh({ ...actor, actorId: 'EMP-OTHER' }, live, 'new-run'), /RESEARCH_IDEMPOTENCY_CONFLICT/);
  });

  test('expired context can be consulted with null validity but cannot validate the old fresh dependency', async (): Promise<void> => {
    const repo = repository(); const first = await repo.refresh(actor, live, 'live-v1'); time = new Date(time.getTime() + 61_000);
    const stale = await repo.lookup(actor, live); assert.equal(stale.state, 'stale'); assert.equal(stale.validUntil, null);
    assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false); assert.equal(await repo.validate(actor.companyId, [dependency(stale)]), true);
    const refreshed = await repo.refresh(actor, live, 'live-v2'); assert.equal(refreshed.state, 'reusable'); assert.equal(calls, 2);
  });

  test('interrupted collector becomes durable uncertain and neither replay nor a new run retries automatically', async (): Promise<void> => {
    const repo = repository({ timeoutMs: 10, createCollection: () => ({ externalCalls: (): number => 1, collect: async (): Promise<CollectionResult> => { calls++; return await new Promise<CollectionResult>((): void => {}); } }) });
    const result = await repo.refresh(actor, live, 'interrupted'); assert.equal(result.state, 'uncertain'); assert.equal(result.externalCalls, 1);
    const restarted = repository(); assert.equal((await restarted.lookup(actor, live)).state, 'uncertain');
    assert.equal((await restarted.refresh(actor, live, 'interrupted')).state, 'uncertain'); assert.equal((await restarted.refresh(actor, live, 'new-run')).state, 'uncertain'); assert.equal(calls, 1);
    assert.equal((await pool.query("SELECT count(*)::integer AS count FROM accel_research_commands WHERE status='uncertain'")).rows[0]?.count, 1);
  });

  test('simultaneous refresh records only one external intent and one collection', async (): Promise<void> => {
    const repo = repository(); const results = await Promise.all([repo.refresh(actor, live, 'one'), repo.refresh(actor, live, 'two')]);
    assert.equal(calls, 1); assert.ok(results.some((value) => value.state === 'reusable')); assert.equal((await repo.lookup(actor, live)).state, 'reusable');
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_research_commands')).rows[0]?.count, 1);
  });

  test('explicit adoption reuses existing partial source pages without a new raw body or HTTP call', async (): Promise<void> => {
    const watchRepo = createWatchRepository(port(pool)); const watch = await watchRepo.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'existing-watch', time);
    await watchRepo.enqueueManual(actor, watch.id, 'existing-source', time); const claim = await watchRepo.claimNext('fixture-worker', 60_000, time); assert.ok(claim);
    const page = evidence('live-v1', 'direct'); const snippet = evidence('snippet', 'direct', '-snippet'); snippet.provenance = { ...snippet.provenance!, method: 'search_snippet', endpoint: KEENABLE_SOURCE_URL };
    await watchRepo.finish(claim, collection([page, snippet], 'partial'), time);
    const countBefore = (await pool.query('SELECT count(*)::integer AS count FROM accel_watch_evidence')).rows[0]?.count;
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 86_400_000, adoptWatchIds: [watch.id], acceptPartialObservations: true }] });
    const context = await repo.lookup(actor, live); assert.equal(context.state, 'reusable'); assert.equal(context.observations.length, 1); assert.ok(context.conditions.includes('PARTIAL_SOURCE_SET'));
    assert.equal(context.observations[0]?.ref.occurrenceId, claim.occurrence.id); assert.equal(context.observations[0]?.evidence.contentHash, page.contentHash);
    assert.equal((await repo.refresh(actor, live, 'use-existing')).externalCalls, 0); assert.equal(calls, 0);
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_watch_evidence')).rows[0]?.count, countBefore);
    assert.equal((await repo.lookup(actor, scope)).state, 'missing');
  });

  test('adoption changes generation when the admissible Fetch subset changes with identical id/hash', async (): Promise<void> => {
    const watchRepo = createWatchRepository(port(pool)); const watch = await watchRepo.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'subset-watch', time);
    const publish = async (key: string, items: SourceEvidence[]): Promise<void> => {
      await watchRepo.enqueueManual(actor, watch.id, key, time); const claim = await watchRepo.claimNext('subset-worker', 60_000, time); assert.ok(claim); await watchRepo.finish(claim, collection(items, 'partial'), time);
    };
    const a = evidence('unchanged-a', 'direct', '-a'); const b = evidence('unchanged-b', 'direct', '-b');
    const excerpt = (item: SourceEvidence): SourceEvidence => ({ ...item, collectedAt: time.toISOString(), provenance: { ...item.provenance!, method: 'search_snippet', endpoint: KEENABLE_SOURCE_URL } });
    await publish('one', [a, excerpt(b)]);
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id], acceptPartialObservations: true }] });
    const first = await repo.lookup(actor, live); assert.equal(first.observations[0]?.evidence.id, a.id);
    time = new Date(time.getTime() + 1000); await publish('two', [excerpt(a), { ...b, collectedAt: time.toISOString() }]);
    const second = await repo.lookup(actor, live); assert.ok(second.generation > first.generation); assert.equal(second.observations[0]?.evidence.id, b.id);
    assert.equal(second.observations[0]?.evidence.provenance?.method, 'fetch'); assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false);
  });

  test('ambiguous duplicate identity cannot restore a snippet as a reusable page', async (): Promise<void> => {
    const watchRepo = createWatchRepository(port(pool)); const watch = await watchRepo.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'duplicate-watch', time);
    await watchRepo.enqueueManual(actor, watch.id, 'duplicates', time); const claim = await watchRepo.claimNext('duplicate-worker', 60_000, time); assert.ok(claim);
    const page = evidence('same', 'direct'); const snippet = { ...page, provenance: { ...page.provenance!, method: 'search_snippet' as const, endpoint: KEENABLE_SOURCE_URL } };
    await watchRepo.finish(claim, collection([snippet, page], 'partial'), time);
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id], acceptPartialObservations: true }] });
    const value = await repo.lookup(actor, live); assert.equal(value.state, 'error'); assert.equal(value.observations.length, 0);
    assert.ok(value.conditions.includes('INVALID_ADOPTED_SOURCE_RESULT')); assert.equal(calls, 0);
    assert.equal((await repo.lookup(actor, live)).generation, value.generation);
  });

  test('an old invalid adopted occurrence does not erase a newer successful refresh', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'old-invalid', time);
    await watches.enqueueManual(actor, watch.id, 'old-source', time); const claim = await watches.claimNext('worker', 60_000, time); assert.ok(claim);
    const item = evidence('old', 'direct'); await watches.finish(claim, collection([item, item], 'partial'), time);
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id], acceptPartialObservations: true }] });
    assert.equal((await repo.lookup(actor, live)).state, 'error'); time = new Date(time.getTime() + 1000);
    const fresh = await repo.refresh(actor, live, 'new-good-source'); assert.equal(fresh.state, 'reusable');
    const next = await repo.lookup(actor, live); assert.equal(next.state, 'reusable'); assert.equal(next.generation, fresh.generation);
    assert.deepEqual(next.observations.map((value) => value.ref), fresh.observations.map((value) => value.ref)); assert.equal(calls, 1);
  });

  test('generation callback failure rolls back rather than being mislabeled as an invalid source', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'callback-watch', time);
    await watches.enqueueManual(actor, watch.id, 'source', time); const claim = await watches.claimNext('worker', 60_000, time); assert.ok(claim); await watches.finish(claim, collection([evidence('valid', 'direct')]), time);
    let fail = true;
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id] }], onGenerationChange: async (): Promise<void> => { if (fail) { fail = false; throw new DataWatchError('CALLBACK_FAILED'); } } });
    await assert.rejects(repo.lookup(actor, live), /CALLBACK_FAILED/);
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_research_scopes')).rows[0]?.count, 0);
    assert.equal((await repo.lookup(actor, live)).state, 'reusable');
  });

  test('latest watch fail with NULL result invalidates prior research; a newer successful refresh stays reusable', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'fail-watch', time);
    await watches.enqueueManual(actor, watch.id, 'success', time); const firstClaim = await watches.claimNext('worker', 60_000, time); assert.ok(firstClaim);
    const original = evidence('original', 'direct'); await watches.finish(firstClaim, collection([original]), time);
    const changes: number[] = [];
    const repo = repository({ profiles: [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id] }], onGenerationChange: async (_client, _company, _scope, generation): Promise<void> => { changes.push(generation); } });
    const first = await repo.lookup(actor, live); assert.equal(first.state, 'reusable');
    await watches.enqueueManual(actor, watch.id, 'fail', time); const failedClaim = await watches.claimNext('worker', 60_000, time); assert.ok(failedClaim);
    const failed = await watches.fail(failedClaim, time); assert.equal(failed?.result, null); assert.equal(failed?.status, 'error');
    const after = await repo.lookup(actor, live); assert.equal(after.state, 'error'); assert.ok(after.conditions.includes('ADOPTED_COLLECTION_FAILED'));
    assert.equal(after.observations.length, 0); assert.ok(after.generation > first.generation); assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false);
    const old = (await watches.listOccurrences(actor.companyId)).find((item) => item.id === firstClaim.occurrence.id); assert.equal(old?.result?.sources[0]?.evidence[0]?.contentHash, original.contentHash);
    const fresh = await repo.refresh(actor, live, 'fresh-after-fail'); assert.equal(fresh.state, 'reusable');
    const next = await repo.lookup(actor, live); assert.equal(next.state, 'reusable'); assert.equal(next.generation, fresh.generation); assert.deepEqual(next.observations.map((item) => item.ref), fresh.observations.map((item) => item.ref));
    assert.ok(changes.length >= 3); assert.equal(calls, 1);
    await watches.enqueueManual(actor, watch.id, 'fail-again-same-time', time); const nextClaim = await watches.claimNext('worker', 60_000, time); assert.ok(nextClaim); await watches.fail(nextClaim, time);
    const failedAgain = await repo.lookup(actor, live); assert.equal(failedAgain.state, 'error'); assert.ok(failedAgain.generation > fresh.generation);
    assert.equal(await repo.validate(actor.companyId, [dependency(fresh)]), false);
    assert.equal((await repo.lookup(actor, live)).generation, failedAgain.generation);
  });

  test('validate propagates an invalidation callback error and rolls back the adopted cursor and generation', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'validate-callback', time);
    await watches.enqueueManual(actor, watch.id, 'success', time); const firstClaim = await watches.claimNext('worker', 60_000, time); assert.ok(firstClaim); await watches.finish(firstClaim, collection([evidence('one', 'direct')]), time);
    const profiles = [{ profileId: scope.profileId, profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watch.id] }];
    const first = await repository({ profiles }).lookup(actor, live);
    const before = (await pool.query('SELECT generation,observed_publication_seq FROM accel_research_scopes')).rows[0];
    await watches.enqueueManual(actor, watch.id, 'failure', time); const failedClaim = await watches.claimNext('worker', 60_000, time); assert.ok(failedClaim); await watches.fail(failedClaim, time);
    let fail = true;
    const repo = repository({ profiles, onGenerationChange: async (): Promise<void> => { if (fail) throw new DataWatchError('CALLBACK_FAILED'); } });
    await assert.rejects(repo.validate(actor.companyId, [dependency(first)]), /CALLBACK_FAILED/);
    assert.deepEqual((await pool.query('SELECT generation,observed_publication_seq FROM accel_research_scopes')).rows[0], before);
    await assert.rejects(store.transaction(async (client): Promise<boolean> => await repo.validate(actor.companyId, [dependency(first)], client)), /CALLBACK_FAILED/);
    assert.deepEqual((await pool.query('SELECT generation,observed_publication_seq FROM accel_research_scopes')).rows[0], before);
    fail = false; assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false);
    const after = await repo.lookup(actor, live); assert.equal(after.state, 'error'); assert.ok(after.generation > first.generation);
  });

  test('identical recollection advances only the durable cursor and freshness, with exact bigint transport', async (): Promise<void> => {
    await pool.query("SELECT setval('accel_watch_publication_seq',9007199254740995,true)");
    const repo = repository(); const first = await repo.ingestControlled(operator, scope, evidence('same'), 'first');
    const before = (await pool.query('SELECT observed_publication_seq FROM accel_research_scopes')).rows[0]?.observed_publication_seq as string;
    time = new Date(time.getTime() + 1000); const second = await repo.ingestControlled(operator, scope, evidence('same'), 'same');
    const after = (await pool.query('SELECT observed_publication_seq FROM accel_research_scopes')).rows[0]?.observed_publication_seq as string;
    assert.equal(before, '9007199254740996'); assert.equal(after, '9007199254740997');
    assert.equal(second.generation, first.generation); assert.deepEqual(second.observations.map((item) => item.ref), first.observations.map((item) => item.ref));
    assert.ok(second.validUntil !== null && first.validUntil !== null && second.validUntil > first.validUntil);
    assert.equal(second.observations[0]?.evidence.contentHash, first.observations[0]?.evidence.contentHash);
    assert.equal('observedPublicationSeq' in second, false);
  });

  test('queued, running, renew and duplicate operations do not publish; terminals and their identity stay immutable', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'publication-watch', time);
    const item = await watches.enqueueManual(actor, watch.id, 'one', time);
    const seq = async (): Promise<string | null> => (await pool.query('SELECT publication_seq FROM accel_watch_occurrences WHERE id=$1', [item.id])).rows[0]?.publication_seq as string | null;
    assert.equal(await seq(), null); const claim = await watches.claimNext('worker', 60_000, time); assert.ok(claim); assert.equal(await seq(), null);
    assert.equal(await watches.renew(claim, 60_000, time), true); assert.equal(await seq(), null);
    assert.equal(await watches.finish({ ...claim, occurrence: { ...claim.occurrence, fence: claim.occurrence.fence + 1 } }, collection([evidence('one', 'direct')]), time), null); assert.equal(await seq(), null);
    await watches.finish(claim, collection([evidence('one', 'direct')]), time); const published = await seq(); assert.ok(published);
    await watches.enqueueManual(actor, watch.id, 'one', time); assert.equal(await seq(), published);
    await assert.rejects(pool.query("UPDATE accel_watch_occurrences SET result='{}'::jsonb WHERE id=$1", [item.id]), /TERMINAL_OCCURRENCE_IMMUTABLE/);
    await assert.rejects(pool.query("UPDATE accel_watch_occurrences SET status='queued' WHERE id=$1", [item.id]), /TERMINAL_OCCURRENCE_IMMUTABLE/);
    assert.equal(await seq(), published);
  });

  test('receive callback rollback leaves a sequence gap without publishing or hiding the next observation', async (): Promise<void> => {
    let fail = true;
    const repo = repository({ onGenerationChange: async (): Promise<void> => { if (fail) { fail = false; throw new Error('ROLLBACK_RECEIVE'); } } });
    await assert.rejects(repo.ingestControlled(operator, scope, evidence('rolled-back'), 'rolled-back'), /ROLLBACK_RECEIVE/);
    const sequence = (await pool.query('SELECT last_value FROM accel_watch_publication_seq')).rows[0]?.last_value as string;
    assert.equal((await pool.query('SELECT count(*)::integer AS count FROM accel_watch_occurrences')).rows[0]?.count, 0);
    const next = await repo.ingestControlled(operator, scope, evidence('next'), 'next'); assert.equal(next.state, 'reusable');
    const cursor = (await pool.query('SELECT observed_publication_seq FROM accel_research_scopes')).rows[0]?.observed_publication_seq as string;
    assert.ok(BigInt(cursor) > BigInt(sequence)); assert.equal((await repo.lookup(actor, scope)).generation, next.generation);
  });

  test('company lock orders terminal publications across connections before sequence allocation', async (): Promise<void> => {
    const watches = createWatchRepository(port(pool)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'lock-order', time);
    const a = await pool.connect(); const b = await pool.connect();
    try {
      await a.query('BEGIN'); await a.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [actor.companyId]);
      await b.query('BEGIN'); await b.query("SET LOCAL lock_timeout='100ms'");
      await assert.rejects(b.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [actor.companyId]), (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === '55P03');
      await b.query('ROLLBACK');
      const first = (await a.query("INSERT INTO accel_watch_occurrences(id,watch_id,company_id,operation_key,status,scheduled_at,completed_at) VALUES('order-a',$1,$2,'order-a','error',$3,$3) RETURNING publication_seq", [watch.id, actor.companyId, time])).rows[0]?.publication_seq as string;
      await a.query('COMMIT');
      await b.query('BEGIN'); await b.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [actor.companyId]);
      const second = (await b.query("INSERT INTO accel_watch_occurrences(id,watch_id,company_id,operation_key,status,scheduled_at,completed_at) VALUES('order-b',$1,$2,'order-b','error',$3,$3) RETURNING publication_seq", [watch.id, actor.companyId, time])).rows[0]?.publication_seq as string;
      await b.query('COMMIT'); assert.ok(BigInt(second) > BigInt(first));
      assert.equal((await pool.query("SELECT cache_size FROM pg_sequences WHERE schemaname=$1 AND sequencename='accel_watch_publication_seq'", [schema])).rows[0]?.cache_size, '1');
    } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK'); a.release(); b.release(); }
  });

  test('historical migration preserves proofs, blocks ambiguous adoption and replay never renumbers a received publication', async (): Promise<void> => {
    const legacySchema = `research_legacy_${randomUUID().replaceAll('-', '')}`; await admin.query(`CREATE SCHEMA ${legacySchema}`);
    const legacy = new Pool({ connectionString: process.env.DATA_WATCH_TEST_DATABASE_URL, max: 2, options: `-c search_path=${legacySchema}` });
    const legacyStore: ResearchStore = { ...port(legacy), async transaction<T>(work: (client: SqlPort) => Promise<T>): Promise<T> {
      const client = await legacy.connect(); try { await client.query('BEGIN'); const value = await work(port(client)); await client.query('COMMIT'); return value; } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } };
    try {
      await legacy.query('CREATE TABLE companies(company_id text PRIMARY KEY)'); await legacy.query('INSERT INTO companies VALUES($1)', [actor.companyId]);
      await legacy.query(await readFile(new URL('../../proposals/data/watch-schema.sql', import.meta.url), 'utf8'));
      await legacy.query(await readFile(new URL('../../proposals/data/research-schema.sql', import.meta.url), 'utf8'));
      const watches = createWatchRepository(port(legacy)); const watch = await watches.createWatch(actor, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'legacy', time);
      const item = evidence('legacy', 'direct'); let firstId = '';
      for (const key of ['old-one', 'old-identical-two']) {
        await watches.enqueueManual(actor, watch.id, key, time); const claim = await watches.claimNext('legacy-worker', 60_000, time); assert.ok(claim); await watches.finish(claim, collection([item]), time);
        if (!firstId) firstId = claim.occurrence.id;
      }
      const refs = [{ occurrenceId: firstId, evidenceId: item.id, contentHash: item.contentHash }];
      await legacy.query(`INSERT INTO accel_research_scopes(company_id,profile_id,profile_version,namespace,generation,fingerprint,state,observed_at,valid_until,occurrence_id,evidence_refs,conditions,reason)
        VALUES($1,$2,'v1','live',3,'legacy','reusable',$3,$4,$5,$6,'[]','historical fixture')`, [actor.companyId, live.profileId, time, new Date(time.getTime() + 60_000), firstId, JSON.stringify(refs)]);
      const sql = await readFile(new URL('../../proposals/data/research-publication-order.sql', import.meta.url), 'utf8');
      await legacyStore.transaction(async (client): Promise<void> => { await client.query(sql); });
      const oldPublications = (await legacy.query('SELECT id,publication_seq FROM accel_watch_occurrences ORDER BY id')).rows;
      const initial = (await legacy.query('SELECT * FROM accel_research_scopes')).rows[0];
      assert.equal(initial?.state, 'stale'); assert.equal(initial?.generation, '4'); assert.equal(initial?.valid_until, null); assert.deepEqual(initial?.evidence_refs, refs);
      const repo = createResearchRepository(legacyStore, { profiles: ['v1', 'v2'].map((profileVersion) => ({ profileId: live.profileId, profileVersion, freshForMs: 60_000, adoptWatchIds: [watch.id] })), now: (): Date => time,
        createCollection: () => ({ externalCalls: (): number => 1, collect: async (): Promise<CollectionResult> => collection([evidence('new-publication', 'direct')]) }) });
      const old = await repo.lookup(actor, live); assert.equal(old.state, 'stale'); assert.equal(old.observations[0]?.ref.occurrenceId, firstId);
      const absentScope = await repo.lookup(actor, { ...live, profileVersion: 'v2' }); assert.equal(absentScope.state, 'stale'); assert.equal(absentScope.observations.length, 0); assert.ok(absentScope.conditions.includes('HISTORICAL_PUBLICATION_ORDER_UNVERIFIED'));
      const fresh = await repo.refresh(actor, live, 'explicit-post-migration'); assert.equal(fresh.state, 'reusable');
      const published = (await legacy.query('SELECT id,publication_seq FROM accel_watch_occurrences ORDER BY id')).rows;
      await legacyStore.transaction(async (client): Promise<void> => { await client.query(sql); });
      assert.deepEqual((await legacy.query('SELECT id,publication_seq FROM accel_watch_occurrences ORDER BY id')).rows, published);
      assert.deepEqual(published.filter((row) => oldPublications.some((oldRow) => oldRow.id === row.id)), oldPublications);
      const after = await repo.lookup(actor, live); assert.equal(after.state, 'reusable'); assert.equal(after.generation, fresh.generation); assert.deepEqual(after.observations.map((observation) => observation.ref), fresh.observations.map((observation) => observation.ref));
      assert.equal((await legacy.query('SELECT result FROM accel_watch_occurrences WHERE id=$1', [firstId])).rows[0]?.result.sources[0]?.evidence[0]?.contentHash, item.contentHash);
    } finally { await legacy.end(); await admin.query(`DROP SCHEMA ${legacySchema} CASCADE`); }
  });
});
