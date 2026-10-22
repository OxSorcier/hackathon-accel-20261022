import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { Actor, AgentRun, AgentRunner, AgentRunnerResult, CompanySnapshot, JsonObject, SqlPort, ToolTrace } from '../contracts/index.js';
import type { IndustrialApproval, IndustrialBasis, IndustrialContext, IndustrialEvaluationInput, IndustrialReport, ReleasedIndustrialEvent } from '../contracts/industrial.js';
import type { IndustrialDecisionInput, IndustrialQuestionInput, IndustrialReportView, IndustrialSimulationInput, IndustrialWorkspace } from '../contracts/industrial-api.js';
import type { ResearchContext, ResearchDependency } from '../contracts/research.js';
import { createIndustrialAnalysisTrigger, type IndustrialAnalysisTrigger } from '../data/analysis-trigger.js';
import { createAgentRunner, type ModelProvider } from '../agent/index.js';
import { createIndustrialAgentPort } from './industrial-agent-port.js';
import { evaluateIndustrialPlan } from '../domain/industrial.js';
import { IndustrialReadRepository, industrialHash, type IndustrialReadService } from './industrial-read.js';
import { createIndustrialFeedRead } from './industrial-feed.js';
import { DataWatchError } from '../data/validation.js';
import { readIndustrialDisplay } from './industrial-display.js';
import { basisOfIndustrialRelease, IndustrialReleaseRepository } from './industrial-release.js';
import { createIndustrialDemoExecutor, readIndustrialExecutionState, type IndustrialDemoExecutor } from './industrial-execution.js';
import { AppError, PgStore, type RunFinalization } from './store.js';
import type { ResearchService } from './research-service.js';
import type { WatchService } from './app.js';
import { createPdfKnowledgePort } from './pdf-knowledge.js';
import { PDF_PROFILE, type PdfDocuments } from './pdf-documents.js';
import { questionSchema } from './validation.js';

export const INDUSTRIAL_PRINCIPAL = 'SERVICE-INDUSTRIAL-ANALYSIS';
export const INDUSTRIAL_PUBLIC_SCOPE = { profileId: 'public-contracts', profileVersion: 'v1', namespace: 'live' } as const;
const limits = { maxProviderCalls: 6, maxToolCalls: 12, maxDurationMs: 60000, maxRunsPerEvent: 3 };
const json = (value: unknown): JsonObject => JSON.parse(JSON.stringify(value)) as JsonObject;
const dependenciesOf = (value: ResearchContext): ResearchDependency[] => value.state === 'reusable' && value.observations.length > 0
  ? [{ scope: value.scope, generation: value.generation, validUntil: value.validUntil, evidenceRefs: value.observations.map(item => item.ref) }] : [];

export async function authorizeIndustrialResearch(client: SqlPort, companyId: string, scope: ResearchContext['scope'], principalId: string): Promise<boolean> {
  if (principalId !== INDUSTRIAL_PRINCIPAL || scope.profileId !== INDUSTRIAL_PUBLIC_SCOPE.profileId || scope.profileVersion !== 'v1' || scope.namespace !== 'live') return false;
  return (await client.query("SELECT id FROM accel_industrial_principals WHERE company_id=$1 AND id=$2 AND role='analysis_only' AND active=true", [companyId, principalId])).rowCount === 1;
}

export class IndustrialRuntime implements IndustrialReadService {
  readonly read: IndustrialReadRepository;
  readonly trigger: IndustrialAnalysisTrigger;
  readonly executor: IndustrialDemoExecutor;
  constructor(private readonly store: PgStore, private readonly research: ResearchService, private readonly watches: WatchService, private readonly companyId: string, private readonly documents?: PdfDocuments) {
    this.read = new IndustrialReadRepository(store);
    this.trigger = createIndustrialAnalysisTrigger({ servicePrincipalId: INDUSTRIAL_PRINCIPAL,
      resolvePrincipal: async (client, company, principal) => await authorizeIndustrialResearch(client, company, INDUSTRIAL_PUBLIC_SCOPE, principal) ? { id: principal, companyId: company, role: 'analysis_only', active: true } : null,
      validateBasis: async (client, basis) => await this.basisCurrent(client, basis),
    });
    this.executor = createIndustrialDemoExecutor({ store, revalidate: async (client, actor, approvalId, input) => {
      const snapshot = await store.snapshot(actor.companyId, client, true);
      const approval = (await client.query<{ payload: IndustrialApproval; report_id: string }>('SELECT payload,report_id FROM accel_industrial_approvals WHERE company_id=$1 AND id=$2', [actor.companyId, approvalId])).rows[0];
      if (!approval) throw new AppError('NOT_FOUND', 'Approval not found.', 404);
      const report = await this.storedReport(client, actor.companyId, approval.report_id);
      const plan = await this.recalculate(client, report, approval.payload.planId);
      if (input.expectedBusinessRevision !== snapshot.revision || input.expectedPlanVersion !== plan.version || input.expectedPlanHash !== industrialHash(plan)) throw new AppError('STALE_CONTEXT', 'The approved plan changed.', 409);
      return { snapshot, approval: approval.payload, plan, executionState: await readIndustrialExecutionState(client, actor.companyId, snapshot.revision), context: await this.read.context(client, snapshot) };
    } });
  }
  async isIndustrial(companyId: string): Promise<boolean> { return await this.read.isIndustrial(companyId); }
  async release(actor: Actor, value: unknown, expectedRevision: string, operationKey: string): Promise<import('./industrial-release.js').IndustrialReleaseResult> {
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Explicit operator release required.', 403);
    const publicContext = await this.publicFor(actor);
    return await new IndustrialReleaseRepository({ store: this.store, context: async (client, snapshot) => await this.read.context(client, snapshot),
      dependencies: async client => {
        const dependencies = dependenciesOf(publicContext);
        if (dependencies.length && !await this.sourceCurrent(client, actor.companyId, publicContext)) throw new AppError('STALE_CONTEXT', 'Public observations changed before release.', 409);
        return dependencies;
      }, enqueue: async (client, basis) => await this.trigger.enqueue(client, { basis, analysisPolicyVersion: 'industrial-analysis:v2', budget: limits }),
    }).release(actor, value, expectedRevision, operationKey);
  }
  private async publicFor(actor: Actor): Promise<ResearchContext> {
    return actor.role === 'analysis_only' ? await this.research.repository.lookupForService(actor.companyId, INDUSTRIAL_PUBLIC_SCOPE, actor.actorId) : await this.research.lookup(actor, INDUSTRIAL_PUBLIC_SCOPE);
  }
  private async sourceCurrent(client: SqlPort, companyId: string, context: ResearchContext): Promise<boolean> {
    const dependencies = dependenciesOf(context);
    return dependencies.length > 0 && await this.store.researchCurrent(companyId, dependencies, client, true);
  }
  async workspace(actor: Actor): Promise<IndustrialWorkspace> {
    const view = await createIndustrialFeedRead(this.store, this.research, this.watches).workspace(actor);
    return { ...view, reports: view.reports.map(report => this.permissions(actor, report)), capabilities: { ...view.capabilities, automaticAnalysis: true, questionsConnected: true, decisionsConnected: true, simulationConnected: true } };
  }
  async report(actor: Actor, id: string): Promise<IndustrialReportView> { return this.permissions(actor, await this.read.report(actor, id)); }
  private permissions(actor: Actor, view: IndustrialReportView): IndustrialReportView {
    const business = ['direction', 'achats'].includes(actor.role), current = view.freshness === 'current';
    return { ...view, planStates: view.planStates.map(state => {
      const plan = view.report.assessment.plans.find(value => value.id === state.planId);
      const budget = plan !== undefined && plan.economics.grossNewSpendCents <= actor.approvalCeilingEur * 100;
      const eligible = business && current && budget;
      return { ...state, permissions: { canApprove: eligible && state.status === 'pending' && plan?.status === 'feasible', canReject: business && current && state.status === 'pending', canSimulate: eligible && state.status === 'approved' && state.execution === null && plan?.status === 'feasible', blockedReason: !business ? 'A business decision role is required.' : !current ? 'The report basis changed. Read the current analysis.' : !budget ? 'The gross spending exceeds this actor’s authority.' : null } };
    }) };
  }
  private async latestRelease(client: SqlPort, companyId: string, eventId?: string): Promise<ReleasedIndustrialEvent | null> {
    const result = await client.query<{ payload: ReleasedIndustrialEvent }>(`SELECT r.payload FROM accel_industrial_event_heads h JOIN accel_industrial_releases r ON r.company_id=h.company_id AND r.id=h.release_id WHERE h.company_id=$1${eventId ? ' AND h.event_id=$2' : ''} ORDER BY r.created_at DESC,r.id LIMIT 1`, eventId ? [companyId, eventId] : [companyId]);
    return result.rows[0]?.payload ?? null;
  }
  private async basisCurrent(client: SqlPort, basis: IndustrialBasis): Promise<boolean> {
    const snapshot = await this.store.snapshot(basis.companyId, client as PoolClient, true);
    if (snapshot.revision !== basis.businessRevision || snapshot.policyVersion !== basis.policyVersion) return false;
    try {
      const context = await this.read.context(client as PoolClient, snapshot), release = await this.latestRelease(client, basis.companyId, basis.eventId);
      return context.revision === basis.contextRevision && context.qualificationRevision === basis.qualificationRevision && release?.revision === basis.eventRevision && release.businessRevision === snapshot.revision && basis.researchDependencies.length > 0 && await this.store.researchCurrent(basis.companyId, basis.researchDependencies, client, true);
    } catch (error) {
      if (error instanceof DataWatchError && ['INVALID_INDUSTRIAL_CONTEXT', 'INDUSTRIAL_CONTEXT_NOT_CURRENT'].includes(error.code)) return false;
      throw error;
    }
  }
  async question(actor: Actor, received: IndustrialQuestionInput): Promise<AgentRun> {
    if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'A business analysis session is required.', 403);
    const input = questionSchema.extend({ reportId: z.string().min(1).max(200).optional() }).strict().parse(received);
    const publicContext = await this.publicFor(actor);
    return await this.store.transaction(async client => {
      const snapshot = await this.store.snapshot(actor.companyId, client, true);
      const prior = (await client.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE company_id=$1 AND operation_key=$2', [actor.companyId, input.operationKey])).rows[0]?.payload;
      if (prior) {
        if (prior.actorId !== actor.actorId || prior.question !== input.question || !prior.industrialScope || prior.industrialIntentId || prior.industrialScope.reportId !== (input.reportId ?? null)) throw new AppError('OPERATION_CONFLICT', 'The key identifies another question.', 409);
        return prior;
      }
      const context = await this.read.context(client, snapshot);
      if (input.reportId) await this.storedReport(client, actor.companyId, input.reportId);
      const dependencies = dependenciesOf(publicContext);
      if (dependencies.length && !await this.sourceCurrent(client, actor.companyId, publicContext)) throw new AppError('STALE_CONTEXT', 'Public observations changed before the question.', 409);
      const release = await this.latestRelease(client, actor.companyId);
      const basis = release?.businessRevision === snapshot.revision ? { ...basisOfIndustrialRelease(release), researchDependencies: dependencies } : undefined;
      const run: AgentRun = { id: randomUUID(), companyId: actor.companyId, actorId: actor.actorId, operationKey: input.operationKey, question: input.question, status: 'queued', revision: snapshot.revision, policyVersion: snapshot.policyVersion, mode: 'direct', model: null, proposalId: null, message: null, traces: [], createdAt: new Date().toISOString(), completedAt: null, ...(this.documents ? { pdfProfileId: PDF_PROFILE.id } : {}), industrialScope: { contextRevision: context.revision, qualificationRevision: context.qualificationRevision, reportId: input.reportId ?? null }, ...(basis ? { industrialBasis: basis } : {}) };
      await client.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)', [run.id, actor.companyId, input.operationKey, actor, run]);
      await client.query('INSERT INTO accel_industrial_run_budgets(run_id,company_id,max_provider_calls,max_tool_calls,max_duration_ms,research_dependencies) VALUES($1,$2,$3,$4,$5,$6)', [run.id, actor.companyId, limits.maxProviderCalls, limits.maxToolCalls, limits.maxDurationMs, JSON.stringify(dependencies)]);
      return run;
    });
  }
  async beforeClaim(): Promise<void> {
    if (!await this.isIndustrial(this.companyId)) return;
    const actor: Actor = { companyId: this.companyId, actorId: INDUSTRIAL_PRINCIPAL, role: 'analysis_only', approvalCeilingEur: 0 };
    let publicContext: ResearchContext;
    try { publicContext = await this.publicFor(actor); } catch (error) { if (error instanceof DataWatchError && error.code === 'RESEARCH_SERVICE_FORBIDDEN') return; throw error; }
    await this.store.transaction(async client => {
      const snapshot = await this.store.snapshot(this.companyId, client, true), release = await this.latestRelease(client, this.companyId);
      if (release?.businessRevision === snapshot.revision && await this.sourceCurrent(client, this.companyId, publicContext)) await this.trigger.enqueue(client, { basis: { ...basisOfIndustrialRelease(release), researchDependencies: dependenciesOf(publicContext) }, analysisPolicyVersion: 'industrial-analysis:v2', budget: limits });
      const abandoned = await client.query<{ id: string; run_id: string }>("SELECT i.id,i.run_id FROM accel_industrial_analysis_intents i JOIN runs r ON r.id=i.run_id AND r.company_id=i.company_id WHERE i.company_id=$1 AND i.status IN ('queued','running') AND r.payload->>'status'='uncertain' LIMIT 10", [this.companyId]);
      for (const row of abandoned.rows) await this.trigger.finish(client, this.companyId, row.id, row.run_id, 'uncertain', 'RUN_REQUIRES_RECONCILIATION');
      await client.query("UPDATE accel_industrial_analysis_intents SET status='blocked',blocked_reason='ANALYSIS_POLICY_SUPERSEDED' WHERE company_id=$1 AND status='ready' AND analysis_policy_version<>$2", [this.companyId, 'industrial-analysis:v2']);
      const readyRows = await client.query<{ id: string }>("SELECT id FROM accel_industrial_analysis_intents WHERE company_id=$1 AND status='ready' AND analysis_policy_version=$2 ORDER BY created_at,id LIMIT 10", [this.companyId, 'industrial-analysis:v2']);
      const ready = [];
      for (const row of readyRows.rows) { const intent = await this.trigger.get(client, this.companyId, row.id); if (intent) ready.push(intent); }
      for (const intent of ready) await this.trigger.promote(client, intent.basis.companyId, intent.id, async (sql, value) => {
        const run: AgentRun = { id: randomUUID(), companyId: value.basis.companyId, actorId: value.servicePrincipalId, operationKey: value.id, question: 'Prepare the current company briefing. Read the known company profile, current public observations and separately released synthetic incident and confirmations. Explain risks, public leads to qualify, the qualified existing CRM demand, the common plan and its limits. Never infer a supplier relationship or confirmation from a public notice. Check whether each public notice is actually relevant to timber, panels or insulation in the company regions; state no known exposure when the released observations do not establish one. This is an automatic structured report job: after read_company_context call calculate_common_plan with the existing qualified demand ID, then MUST call prepare_industrial_report with evaluationId=the returned assessmentId and recommendedPlanId=the returned feasible plan ID. If no feasible plan exists, use recommendedPlanId:null and explain the missing facts; never invent a plan ID. Put the attributed briefing and source limitations in that tool summary. A narrative final answer without prepare_industrial_report does not complete this job.', status: 'queued', revision: value.basis.businessRevision, policyVersion: value.basis.policyVersion, mode: 'direct', model: null, proposalId: null, message: null, traces: [], createdAt: new Date().toISOString(), completedAt: null, industrialScope: { contextRevision: value.basis.contextRevision, qualificationRevision: value.basis.qualificationRevision, reportId: null }, industrialBasis: value.basis, industrialIntentId: value.id };
        await sql.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)', [run.id, run.companyId, run.operationKey, { ...actor, companyId: run.companyId }, run]); return run.id;
      });
    });
  }
  private async validateRun(client: PoolClient, run: AgentRun, actor: Actor): Promise<boolean> {
    const snapshot = await this.store.snapshot(run.companyId, client, true);
    if (actor.actorId !== run.actorId || actor.companyId !== run.companyId || snapshot.revision !== run.revision || snapshot.policyVersion !== run.policyVersion || !run.industrialScope) return false;
    if (actor.role === 'analysis_only' && !await authorizeIndustrialResearch(client, run.companyId, INDUSTRIAL_PUBLIC_SCOPE, actor.actorId)) return false;
    const context = await this.read.context(client, snapshot);
    if (context.revision !== run.industrialScope.contextRevision || context.qualificationRevision !== run.industrialScope.qualificationRevision) return false;
    if (run.industrialBasis) return await this.basisCurrent(client, run.industrialBasis);
    const row = (await client.query<{ research_dependencies: ResearchDependency[] }>('SELECT research_dependencies FROM accel_industrial_run_budgets WHERE company_id=$1 AND run_id=$2', [run.companyId, run.id])).rows[0];
    return Boolean(row && (row.research_dependencies.length === 0 || await this.store.researchCurrent(run.companyId, row.research_dependencies, client, true)));
  }
  private async loadInput(client: PoolClient, run: AgentRun, demandId: string, evaluatedAt: string): Promise<IndustrialEvaluationInput> {
    if (!run.industrialBasis) throw new AppError('NEEDS_INPUT', 'No current released industrial case is bound to this question.', 409);
    const snapshot = await this.store.snapshot(run.companyId, client, true), context = await this.read.context(client, snapshot), release = await this.latestRelease(client, run.companyId, run.industrialBasis.eventId);
    if (!release || release.revision !== run.industrialBasis.eventRevision || release.businessRevision !== snapshot.revision) throw new AppError('STALE_CONTEXT', 'The released industrial case changed.', 409);
    return { snapshot, context, releasedEvent: { ...release, researchDependencies: structuredClone(run.industrialBasis.researchDependencies) }, executionState: await readIndustrialExecutionState(client, run.companyId, snapshot.revision), demandId, evaluatedAt };
  }
  private async reserve(run: AgentRun, actor: Actor, kind: 'provider' | 'tool'): Promise<boolean> {
    return await this.store.transaction(async client => {
      if (!await this.validateRun(client, run, actor)) return false;
      const running = await client.query("SELECT id FROM runs WHERE company_id=$1 AND id=$2 AND payload->>'status'='running' AND lease_until>clock_timestamp()", [run.companyId, run.id]);
      if (!running.rowCount) return false;
      if (run.industrialIntentId) return await this.trigger.reserveUsage(client, run.companyId, run.industrialIntentId, run.id, kind);
      const column = kind === 'provider' ? 'provider_calls' : 'tool_calls', maximum = kind === 'provider' ? 'max_provider_calls' : 'max_tool_calls';
      return (await client.query(`UPDATE accel_industrial_run_budgets SET ${column}=${column}+1,started_at=COALESCE(started_at,clock_timestamp()) WHERE company_id=$1 AND run_id=$2 AND ${column}<${maximum} AND (started_at IS NULL OR clock_timestamp()<started_at+max_duration_ms*interval '1 millisecond') RETURNING run_id`, [run.companyId, run.id])).rowCount === 1;
    });
  }
  runnerFor(run: AgentRun, sink: (trace: ToolTrace) => Promise<void>, actor: Actor, provider?: ModelProvider): AgentRunner {
    return async input => {
      const publicContext = await this.publicFor(actor);
      const port = createIndustrialAgentPort({ run, actor, transaction: async work => await this.store.transaction(work),
        validateBasis: async client => await this.validateRun(client, run, actor),
        loadInput: async (client, demandId, evaluatedAt) => await this.loadInput(client, run, demandId, evaluatedAt),
        readOverview: async client => await this.overview(client, run, publicContext), reserveUsage: async kind => await this.reserve(run, actor, kind),
      });
      return await createAgentRunner({ industrialPort: port, ...(run.pdfProfileId && this.documents ? { pdfKnowledgePort: createPdfKnowledgePort(this.documents, actor, run.pdfProfileId) } : {}), ...(provider ? { provider } : {}), writeTrace: sink, maxDurationMs: 60000, currentVersion: async () => { const snapshot = await this.store.snapshot(run.companyId); return { companyId: snapshot.companyId, revision: snapshot.revision, policyVersion: snapshot.policyVersion }; } })(input);
    };
  }
  private async overview(client: PoolClient, run: AgentRun, research: ResearchContext): Promise<JsonObject> {
    const snapshot = await this.store.snapshot(run.companyId, client, true), context = await this.read.context(client, snapshot), display = await readIndustrialDisplay(client, run.companyId), release = await this.latestRelease(client, run.companyId);
    const report = (await client.query<{ payload: IndustrialReport }>(`SELECT payload FROM accel_industrial_reports WHERE company_id=$1${run.industrialScope?.reportId ? ' AND id=$2' : ''} ORDER BY created_at DESC,id LIMIT 1`, run.industrialScope?.reportId ? [run.companyId, run.industrialScope.reportId] : [run.companyId])).rows[0]?.payload;
    const approvals = report ? (await client.query<{ payload: IndustrialApproval }>('SELECT payload FROM accel_industrial_approvals WHERE company_id=$1 AND report_id=$2 ORDER BY created_at DESC,id LIMIT 10', [run.companyId, report.id])).rows.map(row => row.payload) : [];
    const executions = report ? (await client.query<{ payload: import('../contracts/industrial.js').IndustrialDemoExecution }>('SELECT e.payload FROM accel_industrial_executions e JOIN accel_industrial_approvals a ON a.company_id=e.company_id AND a.id=e.approval_id WHERE e.company_id=$1 AND a.report_id=$2 ORDER BY e.created_at DESC,e.id LIMIT 10', [run.companyId, report.id])).rows.map(row => row.payload) : [];
    const usable = await this.sourceCurrent(client, run.companyId, research);
    return json({ companyId: run.companyId, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, contextRevision: context.revision, qualificationRevision: context.qualificationRevision,
      counts: { commitments: snapshot.dataset.tables.order_lines?.length ?? 0, crmDemands: context.commercialDemand.length, sources: usable ? research.observations.length : 0 },
      profile: { name: display?.labels.find(label => label.entityType === 'company')?.displayName ?? String(snapshot.dataset.tables.company?.[0]?.name ?? run.companyId), activity: display?.companyProfileDisplay.activity ?? context.companyProfile.activity, countries: context.companyProfile.countries.slice(0,20), regions: context.companyProfile.regions.slice(0,20) },
      relationships: context.supplierDependencies.slice(0,10).map(value => ({ supplierId: value.supplierId, supplierSiteId: value.supplierSiteId, productId: value.productId, purchaseOrderLineIds: value.purchaseOrderLineIds.slice(0,20), orderLineIds: value.orderLineIds.slice(0,20), totalOrderLines: value.orderLineIds.length, partial: value.orderLineIds.length > 20 || value.purchaseOrderLineIds.length > 20 })),
      demands: context.commercialDemand.slice(0,20).map(value => ({ opportunityId: value.opportunityId, quantity: value.quantity, unit: value.unit, productId: value.productId, needDate: value.needDate })),
      releasedEvent: release?.businessRevision === snapshot.revision ? { eventId: release.event.eventId, eventRevision: release.revision, testOnly: true } : null,
      publicSources: usable ? research.observations.slice(0,10).map(value => ({ ref: value.ref, title: value.evidence.title.slice(0,500), url: value.evidence.url, publishedAt: value.evidence.publishedAt, collectedAt: value.evidence.collectedAt, content: value.evidence.content.slice(0,2000), conditions: [...value.conditions, 'PUBLIC_NOTICE_LEAD_NOT_QUALIFIED_CRM_DEMAND', 'NO_SUPPLIER_CAUSALITY', ...(value.evidence.content.length > 2000 ? ['EXCERPT_FIRST_2000_CHARACTERS'] : [])].slice(0,30) })) : [],
      runtimeState: { report: report ? { id: report.id, businessRevision: report.basis.businessRevision, policyVersion: report.basis.policyVersion, status: report.status, recommendedPlanId: report.recommendedPlanId } : null, approvals: approvals.map(value => ({ id: value.id, planId: value.planId, planVersion: value.planVersion, decision: value.decision, actorId: value.actorId, decidedAt: value.decidedAt })), executions: executions.map(value => ({ id: value.id, planId: value.planId, planVersion: value.planVersion, approvalId: value.approvalId, status: value.status, beforeRevision: value.beforeRevision, afterRevision: value.afterRevision, simulation: true, completedAt: value.completedAt, records: value.records.slice(0,20) })) },
    });
  }
  private async storedReport(client: SqlPort, companyId: string, reportId: string): Promise<IndustrialReport> {
    const row = (await client.query<{ payload: IndustrialReport }>('SELECT payload FROM accel_industrial_reports WHERE company_id=$1 AND id=$2', [companyId, reportId])).rows[0];
    if (!row) throw new AppError('NOT_FOUND', 'Report not found.', 404); return row.payload;
  }
  private async recalculate(client: PoolClient, report: IndustrialReport, planId: string, requireFeasible = true): Promise<IndustrialReport['assessment']['plans'][number]> {
    if (!await this.basisCurrent(client, report.basis)) throw new AppError('STALE_CONTEXT', 'The report basis changed.', 409);
    const run = (await client.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE company_id=$1 AND id=$2', [report.companyId, report.runId])).rows[0]?.payload;
    if (!run) throw new AppError('NOT_FOUND', 'Report run not found.', 404);
    const input = await this.loadInput(client, run, report.assessment.plans.find(plan => plan.id === planId)?.demandId ?? '', report.assessment.evaluatedAt);
    const fresh = evaluateIndustrialPlan(input), plan = fresh.plans.find(value => value.id === planId), old = report.assessment.plans.find(value => value.id === planId);
    if (!plan || !old || requireFeasible && plan.status !== 'feasible' || industrialHash(plan) !== industrialHash(old) || fresh.calculationHash !== report.assessment.calculationHash) throw new AppError('INADMISSIBLE', 'The exact plan is no longer admissible.', 409);
    if (!requireFeasible) return plan;
    const now = new Date().toISOString();
    const current = evaluateIndustrialPlan({ ...input, evaluatedAt: now });
    const actions = (value: typeof plan): unknown => value.steps.map(({ id: _id, dependsOn, ...step }) => ({ ...step, dependsOn: dependsOn.map(id => value.steps.findIndex(candidate => candidate.id === id)) }));
    if (!current.plans.some(value => value.status === 'feasible' && industrialHash(actions(value)) === industrialHash(actions(plan)) && industrialHash(value.economics) === industrialHash(plan.economics))) throw new AppError('STALE_CONTEXT', 'Time-sensitive plan resources changed.', 409);
    return plan;
  }
  async decide(actor: Actor, planId: string, input: IndustrialDecisionInput): Promise<IndustrialApproval> {
    if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'A decision role is required.', 403);
    return await this.store.transaction(async client => {
      await this.store.snapshot(actor.companyId, client, true);
      const commandHash = industrialHash({ actorId: actor.actorId, planId, input });
      const prior = (await client.query<{ command_hash: string; payload: IndustrialApproval }>('SELECT command_hash,payload FROM accel_industrial_approvals WHERE company_id=$1 AND operation_key=$2', [actor.companyId, input.operationKey])).rows[0];
      if (prior) { if (prior.command_hash !== commandHash) throw new AppError('OPERATION_CONFLICT', 'Decision key identifies different input.', 409); return prior.payload; }
      const row = (await client.query<{ payload: IndustrialReport }>("SELECT payload FROM accel_industrial_reports WHERE company_id=$1 AND EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'assessment'->'plans') plan WHERE plan->>'id'=$2) ORDER BY created_at DESC LIMIT 1", [actor.companyId, planId])).rows[0];
      if (!row) throw new AppError('NOT_FOUND', 'Plan not found.', 404);
      const receivedPlan = row.payload.assessment.plans.find(value => value.id === planId);
      if (!receivedPlan || industrialHash(input.expectedBasis) !== industrialHash(receivedPlan.basis) || input.expectedPlanHash !== industrialHash(receivedPlan) || input.expectedPlanVersion !== receivedPlan.version) throw new AppError('STALE_CONTEXT', 'Plan identity changed.', 409);
      if (input.decision === 'approve' && receivedPlan.economics.grossNewSpendCents > actor.approvalCeilingEur * 100) throw new AppError('BUDGET', 'Gross spending exceeds approval authority.', 403);
      const plan = await this.recalculate(client, row.payload, planId, input.decision === 'approve');
      if (industrialHash(input.expectedBasis) !== industrialHash(plan.basis) || input.expectedPlanHash !== industrialHash(plan) || input.expectedPlanVersion !== plan.version) throw new AppError('STALE_CONTEXT', 'Plan identity changed.', 409);
      if (input.decision === 'approve' && plan.economics.grossNewSpendCents > actor.approvalCeilingEur * 100) throw new AppError('BUDGET', 'Gross spending exceeds approval authority.', 403);
      if ((await client.query('SELECT id FROM accel_industrial_approvals WHERE company_id=$1 AND plan_id=$2', [actor.companyId, planId])).rowCount) throw new AppError('ALREADY_DECIDED', 'Plan already decided.', 409);
      const approval: IndustrialApproval = { id: `industrial-approval:${randomUUID()}`, companyId: actor.companyId, planId, planVersion: plan.version, planHash: industrialHash(plan), basis: plan.basis, actorId: actor.actorId, decision: input.decision === 'approve' ? 'approved' : 'rejected', decidedAt: new Date().toISOString() };
      await client.query('INSERT INTO accel_industrial_approvals(id,company_id,report_id,plan_id,operation_key,command_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)', [approval.id, actor.companyId, row.payload.id, planId, input.operationKey, commandHash, approval]); return approval;
    });
  }
  async simulate(actor: Actor, approvalId: string, input: IndustrialSimulationInput): Promise<import('../contracts/industrial.js').IndustrialDemoExecution> { return await this.executor.execute(actor, approvalId, input); }
  async finalize(client: PoolClient, run: AgentRun, result: AgentRunnerResult, snapshot: CompanySnapshot, stale: boolean): Promise<RunFinalization> {
    if (!run.industrialScope) return {};
    const actor = (await client.query<{ actor: Actor }>('SELECT actor FROM runs WHERE company_id=$1 AND id=$2', [run.companyId, run.id])).rows[0]?.actor;
    if (!actor) throw new AppError('INVALID_RUN', 'Stored run authority is missing.', 503);
    const report = result.industrialReport;
    if (report && (report.id !== `report:${run.id}` || report.companyId !== run.companyId || report.runId !== run.id || !run.industrialBasis || industrialHash(report.basis) !== industrialHash(run.industrialBasis))) throw new AppError('INVALID_REPORT', 'The report is outside its bound run.', 409);
    const current = !stale && await this.validateRun(client, run, actor);
    let outcome: 'done' | 'stale' | 'blocked' | 'uncertain' = result.status === 'uncertain' ? 'uncertain' : !current || result.status === 'stale_context' ? 'stale' : result.status === 'error' || result.status === 'budget_exhausted' || Boolean(run.industrialIntentId && !report) ? 'blocked' : 'done';
    if (report && outcome === 'done') {
      if (report.basis.businessRevision !== snapshot.revision || report.basis.policyVersion !== snapshot.policyVersion || report.status === 'stale' || report.recommendedPlanId === null && report.status !== 'needs_input') throw new AppError('INVALID_REPORT', 'Report status or snapshot binding is invalid.', 409);
      const demandId = report.assessment.plans[0]?.demandId ?? report.assessment.qualifiedDemandIds[0];
      if (demandId) {
        const input = await this.loadInput(client, run, demandId, report.assessment.evaluatedAt);
        const assessment = evaluateIndustrialPlan(input);
        if (industrialHash(assessment) !== industrialHash(report.assessment) || report.recommendedPlanId !== null && !assessment.plans.some(plan => plan.id === report.recommendedPlanId && plan.status !== 'rejected')) throw new AppError('INVALID_REPORT', 'The report differs from the independent server calculation.', 409);
      } else if (report.status !== 'needs_input' || report.assessment.plans.length !== 0 || report.recommendedPlanId !== null) throw new AppError('INVALID_REPORT', 'A report without a received demand cannot contain a plan.', 409);
    }
    // Publication consumes the final currentness and duration gate after calculation.
    if (run.industrialIntentId) {
      const finished = await this.trigger.finish(client, run.companyId, run.industrialIntentId, run.id, outcome, run.industrialIntentId && !report && outcome === 'blocked' ? 'REPORT_NOT_PREPARED' : undefined);
      outcome = finished.status === 'done' ? 'done' : finished.status === 'stale' ? 'stale' : finished.status === 'uncertain' ? 'uncertain' : 'blocked';
    } else if (outcome === 'done') {
      const allowed = await client.query("SELECT run_id FROM accel_industrial_run_budgets WHERE company_id=$1 AND run_id=$2 AND (started_at IS NULL OR clock_timestamp()<started_at+max_duration_ms*interval '1 millisecond')", [run.companyId, run.id]);
      if (!allowed.rowCount) outcome = 'blocked';
    }
    if (report && outcome !== 'done') await client.query('INSERT INTO accel_industrial_report_attempts(company_id,run_id,payload,outcome) VALUES($1,$2,$3,$4) ON CONFLICT(run_id) DO NOTHING', [run.companyId, run.id, report, outcome]);
    if (outcome !== 'done') return { status: outcome === 'uncertain' ? 'uncertain' : outcome === 'stale' ? 'stale_context' : result.status === 'budget_exhausted' ? 'budget_exhausted' : 'error', message: report ? 'The report attempt requires reconciliation. No reviewable report or business effect was published.' : run.industrialIntentId && !report && outcome === 'blocked' ? 'The model did not prepare the required structured report. This attempt is blocked for reconciliation. No reviewable report or business effect was published.' : 'The bound company, source or processing budget is no longer current.' };
    if (!report) return {};
    await client.query('INSERT INTO accel_industrial_reports(id,company_id,run_id,payload) VALUES($1,$2,$3,$4)', [report.id, run.companyId, run.id, report]);
    return { industrialReportId: report.id };
  }
}
