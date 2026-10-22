import type { z } from "zod";
import type { Actor, AgentRun } from "../contracts/index.js";
import type { IndustrialApproval, IndustrialBasis, IndustrialDemoExecution } from "../contracts/industrial.js";
import type { IndustrialReportView, IndustrialWorkspace } from "../contracts/industrial-api.js";
import type { RunView, UiApi } from "./types";
import { UiError } from "./types";
import { industrialBasisCurrent, sameIndustrialValue } from "./industrial";
import type { IndustrialSchemas } from "./industrial";

type IndustrialApi = Required<Pick<UiApi, "readIndustrial" | "readIndustrialReport" | "decideIndustrialPlan" | "simulateIndustrialApproval" | "askIndustrialQuestion" | "readIndustrialRun">>;
interface Authority { actor: Actor; sessionEpoch: number }
type BasisPin = Pick<IndustrialBasis, "eventId" | "eventRevision" | "contextRevision" | "qualificationRevision">;
interface Dependencies {
  request: <T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal) => Promise<T>;
  schemas: IndustrialSchemas;
  authority: () => Authority;
  runSchema: z.ZodType<AgentRun>;
  projectRun: (run: AgentRun) => RunView;
}

export function createIndustrialApi({ request, schemas, authority, runSchema, projectRun }: Dependencies): IndustrialApi {
  let saved: { workspace: IndustrialWorkspace; authority: Authority } | null = null;
  let fence = 0; let reading = 0; let mutating = false; let runReading = 0;
  const latestRunReads = new Map<string, number>();
  const questionReceipts = new Map<string, { authority: Authority; run: AgentRun; basisPins: BasisPin[] }>();
  function verifySession(expected: Authority, uncertain = false): void {
    let current: Authority;
    try { current = authority(); } catch { throw new UiError("SESSION_CHANGED", "The session changed. Reload the company briefing.", uncertain); }
    if (!sameIndustrialValue(expected, current)) throw new UiError("SESSION_CHANGED", "The session changed. Reload the company briefing.", uncertain);
  }
  function current(): IndustrialWorkspace {
    if (!saved) throw new UiError("INDUSTRIAL_READ_REQUIRED", "Reload the company briefing before an action.");
    verifySession(saved.authority); return saved.workspace;
  }
  function validIndustrialRun(run: AgentRun): boolean {
    const scope = run.industrialScope; const basis = run.industrialBasis;
    return Boolean(scope && !run.caseRef && !run.researchScope && (!basis || (basis.companyId === run.companyId && basis.businessRevision === run.revision && basis.policyVersion === run.policyVersion && basis.contextRevision === scope.contextRevision && basis.qualificationRevision === scope.qualificationRevision)));
  }
  function pins(workspace: IndustrialWorkspace): BasisPin[] {
    return [...workspace.events.map(item => ({ eventId: item.event.eventId, eventRevision: item.revision, contextRevision: item.contextRevision, qualificationRevision: item.qualificationRevision })), ...workspace.reports.map(item => item.report.basis), ...workspace.analyses.map(item => item.basis)];
  }
  function knownBasis(basis: IndustrialBasis | undefined, received: BasisPin[]): boolean {
    return !basis || received.some(item => item.eventId === basis.eventId && item.eventRevision === basis.eventRevision && item.contextRevision === basis.contextRevision && item.qualificationRevision === basis.qualificationRevision);
  }
  async function mutation<T>(send: () => Promise<T>): Promise<T> {
    if (mutating) throw new UiError("COMMAND_PENDING", "Another briefing command is still waiting for a receipt.");
    mutating = true; fence++; saved = null;
    try { return await send(); }
    finally { mutating = false; fence++; saved = null; }
  }
  return {
    async askIndustrialQuestion(input): Promise<RunView> {
      const context = current(); const expected = authority();
      const body = schemas.question.parse({ question: input.question, operationKey: input.idempotencyKey, ...(input.reportId !== undefined ? { reportId: input.reportId } : {}) });
      if (body.reportId && !context.reports.some(item => item.report.id === body.reportId)) throw new UiError("REPORT_NOT_RECEIVED", "Choose a report received for this company before asking about it.");
      const scope = { contextRevision: context.context.revision, qualificationRevision: context.context.qualificationRevision, reportId: body.reportId ?? null };
      return await mutation(async (): Promise<RunView> => {
        const run = await request("/api/industrial/questions", runSchema, body);
        verifySession(expected, true);
        if (run.companyId !== context.company.id || run.actorId !== expected.actor.actorId || run.operationKey !== body.operationKey || run.question !== body.question || !sameIndustrialValue(run.industrialScope, scope) || !validIndustrialRun(run) || !knownBasis(run.industrialBasis, pins(context)) || run.industrialIntentId) throw new UiError("INVALID_RECEIPT", "The analysis receipt does not match this company question. Read its saved state before retrying.", true);
        questionReceipts.set(run.id, { authority: expected, run: structuredClone(run), basisPins: pins(context) });
        while (questionReceipts.size > 200) questionReceipts.delete(questionReceipts.keys().next().value!);
        return projectRun(run);
      });
    },
    async readIndustrialRun(identifier, signal): Promise<RunView> {
      const prior = questionReceipts.get(identifier);
      const context = prior ? undefined : current(); const expected = prior?.authority ?? authority();
      const version = fence; const number = ++runReading; latestRunReads.set(identifier, number);
      verifySession(expected);
      const report = context?.reports.find(item => item.report.runId === identifier)?.report;
      const intent = context?.analyses.find(item => item.runId === identifier);
      if (!prior && !report && !intent) throw new UiError("RUN_NOT_RECEIVED", "Choose an analysis received for this company.");
      const run = await request(`/api/runs/${encodeURIComponent(identifier)}`, runSchema, undefined, signal);
      verifySession(expected);
      if (signal?.aborted || version !== fence || latestRunReads.get(identifier) !== number) throw new UiError("READ_REPLACED", "The analysis changed during this read. Reload it.");
      if (run.id !== identifier || run.companyId !== expected.actor.companyId || !validIndustrialRun(run) || (report && (run.industrialReportId !== report.id || !sameIndustrialValue(run.industrialBasis, report.basis))) || (intent && (run.industrialIntentId !== intent.id || run.actorId !== intent.servicePrincipalId || !sameIndustrialValue(run.industrialBasis, intent.basis))) || (prior && (run.actorId !== prior.run.actorId || run.question !== prior.run.question || run.operationKey !== prior.run.operationKey || !sameIndustrialValue(run.industrialScope, prior.run.industrialScope) || run.revision !== prior.run.revision || run.policyVersion !== prior.run.policyVersion || run.industrialIntentId || (prior.run.industrialBasis ? !sameIndustrialValue(run.industrialBasis, prior.run.industrialBasis) : !knownBasis(run.industrialBasis, [...prior.basisPins, ...(saved ? pins(saved.workspace) : [])])) || (prior.run.industrialReportId !== undefined && run.industrialReportId !== prior.run.industrialReportId)))) throw new UiError("INVALID_SCOPE", "The analysis does not match this company and request.");
      if (prior) prior.run = structuredClone(run);
      return projectRun(run);
    },
    async readIndustrial(signal): Promise<IndustrialWorkspace> {
      const expected = authority(); const version = fence; const number = ++reading;
      const value = await request("/api/industrial", schemas.workspace, undefined, signal);
      verifySession(expected);
      if (signal?.aborted || version !== fence || number !== reading) throw new UiError("READ_REPLACED", "The briefing changed during this read. Reload it.");
      if (value.company.id !== expected.actor.companyId || !sameIndustrialValue(value.actor, expected.actor)) throw new UiError("INVALID_SCOPE", "The briefing does not match this company and session.");
      saved = { workspace: structuredClone(value), authority: expected }; return value;
    },
    async readIndustrialReport(identifier, signal): Promise<IndustrialReportView> {
      const context = current(); const expected = authority(); const version = fence; const number = ++reading;
      if (!context.reports.some(item => item.report.id === identifier)) throw new UiError("REPORT_NOT_RECEIVED", "Choose a report already received for this company.");
      const value = await request(`/api/industrial/reports/${encodeURIComponent(identifier)}`, schemas.reportView, undefined, signal);
      verifySession(expected);
      if (signal?.aborted || version !== fence || number !== reading) throw new UiError("READ_REPLACED", "The briefing changed during this read. Reload it.");
      if (value.report.id !== identifier || value.report.companyId !== context.company.id) throw new UiError("INVALID_SCOPE", "The report does not match this company and selection.");
      if (saved) saved.workspace.reports = saved.workspace.reports.map(item => item.report.id === identifier ? structuredClone(value) : item);
      return value;
    },
    async decideIndustrialPlan(identifier, input): Promise<IndustrialApproval> {
      const body = schemas.decision.parse(input); const context = current(); const expected = authority();
      if (!context.capabilities.decisionsConnected) throw new UiError("NOT_READY", "Plan decisions are not available yet.");
      const view = context.reports.find(item => item.report.assessment.plans.some(plan => plan.id === identifier && plan.version === body.expectedPlanVersion && sameIndustrialValue(plan.basis, body.expectedBasis)) && item.planStates.some(state => state.planId === identifier && state.planHash === body.expectedPlanHash));
      const plan = view?.report.assessment.plans.find(item => item.id === identifier); const state = view?.planStates.find(item => item.planId === identifier);
      if (!plan || !state || !view || view.freshness !== "current" || view.report.status !== "prepared" || state.status !== "pending" || !industrialBasisCurrent(plan.basis, context) || !sameIndustrialValue(body.expectedBasis, plan.basis) || body.expectedPlanVersion !== plan.version || body.expectedPlanHash !== state.planHash) throw new UiError("STALE_CONTEXT", "This plan is no longer current. Reload the report.");
      if (body.decision === "approve" ? !state.permissions.canApprove || plan.status !== "feasible" : !state.permissions.canReject) throw new UiError("ACTION_UNAVAILABLE", state.permissions.blockedReason ?? "This decision is unavailable for the current session.");
      return await mutation(async (): Promise<IndustrialApproval> => {
        const value = await request(`/api/industrial/plans/${encodeURIComponent(identifier)}/decision`, schemas.approval, body);
        verifySession(expected, true);
        if (value.companyId !== context.company.id || value.actorId !== expected.actor.actorId || value.planId !== identifier || value.planVersion !== body.expectedPlanVersion || value.planHash !== body.expectedPlanHash || !sameIndustrialValue(value.basis, body.expectedBasis) || value.decision !== (body.decision === "approve" ? "approved" : "rejected")) throw new UiError("INVALID_RECEIPT", "The decision receipt does not match this plan. Reload before retrying.", true);
        return value;
      });
    },
    async simulateIndustrialApproval(identifier, input): Promise<IndustrialDemoExecution> {
      const body = schemas.simulation.parse(input); const context = current(); const expected = authority();
      if (!context.capabilities.simulationConnected) throw new UiError("NOT_READY", "Demo execution is not available yet.");
      const view = context.reports.find(item => item.planStates.some(state => state.approval?.id === identifier));
      const state = view?.planStates.find(item => item.approval?.id === identifier); const plan = view?.report.assessment.plans.find(item => item.id === state?.planId);
      if (!state || !plan || view?.freshness !== "current" || view.report.status !== "prepared" || state.status !== "approved" || state.approval?.decision !== "approved" || !state.permissions.canSimulate || !industrialBasisCurrent(plan.basis, context) || body.expectedBusinessRevision !== context.company.businessRevision || body.expectedPlanVersion !== plan.version || body.expectedPlanHash !== state.planHash || state.execution) throw new UiError("ACTION_UNAVAILABLE", state?.permissions.blockedReason ?? "Reload the approved current plan before a simulation.");
      return await mutation(async (): Promise<IndustrialDemoExecution> => {
        const value = await request(`/api/industrial/approvals/${encodeURIComponent(identifier)}/simulate`, schemas.execution, body);
        verifySession(expected, true);
        if (value.companyId !== context.company.id || value.actorId !== expected.actor.actorId || value.approvalId !== identifier || value.planId !== plan.id || value.planVersion !== body.expectedPlanVersion || value.planHash !== body.expectedPlanHash || value.operationKey !== body.operationKey || value.beforeRevision !== body.expectedBusinessRevision) throw new UiError("INVALID_RECEIPT", "The execution receipt does not match the approved simulation. Read its saved state before retrying.", true);
        return value;
      });
    },
  };
}
