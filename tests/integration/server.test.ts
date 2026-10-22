import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor, AgentRunnerResult, BusinessEngine, CompanySnapshot, Proposal } from '../../src/contracts/index.js';
import { createApp } from '../../src/server/app.js';
import { migrate } from '../../src/server/migrate.js';
import { PgStore } from '../../src/server/store.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { createRunWorker } from '../../src/server/worker.js';
import { createWatchServices } from '../../src/server/watch-service.js';
import { syntheticSnapshot } from '../../src/server/operator.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('real local PostgreSQL server boundaries', () => {
  const schema = `test_${randomBytes(8).toString('hex')}`;
  let pool: Pool; let store: PgStore; let snapshot: CompanySnapshot;
  const actor: Actor = { actorId: 'EMP-PAUL', companyId: 'CO-DEMO', role: 'direction', approvalCeilingEur: 2000 };
  const evaluate: BusinessEngine = current => ({ id: 'test-evaluation', companyId: current.companyId, revision: current.revision, policyVersion: current.policyVersion, evaluatedAt: current.updatedAt, constraints: [], unknowns: [], facts: {}, options: [{ id: 'test-option', kind: 'wait', label: 'Injected test option', status: 'feasible', costEur: 120, conditions: [], reasons: [], effects: {} }] });
  const resultFor = (runId: string): AgentRunnerResult => {
    const proposal: Proposal = { id: randomUUID(), runId, companyId: snapshot.companyId, revision: snapshot.revision, policyVersion: snapshot.policyVersion, evaluation: evaluate(snapshot), optionId: 'test-option', title: 'Injected test provider output', summary: 'Synthetic protocol test; no real inference.', conditions: [], status: 'pending', createdAt: new Date().toISOString() };
    return { status: 'proposal', proposal, model: 'injected-test-only', traces: [], message: 'Test only' };
  };
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); store = new PgStore(pool);
    await Promise.all([migrate(pool), migrate(pool)]);
    const dataset = datasetSchema.parse(JSON.parse(await readFile('fixtures/company/dataset.json', 'utf8')));
    const policy = policySchema.parse(JSON.parse(await readFile('fixtures/company/company-policy.json', 'utf8')));
    snapshot = { companyId: dataset.company_id, revision: dataset.snapshot_revision, policyVersion: 'P1', dataOrigin: 'synthetic', dataset, policy, updatedAt: dataset.as_of };
    await store.seed(snapshot);
  });
  afterAll(async () => { if (pool) await pool.end(); const admin = new Pool({ connectionString: url }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  it('persists a seed and refuses an implicit reset', async () => {
    await expect(store.seed(snapshot)).rejects.toMatchObject({ code: 'EXISTS' });
    expect((await store.snapshot(actor.companyId)).revision).toBe('R0');
  });
  it('keeps the server company identity coherent across a fresh seed and display rename', async () => {
    const id = 'CO-IDENTITY-TEST';
    const fresh = syntheticSnapshot(snapshot.dataset, snapshot.policy, id);
    await store.seed(fresh);
    const saved = await store.snapshot(id);
    expect([saved.companyId, saved.dataset.company_id, saved.policy.company_id, saved.dataset.tables.company?.[0]?.id]).toEqual([id, id, id, id]);
    const renamed = structuredClone(saved); renamed.dataset.tables.company![0]!.name = 'Nom de lecture modifié';
    const updated = await store.replaceSnapshot({ ...actor, companyId: id, role: 'operator' }, saved.revision, renamed);
    expect(updated.companyId).toBe(id); expect(updated.dataset.tables.company![0]!.id).toBe(id);
    expect(updated.revision).not.toBe(saved.revision);
    expect(snapshot.dataset.tables.company![0]!.id).toBe('CO-DEMO');
    for (const invalid of [
      { ...saved, companyId: 'FOREIGN' },
      { ...saved, dataset: { ...saved.dataset, tables: { ...saved.dataset.tables, company: [{ ...saved.dataset.tables.company![0]!, id: 'FOREIGN' }] } } },
      { ...saved, dataset: { ...saved.dataset, tables: { ...saved.dataset.tables, company: [] } } },
    ]) await expect(store.seed(invalid)).rejects.toThrow();
  });
  it('denies anonymous and cross-origin mutations before creating work', async () => {
    const app = await createApp({ store, config: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1', port: 3000, companyId: actor.companyId, demoToken: randomBytes(32).toString('hex'), operatorToken: randomBytes(32).toString('hex'), secureCookies: false }, evaluate });
    const payload = { question: 'Question de test', operationKey: randomUUID() };
    expect((await app.inject({ method: 'POST', url: '/api/questions', payload, headers: { origin: 'http://127.0.0.1:3000' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/questions', payload, headers: { origin: 'https://evil.example' } })).statusCode).toBe(403);
    expect(await store.runs(actor.companyId)).toHaveLength(0);
    await app.close();
  });
  it('coalesces concurrent identical questions and rejects conflicting reuse', async () => {
    const input = { question: 'Question de test', operationKey: randomUUID() };
    const [first, second] = await Promise.all([store.queueQuestion(actor, input), store.queueQuestion(actor, input)]);
    expect(first.id).toBe(second.id);
    await expect(store.queueQuestion(actor, { ...input, question: 'Autre question' })).rejects.toMatchObject({ code: 'OPERATION_CONFLICT' });
    const worker = createRunWorker(store, async input => resultFor(input.run.id));
    expect(await worker.tick()).toBe(true);
    const persisted = await store.run(actor.companyId, first.id);
    expect(persisted.status).toBe('proposal'); expect(persisted.model).toBe('injected-test-only');
    const reconnected = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    expect((await new PgStore(reconnected).run(actor.companyId, first.id)).proposalId).toBe(persisted.proposalId);
    await reconnected.end();
    const id = persisted.proposalId!;
    const command = { decision: 'approve' as const, revision: snapshot.revision, policyVersion: snapshot.policyVersion, operationKey: randomUUID() };
    await expect(store.decide({ ...actor, approvalCeilingEur: 100 }, id, command, evaluate)).rejects.toMatchObject({ code: 'BUDGET' });
    const [a, b] = await Promise.all([store.decide(actor, id, command, evaluate), store.decide(actor, id, command, evaluate)]);
    expect(a.status).toBe('approved'); expect(b.id).toBe(a.id);
    expect((await store.memories(actor.companyId)).filter(memory => memory.proposalId === id)).toHaveLength(1);
    expect((await store.snapshot(actor.companyId)).dataset.tables.inventory).toEqual(snapshot.dataset.tables.inventory);
  });
  it('accepts the UI public example and explains unsupported topics before external work', async () => {
    const config = { origin: 'http://127.0.0.1:3000', host: '127.0.0.1', port: 3000, companyId: actor.companyId, demoToken: randomBytes(32).toString('hex'), operatorToken: randomBytes(32).toString('hex'), secureCookies: false };
    const watches = createWatchServices(store);
    const app = await createApp({ store, config, evaluate, watches: watches.service });
    const login = await app.inject({ method: 'POST', url: '/api/session', payload: { token: config.demoToken }, headers: { origin: config.origin } });
    const cookie = login.cookies[0]!;
    const headers = { origin: config.origin, cookie: `${cookie.name}=${cookie.value}` };
    const payload = { publicTopic: 'Production d’isolants en France et perturbations publiques', sourceUrls: ['https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records'], cadenceMinutes: 15 };
    const accepted = await app.inject({ method: 'POST', url: '/api/watches', payload, headers });
    expect(accepted.statusCode).toBe(200);
    const unsupported = await app.inject({ method: 'POST', url: '/api/watches', payload: { ...payload, publicTopic: 'Commande privée du client TEST' }, headers });
    expect(unsupported.statusCode).toBe(400); expect(unsupported.json().error.code).toBe('PUBLIC_TOPIC_REQUIRED');
    expect((await watches.service.list(actor.companyId)).length).toBe(1);
    await app.close();
  });
  it('preserves uncertain results and durable traces after one failed finalization', async () => {
    const run = await store.queueQuestion(actor, { question: 'Uncertain finalize', operationKey: randomUUID() });
    const trace = { id: 'uncertain-finalize-test', tool: 'model_result', input: {}, output: { status: 'uncertain' }, startedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    const original = store.finishRun.bind(store);
    const finalize = vi.spyOn(store, 'finishRun').mockRejectedValueOnce(new Error('Injected finalization outage')).mockImplementation(original);
    try {
      const worker = createRunWorker(store, async () => {
        await store.query("UPDATE runs SET payload=jsonb_set(payload,'{traces}',$2::jsonb) WHERE id=$1", [run.id, JSON.stringify([trace])]);
        return { status: 'uncertain', proposal: null, traces: [trace], model: 'injected-test-only', message: 'Réconcilier la tentative fournisseur.' };
      });
      await worker.tick();
      const saved = await store.run(actor.companyId, run.id);
      expect(saved.status).toBe('uncertain'); expect(saved.traces).toEqual([trace]); expect(saved.model).toBe('injected-test-only');
    } finally { finalize.mockRestore(); }
  });
  it('expires a lease without publishing a stale holder or retrying a provider', async () => {
    const run = await store.queueQuestion(actor, { question: 'Lease test', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    await store.query("UPDATE runs SET lease_until=now()-interval '1 second' WHERE id=$1", [run.id]);
    expect(await store.claimRun()).toBeNull();
    expect((await store.run(actor.companyId, run.id)).status).toBe('uncertain');
    expect(await store.finishRun(run, claim!.fence, resultFor(run.id))).toBe(false);
  });
  it('invalidates pending decisions on an operator change before worker recalculation', async () => {
    const run = await store.queueQuestion(actor, { question: 'Old plan', operationKey: randomUUID() });
    const claim = await store.claimRun(); await store.finishRun(run, claim!.fence, resultFor(run.id));
    const proposalId = (await store.run(actor.companyId, run.id)).proposalId!;
    await expect(store.replaceSnapshot(actor, snapshot.revision, snapshot)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const updated = await store.replaceSnapshot({ ...actor, actorId: 'OPERATOR', role: 'operator' }, snapshot.revision, snapshot);
    expect(updated.revision).not.toBe(snapshot.revision);
    await expect(store.decide(actor, proposalId, { decision: 'approve', revision: snapshot.revision, policyVersion: snapshot.policyVersion, operationKey: randomUUID() }, evaluate)).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    expect((await store.proposals(actor.companyId)).find(proposal => proposal.id === proposalId)?.status).toBe('stale');
    const freshRun = await store.queueQuestion(actor, { question: 'Uncertain and stale', operationKey: randomUUID() });
    const freshClaim = await store.claimRun();
    await store.replaceSnapshot({ ...actor, actorId: 'OPERATOR', role: 'operator' }, updated.revision, updated);
    await store.finishRun(freshRun, freshClaim!.fence, { status: 'uncertain', proposal: null, traces: [], model: 'injected-test-only', message: 'Réconcilier la tentative fournisseur.' });
    const uncertain = await store.run(actor.companyId, freshRun.id);
    expect(uncertain.status).toBe('uncertain'); expect(uncertain.message).toMatch(/concilier/); expect(uncertain.proposalId).toBeNull();
  });
});
