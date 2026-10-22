import { describe, expect, it, vi } from "vitest";
import { createHttpUiApi, projectWorkspace } from "../../src/ui/api";
import { isProposalStale, safeSourceUrl } from "../../src/ui/format";
import { uiCapabilitiesFixture, uiContractFixture } from "./fixtures";

function response(data: unknown, status = 200): Response { return new Response(JSON.stringify({ data, error: null }), { status, headers: { "Content-Type": "application/json" } }); }

describe("UI C1 boundary, synthetic HTTP only", () => {
  it("projects server facts and preserves test mode, revisions and conditions", () => {
    const fixture = uiContractFixture(); const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.company.actor?.name).toBe("Paul Martin"); expect(view.proposals[0]?.executionMode).toBe("test");
    expect(view.proposals[0]?.decisionOptionId).toBe("emergency"); expect(view.proposals[0]?.options[0]?.status).toBe("conditional");
    expect(view.proposals[0]?.exposures.map(item => item.state)).toEqual(["exposed", "covered"]);
    expect(view.proposals[0]?.options[0]?.conditions.join()).toContain("Unconfirmed");
  });

  it("rejects foreign company data and mismatched trace references", () => {
    const fixture = uiContractFixture(); fixture.decisions.runs[0]!.companyId = "OTHER";
    expect(() => projectWorkspace(fixture.company, fixture.decisions)).toThrow("company context");
    fixture.decisions.runs[0]!.companyId = "CO-DEMO"; fixture.decisions.runs[0]!.proposalId = "another-proposal";
    expect(() => projectWorkspace(fixture.company, fixture.decisions)).toThrow("do not match");
  });

  it("treats revision and policy changes as a stale plan", () => {
    const fixture = uiContractFixture(); const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(isProposalStale(view.proposals[0]!, view.company)).toBe(false);
    expect(isProposalStale(view.proposals[0]!, { ...view.company, revision: "R1" })).toBe(true);
    expect(isProposalStale(view.proposals[0]!, { ...view.company, policyVersion: "P2" })).toBe(true);
  });

  it("rejects executable and credential-bearing source links", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,hello", "file:///tmp/source", "https://user:password@example.org/"]) expect(safeSourceUrl(url)).toBeUndefined();
    expect(safeSourceUrl("https://example.org/source")).toBe("https://example.org/source");
  });

  it("rejects empty or incompatible HTTP 200 data", async () => {
    const api = createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async () => response({})) });
    await expect(api.readWorkspace()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("retains an explicit native error even with HTTP 200", async () => {
    const api = createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ data: null, error: { code: "NO_COMPANY", message: "Contexte non initialisé" } }))) });
    await expect(api.readWorkspace()).rejects.toMatchObject({ code: "NO_COMPANY" });
  });

  it("submits only the C1 question fields with the stable operation key", async () => {
    const fixture = uiContractFixture(); const run = { ...fixture.decisions.runs[0]!, question: "Question métier", operationKey: "stable-ui-key" };
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : run));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    await api.askQuestion({ question: "Question métier", idempotencyKey: "stable-ui-key" });
    expect(JSON.parse(String(call.mock.calls[2]?.[1]?.body))).toEqual({ question: "Question métier", operationKey: "stable-ui-key" });
    expect(call.mock.calls[2]?.[1]?.credentials).toBe("same-origin");
  });

  it("marks a lost mutation response uncertain and never retries automatically", async () => {
    const fixture = uiContractFixture();
    const call = vi.fn<typeof fetch>().mockImplementation(async url => { if (url === "/api/company") return response(fixture.company); if (url === "/api/decisions") return response(fixture.decisions); throw new TypeError("network"); });
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    await expect(api.askQuestion({ question: "Question", idempotencyKey: "ui-key-123" })).rejects.toMatchObject({ code: "NETWORK_ERROR", uncertain: true });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("validates watch URL and cadence before any network call", async () => {
    const call = vi.fn<typeof fetch>(); const api = createHttpUiApi({ fetch: call });
    await expect(api.createWatch({ topic: "Sujet public", sourceUrls: ["javascript:alert(1)"], cadenceMinutes: 15, idempotencyKey: "ui-key-123" })).rejects.toBeDefined();
    expect(call).not.toHaveBeenCalled();
  });

  it("binds approval to the server proposal option and checks the receipt", async () => {
    const fixture = uiContractFixture(); let receipt = fixture.decisions.proposals[0]!;
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    const input = { proposalId: receipt.id, optionId: "transfer", action: "approve" as const, revision: "R0", policyVersion: "P1", idempotencyKey: "ui-approval-123" };
    await expect(api.decide(input)).rejects.toMatchObject({ code: "OPTION_MISMATCH" }); expect(call).toHaveBeenCalledTimes(2);
    receipt = { ...receipt, status: "approved" }; await expect(api.decide({ ...input, optionId: "emergency" })).resolves.toMatchObject({ message: expect.stringContaining("recorded") });
    expect(JSON.parse(String(call.mock.calls[2]?.[1]?.body))).toEqual({ decision: "approve", revision: "R0", policyVersion: "P1", operationKey: "ui-approval-123" });
    receipt = { ...receipt, id: "wrong-receipt" }; await expect(api.decide({ ...input, optionId: "emergency" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });

  it("keeps a source with no evidence empty instead of successful", () => {
    const fixture = uiContractFixture();
    fixture.decisions.watches = [{ id: "watch-test", companyId: "CO-DEMO", actorId: "EMP-PAUL", publicTopic: "Sujet public", sourceUrls: ["https://example.org/"], cadenceMinutes: 15, enabled: true, nextRunAt: "2026-10-22T09:00:00Z", createdAt: "2026-10-22T08:00:00Z" }];
    fixture.decisions.occurrences = [{ id: "occurrence-test", watchId: "watch-test", companyId: "CO-DEMO", operationKey: "ui-occurrence", status: "completed", scheduledAt: "2026-10-22T08:00:00Z", startedAt: "2026-10-22T08:00:00Z", completedAt: "2026-10-22T08:01:00Z", fence: 1, leaseUntil: null, error: null, result: { status: "empty", sources: [{ url: "https://example.org/", status: "empty", evidence: [], error: null }], startedAt: "2026-10-22T08:00:00Z", completedAt: "2026-10-22T08:01:00Z" } }];
    expect(projectWorkspace(fixture.company, fixture.decisions).watches[0]?.sources[0]?.status).toBe("empty");
  });

  it("preserves global proposal conditions, unknowns and evaluation constraints", () => {
    const fixture = uiContractFixture(); const proposal = fixture.decisions.proposals[0]!;
    proposal.conditions = ["CONFIRM_CUSTOMER_DATE_BEFORE_APPROVAL"]; proposal.evaluation.unknowns = ["Customer date not confirmed"];
    const mapped = projectWorkspace(fixture.company, fixture.decisions).proposals[0]!;
    expect(mapped).toMatchObject({ conditions: proposal.conditions, unknowns: proposal.evaluation.unknowns, constraints: ["Server-verified decision required"] });
  });

  it.each(["option", "company", "evaluationCompany", "run"])("rejects a receipt with mismatched %s", async mismatch => {
    const fixture = uiContractFixture(); const receipt = structuredClone(fixture.decisions.proposals[0]!); receipt.status = "approved";
    if (mismatch === "option") receipt.optionId = "transfer";
    if (mismatch === "company") receipt.companyId = "OTHER";
    if (mismatch === "evaluationCompany") receipt.evaluation.companyId = "OTHER";
    if (mismatch === "run") receipt.runId = "wrong-run";
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    await expect(api.decide({ proposalId: receipt.id, optionId: "emergency", action: "approve", revision: "R0", policyVersion: "P1", idempotencyKey: "approval-key" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });

  it("rejects a question receipt belonging to another operation or actor", async () => {
    const fixture = uiContractFixture(); const run = { ...fixture.decisions.runs[0]!, companyId: "OTHER", actorId: "OTHER-ACTOR", operationKey: "OTHER-OP", question: "OTHER QUESTION" };
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : run));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    await expect(api.askQuestion({ question: "Own question", idempotencyKey: "own-key" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });

  it("preserves a non-executed or unrecognized trace status", () => {
    const fixture = uiContractFixture(); fixture.decisions.runs[0]!.traces[0]!.output = { status: "not_run" };
    expect(projectWorkspace(fixture.company, fixture.decisions).runs[0]?.tools[0]?.status).toBe("not_run");
    fixture.decisions.runs[0]!.traces[0]!.output = { unexpected: true };
    expect(projectWorkspace(fixture.company, fixture.decisions).runs[0]?.tools[0]?.status).toBe("unknown");
  });

  it("compares occurrence instants instead of ISO strings with different timezones", () => {
    const fixture = uiContractFixture();
    fixture.decisions.watches = [{ id: "watch-test", companyId: "CO-DEMO", actorId: "EMP-PAUL", publicTopic: "Sujet public", sourceUrls: ["https://example.org/"], cadenceMinutes: 15, enabled: true, nextRunAt: "2026-10-22T09:00:00Z", createdAt: "2026-10-22T08:00:00Z" }];
    const occurrence = { id: "old", watchId: "watch-test", companyId: "CO-DEMO", operationKey: "ui-occurrence", status: "completed" as const, scheduledAt: "2026-10-22T09:00:00+02:00", startedAt: null, completedAt: "2026-10-22T09:01:00+02:00", fence: 1, leaseUntil: null, error: null, result: null };
    fixture.decisions.occurrences = [occurrence, { ...occurrence, id: "new", status: "error", scheduledAt: "2026-10-22T08:00:00Z", completedAt: "2026-10-22T08:01:00Z", error: "Newer failure" }];
    expect(projectWorkspace(fixture.company, fixture.decisions).watches[0]).toMatchObject({ status: "error", message: "Newer failure" });
  });

  it("accepts reordered JSON object keys but rejects changed evaluation values", async () => {
    const fixture = uiContractFixture(); const receipt = structuredClone(fixture.decisions.proposals[0]!); receipt.status = "approved";
    receipt.evaluation.options[0]!.effects = Object.fromEntries(Object.entries(receipt.evaluation.options[0]!.effects).reverse());
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace();
    const input = { proposalId: receipt.id, optionId: "emergency", action: "approve" as const, revision: "R0", policyVersion: "P1", idempotencyKey: "approval-key" };
    await expect(api.decide(input)).resolves.toBeDefined();
    receipt.evaluation.options[1]!.costEur = 1;
    await expect(api.decide(input)).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });

  it("rejects a watch receipt belonging to another request", async () => {
    const fixture = uiContractFixture(); const watch = { id: "foreign-watch", companyId: "OTHER", actorId: "OTHER-ACTOR", publicTopic: "OTHER TOPIC", sourceUrls: ["https://other.example/"], cadenceMinutes: 1440, enabled: true, nextRunAt: "2026-10-22T09:00:00Z", createdAt: "2026-10-22T08:00:00Z" };
    const caps = uiCapabilitiesFixture();
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : url === "/api/watch-capabilities" ? caps : watch));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace(); await api.readWatchCapabilities!();
    await expect(api.createWatch({ topic: caps.publicTopics[0]!, sourceUrls: caps.sourceUrls, cadenceMinutes: 15, idempotencyKey: "ui-key-123" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });

  it("uses advertised topics, source and cadence when creating a watch", async () => {
    const fixture = uiContractFixture(); const caps = uiCapabilitiesFixture();
    const watch = { id: "watch-test", companyId: "CO-DEMO", actorId: "EMP-PAUL", publicTopic: caps.publicTopics[0], sourceUrls: caps.sourceUrls, cadenceMinutes: 10080, enabled: true, nextRunAt: "2026-10-29T09:00:00Z", createdAt: "2026-10-22T08:00:00Z" };
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : url === "/api/watch-capabilities" ? caps : watch));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace(); await api.readWatchCapabilities!();
    await expect(api.createWatch({ topic: caps.publicTopics[0]!, sourceUrls: caps.sourceUrls, cadenceMinutes: 10080, idempotencyKey: "ui-key-123" })).resolves.toMatchObject({ status: "active", cadenceMinutes: 10080 });
    expect(JSON.parse(String(call.mock.calls[3]?.[1]?.body))).toEqual({ publicTopic: caps.publicTopics[0], sourceUrls: caps.sourceUrls, cadenceMinutes: 10080 });
  });

  it.each(["topic", "source", "cadence"])("rejects a %s outside server capabilities before POST", async mismatch => {
    const fixture = uiContractFixture(); const caps = uiCapabilitiesFixture();
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : caps));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace(); await api.readWatchCapabilities!();
    await expect(api.createWatch({ topic: mismatch === "topic" ? "Private client data" : caps.publicTopics[0]!, sourceUrls: mismatch === "source" ? ["https://other.example/"] : caps.sourceUrls, cadenceMinutes: mismatch === "cadence" ? 1 : 15, idempotencyKey: "ui-key-123" })).rejects.toMatchObject({ code: "WATCH_CAPABILITIES" });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("keeps the workspace available when capabilities fail, without allowing a watch", async () => {
    const fixture = uiContractFixture();
    const call = vi.fn<typeof fetch>().mockImplementation(async url => url === "/api/watch-capabilities" ? new Response(JSON.stringify({ data: null, error: { code: "NOT_READY", message: "Sujets indisponibles" } }), { status: 503 }) : response(url === "/api/company" ? fixture.company : fixture.decisions));
    const api = createHttpUiApi({ fetch: call }); await expect(api.readWatchCapabilities!()).rejects.toMatchObject({ code: "NOT_READY" });
    await expect(api.readWorkspace()).resolves.toMatchObject({ company: { id: "CO-DEMO" } });
    await expect(api.createWatch({ topic: "Sujet public", sourceUrls: ["https://example.org/"], cadenceMinutes: 15, idempotencyKey: "ui-key-123" })).rejects.toMatchObject({ code: "WATCH_CAPABILITIES" });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid capabilities and protects its cached allowance from mutation", async () => {
    const fixture = uiContractFixture(); let caps = uiCapabilitiesFixture(); caps.sourceUrls = ["javascript:alert(1)"];
    const call = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : caps));
    const api = createHttpUiApi({ fetch: call }); await expect(api.readWatchCapabilities!()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    caps = uiCapabilitiesFixture(); const returned = await api.readWatchCapabilities!(); returned.publicTopics.push("arbitrary text"); await api.readWorkspace();
    await expect(api.createWatch({ topic: "arbitrary text", sourceUrls: caps.sourceUrls, cadenceMinutes: 15, idempotencyKey: "ui-key-123" })).rejects.toMatchObject({ code: "WATCH_CAPABILITIES" });
    expect(call).toHaveBeenCalledTimes(4);
  });

  it("does not let an older workspace response replace the newer command context", async () => {
    const fixture = uiContractFixture(); let releaseOld: (value: Response) => void = () => { throw new Error("missing deferred request"); };
    let companyReads = 0;
    const call = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === "/api/company") { if (++companyReads === 1) return await new Promise<Response>(resolve => { releaseOld = resolve; }); return response(fixture.company); }
      if (url === "/api/decisions") return response(fixture.decisions);
      return response({ ...fixture.decisions.runs[0]!, question: "Current question", operationKey: "current-key" });
    });
    const api = createHttpUiApi({ fetch: call }); const old = api.readWorkspace(); const current = await api.readWorkspace();
    expect(current.company.actor?.name).toBe("Paul Martin"); releaseOld(response({ ...fixture.company, actor: null })); await old;
    await expect(api.askQuestion({ question: "Current question", idempotencyKey: "current-key" })).resolves.toMatchObject({ question: "Current question" });
  });

  it("does not restore an authenticated command context from a pre-logout read", async () => {
    const fixture = uiContractFixture(); let releaseOld: (value: Response) => void = () => { throw new Error("missing deferred request"); };
    const call = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (url === "/api/company") return await new Promise<Response>(resolve => { releaseOld = resolve; });
      if (url === "/api/decisions") return response(fixture.decisions);
      if (url === "/api/session") return response({ closed: true });
      return response({ ...fixture.decisions.runs[0]!, question: "Question after logout", operationKey: "logged-out-key" });
    });
    const api = createHttpUiApi({ fetch: call }); const old = api.readWorkspace(); await api.closeSession!(); releaseOld(response(fixture.company)); await old;
    await expect(api.askQuestion({ question: "Question after logout", idempotencyKey: "logged-out-key" })).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it.each([{ code: "UNAVAILABLE", uncertain: true }, { code: "NOT_READY", uncertain: false }])("preserves mutation uncertainty for structured 503 $code", async ({ code, uncertain }) => {
    const fixture = uiContractFixture(); const caps = uiCapabilitiesFixture();
    const call = vi.fn<typeof fetch>().mockImplementation(async url => url === "/api/watches" ? new Response(JSON.stringify({ data: null, error: { code, message: "Aucun succès confirmé" } }), { status: 503 }) : response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : caps));
    const api = createHttpUiApi({ fetch: call }); await api.readWorkspace(); await api.readWatchCapabilities!();
    await expect(api.createWatch({ topic: caps.publicTopics[0]!, sourceUrls: caps.sourceUrls, cadenceMinutes: 15, idempotencyKey: "uncertain-watch" })).rejects.toMatchObject({ code, uncertain });
  });
});
