import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor, AgentRun, AgentRunnerResult, BusinessEvaluation, CompanySnapshot, DecisionCase, SourceEvidence } from '../../src/contracts/index.js';
import type { ResearchContext, ResearchScope } from '../../src/contracts/research.js';
import { createResearchRepository, type ResearchRepository } from '../../src/data/research-repository.js';
import { businessEngine, evaluateCaseBusiness } from '../../src/domain/index.js';
import { CaseRepository, releaseCase } from '../../src/server/cases.js';
import { migrate } from '../../src/server/migrate.js';
import { syntheticSnapshot } from '../../src/server/operator.js';
import { invalidateResearchDependents } from '../../src/server/research-service.js';
import { PgStore } from '../../src/server/store.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { createRunWorker } from '../../src/server/worker.js';
import { createAgentRunner, type ModelProvider } from '../../src/agent/index.js';
import { createWatchRepository } from '../../src/data/watch-repository.js';
import { createSerializedWatchRepository } from '../../src/server/watch-service.js';
import { evaluateBusiness } from '../../src/domain/index.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('research dependencies across company, run, source correction and decision boundaries', () => {
  const schema = `research_integration_${randomBytes(8).toString('hex')}`;
  const actor: Actor = { actorId: 'EMP-PAUL', companyId: 'CO-RESEARCH-A', role: 'direction', approvalCeilingEur: 2000 };
  const operator: Actor = { ...actor, actorId: 'RESEARCH-OPERATOR', role: 'operator', approvalCeilingEur: 0 };
  const scope: ResearchScope = { profileId: 'soissons-project', profileVersion: 'v1', namespace: 'controlled' };
  let pool: Pool; let store: PgStore; let repository: ResearchRepository; let cases: CaseRepository; let initial: CompanySnapshot;
  let externalCalls = 0;
  function source(version: 'v1' | 'v2', collectedAt = new Date().toISOString()): SourceEvidence {
    const sourceUrl = 'https://www.rockwool.com/fr/soissons/actualites/controlled-test-memory/';
    const content = `CONTROLLED TEST, NOT A PUBLISHER STATEMENT. ${version === 'v1' ? 'An industrial project is planned for 2028.' : 'The earlier 2028 project schedule is withdrawn; the timetable is unknown.'} No relationship to the synthetic company suppliers or products is verified.`;
    return { id: `keenable:${createHash('sha256').update(sourceUrl).digest('hex')}`, url: sourceUrl, title: 'Controlled research test only', content, contentHash: createHash('sha256').update(content).digest('hex'), publishedAt: '2026-10-01T00:00:00.000Z', collectedAt, mode: 'test', dataOrigin: 'public', family: 'supplier', provenance: { provider: 'keenable', endpoint: 'https://api.keenable.ai/v1/fetch/public', method: 'fetch', profileId: scope.profileId, indexedAt: null, truncated: false } };
  }
  function connect(): ResearchRepository {
    return createResearchRepository(store, { profiles: [{ profileId: scope.profileId, profileVersion: scope.profileVersion, freshForMs: 86400000 }], onGenerationChange: invalidateResearchDependents, createCollection: () => ({ collect: async () => { externalCalls += 1; throw new Error('No external call is allowed in this integration test'); }, externalCalls: () => externalCalls }) });
  }
  async function proposal(dossier: DecisionCase, owner = actor, lookupRepository = repository): Promise<{ run: AgentRun; proposalId: string }> {
    const run = await cases.analyze(owner, dossier.id, { expectedCaseRevision: dossier.caseRevision, question: 'Review this controlled case and its current commitments.', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    const bound = await store.bindResearch(claim!.run, claim!.fence, await lookupRepository.lookup(owner, scope));
    const snapshot = await store.snapshot(owner.companyId);
    const evaluation = evaluateCaseBusiness(snapshot, releaseCase(dossier), 'OL-A');
    const option = evaluation.options.find(value => value.kind === 'emergency_purchase')!;
    expect(option.status).toBe('feasible'); expect(option.costEur).toBe(1420);
    const result: AgentRunnerResult = { status: 'proposal', model: 'injected-integration-result-no-model-call', traces: [], message: 'Explicit controlled integration result.', proposal: { id: `proposal:${run.id}`, runId: run.id, companyId: run.companyId, revision: run.revision, policyVersion: run.policyVersion, caseRef: run.caseRef, evaluation, optionId: option.id, title: 'Controlled emergency plan', summary: 'No external causal relationship established.', conditions: [], status: 'pending', createdAt: new Date().toISOString() } };
    await store.finishRun(bound, claim!.fence, result);
    return { run: bound, proposalId: result.proposal!.id };
  }
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); await migrate(pool); store = new PgStore(pool); cases = new CaseRepository(store); repository = connect();
    store.setResearchValidator(async (companyId, dependencies, client) => await repository.validate(companyId, dependencies, client));
    const dataset = datasetSchema.parse(JSON.parse(await readFile('fixtures/company/dataset.json', 'utf8'))); const policy = policySchema.parse(JSON.parse(await readFile('fixtures/company/company-policy.json', 'utf8')));
    initial = syntheticSnapshot(dataset, policy, actor.companyId); await store.seed(initial); await store.seed(syntheticSnapshot(dataset, policy, 'CO-RESEARCH-B'));
  });
  afterAll(async () => { if (pool) await pool.end(); const admin = new Pool({ connectionString: url }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  it('retrieves persisted test observations in a new session and repository without another research call', async () => {
    const first = await repository.ingestControlled(operator, scope, source('v1'), randomUUID()); expect(first.state).toBe('reusable');
    const sessionOne = await store.session(actor); const sessionTwo = await store.session(actor); expect(sessionOne).not.toBe(sessionTwo);
    const restored = await store.actor(sessionTwo); expect(restored?.companyId).toBe(actor.companyId);
    const freshRepository = connect(); const recovered = await freshRepository.lookup(restored!, scope);
    expect(recovered.observations.map(value => value.ref)).toEqual(first.observations.map(value => value.ref));
    expect(recovered.observations[0]?.evidence.content).toContain('planned for 2028'); expect(recovered.observations[0]?.testOnly).toBe(true);
    expect(recovered.externalCalls).toBe(0); expect(externalCalls).toBe(0);
    expect((await freshRepository.lookup({ ...actor, companyId: 'CO-RESEARCH-B' }, scope)).observations).toEqual([]);
    expect((await freshRepository.lookup(actor, { ...scope, namespace: 'live' })).observations).toEqual([]);
  });
  it('keeps the public case boundary closed to test evidence and requires operator authority for controlled cases', async () => {
    const context = await repository.lookup(actor, scope); const ref = context.observations[0]!.ref;
    const input = { evidenceRef: ref, relation: { status: 'unverified' as const, productId: 'SKU-ISO100', supplierId: null, basis: 'Controlled category hypothesis only.' }, operationKey: randomUUID() };
    await expect(cases.create(actor, input)).rejects.toMatchObject({ code: 'EVIDENCE_NOT_RECEIVED' });
    await expect(cases.createControlled(actor, input, context)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(cases.createControlled(operator, input, { ...context, companyId: 'CO-RESEARCH-B' })).rejects.toMatchObject({ code: 'EVIDENCE_NOT_RECEIVED' });
  });
  it('stales an otherwise admissible pending plan solely because the controlled source changes, with v1 retained and identical v2 deduplicated', async () => {
    const first = await repository.lookup(actor, scope);
    const dossier = await cases.createControlled(operator, { evidenceRef: first.observations[0]!.ref, relation: { status: 'unverified', productId: 'SKU-ISO100', supplierId: null, basis: 'Controlled test only, no publisher relationship verified.' }, operationKey: randomUUID() }, first);
    const confirmed = await cases.confirm(operator, dossier.id, { expectedRevision: initial.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Independent synthetic internal confirmation.', operationKey: randomUUID() });
    const control = await proposal(confirmed);
    const current = await store.snapshot(actor.companyId);
    const decision = { decision: 'approve' as const, revision: current.revision, policyVersion: current.policyVersion, operationKey: randomUUID() };
    expect((await store.decide(actor, control.proposalId, decision, businessEngine)).status).toBe('approved');
    const pending = await proposal(confirmed);
    const stored = (await store.proposals(actor.companyId)).find(value => value.id === pending.proposalId)!;
    expect(stored.status).toBe('pending'); expect(stored.researchDependencies).toEqual(pending.run.researchDependencies);
    const revised = await repository.ingestControlled(operator, scope, source('v2'), randomUUID());
    expect(revised.generation).toBeGreaterThan(first.generation); expect(revised.observations[0]?.evidence.content).toContain('timetable is unknown');
    expect((await store.proposals(actor.companyId)).find(value => value.id === pending.proposalId)?.status).toBe('stale');
    await expect(store.decide(actor, pending.proposalId, { ...decision, operationKey: randomUUID() }, businessEngine)).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    await expect(cases.analyze(actor, dossier.id, { expectedCaseRevision: confirmed.caseRevision, question: 'Old source must not be reused.', operationKey: randomUUID() })).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    const again = await repository.ingestControlled(operator, scope, source('v2'), randomUUID()); expect(again.generation).toBe(revised.generation); expect(again.observations.map(value => value.ref)).toEqual(revised.observations.map(value => value.ref));
    const rows = await store.query<{ content_hash: string }>('SELECT content_hash FROM accel_watch_evidence WHERE company_id=$1 AND source_id=$2', [actor.companyId, source('v1').id]);
    expect(rows.rows.map(value => value.content_hash).sort()).toEqual([source('v1').contentHash, source('v2').contentHash].sort());
    expect((await cases.history(actor.companyId, dossier.id)).versions.some(value => value.observation.content.includes('planned for 2028'))).toBe(true);
    expect((await store.proposals(actor.companyId)).find(value => value.id === control.proposalId)?.status).toBe('approved'); expect(externalCalls).toBe(0);
  });
  it('pins and retrieves research through a new durable worker run before a scripted provider can receive the old evidence', async () => {
    const question = 'Read the saved research for this received profile and report its dates and limits.';
    const run = await store.queueQuestion(actor, { question, operationKey: randomUUID() }, scope);
    await store.query("UPDATE runs SET payload=jsonb_set(payload,'{mode}','\"test\"') WHERE id=$1", [run.id]);
    let turns = 0;
    const provider: ModelProvider = { model: 'injected-worker-protocol-test', version: 'v1', mode: 'test', async complete(request) {
      turns += 1;
      if (turns === 1) {
        expect(JSON.stringify(request)).not.toContain('timetable is unknown');
        return { type: 'tool_calls', calls: [{ id: 'research-read-1', name: 'read_research_context', arguments: {} }] };
      }
      expect(JSON.stringify(request.messages)).toContain('timetable is unknown');
      return { type: 'end', message: 'Injected protocol terminal only.' };
    } };
    const worker = createRunWorker(store, createAgentRunner(), (bound, writeTrace, owner) => createAgentRunner({ provider, writeTrace, currentVersion: async () => { const value = await store.snapshot(owner.companyId); return { companyId: value.companyId, revision: value.revision, policyVersion: value.policyVersion }; }, researchPort: { async lookup(): Promise<ResearchContext> { return await repository.lookup(owner, scope); }, async refresh(): Promise<ResearchContext> { throw new Error('No research refresh expected'); }, async validate(dependencies): Promise<boolean> { return await repository.validate(owner.companyId, dependencies); } } }), repository);
    expect(await worker.tick()).toBe(true);
    const saved = await store.run(actor.companyId, run.id);
    expect(saved.researchResult?.outcome).toBe('available'); expect(saved.researchResult?.observations[0]?.evidence.content).toContain('timetable is unknown');
    expect(saved.researchDependencies).toHaveLength(1); expect(saved.traces.some(value => value.tool === 'read_research_context' || JSON.stringify(value.output).includes('read_research_context'))).toBe(true);
    expect(saved.question).toBe(question); expect(saved.proposalId).toBeNull(); expect(externalCalls).toBe(0);
  });
  it('allows approve and reject after identical recollection renews freshness without changing the case evidence basis', async () => {
    const owner = { ...actor, companyId: 'CO-RENEW' }; const op = { ...operator, companyId: owner.companyId };
    await store.seed(syntheticSnapshot(initial.dataset, initial.policy, owner.companyId));
    let clock = Date.now();
    const renewedRepository = createResearchRepository(store, { now: () => new Date(clock), profiles: [{ profileId: scope.profileId, profileVersion: scope.profileVersion, freshForMs: 86400000 }], createCollection: () => { throw new Error('No external collection expected'); } });
    store.setResearchValidator(async (companyId, dependencies, client) => await renewedRepository.validate(companyId, dependencies, client));
    const first = await renewedRepository.ingestControlled(op, scope, source('v1', new Date(clock).toISOString()), randomUUID());
    const dossier = await cases.createControlled(op, { evidenceRef: first.observations[0]!.ref, relation: { status: 'unverified', productId: 'SKU-ISO100', supplierId: null, basis: 'Controlled test only.' }, operationKey: randomUUID() }, first);
    const before = await store.snapshot(owner.companyId);
    const confirmed = await cases.confirm(op, dossier.id, { expectedRevision: before.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Independent internal test date.', operationKey: randomUUID() });
    clock += 1000;
    const renewed = await renewedRepository.ingestControlled(op, scope, source('v1', new Date(clock).toISOString()), randomUUID());
    expect(renewed.generation).toBe(first.generation); expect(renewed.validUntil).not.toBe(first.validUntil);
    expect(await renewedRepository.validate(owner.companyId, [confirmed.researchDependency!])).toBe(true);
    const current = await store.snapshot(owner.companyId);
    for (const action of ['approve', 'reject'] as const) {
      const pending = await proposal(confirmed, owner, renewedRepository);
      expect(pending.run.researchDependencies?.[0]?.validUntil).toBe(renewed.validUntil);
      expect((await store.decide(owner, pending.proposalId, { decision: action, revision: current.revision, policyVersion: current.policyVersion, operationKey: randomUUID() }, businessEngine)).status).toBe(action === 'approve' ? 'approved' : 'rejected');
    }
    const memories = await store.memories(owner.companyId, scope);
    expect(memories).toHaveLength(2); expect(memories.every(value => value.testOnly && value.researchDependencies?.[0]?.scope.namespace === 'controlled')).toBe(true);
    expect(await store.memories(owner.companyId)).toEqual([]);
    expect(await store.memories(owner.companyId, { ...scope, namespace: 'live' })).toEqual([]);
  });
  it('preserves controlled provenance from the real runner through a PostgreSQL decision and a later tool recall without a case', async () => {
    const owner = { ...actor, companyId: 'CO-AGENT-MEMORY' }; const op = { ...operator, companyId: owner.companyId };
    await store.seed(syntheticSnapshot(initial.dataset, initial.policy, owner.companyId));
    store.setResearchValidator(async (companyId, dependencies, client) => await repository.validate(companyId, dependencies, client));
    await repository.ingestControlled(op, scope, source('v1'), randomUUID());
    const title = 'CONTROLLED_DECISION_ADVICE_WITHOUT_CASE';
    async function execute(provider: ModelProvider, researchScope?: ResearchScope): Promise<AgentRun> {
      const queued = await store.queueQuestion(owner, { question: 'Review the current commitments and attributed advice.', operationKey: randomUUID() }, researchScope);
      await store.query("UPDATE runs SET payload=jsonb_set(payload,'{mode}','\"test\"') WHERE id=$1", [queued.id]);
      const worker = createRunWorker(store, createAgentRunner(), (bound, writeTrace, authenticated) => createAgentRunner({ provider, writeTrace,
        currentVersion: async () => { const current = await store.snapshot(authenticated.companyId); return { companyId: current.companyId, revision: current.revision, policyVersion: current.policyVersion }; },
        ...(bound.researchScope ? { researchPort: {
          async lookup(): Promise<ResearchContext> { return await repository.lookup(authenticated, bound.researchScope!); },
          async refresh(): Promise<ResearchContext> { throw new Error('No research collection allowed'); },
          async validate(dependencies): Promise<boolean> { return await repository.validate(authenticated.companyId, dependencies); },
        } } : {}),
      }), repository);
      expect(await worker.tick()).toBe(true);
      return await store.run(owner.companyId, queued.id);
    }
    let turn = 0;
    const planned = await execute({ model: 'injected-real-runner-protocol', version: 'test/1', mode: 'test', async complete(request): Promise<unknown> {
      turn += 1;
      if (turn === 1) return { type: 'tool_calls', calls: [{ id: 'read-current', name: 'read_research_context', arguments: {} }] };
      if (turn === 2) return { type: 'tool_calls', calls: [{ id: 'evaluate', name: 'evaluate_options', arguments: { targetOrderLineId: 'OL-A' } }] };
      const evaluation = request.messages.findLast(value => value.role === 'tool' && value.name === 'evaluate_options')!.content as unknown as BusinessEvaluation;
      return { type: 'tool_calls', calls: [{ id: 'prepare', name: 'prepare_proposal', arguments: { evaluationId: evaluation.id, optionId: evaluation.options.find(value => value.kind === 'wait')!.id, title, summary: 'Controlled advice only, no case or external causal assertion.' } }] };
    } }, scope);
    expect(planned.status).toBe('proposal'); expect(planned.caseRef).toBeUndefined(); expect(planned.proposalId).toBeTruthy();
    const current = await store.snapshot(owner.companyId);
    expect((await store.decide(owner, planned.proposalId!, { decision: 'approve', revision: current.revision, policyVersion: current.policyVersion, operationKey: randomUUID() }, businessEngine)).status).toBe('approved');
    const durable = (await store.query<{ payload: import('../../src/contracts/index.js').AttributedMemory }>('SELECT payload FROM memories WHERE company_id=$1', [owner.companyId])).rows[0]!.payload;
    expect(durable.testOnly).toBe(true); expect(durable.researchDependencies).toEqual(planned.researchDependencies); expect(durable.caseRef).toBeUndefined();
    // Exact legacy memory shape written by the old decision path, whose proposal retains its origin.
    const legacy = { ...durable, id: randomUUID() }; delete legacy.researchDependencies; delete legacy.testOnly;
    await store.query('INSERT INTO memories(id,company_id,payload) VALUES($1,$2,$3)', [legacy.id, owner.companyId, legacy]);
    expect(await store.memories(owner.companyId)).toEqual([]);
    expect((await store.memories(owner.companyId, scope)).map(value => value.id)).not.toContain(legacy.id);
    async function recall(researchScope?: ResearchScope): Promise<string> {
      let step = 0; let output = '';
      await execute({ model: 'injected-real-recall-protocol', version: 'test/1', mode: 'test', async complete(request): Promise<unknown> {
        step += 1;
        if (step === 1) {
          expect(JSON.stringify(request)).not.toContain(title); expect(JSON.stringify(request)).not.toContain(durable.id);
          if (researchScope?.namespace === 'controlled') return { type: 'tool_calls', calls: [{ id: 'read-before-recall', name: 'read_research_context', arguments: {} }] };
        }
        if (step === 1 || step === 2 && researchScope?.namespace === 'controlled') return { type: 'tool_calls', calls: [{ id: 'recall', name: 'recall_decisions', arguments: {} }] };
        output = JSON.stringify(request.messages.findLast(value => value.role === 'tool' && value.name === 'recall_decisions')?.content);
        return { type: 'end', message: 'Injected protocol completed without another model transport.' };
      } }, researchScope);
      return output;
    }
    expect(await recall(scope)).toContain(durable.id);
    expect(await recall()).not.toContain(durable.id);
    // A live run must use direct mode; test mode is deliberately rejected before any controlled advice can enter it.
    expect(await store.memories(owner.companyId, { ...scope, namespace: 'live' })).toEqual([]);
    await repository.ingestControlled(op, scope, source('v2'), randomUUID());
    expect(await recall(scope)).not.toContain(durable.id); expect(externalCalls).toBe(0);
    expect((await store.proposals(owner.companyId)).find(value => value.id === planned.proposalId)?.status).toBe('approved');
  });
  it('serializes adopted watch publication with approval and reconciles source generations before committing the publication', async () => {
    const owner = { ...actor, companyId: 'CO-WATCH-GUARD' }; await store.seed(syntheticSnapshot(initial.dataset, initial.policy, owner.companyId));
    const raw = createWatchRepository(store); const watch = await raw.createWatch(owner, { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: ['https://api.keenable.ai/v1/search'], cadenceMinutes: 10080 }, randomUUID());
    const liveScope: ResearchScope = { ...scope, namespace: 'live' };
    const adopted = createResearchRepository(store, { profiles: [{ profileId: scope.profileId, profileVersion: scope.profileVersion, freshForMs: 86400000, adoptWatchIds: [watch.id] }], onGenerationChange: invalidateResearchDependents, createCollection: () => ({ collect: async () => { throw new Error('No external call expected'); }, externalCalls: () => 0 }) });
    const serialized = createSerializedWatchRepository(store, async (client, companyId) => { await adopted.validate(companyId, [{ scope: liveScope, generation: 0, validUntil: null, evidenceRefs: [] }], client); });
    async function collection(version: 'v1' | 'v2'): Promise<{ claim: NonNullable<Awaited<ReturnType<typeof raw.claimNext>>>; result: import('../../src/contracts/index.js').CollectionResult }> {
      await raw.enqueueManual(owner, watch.id, randomUUID()); const claim = (await raw.claimNext('adopted-watch-test', 30000))!;
      const item = { ...source(version), mode: 'direct' as const, collectedAt: new Date().toISOString() };
      return { claim, result: { status: 'success', sources: [{ url: 'https://api.keenable.ai/v1/search', status: 'success', evidence: [item], error: null }], startedAt: claim.occurrence.startedAt!, completedAt: item.collectedAt } };
    }
    const first = await collection('v1'); await serialized.finish(first.claim, first.result);
    store.setResearchValidator(async (companyId, dependencies, client) => await adopted.validate(companyId, dependencies, client));
    async function pending(): Promise<string> {
      const run = await store.queueQuestion(owner, { question: 'Controlled publication ordering test.', operationKey: randomUUID() }, liveScope);
      const claim = (await store.claimRun())!; expect(claim.run.id).toBe(run.id);
      const bound = await store.bindResearch(claim.run, claim.fence, await adopted.lookup(owner, liveScope));
      const snapshot = await store.snapshot(owner.companyId); const evaluation = evaluateBusiness(snapshot, 'OL-A'); const option = evaluation.options.find(value => value.kind === 'wait')!;
      const id = `proposal:${run.id}`;
      await store.finishRun(bound, claim.fence, { status: 'proposal', model: 'injected-ordering-test-only', message: 'Protocol test.', traces: [], proposal: { id, runId: run.id, companyId: owner.companyId, revision: run.revision, policyVersion: run.policyVersion, evaluation, optionId: option.id, title: 'Protocol test', summary: 'No real model call.', conditions: [], status: 'pending', createdAt: new Date().toISOString() } });
      return id;
    }
    const approvedId = await pending(); const staleId = await pending(); const second = await collection('v2');
    let entered!: () => void; let release!: () => void;
    const inside = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    store.setResearchValidator(async (companyId, dependencies, client) => { const valid = await adopted.validate(companyId, dependencies, client); entered(); await gate; return valid; });
    const snapshot = await store.snapshot(owner.companyId);
    const deciding = store.decide(owner, approvedId, { decision: 'approve', revision: snapshot.revision, policyVersion: snapshot.policyVersion, operationKey: randomUUID() }, businessEngine);
    await inside;
    const transaction = store.transaction.bind(store);
    async function shortLock<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return await transaction(async client => { await client.query("SET LOCAL lock_timeout='100ms'"); return await work(client); }); }
    const spy = vi.spyOn(store, 'transaction').mockImplementationOnce(shortLock);
    try { await expect(serialized.finish(second.claim, second.result)).rejects.toMatchObject({ code: '55P03' }); }
    finally { spy.mockRestore(); release(); }
    expect((await deciding).status).toBe('approved');
    store.setResearchValidator(async (companyId, dependencies, client) => await adopted.validate(companyId, dependencies, client));
    await serialized.finish(second.claim, second.result);
    expect((await store.proposals(owner.companyId)).find(value => value.id === staleId)?.status).toBe('stale');
    expect((await store.proposals(owner.companyId)).find(value => value.id === approvedId)?.status).toBe('approved');
    expect((await adopted.lookup(owner, liveScope)).observations[0]?.evidence.content).toContain('timetable is unknown');
  });
});
