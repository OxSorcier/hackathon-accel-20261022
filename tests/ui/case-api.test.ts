import { describe, expect, it, vi } from "vitest";
import type { CaseInput, DecisionCase } from "../../src/contracts/index.js";
import { createHttpUiApi, projectWorkspace } from "../../src/ui/api";
import { uiCapabilitiesFixture, uiCaseFixture } from "./fixtures";

function response(data: unknown): Response { return new Response(JSON.stringify({ data, error: null }), { status: 200 }); }
function inputFor(value: DecisionCase): CaseInput { return { evidenceRef: value.evidenceRef, relation: value.relation, riskAssumption: value.riskAssumption, operationKey: "case-ui-operation" }; }

describe("case UI boundary, synthetic HTTP", () => {
  it("reads commitment dates from the order record and translates display units without changing records", () => {
    const fixture = uiCaseFixture(); const tables = fixture.company.snapshot.dataset.tables;
    tables.orders![0]!.need_date = "2026-10-23"; delete tables.order_lines![0]!.need_date;
    tables.purchase_order_lines![0]!.unit = "palette";
    const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.catalog.commitments[0]?.label).toContain("23 Oct");
    expect(view.catalog.inbound[0]?.label).toContain("8 pallets");
    expect(tables.purchase_order_lines![0]!.unit).toBe("palette");
  });
  it("does not replace an explicitly unknown order date with a legacy line date", () => {
    const fixture = uiCaseFixture(); fixture.company.snapshot.dataset.tables.orders![0]!.need_date = null;
    fixture.company.snapshot.dataset.tables.order_lines![0]!.need_date = "2026-10-23";
    expect(projectWorkspace(fixture.company, fixture.decisions).catalog.commitments[0]?.label).toContain("needed Not provided");
  });
  it("rejects a globally allowed source when it is not allowed for this topic", async () => {
    const fixture = uiCaseFixture(); const capabilities = uiCapabilitiesFixture();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : capabilities));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace(); await api.readWatchCapabilities!();
    await expect(api.createWatch({ topic: capabilities.publicTopics[2]!, sourceUrls: [capabilities.sourceUrls[0]!], cadenceMinutes: 15, idempotencyKey: "ui-watch-key" })).rejects.toMatchObject({ code: "WATCH_CAPABILITIES" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("hydrates a proposal run outside the latest runs window before projecting its decision", async () => {
    const fixture = uiCaseFixture(); const originalRun = structuredClone(fixture.decisions.runs[0]!);
    fixture.decisions.runs = Array.from({ length: 100 }, (_, index) => ({ ...originalRun, id: `new-${index}`, status: "needs_input", proposalId: null, caseRef: undefined }));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : originalRun));
    const api = createHttpUiApi({ fetch: fetcher }); const view = await api.readWorkspace();
    expect(view.proposals[0]?.caseCurrent).toBe(true); expect(view.proposals[0]?.decisionBlockedReason).toBeUndefined();
    expect(fetcher.mock.calls.some(call => call[0] === `/api/runs/${originalRun.id}`)).toBe(true);
  });
  it("keeps the workspace readable if an historical analysis cannot be received", () => {
    const fixture = uiCaseFixture(); fixture.decisions.runs = [];
    const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.company.actor?.name).toBe("Paul Martin"); expect(view.proposals[0]?.decisionBlockedReason).toBeDefined();
  });
  it("isolates an unavailable historical run from fresh questions and blocks only its decision", async () => {
    const fixture = uiCaseFixture(); const run = { ...fixture.decisions.runs[0]!, question: "Fresh question", operationKey: "fresh-question-key", caseRef: undefined };
    fixture.decisions.runs = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (String(url).startsWith("/api/runs/")) throw new TypeError("Historical read failed");
      return response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : run);
    });
    const api = createHttpUiApi({ fetch: fetcher }); const view = await api.readWorkspace();
    expect(view.proposals[0]?.decisionBlockedReason).toBeDefined();
    await expect(api.askQuestion({ question: run.question, idempotencyKey: run.operationKey })).resolves.toMatchObject({ id: run.id });
    await expect(api.decide({ proposalId: fixture.decisions.proposals[0]!.id, action: "reject", revision: "R0", policyVersion: "P1", idempotencyKey: "case-ui-reject" })).rejects.toMatchObject({ code: "TRACE_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("links the received evidence and preserves the conditional and actual calculation separately", () => {
    const fixture = uiCaseFixture(); const view = projectWorkspace(fixture.company, fixture.decisions);
    expect(view.cases[0]?.riskAssumption).toEqual(fixture.current.riskAssumption);
    expect(view.proposals[0]?.sources[0]?.observation?.contentHash).toBe(fixture.current.evidenceRef.contentHash);
    expect(view.proposals[0]?.actualExposures).toHaveLength(2);
    expect(view.proposals[0]?.approvalBlockedReason).toContain("confirmed internal fact");
    expect(view.watches[0]?.sources[0]?.evidenceRef).toEqual(fixture.current.evidenceRef);
  });
  it("keeps a previous proposal stale without substituting the new source", () => {
    const fixture = uiCaseFixture(); fixture.current.caseRevision = "C-ui-2"; fixture.current.observation.title = "Corrected source";
    const mapped = projectWorkspace(fixture.company, fixture.decisions).proposals[0]!;
    expect(mapped.caseCurrent).toBe(false); expect(mapped.sources.some(value => value.title === "Corrected source")).toBe(false);
  });
  it("refuses foreign cases and mismatched run-case references", () => {
    const fixture = uiCaseFixture(); fixture.current.companyId = "OTHER";
    expect(() => projectWorkspace(fixture.company, fixture.decisions)).toThrow("company context");
    fixture.current.companyId = "CO-DEMO"; fixture.decisions.runs[0]!.caseRef!.caseRevision = "C-other";
    expect(() => projectWorkspace(fixture.company, fixture.decisions)).toThrow("do not match");
  });
  it("sends only the reference, relation and explicit assumption to create a case", async () => {
    const fixture = uiCaseFixture(); const input = inputFor(fixture.current);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : fixture.current));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace(); await api.createCase!(input);
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual(input);
    expect(String(fetcher.mock.calls[2]?.[1]?.body)).not.toContain(fixture.current.observation.content);
  });
  it("refuses an unreceived or non-direct proof before a mutation", async () => {
    const fixture = uiCaseFixture(); const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : fixture.decisions));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace();
    await expect(api.createCase!({ ...inputFor(fixture.current), evidenceRef: { ...fixture.current.evidenceRef, contentHash: "b".repeat(64) } })).rejects.toMatchObject({ code: "EVIDENCE_NOT_RECEIVED" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["actor", "company", "relation", "content"])("does not accept a case receipt with the wrong %s", async kind => {
    const fixture = uiCaseFixture(); const receipt = structuredClone(fixture.current);
    if (kind === "actor") receipt.actorId = "OTHER";
    if (kind === "company") receipt.companyId = "OTHER";
    if (kind === "relation") receipt.relation.basis = "Another basis";
    if (kind === "content") receipt.observation.content = "Another content";
    const api = createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt)) });
    await api.readWorkspace(); await expect(api.createCase!(inputFor(fixture.current))).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("checks that a revision advances the exact previous case version", async () => {
    const fixture = uiCaseFixture(); const receipt = { ...fixture.current, caseRevision: "C-ui-2", previousRevision: "C-wrong" };
    const api = createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt)) });
    await api.readWorkspace(); await expect(api.reviseCase!(fixture.current.id, { ...inputFor(fixture.current), expectedCaseRevision: fixture.current.caseRevision })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("keeps conditional approval disabled while allowing current rejection", async () => {
    const fixture = uiCaseFixture(); const receipt = { ...fixture.decisions.proposals[0]!, status: "rejected" as const };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : receipt));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace();
    const input = { proposalId: receipt.id, optionId: "emergency", revision: "R0", policyVersion: "P1", idempotencyKey: "case-ui-decision" };
    await expect(api.decide({ ...input, action: "approve" })).rejects.toMatchObject({ code: "CASE_NOT_DECIDABLE" }); expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(api.decide({ ...input, action: "reject" })).resolves.toMatchObject({ message: "Rejection recorded." });
    receipt.caseRef = { ...receipt.caseRef!, caseRevision: "C-wrong" };
    await expect(api.decide({ ...input, action: "reject" })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
  });
  it("accepts an analysis refreshed to a new business version only after its saved history is received", async () => {
    const fixture = uiCaseFixture(); const refreshed = { ...fixture.current, caseRevision: "C-ui-2", previousRevision: fixture.current.caseRevision, businessRevision: "R1" };
    const run = { ...fixture.decisions.runs[0]!, operationKey: "case-ui-analysis", question: "Examine this case", revision: "R1", caseRef: { caseId: fixture.current.id, caseRevision: refreshed.caseRevision } };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : init?.method === "POST" ? run : { current: refreshed, versions: [refreshed, fixture.current] }));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace();
    await expect(api.analyzeCase!(fixture.current.id, { expectedCaseRevision: fixture.current.caseRevision, operationKey: run.operationKey, question: run.question })).resolves.toMatchObject({ caseRef: run.caseRef });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("marks a mismatched refreshed analysis uncertain, with no automatic resubmission", async () => {
    const fixture = uiCaseFixture(); const refreshed = { ...fixture.current, caseRevision: "C-ui-2", previousRevision: fixture.current.caseRevision };
    const run = { ...fixture.decisions.runs[0]!, operationKey: "case-ui-analysis", question: "Examine this case", caseRef: { caseId: fixture.current.id, caseRevision: refreshed.caseRevision } };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : init?.method === "POST" ? run : { current: refreshed, versions: [refreshed, fixture.current] }));
    const api = createHttpUiApi({ fetch: fetcher }); await api.readWorkspace();
    await expect(api.analyzeCase!(fixture.current.id, { expectedCaseRevision: fixture.current.caseRevision, operationKey: run.operationKey, question: run.question })).rejects.toMatchObject({ code: "INVALID_RECEIPT", uncertain: true });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("rejects a history from another company", async () => {
    const fixture = uiCaseFixture(); const other = { ...fixture.current, companyId: "OTHER" };
    const api = createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async url => response(url === "/api/company" ? fixture.company : url === "/api/decisions" ? fixture.decisions : { current: other, versions: [other] })) });
    await api.readWorkspace(); await expect(api.readCase!(fixture.current.id)).rejects.toMatchObject({ code: "INVALID_SCOPE" });
  });
  it("only enables the positive UI gate for a matching internal confirmation and calculation basis", () => {
    const fixture = uiCaseFixture(); const current = fixture.current; delete current.riskAssumption;
    current.confirmation = { kind: "inbound_date_confirmed", eventId: "event-ui", companyId: current.companyId, caseId: current.id, caseRevision: current.caseRevision, purchaseOrderLineId: "POL-1", productId: "SKU-ISO100", previousExpectedDate: "2026-10-22", confirmedExpectedDate: "2026-10-28", actorId: "OP-UI", confirmedAt: current.createdAt, basis: "Synthetic operator confirmation", businessRevision: "R0", policyVersion: "P1", dataOrigin: "synthetic" };
    fixture.decisions.proposals[0]!.evaluation.facts.coverageBasis = "confirmed_internal_synthetic";
    fixture.decisions.proposals[0]!.evaluation.facts.confirmation = { ...current.confirmation };
    expect(projectWorkspace(fixture.company, fixture.decisions).proposals[0]?.approvalBlockedReason).toBeUndefined();
    expect(projectWorkspace(fixture.company, fixture.decisions).proposals[0]?.actualExposures).toBeUndefined();
    current.confirmation.caseRevision = "C-wrong";
    expect(projectWorkspace(fixture.company, fixture.decisions).proposals[0]?.approvalBlockedReason).toBeDefined();
    current.confirmation.caseRevision = current.caseRevision; delete fixture.decisions.proposals[0]!.evaluation.facts.coverageBasis;
    expect(projectWorkspace(fixture.company, fixture.decisions).proposals[0]?.approvalBlockedReason).toBeDefined();
  });
});
