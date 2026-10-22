import { readFile, access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Actor, AgentRun, CompanySnapshot, DecisionCase, JsonObject, SourceEvidence } from '../../src/contracts/index.js';
import type { ResearchScope } from '../../src/contracts/research.js';
import type { ModelProvider, ModelRequest } from '../../src/agent/runner.js';
import { assert, company, digest, frozenManifest, moduleAt, project, scopedEnvironment, witness } from './shared.js';

const out = resolve(project, 'proposals/agent');
const save = async (name: string, value: unknown): Promise<void> => { assert(/^R2-[A-Z0-9-]+\.json$/.test(name), 'INVALID_RECEIPT_NAME'); await writeFile(resolve(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
let httpAttempts = 0, collectionAttempts = 0, injectedInvocations = 0;
globalThis.fetch = async (): Promise<Response> => { httpAttempts++; throw new Error('R2_HTTP_PROHIBITED'); };

async function main(): Promise<void> {
  const manifest = await frozenManifest(resolve(out, 'R1-FROZEN.json'));
  assert(digest(await readFile(fileURLToPath(import.meta.url), 'utf8')) === process.env.R2_EXPECTED_SCRIPT_SHA256, 'R2_SCRIPT_AUTHORITY_MISMATCH');
  const scenarioPath = resolve(project, 'proposals/data/RESEARCH-MEMORY-CONTROLLED-SCENARIO.json'), rawScenario = await readFile(scenarioPath, 'utf8');
  assert(digest(rawScenario) === process.env.R2_EXPECTED_SCENARIO_SHA256, 'R2_SCENARIO_AUTHORITY_MISMATCH');
  const scenario = z.object({ kind: z.literal('controlled_test_input_only'), profileId: z.literal('soissons-project'), sourceUrl: z.literal('https://www.rockwool.com/fr/soissons/actualites/controlled-test-memory/'), mode: z.literal('test'), versions: z.array(z.object({ version: z.enum(['v1', 'v2']), content: z.string().startsWith('CONTROLLED TEST, NOT A PUBLISHER STATEMENT.'), publishedAt: z.iso.datetime({ offset: true }) })).length(2) }).parse(JSON.parse(rawScenario));
  assert(scenario.versions[0]?.version === 'v1' && scenario.versions[1]?.version === 'v2', 'R2_SCENARIO_VERSION_ORDER');
  if (process.argv[2] === 'plan') { process.stdout.write('R2_PINS_VERIFIED_NO_DATABASE_OR_MODEL_CALL\n'); return; }
  assert(process.argv[2] === 'execute', 'R2_INVALID_PHASE');
  try { await access(resolve(out, 'R2-STARTED.json')); throw new Error('R2_ALREADY_STARTED_RECONCILE'); } catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  const { createPool } = await moduleAt<typeof import('../../src/server/config.js')>(manifest, 'server/config.js');
  const { PgStore } = await moduleAt<typeof import('../../src/server/store.js')>(manifest, 'server/store.js');
  const { createResearchRepository } = await moduleAt<typeof import('../../src/data/research-repository.js')>(manifest, 'data/research-repository.js');
  const { invalidateResearchDependents } = await moduleAt<typeof import('../../src/server/research-service.js')>(manifest, 'server/research-service.js');
  const { createRunWorker } = await moduleAt<typeof import('../../src/server/worker.js')>(manifest, 'server/worker.js');
  const { CaseRepository } = await moduleAt<typeof import('../../src/server/cases.js')>(manifest, 'server/cases.js');
  const { createAgentRunner } = await moduleAt<typeof import('../../src/agent/runner.js')>(manifest, 'agent/runner.js');
  const { businessEngine } = await moduleAt<typeof import('../../src/domain/contract.js')>(manifest, 'domain/contract.js');
  const { hashToken } = await moduleAt<typeof import('../../src/server/auth.js')>(manifest, 'server/auth.js');
  const scope: ResearchScope = { profileId: scenario.profileId, profileVersion: 'v1', namespace: 'controlled' };
  const owner: Actor = { companyId: witness, actorId: 'EMP-PAUL', role: 'direction', approvalCeilingEur: 2000 }, operator: Actor = { ...owner, actorId: 'RESEARCH-OPERATOR', role: 'operator', approvalCeilingEur: 0 };
  const env = scopedEnvironment(manifest);
  let pool = await createPool(env), store = new PgStore(pool);
  const connect = (): ReturnType<typeof createResearchRepository> => {
    const repository = createResearchRepository(store, { profiles: [{ profileId: scope.profileId, profileVersion: scope.profileVersion, freshForMs: 86400000 }], onGenerationChange: invalidateResearchDependents, createCollection: () => { collectionAttempts++; throw new Error('R2_COLLECTION_PROHIBITED'); } });
    store.setResearchValidator(async (companyId, deps, client) => await repository.validate(companyId, deps, client)); return repository;
  };
  let repository = connect();
  const source = (index: number): SourceEvidence => {
    const v = scenario.versions[index]!;
    return { id: `keenable:${digest(scenario.sourceUrl)}`, url: scenario.sourceUrl, title: 'CONTROLLED research correction test, not a publisher statement', content: v.content, contentHash: digest(v.content), publishedAt: v.publishedAt, collectedAt: new Date().toISOString(), mode: 'test', dataOrigin: 'public', family: 'supplier', provenance: { provider: 'keenable', endpoint: 'https://api.keenable.ai/v1/fetch', method: 'fetch', profileId: scope.profileId, indexedAt: null, truncated: false } };
  };
  const sessions: { hash: string; restoredActorId: string }[] = [];
  const session = async (): Promise<void> => {
    const token = await store.session(owner);
    try { const restored = await store.actor(token); assert(restored?.companyId === witness && restored.actorId === owner.actorId && restored.role === 'direction', 'R2_SESSION_SCOPE'); sessions.push({ hash: digest(token), restoredActorId: restored.actorId }); }
    finally { await pool.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(token)]); }
  };
  const readR1 = async (): Promise<string> => {
    const snapshots = await pool.query<{ company_id: string; snapshot: CompanySnapshot }>('SELECT company_id,snapshot FROM companies WHERE company_id=$1', [company]);
    const runs = await pool.query<{ id: string; payload: AgentRun }>('SELECT id,payload FROM runs WHERE company_id=$1 ORDER BY id', [company]);
    const evidence = await pool.query('SELECT source_id,content_hash,evidence FROM accel_watch_evidence WHERE company_id=$1 ORDER BY source_id,content_hash', [company]);
    assert(snapshots.rowCount === 1 && runs.rowCount === 2 && runs.rows.every(r => r.payload.status === 'needs_input') && evidence.rowCount === 5, 'R2_R1_BASELINE_CHANGED');
    return digest({ snapshots: snapshots.rows, runs: runs.rows, evidence: evidence.rows });
  };
  const run = async (key: string, makePlan: boolean, expectedHash: string, dossier?: DecisionCase): Promise<AgentRun> => {
    const question = makePlan ? 'Read controlled research and the released internally confirmed case, then calculate a current synthetic emergency plan for OL-A. Deterministic state-guard test only.' : 'Read the latest controlled research and its explicit limits. No business proposal.';
    const q = dossier ? await new CaseRepository(store).analyze(owner, dossier.id, { expectedCaseRevision: dossier.caseRevision, operationKey: key, question }) : await store.queueQuestion(owner, { operationKey: key, question }, scope);
    // The canonical queue is direct-only. Operator harness explicitly marks injected protocol tests.
    await pool.query("UPDATE runs SET payload=jsonb_set(payload,'{mode}','\"test\"') WHERE id=$1 AND company_id=$2 AND payload->>'status'='queued'", [q.id, witness]);
    let turns = 0;
    const provider: ModelProvider = { model: 'R2-INJECTED-PROTOCOL-NO-MODEL-CALL', version: 'test/1', mode: 'test', async complete(request: ModelRequest): Promise<unknown> {
      injectedInvocations++; const turn = turns++;
      if (turn === 0) {
        const first = JSON.stringify(request);
        assert(request.messages.length === 0 && request.context.manifest.memoryIds.length === 0 && (dossier !== undefined || !first.includes(expectedHash)) && scenario.versions.every(v => !first.includes(v.content)), 'R2_PRIOR_ANSWER_INJECTED');
        return { type: 'tool_calls', calls: [{ id: 'read-research', name: 'read_research_context', arguments: {} }] };
      }
      const research = request.messages.find(m => m.role === 'tool' && m.name === 'read_research_context');
      assert(research && !research.isError && JSON.stringify(research.content).includes(expectedHash), 'R2_SOURCE_NOT_FROM_TOOL');
      if (!makePlan) return { type: 'end', message: 'Controlled research is available with its source identity, version and test-only conditions.' };
      if (turn === 1) return { type: 'tool_calls', calls: [{ id: 'read-case', name: 'read_observation_context', arguments: {} }] };
      if (turn === 2) return { type: 'tool_calls', calls: [{ id: 'evaluate', name: 'evaluate_options', arguments: { targetOrderLineId: 'OL-A' } }] };
      assert(turn === 3, 'R2_UNEXPECTED_INJECTED_TURN');
      const evaluation = request.messages.find(m => m.role === 'tool' && m.name === 'evaluate_options');
      assert(evaluation && !evaluation.isError, 'R2_EVALUATION_UNAVAILABLE');
      const parsed = z.object({ id: z.string(), options: z.array(z.object({ id: z.string(), kind: z.string(), status: z.string(), costEur: z.number(), effects: z.object({ coverage: z.array(z.object({ orderLineId: z.string(), shortage: z.number() })) }) })) }).parse(evaluation.content);
      const selected = parsed.options.find(o => o.kind === 'emergency_purchase' && o.status === 'feasible' && o.costEur === 1420 && o.costEur <= owner.approvalCeilingEur);
      assert(selected, 'R2_NO_ADMISSIBLE_CURRENT_OPTION');
      assert(['OL-A', 'OL-B'].every(id => selected.effects.coverage.some(c => c.orderLineId === id && c.shortage === 0)), 'R2_A_OR_B_UNPROTECTED');
      return { type: 'tool_calls', calls: [{ id: 'prepare', name: 'prepare_proposal', arguments: { evaluationId: parsed.id, optionId: selected.id, title: 'Controlled source-dependent plan', summary: 'Deterministic protocol test. No public causal relationship is established and no stock action is executed.' } }] };
    } };
    const worker = createRunWorker(store, createAgentRunner(), (bound, sink, actor) => createAgentRunner({ provider, writeTrace: sink, currentVersion: async () => { const s = await store.snapshot(actor.companyId); return { companyId: s.companyId, revision: s.revision, policyVersion: s.policyVersion }; }, researchPort: { lookup: async () => await repository.lookup(actor, scope), refresh: async () => { throw new Error('R2_REFRESH_PROHIBITED'); }, validate: async deps => await repository.validate(actor.companyId, deps) } }), repository);
    try { assert(await worker.tick(), 'R2_WORKER_DID_NOT_CLAIM'); } finally { await worker.stop(); }
    const saved = await store.run(witness, q.id);
    assert(saved.mode === 'test' && saved.model === provider.model && saved.status === (makePlan ? 'proposal' : 'needs_input') && saved.researchResult?.outcome === 'available' && saved.researchResult.observations.length === 1 && saved.researchResult.observations[0]?.ref.contentHash === expectedHash && saved.researchResult.observations[0]?.testOnly && saved.researchResult.observations[0]?.evidence.mode === 'test', 'R2_RUN_NOT_RECEIVED');
    return saved;
  };
  try {
    assert((await pool.query<{ schema: string }>('SELECT current_schema() AS schema')).rows[0]?.schema === manifest.schema, 'R2_WRONG_SCHEMA');
    assert((await pool.query("SELECT 1 FROM runs WHERE company_id=$1 OR payload->>'status' IN ('queued','running')", [witness])).rowCount === 0, 'R2_PREEXISTING_RUN_RECONCILE');
    for (const table of ['proposals', 'memories', 'accel_research_commands', 'decision_cases', 'case_commands', 'business_events']) assert((await pool.query(`SELECT 1 FROM ${table} WHERE company_id=$1`, [witness])).rowCount === 0, 'R2_PREEXISTING_STATE_RECONCILE');
    const initial = await store.snapshot(witness), initialSnapshotHash = digest(initial), r1Hash = await readR1();
    await save('R2-STARTED.json', { status: 'STARTED_NO_AUTOMATIC_REPEAT', schema: manifest.schema, companyId: witness, startedAt: new Date().toISOString(), sourceFingerprint: manifest.sourceFingerprint, initialSnapshotHash, r1Hash });
    await session();
    const v1 = source(0), v2 = source(1), first = await repository.ingestControlled(operator, scope, v1, 'r2-source-v1');
    assert(first.state === 'reusable' && first.observations[0]?.ref.contentHash === v1.contentHash, 'R2_V1_NOT_RECEIVED');
    const cases = new CaseRepository(store);
    const dossier = await cases.createControlled(operator, { evidenceRef: first.observations[0]!.ref, relation: { status: 'unverified', productId: 'SKU-ISO100', supplierId: null, basis: 'Controlled source correction test only. No publisher relationship established.' }, operationKey: 'r2-controlled-case-v1' }, first);
    const confirmed = await cases.confirm(operator, dossier.id, { expectedRevision: initial.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Explicit independent synthetic internal confirmation for the controlled state-guard test.', operationKey: 'r2-internal-confirmation' });
    assert(confirmed.candidateOrderLineIds.includes('OL-A') && !confirmed.candidateOrderLineIds.includes('OL-B') && confirmed.confirmation?.confirmedExpectedDate === '2026-10-27', 'R2_CONFIRMATION_EXPOSURE_INVALID');
    const current = await store.snapshot(witness), snapshotHash = digest(current);
    const control = await run('r2-control-plan', true, v1.contentHash, confirmed);
    assert(control.proposalId, 'R2_NO_CONTROL_PLAN');
    const controlProposal = (await store.proposals(witness)).find(p => p.id === control.proposalId)!;
    const approved = await store.decide(owner, control.proposalId, { decision: 'approve', revision: current.revision, policyVersion: current.policyVersion, operationKey: 'r2-control-approval' }, businessEngine);
    assert(approved.status === 'approved', 'R2_CONTROL_NOT_ADMISSIBLE');
    const pending = await run('r2-pending-plan', true, v1.contentHash, confirmed); assert(pending.proposalId, 'R2_NO_PENDING_PLAN');
    const pendingProposal = (await store.proposals(witness)).find(p => p.id === pending.proposalId)!;
    assert(pendingProposal.status === 'pending' && pendingProposal.optionId === controlProposal.optionId && digest(await store.snapshot(witness)) === snapshotHash, 'R2_PLAN_NOT_OTHERWISE_IDENTICAL');
    const revised = await repository.ingestControlled(operator, scope, v2, 'r2-source-v2');
    assert(revised.generation > first.generation && revised.observations[0]?.ref.contentHash === v2.contentHash, 'R2_V2_NOT_CURRENT');
    const stale = (await store.proposals(witness)).find(p => p.id === pending.proposalId)!;
    assert(stale.status === 'stale', 'R2_OLD_PLAN_NOT_STALE');
    let refusal: string | undefined;
    try { await store.decide(owner, pending.proposalId, { decision: 'approve', revision: current.revision, policyVersion: current.policyVersion, operationKey: 'r2-old-plan-refusal' }, businessEngine); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') refusal = error.code; }
    assert(refusal === 'STALE_CONTEXT', 'R2_OLD_PLAN_NOT_REJECTED');
    let oldCaseRefusal: string | undefined;
    try { await cases.analyze(owner, dossier.id, { expectedCaseRevision: confirmed.caseRevision, operationKey: 'r2-old-case-refusal', question: 'This stale source must not be reused.' }); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') oldCaseRefusal = error.code; }
    assert(oldCaseRefusal === 'STALE_CONTEXT', 'R2_OLD_CASE_STILL_ANALYZABLE');
    const stillFeasible = businessEngine(await store.snapshot(witness)).options.find(o => o.id === pendingProposal.optionId);
    assert(stillFeasible?.status === 'feasible' && stillFeasible.costEur <= owner.approvalCeilingEur && digest(await store.snapshot(witness)) === snapshotHash, 'R2_BUSINESS_CAUSE_NOT_ISOLATED');
    await pool.end(); pool = await createPool(env); store = new PgStore(pool); repository = connect();
    await session(); assert(sessions.length === 2 && sessions[0]!.hash !== sessions[1]!.hash, 'R2_SESSION_NOT_DISTINCT');
    const readback = await run('r2-new-session-v2-read', false, v2.contentHash);
    const beforeDuplicate = (await pool.query('SELECT id FROM accel_watch_occurrences WHERE company_id=$1', [witness])).rowCount;
    const duplicate = await repository.ingestControlled(operator, scope, v2, 'r2-source-v2');
    const afterDuplicate = (await pool.query('SELECT id FROM accel_watch_occurrences WHERE company_id=$1', [witness])).rowCount;
    assert(duplicate.generation === revised.generation && digest(duplicate.observations.map(o => o.ref)) === digest(revised.observations.map(o => o.ref)) && beforeDuplicate === afterDuplicate, 'R2_DUPLICATE_PUBLICATION');
    const newCommandSameContent = await repository.ingestControlled(operator, scope, v2, 'r2-source-v2-new-command');
    assert(newCommandSameContent.generation === revised.generation && digest(newCommandSameContent.observations.map(o => o.ref)) === digest(revised.observations.map(o => o.ref)), 'R2_IDENTICAL_CONTENT_NOT_DEDUPLICATED');
    const history = await pool.query<{ content_hash: string }>('SELECT content_hash FROM accel_watch_evidence WHERE company_id=$1 AND source_id=$2 ORDER BY content_hash', [witness, v1.id]);
    assert(digest(history.rows.map(r => r.content_hash)) === digest([v1.contentHash, v2.contentHash].sort()), 'R2_HISTORY_LOST_OR_DUPLICATED');
    assert((await store.proposals(witness)).find(p => p.id === control.proposalId)?.status === 'approved', 'R2_APPROVED_HISTORY_CHANGED');
    const caseHistory = await new CaseRepository(store).history(witness, dossier.id);
    assert(caseHistory.versions.some(v => v.observation.contentHash === v1.contentHash && v.observation.content === v1.content), 'R2_CASE_V1_HISTORY_LOST');
    const finalRuns = await pool.query<{ id: string; payload: AgentRun }>('SELECT id,payload FROM runs WHERE company_id=$1', [witness]);
    assert(finalRuns.rowCount === 3 && finalRuns.rows.every(r => [control.id, pending.id, readback.id].includes(r.id) && !['queued', 'running'].includes(r.payload.status) && r.payload.mode === 'test') && injectedInvocations === 10, 'R2_UNEXPECTED_OR_UNFINISHED_RUNS');
    assert(await readR1() === r1Hash && digest(await store.snapshot(witness)) === snapshotHash && httpAttempts === 0 && collectionAttempts === 0, 'R2_UNEXPECTED_MUTATION_OR_HTTP');
    await frozenManifest(resolve(out, 'R1-FROZEN.json'));
    await save('R2-RECEPTION.json', { status: 'CONTROLLED_AIVEN_SOURCE_REVISION_PASS', checkedAt: new Date().toISOString(), schema: manifest.schema, companyId: witness, sourceFingerprint: manifest.sourceFingerprint, sourceId: v1.id, v1: { contentHash: v1.contentHash, generation: first.generation, ref: first.observations[0]!.ref }, v2: { contentHash: v2.contentHash, generation: revised.generation, ref: revised.observations[0]!.ref }, controlledCase: { id: dossier.id, caseRevision: confirmed.caseRevision, confirmationEventId: confirmed.confirmation!.eventId, confirmedExpectedDate: '2026-10-27', candidateOrderLineIds: confirmed.candidateOrderLineIds, oldCaseRefusal, v1HistoryPreserved: true }, control: { runId: control.id, proposalId: control.proposalId, status: approved.status, optionId: approved.optionId, costEur: 1420, protected: ['OL-A', 'OL-B'] }, oldPlan: { runId: pending.id, proposalId: pending.proposalId, status: stale.status, refusal, optionStillFeasible: true, businessRevision: current.revision, policyVersion: current.policyVersion }, newSession: { sessions, runId: readback.id, sourceHash: readback.researchResult!.observations[0]!.ref.contentHash, qualification: readback.researchResult!.observations[0]!.qualification, testOnly: true }, duplicate: { operationKey: 'r2-source-v2', occurrenceCountBefore: beforeDuplicate, occurrenceCountAfter: afterDuplicate, generationUnchanged: true, refsUnchanged: true, newOperationKeySameContent: { operationKey: 'r2-source-v2-new-command', generation: newCommandSameContent.generation, refsUnchanged: true, evidenceRowCount: history.rowCount, note: 'A new command gets its own acquisition receipt; content versions and current references stay deduplicated.' } }, evidenceHistory: history.rows, snapshotUnchangedSinceConfirmation: true, r1Unchanged: true, actualOpenAiCalls: 0, httpAttempts, collectionAttempts, injectedProtocolInvocations: injectedInvocations, realModelInference: 'NOT_RUN_DETERMINISTIC_INJECTED_PROVIDER', retainedTraces: [control.id, pending.id, readback.id], limits: ['Controlled test content only, no publisher revision claimed.', 'Actual frozen worker/runner/store/research/decision guard on existing Aiven; operator CLI harness, not HTTP/browser authentication.', 'Only explicit controlled POL1 confirmation changes witness R before comparison. No stock change, reseed, import, reset or scheduler. R1 first-process metric gaps remain.'] });
    process.stdout.write('R2_CONTROLLED_AIVEN_SOURCE_REVISION_PASS\n');
  } finally { await pool.end(); }
}
await main().catch(async error => {
  const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'R2_FAILED_RECONCILE';
  try { await save('R2-FAILURE.json', { status: 'FAILED_NO_AUTOMATIC_REPEAT', code, checkedAt: new Date().toISOString(), httpAttempts, collectionAttempts, injectedProtocolInvocations: injectedInvocations }); } catch { /* Preserve first negative. */ }
  process.stderr.write(code + '\n'); process.exitCode = 1;
});
