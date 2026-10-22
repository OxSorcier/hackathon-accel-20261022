import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { SqlPort, SqlResult } from '../../src/contracts/index.ts';
import type { IndustrialAnalysisIntent, IndustrialBasis } from '../../src/contracts/industrial.ts';
import { createIndustrialAnalysisTrigger, type IndustrialAnalysisInput, type IndustrialAnalysisTrigger, type IndustrialTriggerOptions } from '../../src/data/analysis-trigger.ts';

const schema = `industrial_trigger_${randomUUID().replaceAll('-', '')}`;
const companyId = 'INDUSTRIAL-A', principalId = 'SVC-INDUSTRIAL-ANALYSIS';
const base: IndustrialBasis = { companyId, businessRevision: 'R1', policyVersion: 'P1', contextRevision: 'C1', qualificationRevision: 'Q1', eventId: 'FIRE-1', eventRevision: 'E1', researchDependencies: [] };
const limits: IndustrialAnalysisIntent['budget'] = { maxProviderCalls: 1, maxToolCalls: 2, maxDurationMs: 1000, maxRunsPerEvent: 2 };
let admin: Pool; let pool: Pool; let time: Date; let current: boolean; let active: boolean; let created = false;
function port(client: Pool | PoolClient): SqlPort { return { async query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> { const result = await client.query<T>(text, values); return { rows: result.rows, rowCount: result.rowCount }; } }; }
async function tx<T>(work: (client: SqlPort) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(port(client)); await client.query('COMMIT'); return value; } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
function trigger(overrides: Partial<IndustrialTriggerOptions> = {}): IndustrialAnalysisTrigger { return createIndustrialAnalysisTrigger({ servicePrincipalId: principalId, now: (): Date => time,
  resolvePrincipal: async (_client, company, id) => ({ id, companyId: company, role: 'analysis_only', active }), validateBasis: async (): Promise<boolean> => current, ...overrides }); }
function input(changes: Partial<IndustrialBasis> = {}): IndustrialAnalysisInput { return { basis: { ...base, ...changes }, analysisPolicyVersion: 'AP1', budget: { ...limits } }; }
async function enqueueRun(client: SqlPort, intent: IndustrialAnalysisIntent): Promise<string> { const id = `run:${intent.id}`; await client.query('INSERT INTO test_runs(id,company_id) VALUES($1,$2)', [id,intent.basis.companyId]); return id; }
async function queued(repo: IndustrialAnalysisTrigger, changes: Partial<IndustrialBasis> = {}): Promise<IndustrialAnalysisIntent> { const value = await tx(async (client) => await repo.enqueue(client,input(changes))); return await tx(async (client) => await repo.promote(client,companyId,value.id,enqueueRun)); }

describe.skipIf(!process.env.DATA_WATCH_TEST_DATABASE_URL)('Industrial analysis intent, disposable real PostgreSQL', (): void => {
  beforeAll(async (): Promise<void> => {
    const connectionString = process.env.DATA_WATCH_TEST_DATABASE_URL; assert.ok(connectionString); admin = new Pool({ connectionString,max:1 }); await admin.query(`CREATE SCHEMA ${schema}`); created = true;
    pool = new Pool({ connectionString,max:8,options:`-c search_path=${schema}` }); await pool.query('CREATE TABLE companies(company_id text PRIMARY KEY)'); await pool.query('CREATE TABLE test_runs(id text PRIMARY KEY,company_id text NOT NULL)');
    await pool.query(await readFile(new URL('../../proposals/data/industrial-analysis-schema.sql',import.meta.url),'utf8'));
  });
  beforeEach(async (): Promise<void> => { await pool.query('TRUNCATE accel_industrial_analysis_intents,accel_industrial_analysis_budgets,test_runs,companies'); await pool.query("INSERT INTO companies VALUES('INDUSTRIAL-A'),('INDUSTRIAL-B')"); time = new Date('2026-10-22T10:00:00Z'); current = true; active = true; });
  afterAll(async (): Promise<void> => { if (pool) await pool.end(); if (admin) { try { if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin.end(); } } });

  test('concurrent duplicate publications and promotions create exactly one durable intent and existing-worker run', async (): Promise<void> => {
    const repo = trigger(); const values = await Promise.all(Array.from({length:12},async () => await tx(async (client) => await repo.enqueue(client,input()))));
    assert.equal(new Set(values.map((value) => value.id)).size,1);
    const promoted = await Promise.all(values.map(async (value) => await tx(async (client) => await repo.promote(client,companyId,value.id,enqueueRun))));
    assert.ok(promoted.every((value) => value.status === 'queued' && value.runId === promoted[0]?.runId));
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM test_runs')).rows[0]?.n,1);
    assert.equal((await pool.query('SELECT runs_used FROM accel_industrial_analysis_budgets')).rows[0]?.runs_used,1);
    const restored = await tx(async (client) => await trigger().enqueue(client,input())); assert.equal(restored.runId,promoted[0]?.runId);
  });
  test('publication transaction rollback leaves neither intent nor budget record', async (): Promise<void> => {
    await assert.rejects(tx(async (client): Promise<void> => { await trigger().enqueue(client,input()); throw new Error('PUBLICATION_ROLLBACK'); }),/PUBLICATION_ROLLBACK/);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_industrial_analysis_intents')).rows[0]?.n,0);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_industrial_analysis_budgets')).rows[0]?.n,0);
  });
  test('run callback failure rolls back its run, counter and promotion together', async (): Promise<void> => {
    const repo = trigger(), value = await tx(async (client) => await repo.enqueue(client,input()));
    await assert.rejects(tx(async (client) => await repo.promote(client,companyId,value.id,async (connection,intent): Promise<string> => { await enqueueRun(connection,intent); throw new Error('ENQUEUE_FAILED'); })),/ENQUEUE_FAILED/);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM test_runs')).rows[0]?.n,0); assert.equal((await pool.query('SELECT runs_used FROM accel_industrial_analysis_budgets')).rows[0]?.runs_used,0);
    assert.equal((await tx(async (client) => await repo.get(client,companyId,value.id)))?.status,'ready');
    assert.equal((await tx(async (client) => await repo.promote(client,companyId,value.id,enqueueRun))).status,'queued');
  });
  test('event run budget spans versions and qualification while completed history and limits survive restart', async (): Promise<void> => {
    const repo = trigger(), first = await queued(repo); assert.ok(first.runId); await tx(async (client) => await repo.finish(client,companyId,first.id,first.runId!,'done'));
    const second = await queued(trigger(),{eventRevision:'E2',qualificationRevision:'Q2'}); assert.equal(second.status,'queued'); assert.notEqual(second.id,first.id);
    const third = await queued(trigger(),{eventRevision:'E3',qualificationRevision:'Q3'}); assert.equal(third.status,'blocked'); assert.equal(third.blockedReason,'EVENT_RUN_BUDGET_EXHAUSTED');
    assert.equal((await tx(async (client) => await trigger().get(client,companyId,first.id)))?.status,'done');
    assert.equal((await pool.query('SELECT runs_used FROM accel_industrial_analysis_budgets')).rows[0]?.runs_used,2);
    await assert.rejects(tx(async (client) => await trigger().enqueue(client,{...input({eventRevision:'E4'}),budget:{...limits,maxRunsPerEvent:3}})),/INDUSTRIAL_BUDGET_POLICY_CONFLICT/);
  });
  test('principal and current basis are checked before promotion and every reserved effect', async (): Promise<void> => {
    active = false; const blocked = await tx(async (client) => await trigger().enqueue(client,input())); assert.equal(blocked.status,'blocked'); assert.equal(blocked.blockedReason,'ANALYSIS_PRINCIPAL_UNAVAILABLE');
    active = true; const value = await queued(trigger(),{eventRevision:'E2'}); assert.ok(value.runId); current = false;
    assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'provider')),false);
    assert.equal((await tx(async (client) => await trigger().get(client,companyId,value.id)))?.status,'stale');
    assert.equal((await pool.query('SELECT provider_calls FROM accel_industrial_analysis_intents WHERE id=$1',[value.id])).rows[0]?.provider_calls,0);
  });
  test('provider reservation commits before effect, concurrent attempts cannot exceed the persistent per-intent limit', async (): Promise<void> => {
    const value = await queued(trigger()); assert.ok(value.runId);
    const attempts = await Promise.all(Array.from({length:12},async () => await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'provider'))));
    assert.equal(attempts.filter(Boolean).length,1);
    assert.equal((await pool.query('SELECT provider_calls,status,blocked_reason FROM accel_industrial_analysis_intents')).rows[0]?.provider_calls,1);
    assert.equal((await tx(async (client) => await trigger().get(client,companyId,value.id)))?.blockedReason,'PROVIDER_CALL_BUDGET_EXHAUSTED');
    assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'tool')),false);
  });
  test('tool limits, elapsed time and uncertain attempts never reset with a new repository', async (): Promise<void> => {
    const value = await queued(trigger()); assert.ok(value.runId);
    assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'tool')),true);
    time = new Date(time.getTime()+1000); assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'provider')),false);
    assert.equal((await tx(async (client) => await trigger().get(client,companyId,value.id)))?.blockedReason,'DURATION_BUDGET_EXHAUSTED');
    const next = await queued(trigger(),{eventRevision:'E2'}); assert.ok(next.runId); await tx(async (client) => await trigger().finish(client,companyId,next.id,next.runId!,'uncertain','PROCESS_INTERRUPTED'));
    const duplicate = await tx(async (client) => await trigger().enqueue(client,input({eventRevision:'E2'}))); assert.equal(duplicate.status,'uncertain');
    const unchanged = await tx(async (client) => await trigger().promote(client,companyId,next.id,enqueueRun)); assert.equal(unchanged.status,'uncertain');
  });
  test('basis changes invalidate completion and cross-company or mismatched-run calls cannot consume counters', async (): Promise<void> => {
    const value = await queued(trigger()); assert.ok(value.runId);
    await assert.rejects(tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,'OTHER-RUN','tool')),/INDUSTRIAL_RUN_MISMATCH/);
    assert.equal(await tx(async (client) => await trigger().get(client,'INDUSTRIAL-B',value.id)),null);
    current = false; const after = await tx(async (client) => await trigger().finish(client,companyId,value.id,value.runId!,'done')); assert.equal(after.status,'stale');
    const separate = await tx(async (client) => await trigger().enqueue(client,input({companyId:'INDUSTRIAL-B'}))); assert.notEqual(separate.id,value.id);
  });
  test('research basis canonicalization deduplicates reordered refs but a changed generation creates a distinct intent', async (): Promise<void> => {
    const ref = { occurrenceId:'occ:one',evidenceId:'source:one',contentHash:'a'.repeat(64) }, second = {...ref,evidenceId:'source:two'};
    const dep = { scope:{profileId:'soissons-project',profileVersion:'v1',namespace:'live' as const},generation:1,validUntil:'2026-10-23T00:00:00Z',evidenceRefs:[ref,second] };
    const first = await tx(async (client) => await trigger().enqueue(client,input({researchDependencies:[dep]})));
    const same = await tx(async (client) => await trigger().enqueue(client,input({researchDependencies:[{...dep,evidenceRefs:[second,ref]}]}))); assert.equal(same.id,first.id);
    const identicalRefresh = await tx(async (client) => await trigger().enqueue(client,input({researchDependencies:[{...dep,validUntil:'2026-10-24T00:00:00Z'}]}))); assert.equal(identicalRefresh.id,first.id); assert.equal(identicalRefresh.basis.researchDependencies[0]?.validUntil,new Date(dep.validUntil).toISOString());
    const changed = await tx(async (client) => await trigger().enqueue(client,input({researchDependencies:[{...dep,generation:2}]}))); assert.notEqual(changed.id,first.id);
    await assert.rejects(tx(async (client) => await trigger().enqueue(client,input({researchDependencies:[dep,dep]}))));
  });
  test('existing worker reads only bounded ready intents and expired completion cannot publish done', async (): Promise<void> => {
    const repo = trigger(); const first = await tx(async (client) => await repo.enqueue(client,input()));
    await tx(async (client) => await repo.enqueue(client,input({eventRevision:'E2'})));
    assert.equal((await repo.listReady(port(pool),{limit:1})).length,1); await assert.rejects(repo.listReady(port(pool),{limit:11}));
    const promoted = await tx(async (client) => await repo.promote(client,companyId,first.id,enqueueRun)); assert.ok(promoted.runId);
    assert.equal(await tx(async (client) => await repo.reserveUsage(client,companyId,first.id,promoted.runId!,'tool')),true);
    time = new Date(time.getTime()+1000);
    const finished = await tx(async (client) => await repo.finish(client,companyId,first.id,promoted.runId!,'done')); assert.equal(finished.status,'blocked'); assert.equal(finished.blockedReason,'DURATION_BUDGET_EXHAUSTED');
    assert.equal((await repo.listReady(port(pool),{limit:10})).length,1);
  });
  test('tool call reservations have their own durable strict bound', async (): Promise<void> => {
    const value = await queued(trigger()); assert.ok(value.runId);
    for (let index=0;index<2;index++) assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'tool')),true);
    assert.equal(await tx(async (client) => await trigger().reserveUsage(client,companyId,value.id,value.runId!,'tool')),false);
    const row = (await pool.query('SELECT tool_calls,provider_calls,blocked_reason FROM accel_industrial_analysis_intents')).rows[0]; assert.equal(row?.tool_calls,2); assert.equal(row?.provider_calls,0); assert.equal(row?.blocked_reason,'TOOL_CALL_BUDGET_EXHAUSTED');
  });
});
