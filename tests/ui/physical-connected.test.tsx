import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { industrialFixture } from "./industrial-fixtures";
import { buildPhysicalFeed, physicalCompanyName, physicalEntityLabel, physicalFeedState } from "../../src/ui/physical-model";
import { PhysicalPages } from "../../src/ui/physical-pages";
import { UiError, type UiApi, type WorkspaceView } from "../../src/ui/types";

const at = "2026-10-22T12:00:00.000Z";
const now = Date.parse(at);
function company(): WorkspaceView {
  return { company: { id: "CO-DEMO", name: "Raw company", revision: "R0", policyVersion: "P1", asOf: at, dataOrigin: "synthetic", actor: { id: "EMP-PAUL", name: "Paul", role: "direction" }, canDecide: false }, proposals: [], runs: [], watches: [], cases: [], memory: [], catalog: { products: [], suppliers: [], commitments: [], inbound: [] } };
}
function received(): ReturnType<typeof industrialFixture> {
  const value = industrialFixture();
  value.display = { companyId: value.company.id, version: 1, baseCoreSha256: "a".repeat(64), baseContextSha256: "b".repeat(64), labels: [{ entityType: "company", nativeId: value.company.id, displayName: "Rivebois received", synthetic: true }, { entityType: "supplier", nativeId: "SUP-1", displayName: "Received supplier", synthetic: true }, { entityType: "depot", nativeId: "DEP-CENTRE", displayName: "Received depot", synthetic: true }], companyProfileDisplay: { activity: "Received activity", summary: "Received company summary", operations: "Received operations", disclosure: "Synthetic company" } };
  value.publicResearch = { companyId: value.company.id, scope: { profileId: "sector", profileVersion: "1", namespace: "live" }, generation: 3, state: "reusable", checkedAt: at, validUntil: "2026-10-22T13:00:00.000Z", occurrenceId: "OCC-3", conditions: [], reason: "Received source context", reused: false, externalCalls: 1, observations: [{ ref: { occurrenceId: "OCC-3", evidenceId: "PUBLIC-1", contentHash: "c".repeat(64) }, evidence: { id: "PUBLIC-1", title: "Original publisher headline", url: "https://example.com/news", content: "A public observation, without an internal business confirmation.", publishedAt: "2026-10-20T08:00:00.000Z", collectedAt: at, contentHash: "c".repeat(64), dataOrigin: "public", mode: "direct" }, qualification: "source_observation_only", testOnly: false, conditions: [] }] };
  value.publicFeed = { profileId: "sector", watchId: "WATCH-1", cadenceMinutes: 60, nextRunAt: "2026-10-22T13:00:00.000Z", lastAttemptAt: at, lastAttemptStatus: "completed" };
  return value;
}

describe("received Physical Impact workspace projection", () => {
  it("uses labels only for the exact received company, entity type and native ID", () => {
    const workspace = received();
    expect(physicalCompanyName(workspace)).toBe("Rivebois received");
    expect(physicalEntityLabel(workspace, "supplier", "SUP-1")).toBe("Received supplier");
    expect(physicalEntityLabel(workspace, "depot", "SUP-1")).toBe("SUP-1");
    workspace.display!.companyId = "OTHER";
    expect(physicalCompanyName(workspace)).toBe("Bois & Territoires (UI fixture)");
  });
  it("shows canonical public observations without rewriting their publisher or adding an impact report", () => {
    const workspace = received(); const feed = buildPhysicalFeed(workspace, company(), now);
    expect(feed.find(item => item.kind === "incident")?.title).toBe("Industrial incident at Received supplier");
    const source = feed.find(item => item.source?.observation?.id === "PUBLIC-1");
    expect(source).toMatchObject({ title: "Original publisher headline", origin: "Public source", status: "Source context received", source: { publishedAt: "2026-10-20T08:00:00.000Z", collectedAt: at } });
    expect(source?.reportId).toBeUndefined();
    expect(physicalFeedState(workspace, now)).toMatchObject({ cadenceMinutes: 60, nextRunAt: "2026-10-22T13:00:00.000Z", lastAttemptStatus: "completed", namespace: "live" });
  });
  it("keeps controlled, stale and wrong-company source contexts distinct", () => {
    const workspace = received(); workspace.publicResearch!.scope.namespace = "controlled";
    expect(buildPhysicalFeed(workspace, company(), now).find(item => item.source)?.origin).toBe("Controlled public source");
    expect(physicalFeedState(workspace, now).tone).toBe("neutral");
    expect(physicalFeedState(workspace, Date.parse("2026-10-22T14:00:00Z"))).toMatchObject({ label: "Earlier source context", tone: "amber" });
    workspace.publicResearch!.companyId = "OTHER";
    expect(buildPhysicalFeed(workspace, company(), now).filter(item => item.kind === "source")).toEqual([]);
    expect(physicalFeedState(workspace, now)).toEqual({ label: "No source context received", tone: "neutral" });
    expect(buildPhysicalFeed(workspace, { ...company(), company: { ...company().company, id: "OTHER" } }, now)).toEqual([]);
  });
  it("retains a received schedule without claiming that any source was collected", () => {
    const workspace = received(); delete workspace.publicResearch;
    expect(physicalFeedState(workspace, now)).toMatchObject({ label: "No source context received", cadenceMinutes: 60, nextRunAt: "2026-10-22T13:00:00.000Z" });
  });
  it("renders an unassessed workspace and blocks chat when availability is false or unknown", () => {
    const workspace = received(); workspace.reports = []; workspace.events = []; workspace.analyses = []; workspace.capabilities.questionsConnected = false;
    const view = company();
    const unavailable = async (): Promise<never> => { throw new UiError("PREVIEW_ONLY", "Read-only interface check"); };
    const api: UiApi = { readWorkspace: async () => view, askQuestion: unavailable, createWatch: unavailable, decide: unavailable, askIndustrialQuestion: unavailable };
    const render = (): string => renderToStaticMarkup(createElement(PhysicalPages, { page: "overview", workspace, company: view, api, fresh: true, reading: false, onSelectReport: () => undefined, onSelectPlan: () => undefined, onRefresh: () => undefined }));
    const html = render();
    expect(html).toContain("Rivebois received"); expect(html).toContain("Not assessed");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Ask Physical Impact/s);
    expect(html).not.toContain("Assessment received");
    delete workspace.capabilities.questionsConnected;
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>.*?Ask Physical Impact/s);
  });
  it("labels a stale action as an earlier assessment before opening its dossier", () => {
    const workspace = received(); workspace.reports[0]!.freshness = "stale"; workspace.reports[0]!.planStates[0]!.status = "stale";
    const view = company(); const unavailable = async (): Promise<never> => { throw new UiError("PREVIEW_ONLY", "Read-only interface check"); };
    const api: UiApi = { readWorkspace: async () => view, askQuestion: unavailable, createWatch: unavailable, decide: unavailable };
    const html = renderToStaticMarkup(createElement(PhysicalPages, { page: "actions", workspace, company: view, api, report: workspace.reports[0], fresh: true, reading: false, onSelectReport: () => undefined, onSelectPlan: () => undefined, onRefresh: () => undefined }));
    expect(html).toContain("Earlier assessment"); expect(html).not.toContain(">To review<");
  });
});
