import { describe, expect, it, vi } from "vitest";
import { createHttpUiApi } from "../../src/ui/api";
import { uiCaseFixture } from "./fixtures";

function confirmationFixture(exposureOrderLineIds?: string[]): ReturnType<typeof uiCaseFixture> {
  const fixture = uiCaseFixture(); const current = fixture.current; delete current.riskAssumption;
  current.confirmation = { kind: "inbound_date_confirmed", eventId: "event-ui", companyId: current.companyId, caseId: current.id, caseRevision: current.caseRevision, purchaseOrderLineId: "POL-1", productId: "SKU-ISO100", previousExpectedDate: "2026-10-22", confirmedExpectedDate: "2026-10-28", actorId: "OP-UI", confirmedAt: current.createdAt, basis: "Synthetic operator confirmation", businessRevision: "R0", policyVersion: "P1", dataOrigin: "synthetic", ...(exposureOrderLineIds !== undefined ? { exposureOrderLineIds } : {}) };
  fixture.decisions.proposals[0]!.evaluation.facts.coverageBasis = "confirmed_internal_synthetic";
  fixture.decisions.proposals[0]!.evaluation.facts.confirmation = { ...current.confirmation };
  return fixture;
}

function apiFor(fixture: ReturnType<typeof uiCaseFixture>): ReturnType<typeof createHttpUiApi> {
  return createHttpUiApi({ fetch: vi.fn<typeof fetch>().mockImplementation(async url => new Response(JSON.stringify({ data: url === "/api/company" ? fixture.company : fixture.decisions, error: null }))) });
}

describe("internal confirmation exposure boundary, synthetic HTTP", () => {
  it.each([{ label: "historical absence", exposures: undefined }, { label: "empty array", exposures: [] }, { label: "two lines", exposures: ["OL-A", "OL-B"] }, { label: "inclusive maximum", exposures: Array.from({ length: 10000 }, (_, index) => `OL-${index}`) }])("preserves $label in both case and evaluation", async ({ exposures }) => {
    const view = await apiFor(confirmationFixture(exposures)).readWorkspace();
    expect(view.cases[0]?.confirmation?.exposureOrderLineIds).toEqual(exposures);
    expect(view.proposals[0]?.approvalBlockedReason).toBeUndefined();
  });
  it.each([{ label: "duplicates", exposures: ["OL-A", "OL-A"] }, { label: "invalid ID", exposures: ["not a valid ID"] }, { label: "oversized array", exposures: Array.from({ length: 10001 }, (_, index) => `OL-${index}`) }])("refuses $label", async ({ exposures }) => {
    await expect(apiFor(confirmationFixture(exposures)).readWorkspace()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("does not hide an exposure mismatch between the confirmation and evaluation", async () => {
    const fixture = confirmationFixture(["OL-A"]);
    const confirmation = fixture.current.confirmation!;
    fixture.decisions.proposals[0]!.evaluation.facts.confirmation = { ...confirmation, exposureOrderLineIds: ["OL-B"] };
    const view = await apiFor(fixture).readWorkspace();
    expect(view.proposals[0]?.approvalBlockedReason).toBeDefined();
  });
});
