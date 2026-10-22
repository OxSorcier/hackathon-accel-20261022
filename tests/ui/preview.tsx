import { createRoot } from "react-dom/client";
import { App } from "../../src/ui/App";
import { projectWorkspace } from "../../src/ui/api";
import { UiError } from "../../src/ui/types";
import type { UiApi, WatchView } from "../../src/ui/types";
import { uiCapabilitiesFixture, uiCaseFixture, uiContractFixture } from "./fixtures";
import type { DecisionCase } from "../../src/contracts/index.js";
import type { ResearchContext, ResearchScope, ResearchState } from "../../src/contracts/research.js";
import { researchFixture, researchRunFixture } from "./research-fixtures";
import { industrialFixture, industrialApprovalFixture, industrialExecutionFixture } from "./industrial-fixtures";
import type { RunView } from "../../src/ui/types";

const scenario = new URLSearchParams(window.location.search).get("scenario") ?? "ready";
const researchScenario = scenario.startsWith("research");
const industrialScenario = scenario.startsWith("industrial");
const fixture = ["case", "confirmed-case"].includes(scenario) ? uiCaseFixture() : uiContractFixture();
function savedResearch(namespace: ResearchScope["namespace"]): ResearchContext {
  const context = researchFixture(namespace, 2);
  const requested = scenario.slice("research-".length);
  if (["missing", "stale", "partial", "empty", "error", "uncertain"].includes(requested)) {
    context.state = requested as ResearchState; context.reused = false;
    context.reason = `Synthetic ${requested} research state for visual testing.`;
    if (requested === "missing" || requested === "empty") { context.observations = []; context.occurrenceId = null; }
    context.validUntil = requested === "stale" ? "2026-10-21T10:00:00.000Z" : null;
  }
  return context;
}
if (researchScenario) {
  fixture.decisions.proposals = [];
  fixture.decisions.runs = (["live", "controlled"] as const).flatMap(namespace => [2, 1].map(generation => ({ ...researchRunFixture(researchFixture(namespace, generation)), id: `research-${namespace}-${generation}` })));
}
if (scenario === "confirmed-case") {
  const current = fixture.decisions.cases![0]!; delete current.riskAssumption;
  current.confirmation = { kind: "inbound_date_confirmed", eventId: "event-ui", companyId: current.companyId, caseId: current.id, caseRevision: current.caseRevision, purchaseOrderLineId: "POL-1", productId: "SKU-ISO100", previousExpectedDate: "2026-10-22", confirmedExpectedDate: "2026-10-28", actorId: "OP-UI", confirmedAt: current.createdAt, basis: "Synthetic operator confirmation for this visual fixture.", businessRevision: current.businessRevision, policyVersion: current.policyVersion, dataOrigin: "synthetic" };
  fixture.decisions.proposals[0]!.evaluation.facts.confirmation = { ...current.confirmation };
  fixture.decisions.proposals[0]!.evaluation.facts.coverageBasis = "confirmed_internal_synthetic";
}
const workspace = projectWorkspace(fixture.company, fixture.decisions);
const industrial = industrialFixture();
if (industrialScenario) {
  workspace.company.name = industrial.company.name; workspace.proposals = []; workspace.runs = [];
  industrial.events[0]!.event.publicSourceEvidenceRefs = [];
  if (scenario === "industrial-stale") industrial.reports[0]!.freshness = "stale";
  if (scenario === "industrial-needs-input") { industrial.reports[0]!.report.status = "needs_input"; industrial.reports[0]!.report.recommendedPlanId = null; }
  if (["industrial-empty", "industrial-disconnected"].includes(scenario)) { industrial.reports = []; industrial.analyses = []; }
  if (scenario === "industrial-disconnected") industrial.capabilities = { automaticAnalysis: false, decisionsConnected: false, simulationConnected: false, simulationOnly: true, publicEvidenceIsSeparate: true };
}
const versions = structuredClone(workspace.cases);
function updateView(): void { Object.assign(workspace, projectWorkspace(fixture.company, fixture.decisions)); }
function saveCase(value: DecisionCase): DecisionCase {
  for (const proposal of fixture.decisions.proposals) if (proposal.caseRef?.caseId === value.id && proposal.status === "pending") proposal.status = "stale";
  fixture.decisions.cases = [value, ...(fixture.decisions.cases ?? []).filter(item => item.id !== value.id)];
  versions.unshift(structuredClone(value)); updateView(); return structuredClone(value);
}
if (scenario === "stale") workspace.company.revision = "R1";
if (scenario === "missing") workspace.company.actor = null;
if (scenario === "empty") { workspace.proposals = []; workspace.runs = []; }
if (scenario === "conditional") workspace.proposals[0]!.decisionOptionId = "transfer";
if (scenario === "unsafe") { workspace.proposals[0]!.summary = "<img src=x onerror=alert(1)>"; workspace.proposals[0]!.sources[0]!.url = "javascript:alert(1)"; }
let researchReads = 0;
let industrialReads = 0;
let industrialQuestion: RunView | null = null;
const industrialKeys = { decisions: [] as string[], simulations: [] as string[], questions: [] as string[] };
function recordIndustrial(kind: keyof typeof industrialKeys, key: string): void {
  industrialKeys[kind].push(key); document.documentElement.dataset[`industrial${kind[0]!.toUpperCase()}${kind.slice(1)}Requests`] = String(industrialKeys[kind].length); document.documentElement.dataset[`industrial${kind[0]!.toUpperCase()}${kind.slice(1)}Keys`] = String(new Set(industrialKeys[kind]).size);
}
const researchCommandKeys: string[] = [];
const api: UiApi = {
  async readIndustrial(signal) {
    if (!industrialScenario) throw new UiError("NOT_READY", "No industrial company in this synthetic preview.");
    if (scenario === "industrial-loading") await new Promise<void>(resolve => { const timer = setTimeout(resolve, 6000); signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
    if (scenario === "industrial-read-error" && industrialReads++ > 0) throw new UiError("TEST_INDUSTRIAL_READ", "Synthetic briefing read failure.");
    return structuredClone(industrial);
  },
  async readIndustrialReport(identifier) { const value = industrial.reports.find(item => item.report.id === identifier); if (!value) throw new UiError("NOT_FOUND", "Synthetic report not found."); return structuredClone(value); },
  async decideIndustrialPlan(_identifier, input) {
    recordIndustrial("decisions", input.operationKey);
    if (scenario === "industrial-decision-pending") await new Promise<void>(resolve => setTimeout(resolve, 8000));
    if (scenario === "industrial-command-uncertain") throw new UiError("UNCERTAIN", "Synthetic lost decision receipt.", true);
    const approval = industrialApprovalFixture(industrial); approval.decision = input.decision === "approve" ? "approved" : "rejected";
    const state = industrial.reports[0]!.planStates[0]!; state.approval = approval; state.status = approval.decision; state.permissions = { canApprove: false, canReject: false, canSimulate: approval.decision === "approved", blockedReason: null };
    return structuredClone(approval);
  },
  async simulateIndustrialApproval(_identifier, input) {
    recordIndustrial("simulations", input.operationKey); const receipt = industrialExecutionFixture(industrial); receipt.operationKey = input.operationKey;
    if (scenario === "industrial-execution-uncertain") { receipt.status = "uncertain"; receipt.afterRevision = null; receipt.completedAt = null; receipt.records = []; }
    const state = industrial.reports[0]!.planStates[0]!; state.execution = receipt; state.permissions.canSimulate = false;
    if (receipt.status === "applied") { industrial.company.businessRevision = receipt.afterRevision!; industrial.reports[0]!.freshness = "stale"; workspace.company.revision = receipt.afterRevision!; }
    return structuredClone(receipt);
  },
  async askIndustrialQuestion(input) {
    recordIndustrial("questions", input.idempotencyKey);
    if (scenario === "industrial-disconnected") throw new UiError("NOT_READY", "Industrial company questions are not connected yet.");
    industrialQuestion = { id: "industrial-question-ui", question: input.question, status: "queued", createdAt: new Date().toISOString(), executionMode: "test", industrialScope: { contextRevision: industrial.context.revision, qualificationRevision: industrial.context.qualificationRevision, reportId: null }, message: "Synthetic analysis receipt. No model call.", tools: [] };
    return structuredClone(industrialQuestion);
  },
  async readIndustrialRun(identifier) {
    if (!industrialQuestion || industrialQuestion.id !== identifier) throw new UiError("NOT_FOUND", "Synthetic company analysis not found.");
    industrialQuestion.status = "needs_input"; industrialQuestion.message = "Synthetic interface answer: inspect the prepared plan and its missing facts. No model or business calculation was run.";
    return structuredClone(industrialQuestion);
  },
  async readResearch(_profileId, namespace) {
    if (scenario === "research-read-error" && researchReads++ > 0) throw new UiError("TEST_RESEARCH_READ", "Synthetic saved-research read failure.");
    return structuredClone(savedResearch(namespace));
  },
  async analyzeResearch(_profileId, input) {
    researchCommandKeys.push(input.idempotencyKey);
    document.documentElement.dataset.researchRequests = String(researchCommandKeys.length);
    document.documentElement.dataset.researchOperationKeys = String(new Set(researchCommandKeys).size);
    if (scenario === "research-pending") await new Promise<void>(resolve => setTimeout(resolve, 8000));
    if (scenario === "research-command-uncertain") throw new UiError("UNCERTAIN", "Synthetic lost analysis receipt.", true);
    const context = savedResearch(input.namespace);
    const run = researchRunFixture(context); run.id = crypto.randomUUID(); run.question = input.question;
    if (context.state !== "reusable") { run.researchResult!.outcome = context.state === "uncertain" ? "uncertain" : "needs_refresh"; run.message = "Synthetic receipt. A source refresh would be needed. No external call was made."; }
    fixture.decisions.runs.unshift(run); updateView(); return structuredClone(workspace.runs.find(value => value.id === run.id)!);
  },
  async createCase(input) {
    const proof = fixture.decisions.occurrences.flatMap(value => value.result?.sources.flatMap(source => source.evidence) ?? []).find(value => value.id === input.evidenceRef.evidenceId)!;
    return saveCase({ id: `case:${crypto.randomUUID()}`, companyId: "CO-DEMO", caseRevision: `C-${crypto.randomUUID()}`, previousRevision: null, evidenceRef: input.evidenceRef, observation: proof, relation: input.relation, candidateOrderLineIds: input.relation.productId ? ["OL-A", "OL-B"] : [], businessRevision: "R0", policyVersion: "P1", actorId: "EMP-PAUL", createdAt: new Date().toISOString(), qualification: input.relation.status === "none" ? "no_known_exposure" : "to_verify", impactKind: input.riskAssumption ? "risk" : "undetermined", ...(input.riskAssumption ? { riskAssumption: input.riskAssumption } : {}) });
  },
  async reviseCase(identifier, input) {
    const current = fixture.decisions.cases?.find(value => value.id === identifier)!;
    if (current.caseRevision !== input.expectedCaseRevision) throw new UiError("STALE_CONTEXT", "Case version changed in the synthetic harness.");
    const value: DecisionCase = { ...current, caseRevision: `C-${crypto.randomUUID()}`, previousRevision: current.caseRevision, evidenceRef: input.evidenceRef, relation: input.relation, candidateOrderLineIds: input.relation.productId ? ["OL-A", "OL-B"] : [], qualification: input.relation.status === "none" ? "no_known_exposure" : "to_verify", impactKind: input.riskAssumption ? "risk" : "undetermined", riskAssumption: input.riskAssumption, createdAt: new Date().toISOString() };
    delete value.confirmation; return saveCase(value);
  },
  async readCase(identifier) { return { current: structuredClone(fixture.decisions.cases!.find(value => value.id === identifier)!), versions: structuredClone(versions.filter(value => value.id === identifier)) }; },
  async analyzeCase(identifier, input) {
    const current = fixture.decisions.cases!.find(value => value.id === identifier)!;
    const run = { ...workspace.runs[0]!, id: crypto.randomUUID(), question: input.question, caseRef: { caseId: identifier, caseRevision: current.caseRevision }, status: "needs_input" as const, message: "Synthetic analysis receipt. No real model call or new business calculation.", proposalId: undefined, tools: [] };
    workspace.runs.unshift(run); return structuredClone(run);
  },
  async readWatchCapabilities() {
    if (scenario === "capabilities-error" || scenario === "research-capabilities-error") throw new UiError("TEST_CAPABILITIES", "Synthetic topic request unavailable.");
    const capabilities = uiCapabilitiesFixture();
    if (researchScenario) { capabilities.profiles = capabilities.profiles!.filter(value => value.id === "sector-news"); capabilities.publicTopics = capabilities.profiles.map(value => value.publicTopic); }
    return capabilities;
  },
  async readWorkspace(signal) {
    if (scenario === "loading") await new Promise<void>(resolve => { const timer = setTimeout(resolve, 6000); signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
    if (scenario === "error") throw new UiError("TEST_ERROR", "Synthetic UI connection error.");
    return structuredClone(workspace);
  },
  async askQuestion(input) {
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    const run = { ...workspace.runs[0]!, id: crypto.randomUUID(), question: input.question, status: "needs_input" as const, message: "Synthetic response: which need date should be examined?", proposalId: undefined, createdAt: new Date().toISOString(), tools: [] };
    workspace.runs.unshift(run); return run;
  },
  async createWatch(input) {
    const watch: WatchView = { id: crypto.randomUUID(), topic: input.topic, cadenceMinutes: input.cadenceMinutes, status: "draft", message: "Synthetic draft. No real collection.", sources: input.sourceUrls.map((url, index) => ({ id: String(index), title: url, url, kind: "public", status: "not_run" })) };
    workspace.watches.push(watch); return watch;
  },
  async decide(input) {
    await new Promise<void>(resolve => setTimeout(resolve, 350));
    if (scenario === "conflict") { workspace.company.revision = "R1"; throw new UiError("STALE_CONTEXT", "Stale proposal reported by the test server."); }
    workspace.proposals[0]!.status = input.action === "approve" ? "approved" : "rejected";
    return { message: "Synthetic decision received by the UI harness. No real storage." };
  },
  async openSession() { workspace.company.actor = { name: "Paul Martin (test)", role: "direction" }; },
  async closeSession() { workspace.company.actor = null; },
};
const root = document.getElementById("root");
if (!root) throw new Error("Missing preview root");
createRoot(root).render(<App api={api} initialTab={scenario.startsWith("industrial") ? "briefing" : "pending"} previewLabel="Synthetic UI harness. No real model, business calculation, collection or storage tested on this screen." />);
