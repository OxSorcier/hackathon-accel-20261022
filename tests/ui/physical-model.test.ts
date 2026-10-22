import { describe, expect, it } from "vitest";
import { buildPhysicalFeed } from "../../src/ui/physical-model";
import { industrialExecutionFixture, industrialFixture } from "./industrial-fixtures";
import type { WorkspaceView } from "../../src/ui/types";

function company(): WorkspaceView {
  return { company: { id: "CO-DEMO", name: "Rivebois Matériaux", revision: "R0", policyVersion: "P1", asOf: "2026-10-22T10:00:00Z", dataOrigin: "synthetic", actor: { id: "EMP-PAUL", name: "Paul Martin", role: "direction" }, canDecide: true }, proposals: [], runs: [], cases: [], memory: [], catalog: { products: [], suppliers: [{ id: "SUP-1", label: "Arven Isolation" }], commitments: [], inbound: [] }, watches: [{ id: "watch", topic: "sector news", cadenceMinutes: 15, status: "active", sources: [{ id: "public-source", title: "Historical capacity announcement", kind: "public", status: "partial", collectedAt: "2026-10-22T09:00:00Z", url: "https://www.rockwool.com/fr/" }] }] };
}

describe("Physical Impact feed provenance", () => {
  it("keeps public context separate from a controlled incident and its plan", () => {
    const feed = buildPhysicalFeed(industrialFixture(), company());
    expect(feed.find(item => item.kind === "incident")).toMatchObject({ title: "Industrial incident at Arven Isolation", reportId: "report-ui", origin: "Controlled scenario" });
    expect(feed.find(item => item.source?.kind === "public")).toMatchObject({ title: "Historical capacity announcement", status: "Partial collection", origin: "Public source" });
    expect(feed.find(item => item.source?.kind === "public")?.reportId).toBeUndefined();
  });

  it("does not attach a report from an earlier event revision", () => {
    const industrial = industrialFixture();
    industrial.events[0]!.revision = "EVR2";
    const incident = buildPhysicalFeed(industrial, company()).find(item => item.kind === "incident");
    expect(incident?.reportId).toBeUndefined();
    expect(incident?.status).toBe("Awaiting analysis");
  });
  it("keeps the applied response accessible after its execution advances the business revision", () => {
    const industrial = industrialFixture();
    industrial.reports[0]!.planStates[0]!.execution = industrialExecutionFixture(industrial);
    industrial.company.businessRevision = "R1";
    industrial.reports[0]!.freshness = "stale";
    expect(buildPhysicalFeed(industrial, company()).find(item => item.kind === "incident")).toMatchObject({ reportId: "report-ui", status: "Response executed" });
    industrial.events[0]!.revision = "EVR2";
    expect(buildPhysicalFeed(industrial, company()).find(item => item.kind === "incident")?.reportId).toBeUndefined();
  });
});
