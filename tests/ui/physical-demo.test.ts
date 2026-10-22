import { describe, expect, it } from "vitest";
import { createPhysicalDemoApi, type DemoStorage } from "../../src/ui/physical-demo";

function storage(): DemoStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

describe("explicit Physical Impact demo", () => {
  it("preserves approval and one simulated execution across reloads", async () => {
    const saved = storage(); const api = createPhysicalDemoApi(saved);
    const initial = await api.readIndustrial!(); const report = initial.reports[0]!; const plan = report.report.assessment.plans[0]!;
    const input = { decision: "approve" as const, expectedBasis: plan.basis, expectedPlanVersion: plan.version, expectedPlanHash: report.planStates[0]!.planHash, operationKey: "approve-test-001" };
    const approval = await api.decideIndustrialPlan!(plan.id, input);
    expect(await api.decideIndustrialPlan!(plan.id, input)).toEqual(approval);
    const reloaded = createPhysicalDemoApi(saved); expect((await reloaded.readIndustrial!()).reports[0]!.planStates[0]!.status).toBe("approved");
    const executionInput = { expectedBusinessRevision: plan.basis.businessRevision, expectedPlanVersion: plan.version, expectedPlanHash: report.planStates[0]!.planHash, operationKey: "execute-test-001" };
    const receipt = await reloaded.simulateIndustrialApproval!(approval.id, executionInput);
    expect(receipt.records).toHaveLength(5); expect(receipt.simulation).toBe(true);
    expect(await reloaded.simulateIndustrialApproval!(approval.id, executionInput)).toEqual(receipt);
    const final = await createPhysicalDemoApi(saved).readIndustrial!();
    expect(final.company.businessRevision).toBe("DEMO-R2"); expect(final.reports[0]!.planStates[0]!.permissions.canSimulate).toBe(false);
  });
  it("rejects stale inputs, execution before approval and unknown report questions", async () => {
    const api = createPhysicalDemoApi(storage()); const workspace = await api.readIndustrial!(); const plan = workspace.reports[0]!.report.assessment.plans[0]!;
    await expect(api.decideIndustrialPlan!(plan.id, { decision: "approve", expectedBasis: { ...plan.basis, eventRevision: "OLD" }, expectedPlanVersion: "PV1", expectedPlanHash: "demo-plan-v1", operationKey: "approve-stale-001" })).rejects.toMatchObject({ code: "STALE_CONTEXT" });
    await expect(api.simulateIndustrialApproval!("DEMO-APPROVAL-001", { expectedBusinessRevision: "DEMO-R1", expectedPlanVersion: "PV1", expectedPlanHash: "demo-plan-v1", operationKey: "execute-early-001" })).rejects.toMatchObject({ code: "STALE_CONTEXT" });
    await expect(api.askIndustrialQuestion!({ question: "Why?", reportId: "unknown", idempotencyKey: "question-001" })).rejects.toMatchObject({ code: "REPORT_NOT_FOUND" });
  });
  it("answers scoped demo questions and retains a rejected decision without effects", async () => {
    const saved = storage(); const api = createPhysicalDemoApi(saved); const workspace = await api.readIndustrial!(); const plan = workspace.reports[0]!.report.assessment.plans[0]!;
    const question = { question: "What is the cost?", reportId: "REPORT-ARVEN", idempotencyKey: "question-cost-001" };
    const run = await api.askIndustrialQuestion!(question); expect(run.message).toContain("€1,600"); expect(run.executionMode).toBe("test");
    expect(await api.askIndustrialQuestion!(question)).toEqual(run);
    await expect(api.askIndustrialQuestion!({ ...question, question: "Other question" })).rejects.toMatchObject({ code: "CONFLICT" });
    await api.decideIndustrialPlan!(plan.id, { decision: "reject", expectedBasis: plan.basis, expectedPlanVersion: "PV1", expectedPlanHash: "demo-plan-v1", operationKey: "reject-test-001" });
    const final = await createPhysicalDemoApi(saved).readIndustrial!(); expect(final.reports[0]!.planStates[0]!.status).toBe("rejected"); expect(final.reports[0]!.planStates[0]!.execution).toBeNull();
  });
  it("does not accept corrupt browser state as a decision", async () => {
    const api = createPhysicalDemoApi({ getItem: () => '{"version":1,"decision":null,"executed":true}', setItem: () => undefined });
    expect((await api.readIndustrial!()).reports[0]!.planStates[0]!.status).toBe("pending");
  });
  it("prevents a stale second tab from overwriting an executed plan", async () => {
    const saved = storage(); const first = createPhysicalDemoApi(saved); const second = createPhysicalDemoApi(saved);
    const workspace = await first.readIndustrial!(); const plan = workspace.reports[0]!.report.assessment.plans[0]!;
    const decision = { decision: "approve" as const, expectedBasis: plan.basis, expectedPlanVersion: "PV1", expectedPlanHash: "demo-plan-v1", operationKey: "first-approve-001" };
    const receipt = await first.decideIndustrialPlan!(plan.id, decision);
    await first.simulateIndustrialApproval!(receipt.id, { expectedBusinessRevision: "DEMO-R1", expectedPlanVersion: "PV1", expectedPlanHash: "demo-plan-v1", operationKey: "first-execute-001" });
    await expect(second.decideIndustrialPlan!(plan.id, { ...decision, decision: "reject", operationKey: "second-reject-001" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await second.readIndustrial!()).reports[0]!.planStates[0]!.execution?.status).toBe("applied");
  });
});
