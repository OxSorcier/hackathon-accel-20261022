import { describe, expect, it, vi } from "vitest";
import { createHttpUiApi } from "../../src/ui/api";
import { industrialFixture, industrialApprovalFixture, industrialExecutionFixture } from "./industrial-fixtures";
import { uiContractFixture } from "./fixtures";
import type { IndustrialWorkspace } from "../../src/contracts/industrial-api.js";
import { researchDependency, researchFixture } from "./research-fixtures";
import { createIndustrialCommands } from "../../src/ui/pending-commands";

function response(data: unknown): Response { return new Response(JSON.stringify({ data, error: null }), { headers: { "Content-Type": "application/json" } }); }
async function setup(root = industrialFixture()): Promise<{ api: ReturnType<typeof createHttpUiApi>; calls: ReturnType<typeof vi.fn<typeof fetch>>; root: IndustrialWorkspace }> {
  const core = uiContractFixture();
  const calls = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? core.company : url === "/api/decisions" ? core.decisions : root));
  const api = createHttpUiApi({ fetch: calls }); await api.readWorkspace(); return { api, calls, root };
}
function decision(root: IndustrialWorkspace): { decision: "approve"; expectedBasis: IndustrialWorkspace["reports"][number]["report"]["basis"]; expectedPlanVersion: string; expectedPlanHash: string; operationKey: string } {
  const view = root.reports[0]!; return { decision: "approve", expectedBasis: structuredClone(view.report.basis), expectedPlanVersion: view.planStates[0]!.planVersion, expectedPlanHash: view.planStates[0]!.planHash, operationKey: "industrial-decision-ui" };
}
function approved(root: IndustrialWorkspace): void { const state = root.reports[0]!.planStates[0]!; state.status = "approved"; state.approval = industrialApprovalFixture(root); state.permissions = { canApprove: false, canReject: false, canSimulate: true, blockedReason: null }; }

describe("industrial UI boundary, synthetic HTTP only", () => {
  it("preserves received counts, impact, basis and nullable economics without deriving business results", async () => {
    const { api, root, calls } = await setup(); root.reports[0]!.report.assessment.plans[0]!.economics.opportunityContributionCents = null;
    expect(await api.readIndustrial!()).toEqual(root); expect(calls.mock.calls[2]?.[0]).toBe("/api/industrial");
  });
  it.each(["company", "actor", "role"])("rejects a briefing from the wrong %s", async field => {
    const { api, root } = await setup();
    if (field === "company") root.company.id = "OTHER";
    if (field === "actor") root.actor.actorId = "OTHER";
    if (field === "role") root.actor.role = "operator";
    await expect(api.readIndustrial!()).rejects.toMatchObject({ code: field === "company" ? "INVALID_RESPONSE" : "INVALID_SCOPE" });
  });
  it.each(["planBasis", "approvalHash", "planStateVersion", "recommendation"])("rejects broken report correlation: %s", async field => {
    const { api, root } = await setup(); const view = root.reports[0]!;
    if (field === "planBasis") view.report.assessment.plans[0]!.basis = { ...view.report.basis, companyId: "OTHER" };
    if (field === "approvalHash") { approved(root); view.planStates[0]!.approval!.planHash = "OTHER"; }
    if (field === "planStateVersion") view.planStates[0]!.planVersion = "OTHER";
    if (field === "recommendation") view.report.recommendedPlanId = "UNKNOWN";
    await expect(api.readIndustrial!()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("posts the exact current plan basis, version and hash, without executing it", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!(); const body = decision(root); const receipt = industrialApprovalFixture(root);
    calls.mockResolvedValueOnce(response(receipt)); expect(await api.decideIndustrialPlan!("plan-ui", body)).toEqual(receipt);
    expect(calls.mock.calls[3]?.[0]).toBe("/api/industrial/plans/plan-ui/decision"); expect(JSON.parse(String(calls.mock.calls[3]?.[1]?.body))).toEqual(body);
    expect(calls.mock.calls.filter(([url]) => String(url).endsWith("/simulate"))).toHaveLength(0);
    await expect(api.decideIndustrialPlan!("plan-ui", body)).rejects.toMatchObject({ code: "INDUSTRIAL_READ_REQUIRED" });
  });
  it.each(["basis", "version", "hash", "permission", "stale"])("blocks a plan decision before HTTP for %s", async field => {
    const { api, root, calls } = await setup();
    if (field === "permission") root.reports[0]!.planStates[0]!.permissions.canApprove = false;
    if (field === "stale") root.company.businessRevision = "R1";
    await api.readIndustrial!(); const body = decision(root);
    if (field === "basis") body.expectedBasis.eventRevision = "OTHER";
    if (field === "version") body.expectedPlanVersion = "OTHER";
    if (field === "hash") body.expectedPlanHash = "OTHER";
    await expect(api.decideIndustrialPlan!("plan-ui", body)).rejects.toMatchObject({ code: field === "permission" ? "ACTION_UNAVAILABLE" : "STALE_CONTEXT" });
    expect(calls).toHaveBeenCalledTimes(3);
  });
  it.each(["actor", "company", "plan", "hash", "decision"])("rejects a decision receipt with wrong %s", async field => {
    const { api, root, calls } = await setup(); await api.readIndustrial!(); const receipt = industrialApprovalFixture(root);
    if (field === "actor") receipt.actorId = "OTHER";
    if (field === "company") { receipt.companyId = "OTHER"; receipt.basis.companyId = "OTHER"; }
    if (field === "plan") receipt.planId = "OTHER";
    if (field === "hash") receipt.planHash = "OTHER";
    if (field === "decision") receipt.decision = "rejected";
    calls.mockResolvedValueOnce(response(receipt)); await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("requires a received approved plan and returns a separately bound simulated execution", async () => {
    const root = industrialFixture(); approved(root); const { api, calls } = await setup(root); await api.readIndustrial!(); const receipt = industrialExecutionFixture(root);
    calls.mockResolvedValueOnce(response(receipt)); const body = { expectedBusinessRevision: "R0", expectedPlanVersion: "PV1", expectedPlanHash: "plan-hash-ui", operationKey: receipt.operationKey };
    expect(await api.simulateIndustrialApproval!("approval-ui", body)).toEqual(receipt); expect(calls.mock.calls[3]?.[0]).toBe("/api/industrial/approvals/approval-ui/simulate");
    expect(JSON.parse(String(calls.mock.calls[3]?.[1]?.body))).toEqual(body);
  });
  it.each(["approval", "operation", "before", "actor", "hash"])("rejects an execution receipt with wrong %s", async field => {
    const root = industrialFixture(); approved(root); const { api, calls } = await setup(root); await api.readIndustrial!(); const receipt = industrialExecutionFixture(root); const key = receipt.operationKey;
    if (field === "approval") receipt.approvalId = "OTHER";
    if (field === "operation") receipt.operationKey = "other-operation";
    if (field === "before") receipt.beforeRevision = "OTHER";
    if (field === "actor") receipt.actorId = "OTHER";
    if (field === "hash") receipt.planHash = "OTHER";
    calls.mockResolvedValueOnce(response(receipt)); await expect(api.simulateIndustrialApproval!("approval-ui", { expectedBusinessRevision: "R0", expectedPlanVersion: "PV1", expectedPlanHash: "plan-hash-ui", operationKey: key })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it.each(["after", "records", "completed", "simulation"])("does not call an incomplete %s receipt executed", async field => {
    const root = industrialFixture(); approved(root); const { api, calls } = await setup(root); await api.readIndustrial!(); const receipt = industrialExecutionFixture(root);
    if (field === "after") receipt.afterRevision = null;
    if (field === "records") receipt.records = [];
    if (field === "completed") receipt.completedAt = null;
    const value = field === "simulation" ? { ...receipt, simulation: false } : receipt;
    calls.mockResolvedValueOnce(response(value)); await expect(api.simulateIndustrialApproval!("approval-ui", { expectedBusinessRevision: "R0", expectedPlanVersion: "PV1", expectedPlanHash: "plan-hash-ui", operationKey: receipt.operationKey })).rejects.toMatchObject({ code: "INVALID_RESPONSE", uncertain: true });
  });
  it("rejects a late briefing read after sign-out", async () => {
    const { api, calls, root } = await setup(); let finish: ((value: Response) => void) | undefined;
    calls.mockImplementationOnce(async () => await new Promise<Response>(resolve => { finish = resolve; })); const reading = api.readIndustrial!();
    calls.mockResolvedValueOnce(response({ closed: true })); await api.closeSession!(); finish!(response(root));
    await expect(reading).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
  it("keeps failed and uncertain execution statuses without promoting them to applied", async () => {
    for (const status of ["failed", "uncertain"] as const) {
      const root = industrialFixture(); approved(root); const { api, calls } = await setup(root); await api.readIndustrial!(); const receipt = industrialExecutionFixture(root);
      receipt.status = status; receipt.afterRevision = null; receipt.completedAt = null; receipt.records = [];
      calls.mockResolvedValueOnce(response(receipt)); expect((await api.simulateIndustrialApproval!("approval-ui", { expectedBusinessRevision: "R0", expectedPlanVersion: "PV1", expectedPlanHash: "plan-hash-ui", operationKey: receipt.operationKey })).status).toBe(status);
    }
  });
  it("does not retry a lost command response and requires a saved-state read afterwards", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!(); calls.mockRejectedValueOnce(new TypeError("Lost response"));
    await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ uncertain: true });
    await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ code: "INDUSTRIAL_READ_REQUIRED" }); expect(calls).toHaveBeenCalledTimes(4);
  });
  it("refuses a decision when its backend capability is disconnected", async () => {
    const { api, root, calls } = await setup(); root.capabilities.decisionsConnected = false; await api.readIndustrial!();
    await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ code: "NOT_READY" }); expect(calls).toHaveBeenCalledTimes(3);
  });
  it("refuses a simulation when its backend capability is disconnected", async () => {
    const root = industrialFixture(); approved(root); root.capabilities.simulationConnected = false; const { api, calls } = await setup(root); await api.readIndustrial!();
    await expect(api.simulateIndustrialApproval!("approval-ui", { expectedBusinessRevision: "R0", expectedPlanVersion: "PV1", expectedPlanHash: "plan-hash-ui", operationKey: "industrial-key-ui" })).rejects.toMatchObject({ code: "NOT_READY" }); expect(calls).toHaveBeenCalledTimes(3);
  });
  it("does not act on an explicitly expired research dependency", async () => {
    const { api, root, calls } = await setup(); const dep = researchDependency(researchFixture()); dep.validUntil = "2026-10-21T10:00:00.000Z";
    root.reports[0]!.report.basis.researchDependencies.push(dep); await api.readIndustrial!();
    await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ code: "STALE_CONTEXT" }); expect(calls).toHaveBeenCalledTimes(3);
  });
  it("selects the exact plan version when an older report retains the same native plan ID", async () => {
    const { api, root, calls } = await setup(); const body = decision(root); const old = structuredClone(root.reports[0]!);
    old.report.id = "old-report"; old.report.status = "stale"; old.report.assessment.plans[0]!.version = "OLD"; old.planStates[0]!.planVersion = "OLD"; old.planStates[0]!.status = "stale"; root.reports.unshift(old);
    await api.readIndustrial!(); calls.mockResolvedValueOnce(response(industrialApprovalFixture({ ...root, reports: [root.reports[1]!] })));
    await expect(api.decideIndustrialPlan!("plan-ui", body)).resolves.toMatchObject({ planVersion: "PV1" });
  });
  it("cannot bless an old read as fresh after a command completes", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!(); let finish: ((value: Response) => void) | undefined;
    calls.mockImplementationOnce(async () => await new Promise<Response>(resolve => { finish = resolve; })); const oldRead = api.readIndustrial!();
    calls.mockResolvedValueOnce(response(industrialApprovalFixture(root))); await api.decideIndustrialPlan!("plan-ui", decision(root)); finish!(response(root));
    await expect(oldRead).rejects.toMatchObject({ code: "READ_REPLACED" }); await expect(api.decideIndustrialPlan!("plan-ui", decision(root))).rejects.toMatchObject({ code: "INDUSTRIAL_READ_REQUIRED" });
  });
  it("rejects an internal confirmation attributed to a different controlled event", async () => {
    const { api, root } = await setup(); root.events[0]!.confirmations[0]!.eventId = "OTHER";
    await expect(api.readIndustrial!()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("retains pending and uncertain command keys outside the frontend panel lifecycle", async () => {
    const commands = createIndustrialCommands(); const receipt = industrialApprovalFixture(); let finish: ((value: typeof receipt) => void) | undefined;
    const send = vi.fn(async (_key: string) => await new Promise<typeof receipt>(resolve => { finish = resolve; }));
    const first = commands.decisions.execute("same-current-plan", send); const reopened = commands.decisions.execute("same-current-plan", send);
    expect(send).toHaveBeenCalledTimes(1); finish!(receipt); expect(await reopened).toEqual(await first);
    const keys: string[] = [];
    await expect(commands.simulations.execute("same-approved-plan", async key => { keys.push(key); throw new Error("Lost response"); })).rejects.toThrow("Lost response");
    await commands.simulations.execute("same-approved-plan", async key => { keys.push(key); return industrialExecutionFixture(); }); expect(keys[0]).toBe(keys[1]);
  });
  it("sends a company question through the industrial route and preserves the received scope", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!(); const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this plan", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: "report-ui" } };
    calls.mockResolvedValueOnce(response(run)); const value = await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey, reportId: "report-ui" });
    expect(value.industrialScope).toEqual(run.industrialScope); expect(calls.mock.calls[3]?.[0]).toBe("/api/industrial/questions"); expect(JSON.parse(String(calls.mock.calls[3]?.[1]?.body))).toEqual({ question: run.question, operationKey: run.operationKey, reportId: "report-ui" });
    calls.mockResolvedValueOnce(response({ ...run, status: "needs_input", message: "Current business data needs clarification." })); expect((await api.readIndustrialRun!(run.id)).status).toBe("needs_input");
    expect(root.company.id).toBe("CO-DEMO");
  });
  it.each(["actor", "scope", "question", "operation", "report"])("rejects a company question receipt with wrong %s", async field => {
    const { api, calls } = await setup(); await api.readIndustrial!(); const run = { ...uiContractFixture().decisions.runs[0]!, status: "queued", proposalId: null, question: "Explain this plan", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: "report-ui" } };
    if (field === "actor") run.actorId = "OTHER";
    if (field === "scope") run.industrialScope.contextRevision = "OTHER";
    if (field === "question") run.question = "OTHER";
    if (field === "operation") run.operationKey = "other-operation";
    if (field === "report") run.industrialScope.reportId = "OTHER";
    calls.mockResolvedValueOnce(response(run)); await expect(api.askIndustrialQuestion!({ question: "Explain this plan", idempotencyKey: "industrial-question-key", reportId: "report-ui" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("preserves a truthful NOT_READY response without pretending an analysis was queued", async () => {
    const { api, calls } = await setup(); await api.readIndustrial!(); calls.mockResolvedValueOnce(new Response(JSON.stringify({ data: null, error: { code: "NOT_READY", message: "Industrial analysis is not connected yet." } }), { status: 503 }));
    await expect(api.askIndustrialQuestion!({ question: "Explain this company", idempotencyKey: "industrial-question-key" })).rejects.toMatchObject({ code: "NOT_READY", uncertain: false }); expect(calls).toHaveBeenCalledTimes(4);
  });
  it("reads only a report already received for the current company", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    await expect(api.readIndustrialReport!("foreign-report")).rejects.toMatchObject({ code: "REPORT_NOT_RECEIVED" }); expect(calls).toHaveBeenCalledTimes(3);
    calls.mockResolvedValueOnce(response(root.reports[0]!)); await expect(api.readIndustrialReport!("report-ui")).resolves.toEqual(root.reports[0]);
    calls.mockResolvedValueOnce(response({ ...root.reports[0]!, report: { ...root.reports[0]!.report, id: "OTHER" } }));
    await expect(api.readIndustrialReport!("report-ui")).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("refuses an empty report identifier instead of dropping it from a question", async () => {
    const { api, calls } = await setup(); await api.readIndustrial!();
    await expect(api.askIndustrialQuestion!({ question: "Explain this plan", idempotencyKey: "industrial-question-key", reportId: "" })).rejects.toThrow(); expect(calls).toHaveBeenCalledTimes(3);
  });
  it("rejects a question receipt whose industrial basis contradicts the run versions", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, status: "queued", proposalId: null, question: "Explain this plan", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: "report-ui" }, industrialBasis: { ...root.reports[0]!.report.basis, businessRevision: "OTHER" } };
    calls.mockResolvedValueOnce(response(run)); await expect(api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey, reportId: "report-ui" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("does not substitute an unrelated run for a received report's analysis", async () => {
    const { api, calls } = await setup(); await api.readIndustrial!();
    calls.mockResolvedValueOnce(response({ ...uiContractFixture().decisions.runs[0]!, id: "industrial-run-ui" }));
    await expect(api.readIndustrialRun!("industrial-run-ui")).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("reads an automatic analysis through the report and intent actually received", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-run-ui", actorId: "SERVICE-UI", proposalId: null, industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null }, industrialBasis: root.reports[0]!.report.basis, industrialIntentId: "intent-ui", industrialReportId: "report-ui" };
    calls.mockResolvedValueOnce(response(run)); await expect(api.readIndustrialRun!(run.id)).resolves.toMatchObject({ industrialReportId: "report-ui", industrialIntentId: "intent-ui" });
  });
  it("rejects changed scope while polling an accepted company question", async () => {
    const { api, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this company", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null } };
    calls.mockResolvedValueOnce(response(run)); await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey });
    calls.mockResolvedValueOnce(response({ ...run, industrialScope: { ...run.industrialScope, qualificationRevision: "OTHER" } }));
    await expect(api.readIndustrialRun!(run.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("rejects a late run read after a newer result for the same accepted question", async () => {
    const { api, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this company", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null } };
    calls.mockResolvedValueOnce(response(run)); await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey });
    let finish: ((value: Response) => void) | undefined;
    calls.mockImplementationOnce(async () => await new Promise<Response>(resolve => { finish = resolve; })); const oldRead = api.readIndustrialRun!(run.id);
    calls.mockResolvedValueOnce(response({ ...run, status: "needs_input" })); expect((await api.readIndustrialRun!(run.id)).status).toBe("needs_input"); finish!(response(run));
    await expect(oldRead).rejects.toMatchObject({ code: "READ_REPLACED" });
  });
  it("keeps the full industrial basis once it has been received for a question", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this plan", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: "report-ui" }, industrialBasis: root.reports[0]!.report.basis };
    calls.mockResolvedValueOnce(response(run)); await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey, reportId: "report-ui" });
    calls.mockResolvedValueOnce(response({ ...run, industrialBasis: { ...run.industrialBasis, eventId: "unreceived-event", eventRevision: "OTHER" } }));
    await expect(api.readIndustrialRun!(run.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("retains the simulation operation key after a resolved uncertain receipt", async () => {
    const commands = createIndustrialCommands(); const keys: string[] = [];
    const send = async (key: string): Promise<ReturnType<typeof industrialExecutionFixture>> => { keys.push(key); return { ...industrialExecutionFixture(), status: "uncertain", afterRevision: null, completedAt: null }; };
    await commands.simulations.execute("same-approved-plan", send); await commands.simulations.execute("same-approved-plan", send); expect(keys[0]).toBe(keys[1]);
  });
  it("binds an automatic run to the received service principal", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-run-ui", actorId: "OTHER", proposalId: null, industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null }, industrialBasis: root.reports[0]!.report.basis, industrialIntentId: "intent-ui", industrialReportId: "report-ui" };
    calls.mockResolvedValueOnce(response(run)); await expect(api.readIndustrialRun!(run.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("allows a basis to arrive later only for a received event and then keeps it pinned", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this company", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null } };
    calls.mockResolvedValueOnce(response(run)); await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey });
    const completed = { ...run, status: "needs_input", industrialBasis: root.reports[0]!.report.basis };
    calls.mockResolvedValueOnce(response(completed)); await expect(api.readIndustrialRun!(run.id)).resolves.toMatchObject({ industrialBasis: completed.industrialBasis });
    calls.mockResolvedValueOnce(response({ ...completed, industrialBasis: { ...completed.industrialBasis, eventId: "OTHER" } })); await expect(api.readIndustrialRun!(run.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("requires a saved-state refresh before accepting a newly introduced unreceived event", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-question-ui", status: "queued", proposalId: null, question: "Explain this company", operationKey: "industrial-question-key", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null } };
    calls.mockResolvedValueOnce(response(run)); await api.askIndustrialQuestion!({ question: run.question, idempotencyKey: run.operationKey });
    calls.mockResolvedValueOnce(response({ ...run, industrialBasis: { ...root.reports[0]!.report.basis, eventId: "OTHER" } })); await expect(api.readIndustrialRun!(run.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("retains a historical run after the business revision advances when its report and intent pins match", async () => {
    const { api, root, calls } = await setup(); root.company.businessRevision = "R1"; root.reports[0]!.report.status = "stale"; await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-run-ui", actorId: "SERVICE-UI", proposalId: null, industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null }, industrialBasis: root.reports[0]!.report.basis, industrialIntentId: "intent-ui", industrialReportId: "report-ui" };
    calls.mockResolvedValueOnce(response(run)); await expect(api.readIndustrialRun!(run.id)).resolves.toMatchObject({ industrialBasis: { businessRevision: "R0" } });
  });
  it("rejects a run read that crosses a completed plan mutation", async () => {
    const { api, root, calls } = await setup(); await api.readIndustrial!();
    const run = { ...uiContractFixture().decisions.runs[0]!, id: "industrial-run-ui", actorId: "SERVICE-UI", proposalId: null, industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: null }, industrialBasis: root.reports[0]!.report.basis, industrialIntentId: "intent-ui", industrialReportId: "report-ui" }; let finish: ((value: Response) => void) | undefined;
    calls.mockImplementationOnce(async () => await new Promise<Response>(resolve => { finish = resolve; })); const oldRead = api.readIndustrialRun!(run.id);
    calls.mockResolvedValueOnce(response(industrialApprovalFixture(root))); await api.decideIndustrialPlan!("plan-ui", decision(root)); finish!(response(run));
    await expect(oldRead).rejects.toMatchObject({ code: "READ_REPLACED" });
  });
});
