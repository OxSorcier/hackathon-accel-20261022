import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor, AgentRun, AgentRunnerResult, CaseInput, CompanySnapshot, EvidenceRef, SourceEvidence } from '../../src/contracts/index.js';
import { createWatchRepository } from '../../src/data/watch-repository.js';
import { businessEngine, evaluateBusiness, parseInternalConfirmation } from '../../src/domain/index.js';
import { CaseRepository, hasCurrentConfirmation } from '../../src/server/cases.js';
import { migrate } from '../../src/server/migrate.js';
import { syntheticSnapshot } from '../../src/server/operator.js';
import { PgStore } from '../../src/server/store.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { BOAMP_SOURCE_URL, PUBLIC_TOPICS } from '../../src/watch/collector.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('versioned evidence cases on PostgreSQL, injected public evidence only', () => {
  const schema = `case_test_${randomBytes(8).toString('hex')}`;
  const actor: Actor = { actorId: 'EMP-PAUL', companyId: 'CO-DEMO', role: 'direction', approvalCeilingEur: 2000 };
  let pool: Pool; let store: PgStore; let cases: CaseRepository; let snapshot: CompanySnapshot; let firstEvidence: EvidenceRef;
  async function proof(content: string, owner = actor): Promise<EvidenceRef> {
    const repo = createWatchRepository(store); const now = new Date();
    const watch = await repo.createWatch(owner, { publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL], cadenceMinutes: 15 }, randomUUID(), now);
    await repo.enqueueManual(owner, watch.id, randomUUID(), now);
    const claim = await repo.claimNext('test-case-worker', 30000, now); if (!claim) throw new Error('Test claim missing');
    const evidence: SourceEvidence = { id: 'boamp:26-123456', url: 'https://www.boamp.fr/pages/avis/?q=idweb%3A%2226-123456%22', title: 'Injected protocol evidence, no public event asserted', content, contentHash: createHash('sha256').update(content).digest('hex'), dataOrigin: 'public', mode: 'direct', publishedAt: null, collectedAt: now.toISOString() };
    await repo.finish(claim, { status: 'success', sources: [{ url: BOAMP_SOURCE_URL, status: 'success', evidence: [evidence], error: null }], startedAt: now.toISOString(), completedAt: now.toISOString() }, now);
    return { occurrenceId: claim.occurrence.id, evidenceId: evidence.id, contentHash: evidence.contentHash };
  }
  function input(ref = firstEvidence): CaseInput { return { evidenceRef: ref, relation: { status: 'unverified', productId: 'SKU-ISO100', supplierId: null, basis: 'Hypothèse produit de test, aucun lien fournisseur établi.' }, operationKey: randomUUID() }; }
  function result(run: AgentRun, source = snapshot, kind: 'wait' | 'emergency_purchase' = 'wait'): AgentRunnerResult {
    const evaluation = evaluateBusiness(source, 'OL-A'); const option = evaluation.options.find(value => value.kind === kind)!;
    return { status: 'proposal', model: 'injected-test-only', message: 'Test protocol only', traces: [], proposal: { id: `proposal:${run.id}`, runId: run.id, companyId: run.companyId, revision: run.revision, policyVersion: run.policyVersion, caseRef: run.caseRef, evaluation, optionId: option.id, title: 'Couverture courante sous hypothèse', summary: 'Aucun inbound retiré.', conditions: [], status: 'pending', createdAt: new Date().toISOString() } };
  }
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); await migrate(pool); store = new PgStore(pool); cases = new CaseRepository(store);
    const dataset = datasetSchema.parse(JSON.parse(await readFile('fixtures/company/dataset.json', 'utf8'))); const policy = policySchema.parse(JSON.parse(await readFile('fixtures/company/company-policy.json', 'utf8')));
    snapshot = syntheticSnapshot(dataset, policy, actor.companyId); await store.seed(snapshot); await store.seed(syntheticSnapshot(dataset, policy, 'CO-OTHER'));
    firstEvidence = await proof('First injected source revision');
  });
  afterAll(async () => { if (pool) await pool.end(); const admin = new Pool({ connectionString: url }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  it('anchors exact scoped evidence and preserves absent, hypothetical and homonymous relations', async () => {
    const command = input(); const [a, b] = await Promise.all([cases.create(actor, command), cases.create(actor, command)]);
    expect(a.id).toBe(b.id); expect(a.candidateOrderLineIds).toEqual(['OL-A', 'OL-B']);
    expect(a.relation.status).toBe('unverified'); expect(a.qualification).toBe('to_verify');
    await expect(cases.create(actor, { ...command, relation: { ...command.relation, basis: 'Different input' } })).rejects.toMatchObject({ code: 'OPERATION_CONFLICT' });
    await expect(cases.create({ ...actor, companyId: 'CO-OTHER' }, input())).rejects.toMatchObject({ code: 'EVIDENCE_NOT_RECEIVED' });
    await expect(cases.create(actor, { ...input(), evidenceRef: { ...firstEvidence, contentHash: 'a'.repeat(64) } })).rejects.toMatchObject({ code: 'EVIDENCE_NOT_RECEIVED' });
    await expect(cases.create(actor, { ...input(), relation: { ...command.relation, supplierId: 'ISOLANT-HOMONYME' } })).rejects.toMatchObject({ code: 'UNKNOWN_SUPPLIER' });
    await expect(cases.create(actor, { ...input(), relation: { ...command.relation, status: 'verified' as 'unverified' } })).rejects.toThrow();
    const none = await cases.create(actor, { ...input(), relation: { status: 'none', productId: null, supplierId: null, basis: 'Aucune relation connue.' } });
    expect(none.qualification).toBe('no_known_exposure'); expect(none.candidateOrderLineIds).toEqual([]);
    expect((await store.snapshot(actor.companyId)).dataset.tables.purchase_order_lines).toEqual(snapshot.dataset.tables.purchase_order_lines);
  });
  it('includes exposed beneficiaries of unallocated inbound without selecting independently covered commitments', async () => {
    const owner = { ...actor, companyId: 'CO-FREE-INBOUND' };
    const free = syntheticSnapshot(snapshot.dataset, snapshot.policy, owner.companyId);
    free.dataset.tables.inbound_allocations = [];
    await store.seed(free);
    const ref = await proof('Unallocated inbound test evidence', owner);
    const dossier = await cases.create(owner, { ...input(ref), riskAssumption: { kind: 'inbound_delay', purchaseOrderLineId: 'POL-1', assumedExpectedDate: '2026-10-27', basis: 'Controlled delay, no public causal assertion.' } });
    expect(dossier.candidateOrderLineIds).toEqual(['OL-A']);
    const operator: Actor = { ...owner, actorId: 'OPERATOR-FREE', role: 'operator', approvalCeilingEur: 0 };
    const confirmed = await cases.confirm(operator, dossier.id, { expectedRevision: free.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Controlled internal date.', operationKey: randomUUID() });
    expect(confirmed.candidateOrderLineIds).toEqual(['OL-A']);
    const current = await store.snapshot(owner.companyId);
    expect(evaluateBusiness(current, 'OL-A').facts.coverage).toEqual(expect.arrayContaining([expect.objectContaining({ orderLineId: 'OL-A', shortage: 8 }), expect.objectContaining({ orderLineId: 'OL-B', shortage: 0 })]));
    const run = await cases.analyze(owner, dossier.id, { expectedCaseRevision: confirmed.caseRevision, question: 'Compare this case.', operationKey: randomUUID() });
    expect(run.caseRef?.caseRevision).toBe(confirmed.caseRevision);
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    await store.finishRun(run, claim!.fence, { status: 'needs_input', proposal: null, message: 'Controlled target selection check only.', model: null, traces: [] });
  });
  it('preserves actual free-inbound beneficiaries after confirmation when an earlier commitment is already uncovered', async () => {
    const owner = { ...actor, companyId: 'CO-FREE-LATER' };
    const later = syntheticSnapshot(snapshot.dataset, snapshot.policy, owner.companyId);
    later.dataset.tables.inbound_allocations = [];
    later.dataset.tables.purchase_order_lines!.find(value => value.id === 'POL-1')!.expected_date = '2026-10-24';
    later.dataset.tables.orders!.push({ ...later.dataset.tables.orders!.find(value => value.id === 'ORD-A')!, id: 'ORD-C', need_date: '2026-10-25' });
    later.dataset.tables.order_lines!.push({ ...later.dataset.tables.order_lines!.find(value => value.id === 'OL-A')!, id: 'OL-C', order_id: 'ORD-C' });
    await store.seed(later);
    const ref = await proof('Later actual beneficiary test', owner);
    const dossier = await cases.create(owner, { ...input(ref), riskAssumption: { kind: 'inbound_delay', purchaseOrderLineId: 'POL-1', assumedExpectedDate: '2026-10-27', basis: 'Controlled delay only.' } });
    expect(dossier.candidateOrderLineIds).toEqual(['OL-C']);
    const operator: Actor = { ...owner, actorId: 'OPERATOR-LATER', role: 'operator', approvalCeilingEur: 0 };
    let confirmed = await cases.confirm(operator, dossier.id, { expectedRevision: later.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Controlled date only.', operationKey: randomUUID() });
    expect(confirmed.candidateOrderLineIds).toEqual(['OL-C']);
    expect(confirmed.confirmation?.exposureOrderLineIds).toEqual(['OL-C']);
    for (const date of ['2026-10-27', '2026-10-28']) {
      const before = await store.snapshot(owner.companyId);
      confirmed = await cases.confirm(operator, dossier.id, { expectedRevision: before.revision, expectedCaseRevision: confirmed.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: date, basis: 'Reconfirm the known synthetic date.', operationKey: randomUUID() });
      expect(confirmed.candidateOrderLineIds).toEqual(['OL-C']);
      expect(confirmed.confirmation?.previousExpectedDate).toBe('2026-10-27');
      expect(confirmed.confirmation?.exposureOrderLineIds).toEqual(['OL-C']);
      expect(await hasCurrentConfirmation(store, confirmed, await store.snapshot(owner.companyId))).toBe(true);
    }
    const run = await cases.analyze(owner, dossier.id, { expectedCaseRevision: confirmed.caseRevision, question: 'Compare options.', operationKey: randomUUID() });
    expect(parseInternalConfirmation(await store.snapshot(owner.companyId), { caseId: confirmed.id, caseRevision: confirmed.caseRevision }, confirmed.relation, confirmed.confirmation).exposureOrderLineIds).toEqual(['OL-C']);
    expect(run.caseRef?.caseRevision).toBe(confirmed.caseRevision);
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    await store.finishRun(run, claim!.fence, { status: 'needs_input', proposal: null, message: 'Controlled target selection check only.', model: null, traces: [] });
  });
  it('requires a case reference on publication and blocks approval despite a feasible current option', async () => {
    const dossier = await cases.create(actor, input()); const run = await cases.analyze(actor, dossier.id, { expectedCaseRevision: dossier.caseRevision, question: 'Calculer la couverture courante.', operationKey: randomUUID() });
    const claim = await store.claimRun(); expect(claim?.run.id).toBe(run.id);
    const missing = result(run); delete missing.proposal!.caseRef;
    await expect(store.finishRun(run, claim!.fence, missing)).rejects.toMatchObject({ code: 'INVALID_PROPOSAL' });
    await store.finishRun(run, claim!.fence, result(run)); const saved = (await store.proposals(actor.companyId)).find(value => value.runId === run.id)!;
    expect(saved.conditions).toContain('RELATION_UNVERIFIED');
    const command = { decision: 'approve' as const, revision: snapshot.revision, policyVersion: snapshot.policyVersion, operationKey: randomUUID() };
    await expect(store.decide(actor, saved.id, command, businessEngine)).rejects.toMatchObject({ code: 'RELATION_UNVERIFIED' });
    const rejected = await store.decide(actor, saved.id, { ...command, decision: 'reject' }, businessEngine); expect(rejected.status).toBe('rejected');
    expect((await store.memories(actor.companyId)).find(value => value.proposalId === saved.id)?.caseRef).toEqual(run.caseRef);
  });
  it('invalidates old plans at unchanged business revision after a source correction, with durable idempotent history', async () => {
    const dossier = await cases.create(actor, input());
    const completed = await cases.analyze(actor, dossier.id, { expectedCaseRevision: dossier.caseRevision, question: 'Avant correction', operationKey: randomUUID() });
    const first = await store.claimRun(); await store.finishRun(completed, first!.fence, result(completed));
    const running = await cases.analyze(actor, dossier.id, { expectedCaseRevision: dossier.caseRevision, question: 'Calcul en cours', operationKey: randomUUID() }); const second = await store.claimRun();
    const corrected = await proof('Corrected injected source revision');
    const command = { ...input(corrected), expectedCaseRevision: dossier.caseRevision };
    const [a, b] = await Promise.all([cases.revise(actor, dossier.id, command), cases.revise(actor, dossier.id, command)]);
    expect(a.caseRevision).toBe(b.caseRevision); expect(a.businessRevision).toBe(snapshot.revision); expect(a.previousRevision).toBe(dossier.caseRevision);
    await expect(cases.revise(actor, dossier.id, { ...command, operationKey: randomUUID() })).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    await store.finishRun(running, second!.fence, result(running)); expect((await store.run(actor.companyId, running.id)).status).toBe('stale_context');
    const proposal = (await store.proposals(actor.companyId)).find(value => value.runId === completed.id)!; expect(proposal.status).toBe('stale');
    await expect(store.decide(actor, proposal.id, { decision: 'approve', revision: snapshot.revision, policyVersion: snapshot.policyVersion, operationKey: randomUUID() }, businessEngine)).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    const reconnected = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    try { const history = await new CaseRepository(new PgStore(reconnected)).history(actor.companyId, dossier.id); expect(history.current.caseRevision).toBe(a.caseRevision); expect(history.versions).toHaveLength(2); } finally { await reconnected.end(); }
  });
  it('refreshes candidate context atomically before analyzing a changed business snapshot', async () => {
    const dossier = await cases.create(actor, input()); const before = await store.snapshot(actor.companyId);
    const changed = await store.replaceSnapshot({ ...actor, role: 'operator' }, before.revision, before);
    const command = { expectedCaseRevision: dossier.caseRevision, question: 'Réévaluer après mutation', operationKey: randomUUID() };
    const run = await cases.analyze(actor, dossier.id, command); const replay = await cases.analyze(actor, dossier.id, command);
    expect(replay.id).toBe(run.id); expect(run.revision).toBe(changed.revision); expect(run.caseRef?.caseRevision).not.toBe(dossier.caseRevision);
    const history = await cases.history(actor.companyId, dossier.id); expect(history.current.businessRevision).toBe(changed.revision); expect(history.versions).toHaveLength(2);
  });
  it('refuses cross-command key reuse between a free question and a case analysis in both directions', async () => {
    const dossier = await cases.create(actor, input()); const current = await store.snapshot(actor.companyId);
    const caseKey = randomUUID(); const question = 'Same text, different command';
    await cases.analyze(actor, dossier.id, { expectedCaseRevision: dossier.caseRevision, question, operationKey: caseKey });
    const questionKey = randomUUID(); await store.queueQuestion(actor, { question, operationKey: questionKey });
    const checks = await Promise.allSettled([store.queueQuestion(actor, { question, operationKey: caseKey }), cases.analyze(actor, dossier.id, { expectedCaseRevision: dossier.caseRevision, question, operationKey: questionKey })]);
    expect(checks.map(result => result.status === 'fulfilled' ? 'ACCEPTED' : (result.reason as { code: string }).code)).toEqual(['OPERATION_CONFLICT', 'OPERATION_CONFLICT']);
    expect((await store.snapshot(actor.companyId)).revision).toBe(current.revision);
  });
  it('accepts an attributed internal confirmation and approves only a current feasible synthetic plan', async () => {
    const before = await store.snapshot(actor.companyId);
    const dossier = await cases.create(actor, { ...input(), riskAssumption: { kind: 'inbound_delay', purchaseOrderLineId: 'POL-1', assumedExpectedDate: '2026-10-27', basis: 'Explicit synthetic test hypothesis.' } });
    expect(dossier.candidateOrderLineIds).toEqual(['OL-A']);
    const operator: Actor = { ...actor, actorId: 'OPERATOR', role: 'operator', approvalCeilingEur: 0 };
    const command = { expectedRevision: before.revision, expectedCaseRevision: dossier.caseRevision, purchaseOrderLineId: 'POL-1', confirmedExpectedDate: '2026-10-27', basis: 'Operator confirms a date inside the synthetic company only.', operationKey: randomUUID() };
    await expect(cases.confirm(actor, dossier.id, command)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(cases.confirm(operator, dossier.id, { ...command, purchaseOrderLineId: 'POL-2', operationKey: randomUUID() })).rejects.toMatchObject({ code: 'INVALID_CONFIRMATION' });
    await expect(cases.confirm(operator, dossier.id, { ...command, confirmedExpectedDate: '2026-02-31', operationKey: randomUUID() })).rejects.toThrow();
    expect((await store.snapshot(actor.companyId)).revision).toBe(before.revision);
    const [confirmed, replay] = await Promise.all([cases.confirm(operator, dossier.id, command), cases.confirm(operator, dossier.id, command)]);
    expect(confirmed.candidateOrderLineIds).toEqual(['OL-A']);
    expect(replay.caseRevision).toBe(confirmed.caseRevision); expect(confirmed.riskAssumption).toBeUndefined(); expect(confirmed.relation.status).toBe('unverified');
    const current = await store.snapshot(actor.companyId); expect(current.revision).not.toBe(before.revision);
    expect(await hasCurrentConfirmation(store, confirmed, current)).toBe(true);
    expect(await hasCurrentConfirmation(store, { ...confirmed, confirmation: { ...confirmed.confirmation!, eventId: randomUUID() } }, current)).toBe(false);
    const run = await cases.analyze(actor, dossier.id, { expectedCaseRevision: confirmed.caseRevision, question: 'Compare options for the internally confirmed date.', operationKey: randomUUID() });
    await store.query("UPDATE runs SET payload=jsonb_set(payload,'{status}','\"running\"'),fence=1,lease_until=now()+interval '90 seconds' WHERE id=$1", [run.id]);
    await store.finishRun(run, 1, result(run, current, 'emergency_purchase'));
    const proposal = (await store.proposals(actor.companyId)).find(value => value.runId === run.id)!;
    const decision = { decision: 'approve' as const, revision: current.revision, policyVersion: current.policyVersion, operationKey: randomUUID() };
    await expect(store.decide(operator, proposal.id, decision, businessEngine)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await store.decide(actor, proposal.id, decision, businessEngine)).status).toBe('approved');
    expect((await store.memories(actor.companyId)).find(value => value.proposalId === proposal.id)?.caseRef).toEqual(run.caseRef);
    expect((await store.snapshot(actor.companyId)).dataset.tables.inventory).toEqual(before.dataset.tables.inventory);
    const changed = await store.replaceSnapshot(operator, current.revision, current);
    expect(await hasCurrentConfirmation(store, confirmed, changed)).toBe(false);
    const refreshedRun = await cases.analyze(actor, dossier.id, { expectedCaseRevision: confirmed.caseRevision, question: 'Reevaluate after another business revision.', operationKey: randomUUID() });
    expect(refreshedRun.revision).toBe(changed.revision); expect((await cases.history(actor.companyId, dossier.id)).current.confirmation).toBeUndefined();
    const stable = (await cases.history(actor.companyId, dossier.id)).current;
    const repeated = await cases.analyze(actor, dossier.id, { expectedCaseRevision: stable.caseRevision, question: 'Read the same refreshed context.', operationKey: randomUUID() });
    expect(repeated.caseRef?.caseRevision).toBe(stable.caseRevision);
  });
  it('preserves an unknown historical decision time while timestamping new decisions', async () => {
    const legacySchema = `legacy_time_${randomBytes(8).toString('hex')}`;
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${legacySchema}`);
    const legacy = new Pool({ connectionString: url, options: `-c search_path=${legacySchema}` });
    try {
      await legacy.query('CREATE TABLE decisions(id text PRIMARY KEY)'); await legacy.query("INSERT INTO decisions(id) VALUES('historical')");
      await migrate(legacy); await legacy.query("INSERT INTO decisions(id) VALUES('new')");
      const result = await legacy.query<{ id: string; created_at: Date | null }>('SELECT id,created_at FROM decisions ORDER BY id');
      expect(result.rows.find(row => row.id === 'historical')?.created_at).toBeNull();
      expect(result.rows.find(row => row.id === 'new')?.created_at).toBeInstanceOf(Date);
    } finally { await legacy.end(); await admin.query(`DROP SCHEMA ${legacySchema} CASCADE`); await admin.end(); }
  });
});
