import type { AgentRun } from "../../src/contracts/index.js";
import type { ResearchContext, ResearchDependency, ResearchScope } from "../../src/contracts/research.js";
import { uiCaseFixture, uiContractFixture } from "./fixtures";

/** Explicit UI-only research records. No external call, persistence or R1/R2 proof. */
export function researchFixture(namespace: ResearchScope["namespace"] = "live", generation = 1): ResearchContext {
  const sample = uiCaseFixture().current.observation;
  const evidence = { ...sample, id: "research-source-ui", title: `Materials notice, source version ${generation} (UI fixture)`, content: `Synthetic controlled content version ${generation}. No real supplier relationship or regulatory applicability is established.`, contentHash: (generation === 1 ? "b" : "c").repeat(64), mode: namespace === "controlled" ? "test" as const : "direct" as const, provenance: { ...sample.provenance!, profileId: "sector-news" } };
  const ref = { occurrenceId: `research-occurrence-${generation}`, evidenceId: evidence.id, contentHash: evidence.contentHash };
  return { companyId: "CO-DEMO", scope: { profileId: "sector-news", profileVersion: "v1", namespace }, generation, state: "reusable", checkedAt: "2026-10-22T10:00:00.000Z", validUntil: "2099-10-22T11:00:00.000Z", occurrenceId: ref.occurrenceId, observations: [{ ref, evidence, qualification: "source_observation_only", testOnly: namespace === "controlled", conditions: ["SOURCE_OBSERVATION_ONLY"] }], conditions: ["SOURCE_OBSERVATION_ONLY"], reason: "Saved source observation received for this exact company and research profile.", reused: true, externalCalls: 0 };
}

export function researchDependency(context: ResearchContext): ResearchDependency {
  return { scope: { ...context.scope }, generation: context.generation, validUntil: context.validUntil, evidenceRefs: context.observations.map(item => ({ ...item.ref })) };
}

export function researchRunFixture(context = researchFixture()): AgentRun {
  const original = uiContractFixture().decisions.runs[0]!;
  const dependency = researchDependency(context);
  return { ...original, id: `research-run-${context.generation}`, operationKey: "research-operation-ui", question: "Retrieve saved research with its sources and conditions.", status: "needs_input", proposalId: null, researchScope: { ...context.scope }, researchDependencies: [dependency], researchResult: { outcome: "available", dependencies: [dependency], observations: structuredClone(context.observations), conditions: [...context.conditions] }, message: "Prior research is available. This synthetic fixture made no external call.", traces: [{ ...original.traces[0]!, tool: "read_research_context", output: { callId: "research-call-ui", isError: false, result: { reused: true, externalCalls: 0, state: context.state } } }] };
}
