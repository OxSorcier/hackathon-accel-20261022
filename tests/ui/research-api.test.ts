import { describe, expect, it, vi } from "vitest";
import { createHttpUiApi, projectWorkspace } from "../../src/ui/api";
import { runStatusLabel } from "../../src/ui/research";
import type { ResearchContext } from "../../src/contracts/research.js";
import { uiCapabilitiesFixture, uiCaseFixture, uiContractFixture } from "./fixtures";
import { researchDependency, researchFixture, researchRunFixture } from "./research-fixtures";

function response(data: unknown): Response { return new Response(JSON.stringify({ data, error: null }), { headers: { "Content-Type": "application/json" } }); }
async function setup(context = researchFixture()): Promise<{ api: ReturnType<typeof createHttpUiApi>; calls: ReturnType<typeof vi.fn<typeof fetch>>; received: ResearchContext }> {
  const fixture = uiContractFixture(); const capabilities = uiCapabilitiesFixture();
  const calls = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : url === "/api/watch-capabilities" ? capabilities : context));
  const api = createHttpUiApi({ fetch: calls }); await api.readWorkspace(); await api.readWatchCapabilities!();
  return { api, calls, received: context };
}

describe("saved research UI boundary, synthetic HTTP", () => {
  it("preserves the server-reported reuse state, exact sources, version and conditions", async () => {
    const { api, received, calls } = await setup(); const value = await api.readResearch!("sector-news", "live");
    expect(value).toEqual(received); expect(value.externalCalls).toBe(0); expect(value.reused).toBe(true);
    expect(calls.mock.calls[3]?.[0]).toBe("/api/research/sector-news?namespace=live");
    expect(calls.mock.calls[3]?.[1]?.body).toBeUndefined();
  });
  it("keeps a controlled observation explicitly test-only", async () => {
    const { api } = await setup(researchFixture("controlled")); const value = await api.readResearch!("sector-news", "controlled");
    expect(value.scope.namespace).toBe("controlled"); expect(value.observations[0]?.testOnly).toBe(true); expect(value.observations[0]?.evidence.mode).toBe("test");
  });
  it("does not infer reuse from identical content", async () => {
    const context = researchFixture(); context.reused = false; const { api } = await setup(context);
    expect((await api.readResearch!("sector-news", "live")).reused).toBe(false);
  });
  it.each(["company", "profile", "namespace"])("rejects a wrong %s research receipt", async field => {
    const context = researchFixture();
    if (field === "company") context.companyId = "OTHER";
    if (field === "profile") { context.scope.profileId = "other-profile"; context.observations[0]!.evidence.provenance!.profileId = "other-profile"; }
    if (field === "namespace") { context.scope.namespace = "controlled"; context.observations[0]!.testOnly = true; context.observations[0]!.evidence.mode = "test"; }
    const { api } = await setup(context); await expect(api.readResearch!("sector-news", "live")).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it.each(["hash", "mode", "testFlag", "occurrence", "expired"])("rejects incoherent research %s", async field => {
    const context = researchFixture("controlled"); const value = context.observations[0]!;
    if (field === "hash") value.ref.contentHash = "d".repeat(64);
    if (field === "mode") value.evidence.mode = "direct";
    if (field === "testFlag") value.testOnly = false;
    if (field === "occurrence") context.occurrenceId = "another-occurrence";
    if (field === "expired") context.validUntil = "2026-10-21T10:00:00.000Z";
    const { api } = await setup(context); await expect(api.readResearch!("sector-news", "controlled")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each(["missing", "stale", "partial", "empty", "error", "uncertain"] as const)("preserves the backend %s state without a false success", async state => {
    const context = researchFixture(); context.state = state; context.validUntil = null; context.reused = false;
    if (state === "missing" || state === "empty") { context.observations = []; context.occurrenceId = null; }
    const { api } = await setup(context); const value = await api.readResearch!("sector-news", "live");
    expect(value.state).toBe(state); expect(value.validUntil).toBeNull(); expect(value.reused).toBe(false);
  });
  it("requires an advertised fixed profile before any research request", async () => {
    const { api, calls } = await setup(); await expect(api.readResearch!("free-url-or-profile", "live")).rejects.toMatchObject({ code: "RESEARCH_PROFILE" });
    expect(calls).toHaveBeenCalledTimes(3);
  });
  it("posts only the question, namespace and stable operation key", async () => {
    const { api, calls } = await setup(researchFixture("controlled")); const run = researchRunFixture(researchFixture("controlled"));
    calls.mockResolvedValueOnce(response(run));
    const result = await api.analyzeResearch!("sector-news", { namespace: "controlled", question: run.question, idempotencyKey: run.operationKey });
    expect(JSON.parse(String(calls.mock.calls[3]?.[1]?.body))).toEqual({ namespace: "controlled", question: run.question, operationKey: run.operationKey });
    expect(calls.mock.calls[3]?.[0]).toBe("/api/research/sector-news/analyze");
    expect(result.status).toBe("needs_input"); expect(runStatusLabel(result)).toBe("Research available");
  });
  it.each(["company", "actor", "profile", "namespace", "question", "operation"])("does not accept a research run with wrong %s", async field => {
    const { api, calls } = await setup(); const run = researchRunFixture(); const question = run.question; const operationKey = run.operationKey;
    if (field === "company") run.companyId = "OTHER";
    if (field === "actor") run.actorId = "OTHER";
    if (field === "profile") { run.researchScope!.profileId = "other"; run.researchDependencies = []; run.researchResult = undefined; }
    if (field === "namespace") { run.researchScope!.namespace = "controlled"; run.researchDependencies = []; run.researchResult = undefined; }
    if (field === "question") run.question = "Other question";
    if (field === "operation") run.operationKey = "other-operation";
    calls.mockResolvedValueOnce(response(run));
    await expect(api.analyzeResearch!("sector-news", { namespace: "live", question, idempotencyKey: operationKey })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("retains the operation key on a lost mutation response and never retries", async () => {
    const { api, calls } = await setup(); calls.mockRejectedValueOnce(new TypeError("Lost response"));
    await expect(api.analyzeResearch!("sector-news", { namespace: "live", question: "Retrieve research", idempotencyKey: "research-stable-key" })).rejects.toMatchObject({ code: "NETWORK_ERROR", uncertain: true });
    expect(calls).toHaveBeenCalledTimes(4);
  });
  it("rejects an available research result that omits a retained source version", async () => {
    const { api, calls } = await setup(); const run = researchRunFixture();
    run.researchDependencies![0]!.evidenceRefs.push({ occurrenceId: "missing-source", evidenceId: "missing-source", contentHash: "d".repeat(64) });
    run.researchResult!.dependencies = structuredClone(run.researchDependencies!);
    calls.mockResolvedValueOnce(response(run));
    await expect(api.analyzeResearch!("sector-news", { namespace: "live", question: run.question, idempotencyKey: run.operationKey })).rejects.toMatchObject({ code: "INVALID_RESPONSE", uncertain: true });
  });
  it("rejects a late research read after sign-out", async () => {
    const { api, calls, received } = await setup(); let finish: ((value: Response) => void) | undefined;
    calls.mockImplementationOnce(async () => await new Promise<Response>(resolve => { finish = resolve; }));
    const reading = api.readResearch!("sector-news", "live");
    calls.mockResolvedValueOnce(response({ closed: true })); await api.closeSession!(); finish!(response(received));
    await expect(reading).rejects.toMatchObject({ code: "SESSION_CHANGED" });
  });
  it("preserves v1 and v2 evidence in historical runs without merging their content", () => {
    const fixture = uiContractFixture(); const v1 = researchFixture("controlled", 1); const v2 = researchFixture("controlled", 2);
    fixture.decisions.proposals = []; fixture.decisions.runs = [researchRunFixture(v2), researchRunFixture(v1)];
    const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.runs.map(run => run.researchDependencies?.[0]?.generation)).toEqual([2, 1]);
    expect(view.runs.map(run => run.researchResult?.observations[0]?.ref.contentHash)).toEqual(["c".repeat(64), "b".repeat(64)]);
    expect(view.runs.every(run => runStatusLabel(run) === "Research available")).toBe(true);
  });
  it("keeps controlled case markers and blocks an unlabelled test observation", async () => {
    const fixture = uiCaseFixture(); const context = researchFixture("controlled");
    fixture.current.observation = context.observations[0]!.evidence; fixture.current.evidenceRef = context.observations[0]!.ref;
    fixture.current.testOnly = true; fixture.current.researchDependency = researchDependency(context);
    const calls = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : fixture.decisions));
    const api = createHttpUiApi({ fetch: calls }); expect((await api.readWorkspace()).cases[0]?.testOnly).toBe(true);
    fixture.current.testOnly = false; await expect(api.readWorkspace()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each(["namespace", "profileVersion", "missingScope", "dependency"])("rejects a controlled case analysis with wrong %s", async field => {
    const fixture = uiCaseFixture(); const context = researchFixture("controlled");
    fixture.current.observation = context.observations[0]!.evidence; fixture.current.evidenceRef = context.observations[0]!.ref;
    fixture.current.testOnly = true; fixture.current.researchDependency = researchDependency(context);
    const run = { ...fixture.decisions.runs[0]!, status: "queued" as const, proposalId: null, question: "Analyze controlled case", operationKey: "controlled-analysis-key", researchScope: { ...context.scope }, researchDependencies: undefined as ReturnType<typeof researchRunFixture>["researchDependencies"] };
    if (field === "namespace") run.researchScope.namespace = "live";
    if (field === "profileVersion") run.researchScope.profileVersion = "other-version";
    if (field === "missingScope") delete (run as { researchScope?: unknown }).researchScope;
    if (field === "dependency") { run.researchDependencies = [researchDependency(context)]; run.researchDependencies[0]!.generation++; }
    const calls = vi.fn<typeof fetch>().mockImplementation(async url => response(String(url).endsWith("/analyze") ? run : url === "/api/company" ? fixture.company : fixture.decisions));
    const api = createHttpUiApi({ fetch: calls }); await api.readWorkspace();
    await expect(api.analyzeCase!(fixture.current.id, { expectedCaseRevision: fixture.current.caseRevision, question: run.question, operationKey: run.operationKey })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
});
