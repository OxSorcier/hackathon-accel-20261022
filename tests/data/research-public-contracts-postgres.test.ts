import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { Actor, CollectionResult, SourceEvidence, SqlPort, SqlResult } from '../../src/contracts/index.ts';
import type { ResearchContext, ResearchDependency, ResearchScope } from '../../src/contracts/research.ts';
import { createResearchRepository, type ResearchRepositoryOptions, type ResearchStore } from '../../src/data/research-repository.ts';
import { createWatchRepository } from '../../src/data/watch-repository.ts';
import { BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL } from '../../src/watch/source-policy.ts';

const schema = `research_public_contracts_${randomUUID().replaceAll('-', '')}`;
const scope: ResearchScope = { profileId: 'public-contracts', profileVersion: 'v1', namespace: 'live' };
const actor: Actor = { actorId: 'EMP-PAUL', companyId: 'CONTRACTS-A', role: 'direction', approvalCeilingEur: 2000 };
let admin: Pool; let pool: Pool; let store: ResearchStore; let time: Date; let watchId: string; let created = false; let collectionCalls: number;
function port(client: Pool | PoolClient): SqlPort {
  return { async query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> { const result = await client.query<T>(text, values); return { rows: result.rows, rowCount: result.rowCount }; } };
}
function notice(suffix = '1', overrides: Partial<SourceEvidence> = {}): SourceEvidence {
  const id = `boamp:26-${suffix}`, content = `SIMULATED BOAMP record ${suffix}; not an actual notice or qualified CRM demand.`;
  return { id, url: `https://www.boamp.fr/pages/avis/?q=${encodeURIComponent(`idweb:"${id.slice(6)}"`)}`, title: 'Simulated public notice', content,
    contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct', family: 'public_contract',
    publishedAt: '2026-10-01T00:00:00.000Z', collectedAt: time.toISOString(),
    provenance: { provider: 'boamp', endpoint: BOAMP_SOURCE_URL, method: 'api_record', profileId: 'public-contracts', indexedAt: null, truncated: false }, ...overrides };
}
function search(method: 'fetch' | 'search_snippet' = 'search_snippet'): SourceEvidence {
  const url = 'https://www.boamp.fr/pages/avis/fixture/', content = 'SIMULATED Keenable result, no qualified CRM demand.';
  return { id: `keenable:${createHash('sha256').update(url).digest('hex')}`, url, title: 'Simulated search result', content,
    contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct', family: 'public_contract', publishedAt: null, collectedAt: time.toISOString(),
    provenance: { provider: 'keenable', endpoint: `https://api.keenable.ai/v1/${method === 'fetch' ? 'fetch' : 'search'}/public`, method, profileId: 'public-contracts', indexedAt: null, truncated: false } };
}
function result(notices: SourceEvidence[], searches: SourceEvidence[] = [search()], partial = true): CollectionResult {
  return { status: partial ? 'partial' : 'success', startedAt: time.toISOString(), completedAt: time.toISOString(), sources: [
    { url: BOAMP_SOURCE_URL, status: notices.length ? 'success' : 'empty', evidence: notices, error: null },
    { url: KEENABLE_SOURCE_URL, status: searches.length ? partial ? 'partial' : 'success' : partial ? 'error' : 'empty', evidence: searches, error: partial ? 'BOUNDED_FIXTURE' : null }
  ] };
}
function repository(overrides: Partial<ResearchRepositoryOptions> = {}) {
  return createResearchRepository(store, { profiles: [{ profileId: 'public-contracts', profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watchId], acceptPartialObservations: true }], now: (): Date => time,
    createCollection: () => ({ externalCalls: (): number => collectionCalls, collect: async (): Promise<CollectionResult> => { collectionCalls++; throw new Error('NO_COLLECTION_IN_OBSERVATION_TEST'); } }),
    authorizeServiceLookup: async (): Promise<boolean> => true, ...overrides });
}
function dependency(value: ResearchContext): ResearchDependency { return { scope, generation: value.generation, validUntil: value.validUntil, evidenceRefs: value.observations.map(item => item.ref) }; }
async function publish(value: CollectionResult, unchecked = false): Promise<string> {
  if (unchecked) return await store.transaction(async (client): Promise<string> => {
    await client.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [actor.companyId]); const id = `unchecked:${randomUUID()}`;
    await client.query("INSERT INTO accel_watch_occurrences(id,watch_id,company_id,operation_key,status,scheduled_at,started_at,completed_at,result) VALUES($1,$2,$3,$1,'completed',$4,$4,$4,$5)", [id, watchId, actor.companyId, time, JSON.stringify(value)]); return id;
  });
  const watches = createWatchRepository(port(pool)); const item = await watches.enqueueManual(actor, watchId, `fixture:${randomUUID()}`, time);
  const claim = await watches.claimNext('fixture-worker', 60_000, time); assert.ok(claim); assert.equal(claim.occurrence.id, item.id);
  assert.ok(await watches.finish(claim, value, time)); return item.id;
}

describe.skipIf(!process.env.DATA_WATCH_TEST_DATABASE_URL)('Explicit BOAMP observation policy, isolated PostgreSQL schema', (): void => {
  beforeAll(async (): Promise<void> => {
    try {
      const connectionString = process.env.DATA_WATCH_TEST_DATABASE_URL; assert.ok(connectionString); admin = new Pool({ connectionString, max: 1 }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
      pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` }); await pool.query('CREATE TABLE companies(company_id text PRIMARY KEY)');
      for (const file of ['watch-schema.sql', 'research-schema.sql']) await pool.query(await readFile(new URL(`../../proposals/data/${file}`, import.meta.url), 'utf8'));
      store = { ...port(pool), async transaction<T>(work: (client: SqlPort) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(port(client)); await client.query('COMMIT'); return value; } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } } };
      await store.transaction(async (client): Promise<void> => { await client.query(await readFile(new URL('../../proposals/data/research-publication-order.sql', import.meta.url), 'utf8')); });
    } catch { throw new Error('PUBLIC_CONTRACT_TEST_DATABASE_SETUP_FAILED'); }
  });
  beforeEach(async (): Promise<void> => {
    await pool.query('TRUNCATE accel_research_commands,accel_research_scopes,accel_watch_evidence,accel_watch_occurrences,accel_watch_definitions,companies'); await pool.query("INSERT INTO companies VALUES('CONTRACTS-A')");
    await pool.query('UPDATE accel_research_publication_boundary SET historical_seq=0'); time = new Date('2026-10-22T10:00:00.000Z'); collectionCalls = 0;
    watchId = (await createWatchRepository(port(pool)).createWatch(actor, { publicTopic: 'marchés publics matériaux France', sourceUrls: [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL], cadenceMinutes: 15 }, 'existing-watch', time)).id;
  });
  afterAll(async (): Promise<void> => { if (pool) await pool.end(); if (admin) { try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin.end(); } } });

  test('partial raw collection is retained while only dated complete BOAMP records become observations for human and service', async (): Promise<void> => {
    const raw = result([notice()]), id = await publish(raw), repo = repository(), value = await repo.lookup(actor, scope);
    assert.equal(value.state, 'reusable'); assert.equal(value.observations.length, 1); assert.equal(value.observations[0]?.ref.evidenceId, 'boamp:26-1'); assert.equal(value.observations[0]?.qualification, 'source_observation_only');
    assert.equal(value.observations[0]?.evidence.publishedAt, '2026-10-01T00:00:00.000Z'); assert.equal(value.observations[0]?.testOnly, false);
    for (const condition of ['SOURCE_OBSERVATION_ONLY', 'PARTIAL_SOURCE_SET', 'COMPANY_RELATION_AND_APPLICABILITY_UNVERIFIED', 'PUBLISHER_FRESHNESS_NOT_VERIFIED', 'PUBLIC_NOTICE_LEAD_NOT_QUALIFIED_CRM_DEMAND']) assert.ok(value.conditions.includes(condition));
    assert.deepEqual((await pool.query('SELECT result FROM accel_watch_occurrences WHERE id=$1', [id])).rows[0]?.result, raw);
    assert.deepEqual((await repo.lookupForService(actor.companyId, scope, 'ANALYSIS-PRINCIPAL')).observations.map(item => item.ref), value.observations.map(item => item.ref));
    assert.equal(collectionCalls, 0); assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_research_commands')).rows[0]?.n, 0);
  });

  test('success also filters Fetch and snippets; success with no eligible dated notice stays nonreusable', async (): Promise<void> => {
    const repo = repository(); await publish(result([notice()], [search('fetch'), search()], false), true);
    assert.equal((await repo.lookup(actor, scope)).state, 'error'); // Duplicate source identity is invalid, regardless of source status.
    await publish(result([notice()], [search('fetch')], false)); const valid = await repo.lookup(actor, scope); assert.equal(valid.state, 'reusable'); assert.equal(valid.observations.length, 1);
    const raw = result([notice('2', { publishedAt: null })], [search('fetch')], false), id = await publish(raw); const empty = await repo.lookup(actor, scope);
    assert.equal(empty.state, 'partial'); assert.equal(empty.validUntil, null); assert.equal(empty.observations.length, 0); assert.equal((await pool.query('SELECT result FROM accel_watch_occurrences WHERE id=$1', [id])).rows[0]?.result.status, 'success');
  });

  test('missing native date, truncated BOAMP, search snippets and Fetch never become eligible in partial results', async (): Promise<void> => {
    const repo = repository(), plain = notice();
    for (const raw of [result([notice('1', { publishedAt: null })]), result([notice('1', { provenance: { ...plain.provenance!, truncated: true } })]), result([], [search()]), result([], [search('fetch')])]) {
      await publish(raw); const value = await repo.lookup(actor, scope); assert.equal(value.state, 'partial'); assert.equal(value.observations.length, 0); assert.equal(value.validUntil, null);
    }
    assert.equal(collectionCalls, 0);
  });

  test('opt-in is limited to the exact two pairs and does not grant partial reuse to another namespace or version', async (): Promise<void> => {
    for (const [profileId, profileVersion] of [['public-contracts', 'v2'], ['sector-news', 'v1']]) assert.throws(() => repository({ profiles: [{ profileId, profileVersion, freshForMs: 60_000, acceptPartialObservations: true }] }), /INVALID_RESEARCH_POLICY/);
    await publish(result([notice()])); const off = repository({ profiles: [{ profileId: 'public-contracts', profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watchId] }] }); assert.equal((await off.lookup(actor, scope)).state, 'partial');
    const on = await repository().lookup(actor, scope); assert.equal(on.state, 'reusable'); assert.equal(on.observations.length, 1); assert.equal(collectionCalls, 0);
    const controlled = await repository().lookup({ ...actor, role: 'operator' }, { ...scope, namespace: 'controlled' }); assert.equal(controlled.state, 'missing'); assert.equal(controlled.observations.length, 0);
    await assert.rejects(repository().lookup(actor, { ...scope, profileVersion: 'v2' }), /RESEARCH_SCOPE_NOT_AUTHORISED/);
  });

  test('the unchanged ten-evidence boundary accepts ten and rejects eleven, with no extra fetch', async (): Promise<void> => {
    const repo = repository(); await publish(result(Array.from({ length: 9 }, (_, index) => notice(String(index + 1))))); assert.equal((await repo.lookup(actor, scope)).observations.length, 9);
    await publish(result(Array.from({ length: 10 }, (_, index) => notice(String(index + 1))))); const invalid = await repo.lookup(actor, scope); assert.equal(invalid.state, 'error'); assert.equal(invalid.observations.length, 0); assert.equal(collectionCalls, 0);
  });

  test('identical material preserves exact refs and generation; eligibility change at stable id/hash invalidates its dependency', async (): Promise<void> => {
    const changes: number[] = [], repo = repository({ onGenerationChange: async (_client, _company, _scope, generation): Promise<void> => { changes.push(generation); } });
    await publish(result([notice('1'), notice('2')])); const first = await repo.lookup(actor, scope); time = new Date(time.getTime() + 20_000);
    await publish(result([notice('1'), notice('2')])); const same = await repo.lookup(actor, scope); assert.equal(same.generation, first.generation); assert.deepEqual(same.observations.map(item => item.ref), first.observations.map(item => item.ref));
    assert.equal(changes.length, 1); const original = notice('1'); await publish(result([{ ...original, provenance: { ...original.provenance!, truncated: true } }, notice('2')])); const changed = await repo.lookup(actor, scope);
    assert.ok(changed.generation > same.generation); assert.deepEqual(changed.observations.map(item => item.ref.evidenceId), ['boamp:26-2']); assert.equal(await repo.validate(actor.companyId, [dependency(first)]), false); assert.equal(await repo.validate(actor.companyId, [dependency(changed)]), true); assert.equal(changes.length, 2);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_watch_occurrences')).rows[0]?.n, 3); assert.equal(collectionCalls, 0);
  });

  test('activation reconciles an old success projection and its identical pinned refs without extending the last observation time', async (): Promise<void> => {
    const off = repository({ profiles: [{ profileId: 'public-contracts', profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watchId] }] });
    await publish(result([notice()], [search('fetch')], false)); const first = await off.lookup(actor, scope); time = new Date(time.getTime() + 20_000);
    await publish(result([notice()], [search('fetch')], false)); const same = await off.lookup(actor, scope); assert.equal(same.occurrenceId, first.occurrenceId); assert.equal(same.observations.length, 2);
    const upgraded = await repository().lookup(actor, scope); assert.ok(upgraded.generation > same.generation); assert.equal(upgraded.observations.length, 1); assert.equal(upgraded.occurrenceId, first.occurrenceId); assert.equal(upgraded.validUntil, same.validUntil);
    assert.equal(upgraded.observations[0]?.evidence.collectedAt, '2026-10-22T10:00:00.000Z'); assert.equal(collectionCalls, 0);
  });

  test('activation never revives an expired or historically ambiguous projection', async (): Promise<void> => {
    const off = repository({ profiles: [{ profileId: 'public-contracts', profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watchId] }] });
    await publish(result([notice()], [search('fetch')], false)); await off.lookup(actor, scope); time = new Date(time.getTime() + 60_001); assert.equal((await off.lookup(actor, scope)).state, 'stale');
    assert.equal((await repository().lookup(actor, scope)).state, 'stale');
    await pool.query("UPDATE accel_research_scopes SET conditions='[\"HISTORICAL_PUBLICATION_ORDER_UNVERIFIED\"]',state='stale',valid_until=NULL");
    await pool.query('UPDATE accel_research_publication_boundary SET historical_seq=(SELECT max(publication_seq) FROM accel_watch_occurrences)');
    const historical = await repository().lookup(actor, scope); assert.equal(historical.state, 'stale'); assert.ok(historical.conditions.includes('HISTORICAL_PUBLICATION_ORDER_UNVERIFIED')); assert.equal(collectionCalls, 0);
  });

  test('reconciliation invalidation callback errors roll back the policy projection', async (): Promise<void> => {
    await publish(result([notice()], [search('fetch')], false)); const off = repository({ profiles: [{ profileId: 'public-contracts', profileVersion: 'v1', freshForMs: 60_000, adoptWatchIds: [watchId] }] }); const old = await off.lookup(actor, scope);
    const repo = repository({ onGenerationChange: async (): Promise<void> => { throw new Error('INVALIDATION_FAILED'); } }); await assert.rejects(repo.lookup(actor, scope), /INVALIDATION_FAILED/);
    const row = (await pool.query('SELECT generation,evidence_refs FROM accel_research_scopes')).rows[0]; assert.equal(row?.generation, String(old.generation)); assert.equal((row?.evidence_refs as unknown[]).length, 2);
  });

  test('replay/test modes, future date, mismatched native URL/hash and wrong source set fail closed', async (): Promise<void> => {
    const repo = repository();
    for (const raw of [result([notice('1', { mode: 'replay' })]), result([notice('1', { mode: 'test' })]), result([notice('1', { publishedAt: '2026-10-23T00:00:00.000Z' })]), result([notice('1', { url: 'https://www.boamp.fr/pages/avis/?q=other' })]), result([notice('1', { contentHash: '0'.repeat(64) })]), { ...result([notice()]), sources: result([notice()]).sources.slice(0, 1) }]) {
      await publish(raw, true); const value = await repo.lookup(actor, scope); assert.equal(value.state, 'error'); assert.equal(value.observations.length, 0); assert.equal(value.validUntil, null);
    }
    assert.equal(collectionCalls, 0);
  });
});
