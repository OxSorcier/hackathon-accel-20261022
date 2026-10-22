import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { Actor, CollectionResult, SqlPort, SqlResult, WatchInput } from '../../src/contracts/index.ts';
import { createWatchRepository, type WatchRepository } from '../../src/data/watch-repository.ts';
import { createPublicCollector, BOAMP_SOURCE_URL, PUBLIC_TOPICS } from '../../src/watch/collector.ts';
import { createWatchEngine } from '../../src/watch/engine.ts';

let initial = new Date();
const input: WatchInput = { publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL], cadenceMinutes: 15 };
const schema = `data_watch_test_${randomUUID().replaceAll('-', '')}`;
let pool: Pool; let admin: Pool; let repository: WatchRepository; let actor: Actor; let schemaCreated = false;

async function collection(at = initial, title = 'Fourniture isolants'): Promise<CollectionResult> {
  return await createPublicCollector({ now: (): Date => at, fetch: async (): Promise<Response> => new Response(JSON.stringify({ total_count: 1,
    results: [{ idweb: '26-99752', objet: title, dateparution: '2026-10-21', nomacheteur: 'Commune test', filename: 'BOAMP-26-99752' }] })) })(input);
}

describe.skipIf(!process.env.DATA_WATCH_TEST_DATABASE_URL)('PostgreSQL réel local, schéma jetable propre à cette suite', (): void => {
  beforeAll(async (): Promise<void> => {
    const connectionString = process.env.DATA_WATCH_TEST_DATABASE_URL;
    assert.ok(connectionString);
    admin = new Pool({ connectionString, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;
    pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
    await pool.query(await readFile(new URL('../../proposals/data/watch-schema.sql', import.meta.url), 'utf8'));
    const sql: SqlPort = {
      async query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> {
        const result = await pool.query<T>(text, values); return { rows: result.rows, rowCount: result.rowCount };
      },
    };
    repository = createWatchRepository(sql);
    const fixture: unknown = JSON.parse(await readFile(new URL('../../fixtures/company/dataset.json', import.meta.url), 'utf8'));
    assert.ok(typeof fixture === 'object' && fixture !== null && 'company_id' in fixture && fixture.company_id === 'CO-DEMO');
    actor = { actorId: 'EMP-PAUL', companyId: fixture.company_id, role: 'direction', approvalCeilingEur: 2000 };
  });
  beforeEach(async (): Promise<void> => { await pool.query('TRUNCATE accel_watch_evidence,accel_watch_occurrences,accel_watch_definitions'); initial = new Date(); });
  afterAll(async (): Promise<void> => {
    if (pool) await pool.end();
    if (admin) { try { if (schemaCreated) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); } }
  });

  test('création explicite idempotente, refus de collision et cloisonnement CO-DEMO', async (): Promise<void> => {
    assert.deepEqual(await repository.listWatches(actor.companyId), []);
    const [first, duplicate] = await Promise.all([repository.createWatch(actor, input, 'create-1', initial), repository.createWatch(actor, input, 'create-1', initial)]);
    assert.equal(first.id, duplicate.id);
    await assert.rejects(repository.createWatch(actor, { ...input, cadenceMinutes: 30 }, 'create-1', initial), /IDEMPOTENCY_CONFLICT/);
    await assert.rejects(repository.createWatch({ ...actor, role: 'logistique' }, input, 'forbidden', initial), /WATCH_FORBIDDEN/);
    assert.equal((await repository.listWatches(actor.companyId)).length, 1);
    assert.equal((await repository.listWatches('CO-OTHER')).length, 0);
    await assert.rejects(repository.enqueueManual({ ...actor, companyId: 'CO-OTHER' }, first.id, 'foreign', initial), /WATCH_NOT_FOUND/);
    const other = await repository.createWatch({ ...actor, companyId: 'CO-OTHER' }, input, 'create-1', initial);
    assert.notEqual(other.id, first.id);
  });

  test('réveils concurrents, calendrier durable, aucun reset à la reconstruction du repository', async (): Promise<void> => {
    const saved = await repository.createWatch(actor, input, 'create-1', initial);
    const results = await Promise.all(Array.from({ length: 8 }, async (): Promise<number> => await repository.enqueueDue(initial)));
    assert.equal(results.reduce((a, b) => a + b, 0), 1);
    assert.equal((await repository.listOccurrences(actor.companyId)).length, 1);
    const sql: SqlPort = { async query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> { const result = await pool.query<T>(text, values); return { rows: result.rows, rowCount: result.rowCount }; } };
    const restarted = createWatchRepository(sql);
    assert.equal((await restarted.listWatches(actor.companyId))[0]?.id, saved.id);
    assert.equal((await restarted.listWatches(actor.companyId))[0]?.nextRunAt, new Date(initial.getTime() + 15 * 60_000).toISOString());
    assert.equal(await restarted.enqueueDue(new Date(initial.getTime() + 15 * 60_000)), 1);
    assert.equal((await restarted.listOccurrences(actor.companyId)).length, 2);
  });

  test('clic manuel et worker partagent une exclusion par veille, doubles clics dédupliqués', async (): Promise<void> => {
    const saved = await repository.createWatch(actor, input, 'create-1', initial);
    await repository.enqueueDue(initial);
    const [a, b] = await Promise.all([repository.enqueueManual(actor, saved.id, 'click-1', initial), repository.enqueueManual(actor, saved.id, 'click-1', initial)]);
    assert.equal(a.id, b.id);
    const claims = await Promise.all(Array.from({ length: 8 }, async (_, index) => await repository.claimNext(`worker-${index}`, 1000, initial)));
    const active = claims.filter((claim) => claim !== null);
    assert.equal(active.length, 1);
    const claim = active[0]; assert.ok(claim);
    assert.equal(await repository.claimNext('another', 1000, initial), null);
    assert.ok(await repository.finish(claim, await collection(), initial));
    assert.ok(await repository.claimNext('next', 1000, initial));
  });

  test('bail expiré repris avec fence croissant, ancien résultat et renouvellement périmé refusés', async (): Promise<void> => {
    await repository.createWatch(actor, input, 'create-1', initial); await repository.enqueueDue(initial);
    const old = await repository.claimNext('old', 1000, initial); assert.ok(old);
    const later = new Date(Date.parse(old.occurrence.leaseUntil!) + 1);
    assert.equal(await repository.renew(old, 1000, later), false);
    assert.equal(await repository.finish(old, await collection(), later), null);
    const resumed = await repository.claimNext('new', 1000, later); assert.ok(resumed);
    assert.equal(resumed.occurrence.id, old.occurrence.id);
    assert.equal(resumed.occurrence.fence, old.occurrence.fence + 1);
    assert.equal(await repository.finish(old, await collection(), later), null);
    assert.equal((await pool.query('SELECT * FROM accel_watch_evidence')).rowCount, 0);
    assert.equal(await repository.renew({ ...resumed, workerId: 'impostor' }, 1000, later), false);
    assert.equal(await repository.fail({ ...resumed, occurrence: { ...resumed.occurrence, companyId: 'CO-OTHER' } }, later), null);
    assert.ok(await repository.renew(resumed, 1000, later));
    const completed = await repository.finish(resumed, await collection(later), later); assert.equal(completed?.status, 'completed');
  });

  test('preuve dédupliquée par contenu, révisions et observations conservées', async (): Promise<void> => {
    const saved = await repository.createWatch(actor, input, 'create-1', initial);
    for (let index = 0; index < 3; index++) {
      const at = new Date(initial.getTime() + index * 1000);
      await repository.enqueueManual(actor, saved.id, `click-${index}`, at);
      const claim = await repository.claimNext(`w-${index}`, 1000, at); assert.ok(claim);
      await repository.finish(claim, await collection(at, index === 2 ? 'Titre actualisé' : undefined), at);
    }
    const evidence = await pool.query('SELECT * FROM accel_watch_evidence ORDER BY first_seen_at');
    assert.equal(evidence.rowCount, 2);
    assert.equal(new Date(evidence.rows[0]?.first_seen_at as Date).toISOString(), initial.toISOString());
    assert.equal(new Date(evidence.rows[0]?.last_seen_at as Date).toISOString(), new Date(initial.getTime() + 1000).toISOString());
    assert.equal((await repository.listOccurrences(actor.companyId)).filter((item) => item.result !== null).length, 3);
  });

  test('refuse le rejeu d’une collecte antérieure à la tentative et préserve le bail courant', async (): Promise<void> => {
    await repository.createWatch(actor, input, 'create-1', initial); await repository.enqueueDue(initial);
    const old = await repository.claimNext('old', 1000, initial); assert.ok(old);
    const resumedAt = new Date(Date.parse(old.occurrence.leaseUntil!) + 1);
    const current = await repository.claimNext('resumed', 1000, resumedAt); assert.ok(current);
    await assert.rejects(repository.finish(current, await collection(initial), resumedAt), /INVALID_COLLECTION_TIME/);
    assert.equal((await repository.listOccurrences(actor.companyId))[0]?.status, 'running');
    assert.equal((await pool.query('SELECT * FROM accel_watch_evidence')).rowCount, 0);
    assert.ok(await repository.finish(current, await collection(resumedAt), resumedAt));
  });

  test('une heure appelante périmée ne renouvelle ni ne publie après expiration réelle du bail', async (): Promise<void> => {
    await repository.createWatch(actor, input, 'create-1', initial); await repository.enqueueDue(initial);
    const claim = await repository.claimNext('worker', 1000, initial); assert.ok(claim);
    await pool.query("UPDATE accel_watch_occurrences SET lease_until=clock_timestamp()-interval '1 millisecond' WHERE id=$1", [claim.occurrence.id]);
    assert.equal(await repository.renew(claim, 1000, initial), false);
    assert.equal(await repository.finish(claim, await collection(initial), initial), null);
    assert.equal(await repository.fail(claim, initial), null);
  });

  test('publication et preuves atomiques si une écriture aval échoue', async (): Promise<void> => {
    await repository.createWatch(actor, input, 'create-1', initial); await repository.enqueueDue(initial);
    const claim = await repository.claimNext('worker', 1000, initial); assert.ok(claim);
    await pool.query("ALTER TABLE accel_watch_evidence ADD CONSTRAINT test_reject CHECK (source_id <> 'boamp:26-99752')");
    try {
      await assert.rejects(repository.finish(claim, await collection(), initial), /WATCH_STORAGE_ERROR/);
      assert.equal((await repository.listOccurrences(actor.companyId))[0]?.status, 'running');
      assert.equal((await pool.query('SELECT * FROM accel_watch_evidence')).rowCount, 0);
    } finally { await pool.query('ALTER TABLE accel_watch_evidence DROP CONSTRAINT test_reject'); }
    assert.ok(await repository.finish(claim, await collection(), initial));
  });

  test('deux collectes terminent sans navigateur avec un moteur reconstruit entre elles', async (): Promise<void> => {
    let time = initial;
    let calls = 0;
    await repository.createWatch(actor, input, 'create-1', time);
    const collector = async (): Promise<CollectionResult> => {
      calls++;
      const active = await pool.query("SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'");
      assert.equal(active.rows[0]?.count, 0);
      return await collection(time);
    };
    assert.equal((await createWatchEngine({ repository, collector, now: (): Date => time }).runOnce('one')).status, 'completed');
    time = new Date(initial.getTime() + 15 * 60_000);
    assert.equal((await createWatchEngine({ repository, collector, now: (): Date => time }).runOnce('restarted')).status, 'completed');
    assert.equal(calls, 2);
    assert.equal((await repository.listOccurrences(actor.companyId)).filter((item) => item.status === 'completed').length, 2);
  });

  test('erreur et résultat partiel restent visibles, collector bloqué borné puis repris', async (): Promise<void> => {
    const saved = await repository.createWatch(actor, input, 'create-1', initial);
    const error: CollectionResult = { status: 'error', sources: [{ url: BOAMP_SOURCE_URL, status: 'error', evidence: [], error: 'HTTP_503' }], startedAt: initial.toISOString(), completedAt: initial.toISOString() };
    assert.equal((await createWatchEngine({ repository, collector: async (): Promise<CollectionResult> => error, now: (): Date => initial }).runOnce('error')).status, 'error');
    await repository.enqueueManual(actor, saved.id, 'partial', initial);
    const partial = await collection(); partial.status = 'partial'; partial.sources[0]!.status = 'partial'; partial.sources[0]!.error = 'BOUNDED_RESULTS';
    const done = await createWatchEngine({ repository, collector: async (): Promise<CollectionResult> => partial, now: (): Date => initial }).runOnce('partial');
    assert.equal(done.status, 'completed'); assert.equal(done.occurrence?.result?.status, 'partial');
    await repository.enqueueManual(actor, saved.id, 'timeout', initial);
    const timeout = await createWatchEngine({ repository, collector: async (): Promise<CollectionResult> => await new Promise<CollectionResult>((): void => {}), collectionTimeoutMs: 10, now: (): Date => initial }).runOnce('timeout');
    assert.equal(timeout.status, 'error'); assert.equal(timeout.occurrence?.error, 'COLLECTION_FAILED');
    assert.equal((await repository.listOccurrences(actor.companyId)).length, 3);
  });
});
