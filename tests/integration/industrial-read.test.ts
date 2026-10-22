import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor, AgentRunnerResult, CompanySnapshot } from '../../src/contracts/index.js';
import { createApp } from '../../src/server/app.js';
import { IndustrialReadRepository, industrialHash } from '../../src/server/industrial-read.js';
import { PgStore } from '../../src/server/store.js';
import { migrate } from '../../src/server/migrate.js';
import { syntheticSnapshot } from '../../src/server/operator.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { createIndustrialAnalysisTrigger } from '../../src/data/analysis-trigger.js';
import { createRunWorker } from '../../src/server/worker.js';
import type { IndustrialReport, ReleasedIndustrialEvent } from '../../src/contracts/industrial.js';
import { parseIndustrialContext } from '../../src/data/industrial-relations.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('industrial read checkpoint on persisted company and context', () => {
  const schema = `industrial_read_${randomBytes(8).toString('hex')}`;
  const companyId = 'CO-DEMO-INDUSTRIAL-CANDIDATE';
  const actor: Actor = { companyId, actorId: 'EMP-PAUL', role: 'direction', approvalCeilingEur: 2000 };
  const operator: Actor = { companyId, actorId: 'OPERATOR-IMPORT', role: 'operator', approvalCeilingEur: 0 };
  let pool: Pool; let store: PgStore; let repository: IndustrialReadRepository; let snapshot: CompanySnapshot; let context: unknown;
  const sourceHash = '95a9aeb940ad51f576779e161e633f47e39d78678355b86b01bfd3386ed3235e';
  const operationKey = 'industrial-context-test-import';
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); await migrate(pool);
    store = new PgStore(pool); repository = new IndustrialReadRepository(store);
    const base = 'proposals/product/alignment-20261022/v2/';
    const dataset = datasetSchema.parse(JSON.parse(await readFile(`${base}portfolio-10000.json`, 'utf8')));
    const policy = policySchema.parse(JSON.parse(await readFile(`${base}portfolio-policy.json`, 'utf8')));
    context = JSON.parse(await readFile(`${base}industrial-context.v2.json`, 'utf8'));
    snapshot = syntheticSnapshot(dataset, policy, companyId); await store.seed(snapshot);
    await store.seed(syntheticSnapshot(dataset, policy, 'CO-FOREIGN-INDUSTRIAL'));
    await store.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), companyId, snapshot.revision, operator.actorId, 'industrial_core_import', { testOnly: true }]);
  });
  afterAll(async () => { if (pool) await pool.end(); const admin = new Pool({ connectionString: url }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  it('requires explicit operator import and preserves the native core and source context', async () => {
    expect(await repository.isIndustrial(companyId)).toBe(true);
    await expect(repository.workspace(actor)).rejects.toMatchObject({ code: 'INDUSTRIAL_CONTEXT_NOT_RECEIVED' });
    await expect(repository.importContext(actor, context, snapshot.revision, operationKey, sourceHash)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const before = industrialHash((await store.snapshot(companyId)).dataset);
    const imported = await repository.importContext(operator, context, snapshot.revision, operationKey, sourceHash);
    expect(imported.companyId).toBe(companyId); expect(imported.commercialDemand).toHaveLength(1);
    expect(await repository.isIndustrial(companyId)).toBe(true);
    expect(industrialHash((await store.snapshot(companyId)).dataset)).toBe(before);
    expect(await repository.importContext(operator, context, snapshot.revision, operationKey, sourceHash)).toEqual(imported);
    await expect(repository.importContext(operator, context, 'OTHER-R', operationKey, sourceHash)).rejects.toMatchObject({ code: 'OPERATION_CONFLICT' });
    expect((await store.query('SELECT revision FROM accel_industrial_context_versions')).rowCount).toBe(1);
  });
  it('serves actual bounded company facts and empty states while actions are disconnected', async () => {
    const view = await repository.workspace(actor);
    expect(view.company.counts.order_lines).toBe(10000); expect(view.company.counts.depots).toBe(6);
    expect(view.company.counts.construction_projects).toBe(24); expect(view.context.counts.qualifiedDemands).toBe(1);
    expect(view.context.revision).toBe('IC-INDUSTRIAL-2-2'); expect(view.company.businessRevision).toBe(snapshot.revision);
    expect(view.reports).toEqual([]); expect(view.events).toEqual([]); expect(view.analyses).toEqual([]);
    expect(view.capabilities.automaticAnalysis).toBe(false); expect(view.capabilities.simulationConnected).toBe(false);
    expect(JSON.stringify(view).length).toBeLessThan(10000);
    await expect(repository.workspace({ ...actor, companyId: 'CO-FOREIGN-INDUSTRIAL' })).rejects.toMatchObject({ code: 'INDUSTRIAL_CONTEXT_NOT_RECEIVED' });
    await expect(repository.report(actor, 'missing-report')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('returns real persisted intent state through the canonical metadata parser', async () => {
    const trigger = createIndustrialAnalysisTrigger({ servicePrincipalId: 'SERVICE-INDUSTRIAL-ANALYSIS', resolvePrincipal: async () => ({ id: 'SERVICE-INDUSTRIAL-ANALYSIS', companyId, role: 'analysis_only', active: true }), validateBasis: async () => true });
    const intent = await store.transaction(async client => await trigger.enqueue(client, { basis: { companyId, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, contextRevision: 'IC-INDUSTRIAL-2-2', qualificationRevision: 'Q-INDUSTRIAL-2-1', eventId: 'TEST-READER-METADATA-ONLY', eventRevision: 'TEST-1', researchDependencies: [] }, analysisPolicyVersion: 'test-only:1', budget: { maxProviderCalls: 2, maxToolCalls: 3, maxDurationMs: 60000, maxRunsPerEvent: 2 } }));
    expect((await repository.workspace(actor)).analyses.map(value => value.id)).toEqual([intent.id]);
    expect((await repository.workspace(actor)).analyses[0]?.status).toBe('ready');
    expect((await store.runs(companyId))).toEqual([]);
  });
  it('authenticates HTTP reads, rejects arbitrary company scope and blocks all exhaustive C1 analyses', async () => {
    const config = { origin: 'http://127.0.0.1:3003', host: '127.0.0.1', port: 3003, companyId, demoToken: 'not-a-real-secret', operatorToken: 'test-only', secureCookies: false };
    const app = await createApp({ store, config, industrial: repository, evaluate: () => { throw new Error('No exhaustive C1 calculation allowed'); } });
    try {
      expect((await app.inject({ method: 'GET', url: '/api/industrial' })).statusCode).toBe(401);
      const session = await store.session(actor); const headers = { cookie: `accel_session=${session}`, origin: config.origin };
      const result = await app.inject({ method: 'GET', url: '/api/industrial', headers });
      expect(result.statusCode).toBe(200); expect(result.json().data.company.counts.order_lines).toBe(10000);
      expect((await app.inject({ method: 'GET', url: '/api/industrial?companyId=CO-FOREIGN-INDUSTRIAL', headers })).statusCode).toBe(400);
      for (const path of ['/api/questions', '/api/research/soissons-project/analyze', '/api/cases/any-case/analyze', '/api/proposals/any-proposal/decision']) {
        expect((await app.inject({ method: 'POST', url: path, headers, payload: { question: 'Test', operationKey: randomUUID() } })).statusCode).toBe(409);
      }
      expect((await app.inject({ method: 'POST', url: '/api/industrial/questions', headers, payload: { question: 'Test', operationKey: randomUUID() } })).statusCode).toBe(503);
      expect((await store.runs(companyId))).toEqual([]);
    } finally { await app.close(); }
  });
  const freshCompany = async (): Promise<{ user: Actor; op: Actor; fresh: CompanySnapshot; received: unknown }> => {
    const id = `CO-RACE-${randomUUID()}`;
    const fresh = syntheticSnapshot(snapshot.dataset, snapshot.policy, id);
    await store.seed(fresh);
    return { user: { ...actor, companyId: id }, op: { ...operator, companyId: id }, fresh, received: { ...(context as object), companyId: id } };
  };
  it('rejects a generic question when import commits after the HTTP mode check', async () => {
    const { user, op, fresh, received } = await freshCompany();
    const check = vi.spyOn(repository, 'isIndustrial').mockImplementationOnce(async () => {
      await repository.importContext(op, received, fresh.revision, randomUUID(), sourceHash);
      return false;
    });
    const config = { origin: 'http://127.0.0.1:3003', host: '127.0.0.1', port: 3003, companyId: user.companyId, demoToken: 'test-only', operatorToken: 'test-only', secureCookies: false };
    const app = await createApp({ store, config, industrial: repository, evaluate: () => { throw new Error('No C1 evaluation'); } });
    try {
      const session = await store.session(user);
      const response = await app.inject({ method: 'POST', url: '/api/questions', headers: { origin: config.origin, cookie: `accel_session=${session}` }, payload: { question: 'A generic question racing import', operationKey: randomUUID() } });
      expect(response.statusCode).toBe(409); expect(await store.runs(user.companyId)).toHaveLength(0);
    } finally { check.mockRestore(); await app.close(); }
  });
  it('revokes previously queued C1 work before a worker can receive the industrial snapshot', async () => {
    const { user, op, fresh, received } = await freshCompany();
    const run = await store.queueQuestion(user, { question: 'Queued before import', operationKey: randomUUID() });
    await repository.importContext(op, received, fresh.revision, randomUUID(), sourceHash);
    const runner = vi.fn(async () => ({ status: 'needs_input' as const, proposal: null, traces: [], message: 'Test only', model: null }));
    await createRunWorker(store, runner).tick();
    expect(runner).not.toHaveBeenCalled(); expect((await store.run(user.companyId, run.id)).status).toBe('stale_context');
    await expect(store.queueQuestion(user, { question: 'Bypass HTTP', operationKey: randomUUID() })).rejects.toMatchObject({ code: 'INDUSTRIAL_SCOPE_REQUIRED' });
    await expect(store.decide(user, 'missing', { decision: 'approve', revision: fresh.revision, policyVersion: fresh.policyVersion, operationKey: randomUUID() }, () => { throw new Error('Must not evaluate'); })).rejects.toMatchObject({ code: 'INDUSTRIAL_SCOPE_REQUIRED' });
  });
  it('waits for a claimed generic run to finish before importing its company context', async () => {
    const { user, op, fresh, received } = await freshCompany();
    const run = await store.queueQuestion(user, { question: 'Claimed before import', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    await expect(repository.importContext(op, received, fresh.revision, randomUUID(), sourceHash)).rejects.toMatchObject({ code: 'ANALYSIS_IN_PROGRESS' });
    expect(await repository.isIndustrial(user.companyId)).toBe(false);
    await store.finishRun(run, claim!.fence, { status: 'needs_input', proposal: null, traces: [], model: null, message: 'Finished injected test' });
    await repository.importContext(op, received, fresh.revision, randomUUID(), sourceHash);
    expect(await repository.isIndustrial(user.companyId)).toBe(true);
  });
  it('fences an expired C1 publisher whose transaction began before the import', async () => {
    const { user, op, fresh, received } = await freshCompany();
    const run = await store.queueQuestion(user, { question: 'Delayed fenced publication', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    let notify: () => void = () => {}; let resume: () => void = () => {};
    const entered = new Promise<void>(resolve => { notify = resolve; });
    const barrier = new Promise<void>(resolve => { resume = resolve; });
    const original = store.snapshot.bind(store);
    let transactionStarted = '';
    const spy = vi.spyOn(store, 'snapshot').mockImplementationOnce(async (id, client, lock) => {
      transactionStarted = (await client!.query<{ at: string }>('SELECT transaction_timestamp()::text AS at')).rows[0]!.at;
      notify(); await barrier; return await original(id, client, lock);
    });
    const evaluation = { id: 'injected-evaluation', companyId: user.companyId, revision: fresh.revision, policyVersion: fresh.policyVersion, evaluatedAt: new Date().toISOString(), constraints: [], unknowns: [], facts: {}, options: [] };
    const result: AgentRunnerResult = { status: 'proposal', proposal: { id: `proposal:${run.id}`, runId: run.id, companyId: user.companyId, revision: fresh.revision, policyVersion: fresh.policyVersion, evaluation, optionId: 'injected-option', title: 'Injected publication fixture', summary: 'No model call or business outcome claimed.', conditions: [], status: 'pending', createdAt: new Date().toISOString() }, traces: [], model: null, message: 'Injected protocol only' };
    const finishing = store.finishRun(run, claim!.fence, result);
    try {
      await entered;
      await store.query("UPDATE runs SET lease_until=clock_timestamp()-interval '1 millisecond' WHERE id=$1", [run.id]);
      expect((await store.query<{ old_clock_accepts: boolean }>('SELECT lease_until>$2::timestamptz AS old_clock_accepts FROM runs WHERE id=$1', [run.id, transactionStarted])).rows[0]!.old_clock_accepts).toBe(true);
      await repository.importContext(op, received, fresh.revision, randomUUID(), sourceHash);
      resume(); expect(await finishing).toBe(false);
      expect((await store.run(user.companyId, run.id)).status).toBe('uncertain');
      expect(await store.proposals(user.companyId)).toHaveLength(0);
    } finally { resume(); await finishing; spy.mockRestore(); }
  });
  it('refuses a C1 publication after real lease expiry without relying on an import', async () => {
    const { user, op, fresh, received } = await freshCompany();
    const run = await store.queueQuestion(user, { question: 'Delayed fenced publication', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    let notify: () => void = () => {}; let resume: () => void = () => {};
    const entered = new Promise<void>(resolve => { notify = resolve; });
    const barrier = new Promise<void>(resolve => { resume = resolve; });
    const original = store.snapshot.bind(store);
    let transactionStarted = '';
    const spy = vi.spyOn(store, 'snapshot').mockImplementationOnce(async (id, client, lock) => {
      transactionStarted = (await client!.query<{ at: string }>('SELECT transaction_timestamp()::text AS at')).rows[0]!.at;
      notify(); await barrier; return await original(id, client, lock);
    });
    const evaluation = { id: 'injected-evaluation', companyId: user.companyId, revision: fresh.revision, policyVersion: fresh.policyVersion, evaluatedAt: new Date().toISOString(), constraints: [], unknowns: [], facts: {}, options: [] };
    const result: AgentRunnerResult = { status: 'proposal', proposal: { id: `proposal:${run.id}`, runId: run.id, companyId: user.companyId, revision: fresh.revision, policyVersion: fresh.policyVersion, evaluation, optionId: 'injected-option', title: 'Injected publication fixture', summary: 'No model call or business outcome claimed.', conditions: [], status: 'pending', createdAt: new Date().toISOString() }, traces: [], model: null, message: 'Injected protocol only' };
    const finishing = store.finishRun(run, claim!.fence, result);
    try {
      await entered;
      await store.query("UPDATE runs SET lease_until=clock_timestamp()-interval '1 millisecond' WHERE id=$1", [run.id]);
      expect((await store.query<{ old_clock_accepts: boolean }>('SELECT lease_until>$2::timestamptz AS old_clock_accepts FROM runs WHERE id=$1', [run.id, transactionStarted])).rows[0]!.old_clock_accepts).toBe(true);
      resume(); expect(await finishing).toBe(false);
      await store.claimRun(); expect((await store.run(user.companyId, run.id)).status).toBe('uncertain');
      expect(await store.proposals(user.companyId)).toHaveLength(0);
    } finally { resume(); await finishing; spy.mockRestore(); }
  });
  it('keeps report freshness independent from the twenty-event display window', async () => {
    const raw = JSON.parse(await readFile('proposals/product/alignment-20261022/v2/operator-event.v2.json', 'utf8')) as Pick<ReleasedIndustrialEvent, 'event' | 'confirmations' | 'competitorConfirmations'>;
    const run = { id: randomUUID(), companyId, actorId: actor.actorId, operationKey: randomUUID(), question: 'Persisted read fixture', status: 'needs_input', revision: snapshot.revision, policyVersion: snapshot.policyVersion, mode: 'test', model: null, proposalId: null, message: 'Injected metadata fixture', traces: [], createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    await store.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)', [run.id, companyId, run.operationKey, actor, run]);
    const releases: ReleasedIndustrialEvent[] = Array.from({ length: 21 }, (_, index) => ({ ...structuredClone(raw), id: `read-release-${index}`, companyId, revision: '1', contextRevision: 'IC-INDUSTRIAL-2-2', qualificationRevision: 'Q-INDUSTRIAL-2-1', businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, event: { ...raw.event, eventId: `read-event-${index}` }, releasedByActorId: operator.actorId, releasedAt: new Date().toISOString(), researchDependencies: [] }));
    const first = releases[0]!;
    const basis = { companyId, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, contextRevision: first.contextRevision, qualificationRevision: first.qualificationRevision, eventId: first.event.eventId, eventRevision: first.revision, researchDependencies: [] };
    const report: IndustrialReport = { id: 'read-window-report', companyId, runId: run.id, basis, status: 'prepared', title: 'Injected report for display-window regression', summary: 'No model or analysis result claimed.', assessment: { id: 'read-assessment', basis, evaluatedAt: new Date().toISOString(), testOnly: true, impact: 'needs_input', affectedOrderLineIds: [], qualifiedDemandIds: [], coverage: { totalCommitments: 10000, protectedCommitments: 0, worsenedOrderLineIds: [], remainingShortageOrderLineIds: [] }, plans: [], constraints: [], unknowns: ['TEST_FIXTURE'], calculationHash: 'a'.repeat(64) }, recommendedPlanId: null, createdAt: new Date().toISOString() };
    const quote = parseIndustrialContext(context, snapshot).independentAlternatives[0]!;
    report.assessment.plans.push({ id: 'read-resource-plan', version: '1', basis, evaluationId: report.assessment.id, demandId: 'CRM-IND-000', targetOrderLineIds: [], steps: [{ id: 'read-resource-step', kind: 'purchase', canonicalResourceId: quote.canonicalResourceId, quoteId: quote.quoteId, supplierId: quote.supplierId, supplierSiteId: quote.supplierSiteId, productId: quote.productId, unit: quote.unit, quantity: 1, destinationDepotId: quote.destinationDepotId, arrivalDate: quote.arrivalDate, materialCents: quote.unitCostCents, freightCents: quote.freightCents, dependsOn: [] }], allocations: [], economics: { currency: 'EUR', grossNewSpendCents: 0, riskMitigationSpendCents: 0, opportunityRevenueCents: null, opportunityMaterialValuationCents: null, opportunityFreightCents: null, opportunityHandlingCents: null, opportunityContributionCents: null, missing: ['TEST_FIXTURE'] }, constraints: [], unknowns: ['TEST_FIXTURE'], status: 'conditional' });
    const insert = async (release: ReleasedIndustrialEvent): Promise<void> => {
      await store.query('INSERT INTO accel_industrial_releases(id,company_id,event_id,revision,payload,operation_key,command_hash) VALUES($1,$2,$3,$4,$5,$6,$7)', [release.id, companyId, release.event.eventId, release.revision, release, randomUUID(), industrialHash(release)]);
      await store.query('INSERT INTO accel_industrial_event_heads(company_id,event_id,release_id) VALUES($1,$2,$3)', [companyId, release.event.eventId, release.id]);
    };
    await insert(first);
    await store.query('INSERT INTO accel_industrial_reports(id,company_id,run_id,payload) VALUES($1,$2,$3,$4)', [report.id, companyId, run.id, report]);
    expect((await repository.report(actor, report.id)).report.status).toBe('prepared');
    for (const release of releases.slice(1)) await insert(release);
    expect((await repository.workspace(actor)).events).toHaveLength(20);
    expect((await repository.report(actor, report.id)).report.status).toBe('prepared');
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse(quote.validUntil) + 1);
      const expired = await repository.report(actor, report.id);
      expect(expired.report.status).toBe('prepared'); expect(expired.freshness).toBe('stale');
      expect(expired.planStates[0]?.status).toBe('stale');
      const native = snapshot.dataset.tables.transport_quotes![0]!;
      report.assessment.plans[0]!.steps = [{ id: 'read-c1-transfer', kind: 'transfer', canonicalResourceId: String(native.id), quoteId: String(native.id), quoteSource: 'c1_transport', productId: String(native.product_id), unit: String(native.unit), quantity: 1, fromDepotId: String(native.from_depot_id), destinationDepotId: String(native.to_depot_id), dispatchDate: '2026-10-22', arrivalDate: '2026-10-23', freightCents: 0, handlingCents: 0, dependsOn: [] }];
      await store.query('UPDATE accel_industrial_reports SET payload=$2 WHERE id=$1', [report.id, report]);
      vi.setSystemTime('2026-10-22T21:00:00Z');
      expect((await repository.report(actor, report.id)).freshness).toBe('current');
      vi.setSystemTime('2026-10-22T22:30:00Z');
      const localMidnight = await repository.report(actor, report.id);
      expect(localMidnight.freshness).toBe('stale'); expect(localMidnight.report.status).toBe('prepared');
      expect(localMidnight.planStates[0]?.status).toBe('stale');
    } finally { vi.useRealTimers(); }
    await store.query("UPDATE accel_industrial_reports SET payload=jsonb_set(payload,'{status}','\"needs_input\"') WHERE id=$1", [report.id]);
    const before = await store.snapshot(companyId); const changed = structuredClone(before);
    changed.dataset.tables.crm_opportunities!.find(value => value.id === 'CRM-IND-000')!.status = 'cancelled';
    await store.replaceSnapshot(operator, before.revision, changed);
    const historical = await repository.report(actor, report.id);
    expect(historical.report.status).toBe('needs_input'); expect(historical.freshness).toBe('stale');
    await store.transaction(async client => { await expect(repository.context(client, await store.snapshot(companyId, client, true))).rejects.toThrow('INVALID_INDUSTRIAL_CONTEXT'); });
  });
});
