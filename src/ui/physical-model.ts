import type { IndustrialDisplayProfile, IndustrialWorkspace } from "../contracts/industrial-api.js";
import type { ReleasedIndustrialEvent } from "../contracts/industrial.js";
import type { SourceView, WorkspaceView } from "./types.js";

export interface PhysicalFeedItem {
  id: string;
  kind: "incident" | "source";
  title: string;
  origin: string;
  status: string;
  reportId?: string;
  source?: SourceView;
  event?: ReleasedIndustrialEvent;
}

type EntityType = IndustrialDisplayProfile["labels"][number]["entityType"];
export interface PhysicalFeedState {
  label: string;
  tone: "neutral" | "teal" | "amber";
  checkedAt?: string;
  validUntil?: string;
  cadenceMinutes?: number;
  nextRunAt?: string;
  lastAttemptAt?: string;
  lastAttemptStatus?: string;
  namespace?: "live" | "controlled";
}

export function physicalEntityLabel(workspace: IndustrialWorkspace, entityType: EntityType, nativeId: string, fallback = nativeId): string {
  const display = workspace.display;
  return display?.companyId === workspace.company.id
    ? display.labels.find(label => label.entityType === entityType && label.nativeId === nativeId)?.displayName ?? fallback
    : fallback;
}

export function physicalCompanyName(workspace: IndustrialWorkspace): string {
  return physicalEntityLabel(workspace, "company", workspace.company.id, workspace.company.name);
}

export function physicalFeedState(workspace: IndustrialWorkspace, now = Date.now()): PhysicalFeedState {
  const research = workspace.publicResearch;
  const feed = !research || research.companyId === workspace.company.id && workspace.publicFeed?.profileId === research.scope.profileId ? workspace.publicFeed : undefined;
  const schedule = { ...(feed?.cadenceMinutes !== null && feed?.cadenceMinutes !== undefined ? { cadenceMinutes: feed.cadenceMinutes } : {}), ...(feed?.nextRunAt ? { nextRunAt: feed.nextRunAt } : {}), ...(feed?.lastAttemptAt ? { lastAttemptAt: feed.lastAttemptAt } : {}), ...(feed?.lastAttemptStatus ? { lastAttemptStatus: feed.lastAttemptStatus } : {}) };
  if (!research || research.companyId !== workspace.company.id) return { label: "No source context received", tone: "neutral", ...schedule };
  const expired = research.state === "reusable" && (research.validUntil === null || Date.parse(research.validUntil) <= now);
  const state = expired ? "stale" : research.state;
  const labels = { reusable: research.scope.namespace === "controlled" ? "Controlled source context received" : "Source context received", missing: "Source context missing", stale: "Earlier source context", partial: "Partial source collection", empty: "Collection returned no observation", error: "Source collection error", uncertain: "Collection outcome uncertain" };
  return { label: labels[state], tone: state === "reusable" ? research.scope.namespace === "live" ? "teal" : "neutral" : state === "empty" || state === "missing" ? "neutral" : "amber", checkedAt: research.checkedAt,
    ...(research.validUntil ? { validUntil: research.validUntil } : {}), namespace: research.scope.namespace, ...schedule };
}

/** A public headline never acquires an internal report merely by appearing in the same feed. */
export function buildPhysicalFeed(industrial: IndustrialWorkspace, workspace: WorkspaceView, now = Date.now()): PhysicalFeedItem[] {
  if (industrial.company.id !== workspace.company.id) return [];
  const incidents: PhysicalFeedItem[] = industrial.events.map(event => {
    const supplier = physicalEntityLabel(industrial, "supplier", event.event.supplierId, workspace.catalog.suppliers.find(item => item.id === event.event.supplierId)?.label ?? event.event.supplierId);
    const related = [...industrial.reports].sort((a, b) => Date.parse(b.report.createdAt) - Date.parse(a.report.createdAt)).filter(item =>
      item.report.basis.eventId === event.event.eventId && item.report.basis.eventRevision === event.revision
      && item.report.basis.companyId === industrial.company.id && item.report.basis.policyVersion === industrial.company.policyVersion
      && item.report.basis.contextRevision === industrial.context.revision && item.report.basis.qualificationRevision === industrial.context.qualificationRevision
    );
    const completed = related.find(item => item.planStates.some(state => state.execution?.status === "applied" && state.execution.afterRevision === industrial.company.businessRevision));
    const report = completed ?? related.find(item => item.report.basis.businessRevision === industrial.company.businessRevision && item.report.status === "prepared" && item.freshness !== "stale");
    return { id: event.id, kind: "incident", title: `Industrial incident at ${supplier}`, origin: "Controlled scenario", status: completed ? "Response executed" : report ? "Response ready" : "Awaiting analysis", ...(report ? { reportId: report.report.id } : {}), event };
  });
  const unique = new Map<string, SourceView>();
  for (const watch of workspace.watches) for (const source of watch.sources) if (!industrial.publicResearch || source.kind !== "public") unique.set(source.id, source);
  const sources: PhysicalFeedItem[] = [...unique.values()].map(source => ({ id: source.id, kind: "source", title: source.title,
    origin: source.kind === "public" ? "Public source" : source.kind === "company" ? "Company update" : "Demo source",
    status: ({ success: "Received", partial: "Partial collection", empty: "No update", error: "Collection error", not_run: "Not collected" })[source.status], source }));
  const research = industrial.publicResearch;
  if (research?.companyId === industrial.company.id) {
    const state = physicalFeedState(industrial, now);
    for (const observation of research.observations) {
      const evidence = observation.evidence;
      const controlled = research.scope.namespace === "controlled" || observation.testOnly || evidence.mode !== "direct";
      const id = `${observation.ref.occurrenceId}:${observation.ref.evidenceId}:${observation.ref.contentHash}`;
      sources.push({ id, kind: "source", title: evidence.title, origin: controlled ? "Controlled public source" : "Public source", status: state.label,
        source: { id, title: evidence.title, url: evidence.url, kind: "public", status: research.state === "reusable" ? "success" : research.state === "error" ? "error" : "partial", collectedAt: evidence.collectedAt,
          ...(evidence.publishedAt ? { publishedAt: evidence.publishedAt } : {}), note: observation.conditions.join(" · ") || "Source observation. Business exposure requires separate company evidence.", mode: evidence.mode, evidenceRef: observation.ref, observation: evidence } });
    }
  }
  return [...incidents, ...sources];
}
