import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import type { AgentRunnerInput, JsonObject } from '../../src/contracts/index.js';
import type { IndustrialAgentPort, IndustrialReport } from '../../src/contracts/industrial.js';
import type { PdfDocumentDescriptor, PdfKnowledgePort, PdfReadResult } from '../../src/contracts/pdf.js';
import { createAgentRunner } from '../../src/agent/index.js';
import type { AgentOptions, ModelProvider, ModelRequest } from '../../src/agent/index.js';
import { evaluateIndustrialPlan } from '../../src/domain/industrial.js';
import { projectIndustrialModelContext } from '../../src/agent/industrial-context.js';
import { industrialFixture } from '../domain/industrial-fixture.js';

const now = (): number => Date.parse('2026-10-22T09:00:00Z');
const call = (id: string, name: string, args: Record<string, unknown> = {}): unknown => ({ type: 'tool_calls', calls: [{ id, name, arguments: args }], usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } });
function provider(steps: (unknown | ((request: ModelRequest) => unknown))[], observe?: (request: ModelRequest) => void): ModelProvider {
  let index = 0;
  return { model: 'scoped-protocol-test', mode: 'test', version: 'test/1', async complete(request): Promise<unknown> { observe?.(request); const step = steps[index++]; return typeof step === 'function' ? (step as (r: ModelRequest) => unknown)(request) : step; } };
}
function harness(full = false): { input: AgentRunnerInput; options: AgentOptions; events: string[]; port: IndustrialAgentPort } {
  const business = industrialFixture(full), assessment = full ? undefined : evaluateIndustrialPlan(business), events: string[] = [];
  const input: AgentRunnerInput = { actor: { actorId: 'EMP-PAUL', companyId: business.snapshot.companyId, role: 'direction', approvalCeilingEur: 2000 }, snapshot: business.snapshot, memories: [], run: { id: 'RUN-IND', companyId: business.snapshot.companyId, actorId: 'EMP-PAUL', operationKey: 'OP-IND', question: 'Explain the current risk, commercial opportunity and common plan. Quote the limits.', status: 'running', revision: business.snapshot.revision, policyVersion: business.snapshot.policyVersion, mode: 'test', model: null, proposalId: null, message: null, traces: [], createdAt: business.evaluatedAt, completedAt: null, industrialScope: { contextRevision: business.context.revision, qualificationRevision: business.context.qualificationRevision, reportId: null } } };
  const port: IndustrialAgentPort = {
    async overview(): Promise<JsonObject> { events.push('overview'); return { companyId: input.snapshot.companyId, businessRevision: input.snapshot.revision, policyVersion: input.snapshot.policyVersion, contextRevision: business.context.revision, qualificationRevision: business.context.qualificationRevision, counts: { commitments: full ? 10000 : 2, crmDemands: 1, sources: 0 }, demands: [{ opportunityId: 'CRM-IND-000', quantity: 20, unit: 'palette', productId: 'SKU-ISO100', needDate: '2026-10-29' }], releasedEvent: { eventId: business.releasedEvent.event.eventId, eventRevision: business.releasedEvent.revision, testOnly: true }, publicSources: [] }; },
    async evaluate(demandId): Promise<JsonObject> { events.push('evaluate'); assert.equal(demandId, 'CRM-IND-000'); return projectIndustrialModelContext(business, assessment!); },
    async prepare(args): Promise<IndustrialReport> { events.push('prepare'); return { id: 'REPORT1', companyId: input.snapshot.companyId, runId: input.run.id, basis: assessment!.basis, status: 'prepared', title: args.title, summary: args.summary, assessment: assessment!, recommendedPlanId: args.recommendedPlanId, createdAt: business.evaluatedAt }; },
    async validate(): Promise<boolean> { return true; }, async reserveUsage(kind): Promise<boolean> { events.push(`reserve:${kind}`); return true; },
  };
  return { input, events, port, options: { now, industrialPort: port, currentVersion: async () => ({ companyId: input.snapshot.companyId, revision: input.snapshot.revision, policyVersion: input.snapshot.policyVersion }) } };
}
const prepareFromResult = (request: ModelRequest): unknown => {
  const result = request.messages.findLast(m => m.name === 'calculate_common_plan' && m.role === 'tool')!.content as JsonObject;
  return call('prepare', 'prepare_industrial_report', { evaluationId: result.assessmentId, recommendedPlanId: (result.plans as JsonObject[])[0]!.id, title: 'Protect commitments and prepare the existing demand', summary: 'Review the independent purchase and transfer before a separate approval. The CRM demand predates the synthetic event.' });
};
test('industrial tool loop uses actual bounded ports and cached evaluation IDs, reserves every call, and never exposes C1 tools', async (): Promise<void> => {
  const h = harness(); let requests = 0;
  const p = provider([call('overview', 'read_company_context'), call('calculate', 'calculate_common_plan', { demandId: 'CRM-IND-000' }), prepareFromResult], r => {
    requests++; h.events.push('provider'); assert.ok(JSON.stringify(r.context).length < 4000);
    for (const forbidden of ['read_commitments', 'evaluate_options', 'prepare_proposal']) assert.equal(r.tools.some(t => t.name === forbidden), false);
    assert.deepEqual(r.context.manifest.memoryIds, []);
  });
  const result = await createAgentRunner({ ...h.options, provider: p })(h.input);
  assert.equal(result.status, 'proposal'); assert.equal(result.proposal, null); assert.equal(result.industrialReport?.id, 'REPORT1'); assert.equal(result.industrialReport?.assessment.coverage.protectedCommitments, 2);
  assert.equal(requests, 3); assert.deepEqual(h.events, ['reserve:provider', 'provider', 'reserve:tool', 'overview', 'reserve:provider', 'provider', 'reserve:tool', 'evaluate', 'reserve:provider', 'provider', 'reserve:tool', 'prepare']);
  assert.equal(result.traces.filter(t => t.tool === 'model_result').length, 3);
});
test('the 10000-line initial context remains small without invoking the complete C1 parser or ledger tool', async (): Promise<void> => {
  const h = harness(true); let observed = '';
  const result = await createAgentRunner({ ...h.options, provider: provider([{ type: 'end', message: 'Invented full coverage.' }], r => { observed = JSON.stringify(r.context); }) })(h.input);
  assert.equal(result.status, 'needs_input'); assert.ok(observed.length < 4000); assert.equal(observed.includes('OL-IND-'), false); assert.equal(result.message.includes('Invented'), false);
  assert.equal(h.events.includes('evaluate'), false);
});
test('missing capability, denied durable budgets and stale basis stop before an unauthorized effect', async (): Promise<void> => {
  const h = harness(); let modelCalls = 0; const p = provider([call('r', 'read_company_context')], () => { modelCalls++; });
  const disconnected = await createAgentRunner({ ...h.options, industrialPort: undefined, provider: p })(h.input); assert.equal(disconnected.status, 'needs_input'); assert.equal(modelCalls, 0);
  h.port.reserveUsage = async (): Promise<boolean> => false;
  const denied = await createAgentRunner({ ...h.options, provider: p })(h.input); assert.equal(denied.status, 'budget_exhausted'); assert.equal(modelCalls, 0);
  h.port.reserveUsage = async (kind): Promise<boolean> => kind === 'provider';
  const tool = await createAgentRunner({ ...h.options, provider: p })(h.input); assert.equal(tool.status, 'budget_exhausted'); assert.equal(modelCalls, 1); assert.equal(h.events.includes('overview'), false);
  h.port.validate = async (): Promise<boolean> => false;
  const stale = await createAgentRunner({ ...h.options, provider: p })(h.input); assert.equal(stale.status, 'stale_context'); assert.equal(modelCalls, 1);
});
test('forged evaluation, forbidden tools and unknown tool fields never prepare a report', async (): Promise<void> => {
  const h = harness();
  const result = await createAgentRunner({ ...h.options, provider: provider([call('p', 'prepare_industrial_report', { evaluationId: 'FORGED', recommendedPlanId: 'FORGED', title: 'x', summary: 'x' }), call('c1', 'read_commitments'), call('o', 'read_company_context', { companyId: 'OTHER' }), { type: 'end', message: 'Done' }]) })(h.input);
  assert.equal(h.events.includes('prepare'), false); assert.equal(h.events.includes('overview'), false); assert.equal(result.industrialReport, undefined); assert.match(JSON.stringify(result.traces), /UNKNOWN_EVALUATION/); assert.match(JSON.stringify(result.traces), /TOOL_NOT_AVAILABLE/);
});
test('scope or unexpected data in overview is not released to the model', async (): Promise<void> => {
  const changes: JsonObject[] = [{ companyId: 'OTHER' }, { hiddenOracle: 'SECRET_ORACLE' }];
  for (const change of changes) {
    const h = harness(), prior = h.port.overview; h.port.overview = async (): Promise<JsonObject> => ({ ...await prior(), ...change });
    let delivered = '';
    await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context'), (r: ModelRequest): unknown => { delivered = JSON.stringify(r.messages); return { type: 'end', message: 'More information is needed.' }; }]) })(h.input);
    assert.equal(delivered.includes('SECRET_ORACLE'), false); assert.equal(delivered.includes('OTHER'), false);
  }
});
test('basis changing after a tool and automatic incomplete reports cannot produce a completed report', async (): Promise<void> => {
  const h = harness(), old = h.port.overview; let valid = true;
  h.port.overview = async (): Promise<JsonObject> => { const value = await old(); valid = false; return value; }; h.port.validate = async (): Promise<boolean> => valid;
  const stale = await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context')]) })(h.input); assert.equal(stale.status, 'stale_context'); assert.equal(stale.industrialReport, undefined);
  const auto = harness(); auto.input.run.industrialIntentId = 'AUTO1'; auto.input.actor.role = 'analysis_only';
  const result = await createAgentRunner({ ...auto.options, provider: provider([call('o', 'read_company_context'), { type: 'end', message: 'The complete report is ready.' }]) })(auto.input);
  assert.equal(result.status, 'needs_input'); assert.equal(result.industrialReport, undefined); assert.equal(result.message.includes('did not prepare'), true);
});

test('a follow-up can read attributed report, approval and simulated execution receipts without any new action capability', async (): Promise<void> => {
  const h = harness(), prior = h.port.overview;
  h.input.run.question = 'What was approved and simulated, and what remains a draft?';
  h.port.overview = async (): Promise<JsonObject> => ({ ...await prior(), runtimeState: { report: { id: 'REPORT-OLD', businessRevision: 'R-BEFORE', policyVersion: 'P-INDUSTRIAL-1', status: 'prepared', recommendedPlanId: 'PLAN-OLD' }, approvals: [{ id: 'APPROVAL-OLD', planId: 'PLAN-OLD', planVersion: 'V-OLD', decision: 'approved', actorId: 'EMP-PAUL', decidedAt: '2026-10-22T08:50:00Z' }], executions: [{ id: 'EXEC-OLD', planId: 'PLAN-OLD', planVersion: 'V-OLD', approvalId: 'APPROVAL-OLD', status: 'applied', beforeRevision: 'R-BEFORE', afterRevision: h.input.snapshot.revision, simulation: true, completedAt: '2026-10-22T08:51:00Z', records: [{ kind: 'crm_offer', id: 'OFFER-DRAFT', status: 'draft' }, { kind: 'transfer_order', id: 'TRANSFER-SCHEDULED', status: 'confirmed_scheduled' }] }] } });
  let received = '';
  const result = await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context'), (r: ModelRequest): unknown => { received = JSON.stringify(r.messages); assert.equal(r.tools.some(t => /execute|approve/.test(t.name)), false); return { type: 'end', message: 'Approval APPROVAL-OLD led to simulated execution EXEC-OLD. The offer remains a draft and the transfer is scheduled.' }; }]) })(h.input);
  for (const ref of ['REPORT-OLD', 'APPROVAL-OLD', 'EXEC-OLD', 'R-BEFORE', 'OFFER-DRAFT', 'TRANSFER-SCHEDULED']) assert.ok(received.includes(ref));
  assert.equal(result.status, 'needs_input'); assert.equal(result.industrialReport, undefined); assert.equal(h.events.includes('prepare'), false);
});
test('interrupted report or provider attempt is uncertain, never automatically retried', async (): Promise<void> => {
  const h = harness(); let prepares = 0;
  h.port.prepare = async (): Promise<IndustrialReport> => { prepares++; throw new Error('PRIVATE_DATABASE_DETAIL'); };
  const failed = await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context'), call('e', 'calculate_common_plan', { demandId: 'CRM-IND-000' }), prepareFromResult]) })(h.input);
  assert.equal(failed.status, 'uncertain'); assert.equal(prepares, 1); assert.equal(JSON.stringify(failed).includes('PRIVATE_DATABASE_DETAIL'), false);
  let providers = 0;
  const hung: ModelProvider = { model: 'timeout-test', version: '1', mode: 'test', async complete(): Promise<unknown> { providers++; return await new Promise(() => {}); } };
  const timeout = await createAgentRunner({ ...h.options, provider: hung, maxDurationMs: 10, writeTrace: async t => { if (t.tool === 'model_result') throw new Error('PRIVATE_SINK'); } })(h.input);
  assert.equal(timeout.status, 'uncertain'); assert.equal(providers, 1); assert.ok(timeout.traces.some(t => t.tool === 'model_result' && (t.output as JsonObject).status === 'uncertain'));
});

test('post-prepare trace failure preserves the terminal report and trace for server reconciliation', async (): Promise<void> => {
  const h = harness();
  const result = await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context'), call('e', 'calculate_common_plan', { demandId: 'CRM-IND-000' }), prepareFromResult]), writeTrace: async t => { if (t.tool === 'prepare_industrial_report') throw new Error('PRIVATE_TRACE_FAILURE'); } })(h.input);
  assert.equal(h.events.filter(e => e === 'prepare').length, 1);
  assert.equal(result.status, 'uncertain'); assert.equal(result.industrialReport?.id, 'REPORT1');
  assert.ok(result.traces.some(t => t.tool === 'prepare_industrial_report'));
  assert.equal(JSON.stringify(result).includes('PRIVATE_TRACE_FAILURE'), false);
});

test('the last post-prepare currentness check cannot turn an unavailable validation into a proposal', async (): Promise<void> => {
  const h = harness(), prior = h.port.prepare; let prepared = false, validationsAfter = 0;
  h.port.prepare = async args => { const value = await prior(args); prepared = true; return value; };
  h.port.validate = async (): Promise<boolean> => { if (prepared && ++validationsAfter === 2) throw new Error('PRIVATE_VALIDATION_FAILURE'); return true; };
  const result = await createAgentRunner({ ...h.options, provider: provider([call('o', 'read_company_context'), call('e', 'calculate_common_plan', { demandId: 'CRM-IND-000' }), prepareFromResult]) })(h.input);
  assert.equal(h.events.filter(e => e === 'prepare').length, 1); assert.equal(result.status, 'uncertain');
  assert.equal(result.industrialReport?.id, 'REPORT1'); assert.ok(result.traces.some(t => t.tool === 'prepare_industrial_report'));
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALIDATION_FAILURE'), false);
});

function pdfHarness(): { input: AgentRunnerInput; options: AgentOptions; port: PdfKnowledgePort; descriptor: PdfDocumentDescriptor; calls: string[] } {
  const h = harness(); delete h.input.run.industrialScope; h.input.run.pdfProfileId = 'PDF-PROFILE';
  const sha = (s: string): string => createHash('sha256').update(s).digest('hex'), text = 'Attributed public page. No commercial relationship established.';
  const descriptor: PdfDocumentDescriptor = { companyId: h.input.snapshot.companyId, profileId: 'PDF-PROFILE', profileVersion: 'v1', documentHash: sha('DOCUMENT'), extractorVersion: 'extractor-v1', title: 'Public report', url: 'https://example.org/report.pdf', publishedAt: '2026-08-19', collectedAt: '2026-10-22T08:00:00Z', pageCount: 2, characterCount: text.length * 2, extractionStatus: 'complete', dataOrigin: 'public' };
  const calls: string[] = [];
  const port: PdfKnowledgePort = { async list(): Promise<PdfDocumentDescriptor[]> { calls.push('list'); return [descriptor]; }, async read(documentHash, pages): Promise<PdfReadResult> { calls.push('read'); return { outcome: 'available', document: descriptor, externalCalls: 0, conditions: ['PUBLIC_SOURCE_UNTRUSTED', 'SOURCE_OBSERVATION_ONLY'], reason: 'PDF_CACHE_READ', pages: pages.map(pageNumber => ({ ref: { documentHash, extractorVersion: descriptor.extractorVersion, pageNumber, pageTextHash: sha(text) }, text, excerptHash: sha(text), truncated: false, fullPageCharacterCount: text.length, citationUrl: `${descriptor.url}#page=${pageNumber}` })) }; } };
  return { input: h.input, options: { ...h.options, industrialPort: undefined, pdfKnowledgePort: port }, port, descriptor, calls };
}
test('PDF-only path lists then reads attributed cached pages without exposing business calculations or acquisition', async (): Promise<void> => {
  const h = pdfHarness();
  const result = await createAgentRunner({ ...h.options, provider: provider([call('l', 'list_pdf_documents'), call('r', 'read_pdf_pages', { documentHash: h.descriptor.documentHash, pageNumbers: [1, 2] }), { type: 'end', message: 'The cached report states the following. See pages 1 and 2.' }], r => {
    assert.deepEqual(r.tools.map(t => t.name), ['list_pdf_documents', 'read_pdf_pages']); assert.equal(JSON.stringify(r.context).includes('ST-C100'), false);
  }) })(h.input);
  assert.equal(result.status, 'needs_input'); assert.equal(result.pdfResult?.outcome, 'available'); assert.equal(result.pdfResult?.pages.length, 2); assert.deepEqual(h.calls, ['list', 'read']); assert.equal(result.proposal, null);
});
test('PDF hash/page selection, scope and page hashes are validated before content is released', async (): Promise<void> => {
  const unlisted = pdfHarness(); await createAgentRunner({ ...unlisted.options, provider: provider([call('r', 'read_pdf_pages', { documentHash: unlisted.descriptor.documentHash, pageNumbers: [1] }), { type: 'end', message: 'More information is needed.' }]) })(unlisted.input); assert.equal(unlisted.calls.includes('read'), false);
  const many = pdfHarness(); await createAgentRunner({ ...many.options, provider: provider([call('l', 'list_pdf_documents'), call('r', 'read_pdf_pages', { documentHash: many.descriptor.documentHash, pageNumbers: [1, 2, 3] }), { type: 'end', message: 'More information is needed.' }]) })(many.input); assert.equal(many.calls.includes('read'), false);
  const tampered = pdfHarness(), original = tampered.port.read;
  tampered.port.read = async (hash, pages): Promise<PdfReadResult> => { const r = await original(hash, pages); r.pages[0]!.text = 'TAMPERED_PRIVATE_TEXT'; return r; };
  let delivered = '';
  const result = await createAgentRunner({ ...tampered.options, provider: provider([call('l', 'list_pdf_documents'), call('r', 'read_pdf_pages', { documentHash: tampered.descriptor.documentHash, pageNumbers: [1] }), (r: ModelRequest): unknown => { delivered = JSON.stringify(r.messages); return { type: 'end', message: 'A valid cached page was not available.' }; }]) })(tampered.input);
  assert.equal(delivered.includes('TAMPERED_PRIVATE_TEXT'), false); assert.equal(result.pdfResult?.outcome, 'not_available'); assert.equal(result.pdfResult?.pages.length, 0);
});
test('cache miss returns missing evidence without an implicit acquisition, and repeated listing is safe', async (): Promise<void> => {
  const h = pdfHarness(); h.port.read = async (): Promise<PdfReadResult> => { h.calls.push('read'); return { outcome: 'not_available', document: null, pages: [], conditions: ['PDF_CACHE_MISSING'], reason: 'PDF_CACHE_MISSING', externalCalls: 0 }; };
  const result = await createAgentRunner({ ...h.options, provider: provider([call('l1', 'list_pdf_documents'), call('l2', 'list_pdf_documents'), call('r', 'read_pdf_pages', { documentHash: h.descriptor.documentHash, pageNumbers: [1] }), { type: 'end', message: 'This cached document is missing.' }]) })(h.input);
  assert.deepEqual(h.calls, ['list', 'list', 'read']); assert.equal(result.pdfResult?.outcome, 'not_available'); assert.ok(result.pdfResult?.conditions.includes('PDF_CACHE_MISSING'));
});
