import { z } from "zod";
import type { ResearchContext, ResearchDependency } from "../contracts/research.js";
import type { CoordinatedIndustrialPlan, IndustrialApproval, IndustrialBasis, IndustrialDemoExecution, IndustrialQuestionScope } from "../contracts/industrial.js";
import type { IndustrialDecisionInput, IndustrialQuestionInput, IndustrialReportView, IndustrialSimulationInput, IndustrialWorkspace } from "../contracts/industrial-api.js";

export interface IndustrialSchemas {
  basis: z.ZodType<IndustrialBasis>;
  questionScope: z.ZodType<IndustrialQuestionScope>;
  question: z.ZodType<IndustrialQuestionInput>;
  workspace: z.ZodType<IndustrialWorkspace>;
  reportView: z.ZodType<IndustrialReportView>;
  approval: z.ZodType<IndustrialApproval>;
  execution: z.ZodType<IndustrialDemoExecution>;
  decision: z.ZodType<IndustrialDecisionInput>;
  simulation: z.ZodType<IndustrialSimulationInput>;
}

export function sameIndustrialValue(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
    return JSON.stringify(value) ?? "undefined";
  };
  return canonical(left) === canonical(right);
}

export function industrialBasisCurrent(basis: IndustrialBasis, workspace: IndustrialWorkspace): boolean {
  return basis.companyId === workspace.company.id && basis.businessRevision === workspace.company.businessRevision && basis.policyVersion === workspace.company.policyVersion && basis.contextRevision === workspace.context.revision && basis.qualificationRevision === workspace.context.qualificationRevision
    && basis.researchDependencies.every(value => value.validUntil !== null && Date.parse(value.validUntil) > Date.now())
    && workspace.events.some(value => value.event.eventId === basis.eventId && value.revision === basis.eventRevision && value.contextRevision === basis.contextRevision && value.qualificationRevision === basis.qualificationRevision);
}

export function createIndustrialSchemas(dependency: z.ZodType<ResearchDependency>, publicResearch: z.ZodType<ResearchContext>): IndustrialSchemas {
  const id = z.string().min(1).max(512);
  const text = z.string().max(100000);
  const date = z.string().datetime({ offset: true });
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
  const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const cents = count; const contribution = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
  const quantity = z.number().finite().positive();
  const ids = z.array(id).max(10000).refine(values => new Set(values).size === values.length);
  const texts = z.array(text).max(10000);
  const refs = z.array(z.object({ occurrenceId: id, evidenceId: id, contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(10000);
  const provenance = z.object({ system: z.enum(["ERP_DEMO", "CRM_DEMO", "SCENARIO"]), nativeId: id, version: id, receivedAt: date, actorId: id }).strict();
  const basis: z.ZodType<IndustrialBasis> = z.object({ companyId: id, businessRevision: id, policyVersion: id, contextRevision: id, qualificationRevision: id, eventId: id, eventRevision: id, researchDependencies: z.array(dependency).max(10) }).strict();
  const stepBase = { id, productId: id, unit: id, quantity, destinationDepotId: id, dependsOn: ids };
  const step = z.discriminatedUnion("kind", [
    z.object({ ...stepBase, kind: z.literal("purchase"), canonicalResourceId: id, quoteId: id, supplierId: id, supplierSiteId: id, arrivalDate: day, materialCents: cents, freightCents: cents }).strict(),
    z.object({ ...stepBase, kind: z.literal("transfer"), canonicalResourceId: id, quoteId: id, quoteSource: z.enum(["c1_transport", "industrial_delivery"]), fromDepotId: id, dispatchDate: day, arrivalDate: day, freightCents: cents, handlingCents: cents }).strict(),
    z.object({ ...stepBase, kind: z.literal("prepare_offer"), opportunityId: id, needDate: day, saleUnitPriceCents: cents }).strict(),
  ]);
  const plan: z.ZodType<CoordinatedIndustrialPlan> = z.object({ id, version: id, basis, evaluationId: id, demandId: id, targetOrderLineIds: ids, steps: z.array(step).max(10000), allocations: z.array(z.object({ canonicalResourceId: id, targetKind: z.enum(["commitment", "crm_demand"]), targetId: id, productId: id, unit: id, quantity, availableDate: day, supplyStepId: id.optional() }).strict()).max(100000), economics: z.object({ currency: z.literal("EUR"), grossNewSpendCents: cents, riskMitigationSpendCents: cents, opportunityRevenueCents: cents.nullable(), opportunityMaterialValuationCents: cents.nullable(), opportunityFreightCents: cents.nullable(), opportunityHandlingCents: cents.nullable(), opportunityContributionCents: contribution.nullable(), missing: texts }).strict(), constraints: texts, unknowns: texts, status: z.enum(["feasible", "conditional", "rejected"]) }).strict().refine(value => new Set(value.steps.map(item => item.id)).size === value.steps.length && value.steps.every(item => item.dependsOn.every(parent => parent !== item.id && value.steps.some(candidate => candidate.id === parent))));
  const approval: z.ZodType<IndustrialApproval> = z.object({ id, companyId: id, planId: id, planVersion: id, planHash: id, basis, actorId: id, decision: z.enum(["approved", "rejected"]), decidedAt: date }).strict().refine(value => value.companyId === value.basis.companyId);
  const execution: z.ZodType<IndustrialDemoExecution> = z.object({ id, companyId: id, planId: id, planVersion: id, planHash: id, approvalId: id, operationKey: id, actorId: id, commandHash: id, status: z.enum(["applied", "failed", "uncertain"]), beforeRevision: id, afterRevision: id.nullable(), records: z.array(z.object({ kind: z.enum(["purchase_order", "transfer_order", "origin_stock_reservation", "planned_allocation", "crm_offer"]), id, status: id }).strict()).max(10000), completedAt: date.nullable(), code: id.nullable(), simulation: z.literal(true) }).strict().refine(value => value.status !== "applied" || (value.afterRevision !== null && value.afterRevision !== value.beforeRevision && value.completedAt !== null && value.records.length > 0));
  const assessment = z.object({ id, basis, evaluatedAt: date, testOnly: z.literal(true), impact: z.enum(["risk", "opportunity", "mixed", "no_known_exposure", "needs_input"]), affectedOrderLineIds: ids, qualifiedDemandIds: ids, coverage: z.object({ totalCommitments: count, protectedCommitments: count, worsenedOrderLineIds: ids, remainingShortageOrderLineIds: ids }).strict(), plans: z.array(plan).max(10000), constraints: texts, unknowns: texts, calculationHash: id }).strict();
  const report = z.object({ id, companyId: id, runId: id, basis, status: z.enum(["prepared", "needs_input", "stale"]), title: text, summary: text, assessment, recommendedPlanId: id.nullable(), createdAt: date }).strict().refine(value => value.companyId === value.basis.companyId && sameIndustrialValue(value.basis, value.assessment.basis) && value.assessment.plans.every(item => sameIndustrialValue(item.basis, value.basis)) && new Set(value.assessment.plans.map(item => item.id)).size === value.assessment.plans.length && (value.recommendedPlanId === null || value.assessment.plans.some(item => item.id === value.recommendedPlanId)) && value.assessment.coverage.protectedCommitments <= value.assessment.coverage.totalCommitments);
  const planState = z.object({ planId: id, planVersion: id, planHash: id, status: z.enum(["pending", "approved", "rejected", "stale"]), approval: approval.nullable(), execution: execution.nullable(), permissions: z.object({ canApprove: z.boolean(), canReject: z.boolean(), canSimulate: z.boolean(), blockedReason: text.nullable() }).strict() }).strict();
  const reportView: z.ZodType<IndustrialReportView> = z.object({ report, freshness: z.enum(["current", "stale"]).optional(), planStates: z.array(planState).max(10000) }).strict().refine(value => value.planStates.length === value.report.assessment.plans.length && new Set(value.planStates.map(item => item.planId)).size === value.planStates.length && value.planStates.every(state => {
    const bound = value.report.assessment.plans.find(item => item.id === state.planId && item.version === state.planVersion);
    if (!bound) return false;
    const decision = state.approval; const applied = state.execution;
    if (decision && (decision.companyId !== value.report.companyId || decision.planId !== bound.id || decision.planVersion !== bound.version || decision.planHash !== state.planHash || !sameIndustrialValue(decision.basis, bound.basis))) return false;
    if ((state.status === "approved" && decision?.decision !== "approved") || (state.status === "rejected" && decision?.decision !== "rejected") || (state.status === "pending" && (decision !== null || applied !== null))) return false;
    return !applied || Boolean(decision?.decision === "approved" && applied.companyId === value.report.companyId && applied.planId === bound.id && applied.planVersion === bound.version && applied.planHash === state.planHash && applied.approvalId === decision.id && applied.beforeRevision === bound.basis.businessRevision);
  }));
  const event = z.object({ id, companyId: id, revision: id, contextRevision: id, qualificationRevision: id, businessRevision: id, policyVersion: id, event: z.object({ eventId: id, version: id, kind: z.literal("industrial_fire"), occurredAt: date, supplierId: id, supplierSiteId: id, competitorIds: ids, productIds: ids, status: z.literal("declared_synthetic_scenario"), testOnly: z.literal(true), provenance, publicSourceEvidenceRefs: refs }).strict(), confirmations: z.array(z.object({ confirmationId: id, eventId: id, supplierId: id, supplierSiteId: id, purchaseOrderLineId: id, previousExpectedDate: day.nullable(), confirmedExpectedDate: day, confirmedAt: date, confirmationStatus: z.literal("synthetic_confirmed"), provenance }).strict()).max(10000), competitorConfirmations: z.array(z.object({ confirmationId: id, eventId: id, competitorId: id, supplierSiteId: id, productId: id, unit: id, quantity, requestedDeliveryDate: day, cannotFulfilBefore: day, relatedOpportunityId: id, confirmedAt: date, confirmationStatus: z.literal("synthetic_confirmed"), provenance }).strict()).max(10000), releasedByActorId: id, releasedAt: date, researchDependencies: z.array(dependency).max(10) }).strict();
  const releasedEvent = event.refine(value => value.confirmations.every(item => item.eventId === value.event.eventId) && value.competitorConfirmations.every(item => item.eventId === value.event.eventId));
  const intent = z.object({ id, basis, analysisPolicyVersion: id, servicePrincipalId: id, status: z.enum(["ready", "queued", "running", "done", "stale", "blocked", "uncertain"]), blockedReason: text.nullable(), runId: id.nullable(), budget: z.object({ maxProviderCalls: count, maxToolCalls: count, maxDurationMs: count, maxRunsPerEvent: count }).strict(), createdAt: date }).strict();
  const display = z.object({
    companyId: id, version: count.positive(), baseCoreSha256: z.string().regex(/^[a-f0-9]{64}$/), baseContextSha256: z.string().regex(/^[a-f0-9]{64}$/),
    labels: z.array(z.object({ entityType: z.enum(["company", "depot", "supplier", "supplier_site", "customer", "project", "competitor"]), nativeId: id, displayName: z.string().min(1).max(1000), synthetic: z.literal(true) }).strict()).max(10000).refine(values => new Set(values.map(item => JSON.stringify([item.entityType, item.nativeId]))).size === values.length),
    companyProfileDisplay: z.object({ activity: text, summary: text, operations: text, disclosure: text }).strict(),
  }).strict();
  const publicFeed = z.object({ profileId: id, watchId: id.nullable(), cadenceMinutes: count.positive().nullable(), nextRunAt: date.nullable(), lastAttemptAt: date.nullable(), lastAttemptStatus: z.enum(["queued", "running", "completed", "error"]).nullable() }).strict();
  const workspace: z.ZodType<IndustrialWorkspace> = z.object({
    company: z.object({ id, name: text, businessRevision: id, policyVersion: id, dataOrigin: z.literal("synthetic"), importedAt: date, counts: z.record(id, count) }).strict(),
    context: z.object({ revision: id, qualificationRevision: id, activity: text, countries: texts, regions: texts, receivedAt: date, counts: z.object({ supplierSites: count, supplierDependencies: count, competitors: count, qualifiedDemands: count }).strict() }).strict(),
    actor: z.object({ actorId: id, companyId: id, role: z.enum(["direction", "achats", "logistique", "operator"]), approvalCeilingEur: z.number().finite().nonnegative() }).strict(),
    events: z.array(releasedEvent).max(10000), analyses: z.array(intent).max(10000), reports: z.array(reportView).max(10000),
    display: display.optional(), publicResearch: publicResearch.optional(), publicFeed: publicFeed.optional(),
    capabilities: z.object({ automaticAnalysis: z.boolean(), simulationOnly: z.literal(true), publicEvidenceIsSeparate: z.literal(true), decisionsConnected: z.boolean(), simulationConnected: z.boolean(), questionsConnected: z.boolean().optional() }).strict(),
  }).strict().refine(value => value.actor.companyId === value.company.id
    && value.events.every(item => item.companyId === value.company.id)
    && value.analyses.every(item => item.basis.companyId === value.company.id)
    && value.reports.every(item => item.report.companyId === value.company.id)
    && new Set(value.reports.map(item => item.report.id)).size === value.reports.length
    && (!value.display || value.display.companyId === value.company.id)
    && (!value.publicResearch || value.publicResearch.companyId === value.company.id)
    && (!value.publicResearch || !value.publicFeed || value.publicResearch.scope.profileId === value.publicFeed.profileId));
  const operationKey = z.string().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/);
  return { workspace, reportView, approval, execution, basis, questionScope: z.object({ contextRevision: id, qualificationRevision: id, reportId: id.nullable() }).strict(), question: z.object({ question: z.string().trim().min(1).max(3000), operationKey, reportId: id.optional() }).strict(), decision: z.object({ decision: z.enum(["approve", "reject"]), expectedBasis: basis, expectedPlanVersion: id, expectedPlanHash: id, operationKey }).strict(), simulation: z.object({ expectedBusinessRevision: id, expectedPlanVersion: id, expectedPlanHash: id, operationKey }).strict() };
}
