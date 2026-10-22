import { z } from "zod";
import type { EvidenceRef, SourceEvidence } from "../contracts/index.js";
import type { ResearchContext, ResearchDependency, ResearchObservation, ResearchResult, ResearchScope, ResearchState } from "../contracts/research.js";
import type { RunView } from "./types";

interface ResearchSchemas {
  scope: z.ZodType<ResearchScope>;
  dependency: z.ZodType<ResearchDependency>;
  context: z.ZodType<ResearchContext>;
  result: z.ZodType<ResearchResult>;
}

function refKey(ref: EvidenceRef): string {
  return JSON.stringify([ref.occurrenceId, ref.evidenceId, ref.contentHash]);
}

export function sameResearchScope(left: ResearchScope, right: ResearchScope): boolean {
  return left.profileId === right.profileId && left.profileVersion === right.profileVersion && left.namespace === right.namespace;
}

export function createResearchSchemas(evidence: z.ZodType<SourceEvidence>, evidenceRef: z.ZodType<EvidenceRef>): ResearchSchemas {
  const identity = z.string().trim().min(1).max(512);
  const date = z.string().datetime({ offset: true });
  const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
  const conditions = z.array(z.string().min(1).max(1000)).max(30);
  const scope: z.ZodType<ResearchScope> = z.object({ profileId: identity, profileVersion: identity, namespace: z.enum(["live", "controlled"]) });
  const dependency: z.ZodType<ResearchDependency> = z.object({ scope, generation: counter, validUntil: date.nullable(), evidenceRefs: z.array(evidenceRef).max(10).refine(values => new Set(values.map(refKey)).size === values.length) });
  const observation: z.ZodType<ResearchObservation> = z.object({ ref: evidenceRef, evidence, qualification: z.literal("source_observation_only"), testOnly: z.boolean(), conditions }).refine(value => value.ref.evidenceId === value.evidence.id && value.ref.contentHash === value.evidence.contentHash);
  const observations = z.array(observation).max(10).refine(values => new Set(values.map(value => refKey(value.ref))).size === values.length);
  const inScope = (value: ResearchObservation, bound: ResearchScope): boolean => value.testOnly === (bound.namespace === "controlled") && value.evidence.mode === (bound.namespace === "controlled" ? "test" : "direct") && (!value.evidence.provenance || value.evidence.provenance.profileId === bound.profileId);
  const context: z.ZodType<ResearchContext> = z.object({ companyId: identity, scope, generation: counter, state: z.enum(["reusable", "missing", "stale", "partial", "empty", "error", "uncertain"]), checkedAt: date, validUntil: date.nullable(), occurrenceId: identity.nullable(), observations, conditions, reason: z.string().min(1).max(2000), reused: z.boolean(), externalCalls: counter }).refine(value =>
    value.observations.every(item => inScope(item, value.scope) && item.ref.occurrenceId === value.occurrenceId)
    && (!["missing", "empty"].includes(value.state) || value.observations.length === 0)
    && (value.state !== "reusable" || (value.observations.length > 0 && value.validUntil !== null && Date.parse(value.validUntil) > Date.parse(value.checkedAt)))
  );
  const result: z.ZodType<ResearchResult> = z.object({ outcome: z.enum(["available", "needs_refresh", "uncertain"]), dependencies: z.array(dependency).max(10), observations, conditions }).refine(value =>
    (value.outcome !== "available" || (value.dependencies.length > 0 && value.observations.length > 0 && value.dependencies.every(item => item.validUntil !== null)))
    && value.observations.every(item => value.dependencies.some(bound => inScope(item, bound.scope) && bound.evidenceRefs.some(ref => refKey(ref) === refKey(item.ref))))
    && value.dependencies.every(bound => bound.evidenceRefs.every(ref => value.observations.some(item => inScope(item, bound.scope) && refKey(item.ref) === refKey(ref))))
  );
  return { scope, dependency, context, result };
}

export function researchStateLabel(state: ResearchState): string {
  return { reusable: "Research available", missing: "No saved research", stale: "Needs recheck", partial: "Partial research", empty: "No results saved", error: "Research error", uncertain: "Outcome uncertain" }[state];
}

export function runStatusLabel(run: RunView): string {
  if (run.status === "needs_input" && run.researchResult?.outcome === "available") return "Research available";
  return { queued: "Queued", running: "Analysis in progress", proposal: "Proposal prepared", needs_input: "More information needed", stale_context: "Stale context", error: "Analysis interrupted", budget_exhausted: "Analysis limit reached", uncertain: "Outcome uncertain" }[run.status];
}

export function researchConditionLabel(value: string): string {
  const labels: Record<string, string> = { NO_RECEIVED_RESEARCH: "No research received for this company and profile.", FRESHNESS_EXPIRED: "The saved observation needs a freshness check.", SOURCE_OBSERVATION_ONLY: "Source observation only. No business relationship or regulatory applicability is established.", NEW_ANALYSIS_REQUIRED: "The research changed. Start a new analysis using the current version.", REFRESH_UNCERTAIN: "The source refresh outcome is uncertain. Check the saved state before retrying." };
  return labels[value] ?? value;
}
