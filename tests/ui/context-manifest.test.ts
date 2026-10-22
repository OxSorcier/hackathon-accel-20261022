import { describe, expect, it } from "vitest";
import { projectWorkspace } from "../../src/ui/api";
import { uiContractFixture } from "./fixtures";
import type { JsonValue } from "../../src/contracts/index.js";

const successLike: Record<string, JsonValue>[] = [{ status: "completed" }, { callId: "foreign-call", isError: false, result: {} }];
const foreignOrFailed: Record<string, JsonValue>[] = [
  { companyId: "OTHER-COMPANY" }, { revision: "OTHER-REVISION" }, { policyVersion: "OTHER-POLICY" },
  { caseRef: { caseId: "case:other", caseRevision: "C-other" } },
  { researchScope: { profileId: "other", profileVersion: "v1", namespace: "controlled" } },
  { isError: true }, { status: "error" }, { status: "uncertain" },
  { status: "error", result: { status: "completed" } },
  { status: "uncertain", result: { status: "completed" } },
  { status: "completed", result: { status: "error" } },
  { error: "CONTEXT_FAILED", result: { status: "completed" } },
  { status: "completed", result: { isError: true } },
  { status: "completed" },
];

describe("local context manifest presentation", () => {
  it.each(["plain", "case", "research"] as const)("labels an exact %s local manifest as recorded, independently of provider calls", scope => {
    const fixture = uiContractFixture();
    const run: (typeof fixture.decisions.runs)[number] & { researchScope?: { profileId: string; profileVersion: string; namespace: "live" | "controlled" } } = fixture.decisions.runs[0]!;
    if (scope === "case") { run.caseRef = { caseId: "case:trace", caseRevision: "C-trace" }; fixture.decisions.proposals[0]!.caseRef = { ...run.caseRef }; }
    if (scope === "research") run.researchScope = { profileId: "sector-news", profileVersion: "v1", namespace: "controlled" };
    run.traces = [{ ...run.traces[0]!, tool: "context_manifest", output: { companyId: run.companyId, revision: run.revision, policyVersion: run.policyVersion, assembledAt: run.createdAt, snapshotAsOf: run.createdAt, contractVersion: "C1", toolsVersion: scope === "research" ? "agent-tools/3" : "agent-tools/2", memoryIds: [], ...(run.caseRef ? { caseRef: { ...run.caseRef } } : {}), ...(run.researchScope ? { researchScope: { ...run.researchScope } } : {}) } }];
    const tool = projectWorkspace(fixture.company, fixture.decisions).runs[0]!.tools[0]!;
    expect(tool.name).toBe("Context assembled"); expect(tool.status).toBe("recorded"); expect(tool.summary).toContain("Recorded locally");
  });
  it("does not mark an incomplete context record as assembled successfully", () => {
    const fixture = uiContractFixture(); fixture.decisions.runs[0]!.traces = [{ ...fixture.decisions.runs[0]!.traces[0]!, tool: "context_manifest", output: {} }];
    const tool = projectWorkspace(fixture.company, fixture.decisions).runs[0]!.tools[0]!;
    expect(tool.status).toBe("unknown"); expect(tool.summary).toContain("local context record is incomplete");
  });
  it.each(successLike)("keeps incomplete context receipts unknown despite success-like fields: %j", output => {
    const fixture = uiContractFixture(); const run = fixture.decisions.runs[0]!;
    run.traces = [{ ...run.traces[0]!, tool: "context_manifest", output }];
    const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.runs[0]!.tools[0]!.status).toBe("unknown");
    expect(view.proposals[0]!.tools[0]!.status).toBe("unknown");
  });
  it.each(foreignOrFailed)("does not attest a foreign or failed context manifest: %j", change => {
    const fixture = uiContractFixture(); const run = fixture.decisions.runs[0]!;
    run.traces = [{ ...run.traces[0]!, tool: "context_manifest", output: { companyId: run.companyId, revision: run.revision, policyVersion: run.policyVersion, assembledAt: run.createdAt, snapshotAsOf: run.createdAt, contractVersion: "C1", toolsVersion: "agent-tools/2", memoryIds: [], ...change } }];
    const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.runs[0]!.tools[0]!.status).toBe("unknown");
    expect(view.proposals[0]!.tools[0]!.status).toBe("unknown");
    expect(view.runs[0]!.tools[0]!.summary).not.toContain("Recorded locally");
  });
});
