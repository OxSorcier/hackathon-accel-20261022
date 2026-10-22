import { z } from "zod";
import type { AgentRun, BusinessOption, CaseInput, CaseRef, CompanyView as ContractCompany, DecisionCase, DecisionsView, EvidenceRef, JsonValue, Proposal, SourceEvidence, ToolTrace, Watch } from "../contracts/index.js";
import { CONTRACT_VERSION } from "../contracts/index.js";
import { formatDate, presentMessage, safeSourceUrl } from "./format";
import { UiError } from "./types";
import type { DecisionInput, OptionView, ProposalView, RunView, SourceView, ToolView, UiApi, WatchCapabilitiesView, WatchView, WorkspaceView } from "./types";
import { createResearchSchemas, sameResearchScope } from "./research";
import type { ResearchContext } from "../contracts/research.js";
import { createIndustrialSchemas } from "./industrial";
import { createIndustrialApi } from "./industrial-api";

const text = z.string().max(100_000);
const id = z.string().min(1).max(512);
const date = z.string().datetime({ offset: true });
const json: z.ZodType<JsonValue> = z.lazy(() => z.union([z.null(), z.boolean(), z.number().finite(), text, z.array(json), z.record(z.string(), json)]));
const object = z.record(z.string(), json);
const actorSchema = z.object({ actorId: id, companyId: id, role: z.enum(["direction", "achats", "logistique", "operator"]), approvalCeilingEur: z.number().finite().nonnegative() });
const snapshotSchema = z.object({
  companyId: id, revision: id, policyVersion: id, dataOrigin: z.literal("synthetic"), updatedAt: date,
  dataset: z.object({ schema: id, company_id: id, data_origin: z.literal("synthetic"), snapshot_revision: id, as_of: date, tables: z.record(z.string(), z.array(object)) }),
  policy: z.object({ schema: z.string().optional(), company_id: id, data_origin: z.literal("synthetic"), rules: z.array(z.object({ id, rule: text })), role_approval_note: text, agent_context_excludes: z.array(text), public_search_inputs: text }),
});
const companySchema: z.ZodType<ContractCompany> = z.object({ snapshot: snapshotSchema, actor: actorSchema.nullable(), contractVersion: z.literal(CONTRACT_VERSION) });
const optionSchema = z.object({ id, kind: z.enum(["transfer", "emergency_purchase", "wait", "request_confirmation"]), label: text, status: z.enum(["feasible", "conditional", "rejected"]), costEur: z.number().finite().nonnegative(), conditions: z.array(text), effects: object, reasons: z.array(text) });
const evaluationSchema = z.object({ id, companyId: id, revision: id, policyVersion: id, evaluatedAt: date, constraints: z.array(text), unknowns: z.array(text), options: z.array(optionSchema), facts: object });
const caseIdentity = z.string().min(1).max(160).regex(/^[a-zA-Z0-9:_.-]+$/);
const operationKeySchema = z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
const caseRefSchema = z.object({ caseId: caseIdentity, caseRevision: caseIdentity });
const evidenceRefSchema = z.object({ occurrenceId: caseIdentity, evidenceId: caseIdentity, contentHash: z.string().regex(/^[a-f0-9]{64}$/) });
const relationSchema = z.object({ status: z.enum(["unverified", "none"]), productId: caseIdentity.nullable(), supplierId: caseIdentity.nullable(), basis: z.string().trim().min(1).max(2000) }).refine(value => value.status !== "none" || (value.productId === null && value.supplierId === null));
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const riskAssumptionSchema = z.object({ kind: z.literal("inbound_delay"), purchaseOrderLineId: caseIdentity, assumedExpectedDate: calendarDate.nullable(), basis: z.string().trim().min(1).max(2000) });
const confirmationSchema = z.object({ kind: z.literal("inbound_date_confirmed"), eventId: caseIdentity, companyId: id, caseId: caseIdentity, caseRevision: caseIdentity, purchaseOrderLineId: caseIdentity, productId: caseIdentity, previousExpectedDate: calendarDate.nullable(), confirmedExpectedDate: calendarDate, actorId: id, confirmedAt: date, basis: text, businessRevision: id, policyVersion: id, dataOrigin: z.literal("synthetic"), exposureOrderLineIds: z.array(caseIdentity).max(10000).refine(values => new Set(values).size === values.length).optional() });
const caseInputSchema = z.object({ evidenceRef: evidenceRefSchema, relation: relationSchema, operationKey: operationKeySchema, riskAssumption: riskAssumptionSchema.optional() }).strict();
const proposalSchema: z.ZodType<Proposal> = z.object({ id, companyId: id, runId: id, revision: id, policyVersion: id, evaluation: evaluationSchema, optionId: id.nullable(), title: text, summary: text, conditions: z.array(text), status: z.enum(["pending", "approved", "rejected", "stale"]), createdAt: date, caseRef: caseRefSchema.optional(), researchDependencies: z.lazy(() => z.array(researchSchemas.dependency).max(10)).optional() });
const traceSchema = z.object({ id, tool: id, input: json, output: json, startedAt: date, completedAt: date });
const runSchema: z.ZodType<AgentRun> = z.object({ id, companyId: id, actorId: id, operationKey: id, question: text, status: z.enum(["queued", "running", "proposal", "needs_input", "stale_context", "error", "budget_exhausted", "uncertain"]), revision: id, policyVersion: id, mode: z.enum(["direct", "replay", "test"]), model: text.nullable(), proposalId: id.nullable(), message: text.nullable(), traces: z.array(traceSchema), createdAt: date, completedAt: date.nullable(), caseRef: caseRefSchema.optional(), researchScope: z.lazy(() => researchSchemas.scope).optional(), researchDependencies: z.lazy(() => z.array(researchSchemas.dependency).max(10)).optional(), researchResult: z.lazy(() => researchSchemas.result).optional(), industrialScope: z.lazy(() => industrialSchemas.questionScope).optional(), industrialBasis: z.lazy(() => industrialSchemas.basis).optional(), industrialIntentId: id.optional(), industrialReportId: id.optional() }).refine(value =>
  (!value.researchResult && !value.researchDependencies) || Boolean(value.researchScope && (value.researchDependencies ?? []).every(item => sameResearchScope(item.scope, value.researchScope!)) && (!value.researchResult || (value.researchResult.dependencies.every(item => sameResearchScope(item.scope, value.researchScope!)) && equivalentJson(value.researchResult.dependencies, value.researchDependencies))))
);
const watchSchema: z.ZodType<Watch> = z.object({ id, companyId: id, actorId: id, publicTopic: text, sourceUrls: z.array(text), cadenceMinutes: z.number().int().positive(), enabled: z.boolean(), nextRunAt: date, createdAt: date });
const familySchema = z.enum(["sector", "regional", "supplier", "incident", "project", "public_contract", "regulation_fr", "regulation_eu"]);
const evidenceSchema: z.ZodType<SourceEvidence> = z.object({ id, url: text, title: text, content: text, publishedAt: date.nullable(), collectedAt: date, contentHash: id, dataOrigin: z.literal("public"), mode: z.enum(["direct", "replay", "test"]),
  provenance: z.object({ provider: z.enum(["boamp", "keenable"]), endpoint: text, method: z.enum(["search_snippet", "fetch", "api_record"]), profileId: id, indexedAt: date.nullable(), truncated: z.boolean() }).optional(), family: familySchema.optional(),
  regulation: z.object({ jurisdiction: z.enum(["FR", "EU"]), officialIdentifier: text.nullable(), entryIntoForceAt: text.nullable(), appliesFrom: text.nullable(), deadlineAt: text.nullable(), scope: text.nullable(), applicability: z.enum(["to_verify", "unknown"]) }).optional(),
});
const researchSchemas = createResearchSchemas(evidenceSchema, evidenceRefSchema);
const industrialSchemas = createIndustrialSchemas(researchSchemas.dependency);
const caseSchema: z.ZodType<DecisionCase> = z.object({ id: caseIdentity, companyId: id, caseRevision: caseIdentity, previousRevision: caseIdentity.nullable(), evidenceRef: evidenceRefSchema, observation: evidenceSchema, relation: relationSchema, candidateOrderLineIds: z.array(caseIdentity), businessRevision: id, policyVersion: id, qualification: z.enum(["to_verify", "no_known_exposure"]), actorId: id, createdAt: date, impactKind: z.enum(["risk", "undetermined"]), riskAssumption: riskAssumptionSchema.optional(), confirmation: confirmationSchema.optional(), testOnly: z.boolean().optional(), researchDependency: researchSchemas.dependency.optional() }).refine(value => value.observation.id === value.evidenceRef.evidenceId && value.observation.contentHash === value.evidenceRef.contentHash && value.observation.mode === (value.testOnly ? "test" : "direct") && Boolean(value.testOnly) === (value.researchDependency?.scope.namespace === "controlled") && (!value.researchDependency || value.researchDependency.evidenceRefs.some(ref => equivalentJson(ref, value.evidenceRef))) && value.qualification === (value.relation.status === "none" ? "no_known_exposure" : "to_verify") && value.impactKind === (value.riskAssumption || value.confirmation ? "risk" : "undetermined") && (!value.riskAssumption || (value.relation.status === "unverified" && !value.confirmation)));
const sourceResultSchema = z.object({ url: text, status: z.enum(["success", "empty", "partial", "error", "not_run"]), evidence: z.array(evidenceSchema), error: text.nullable() });
const collectionSchema = z.object({ status: z.enum(["success", "empty", "partial", "error", "not_run"]), sources: z.array(sourceResultSchema), startedAt: date, completedAt: date });
const occurrenceSchema = z.object({ id, watchId: id, companyId: id, operationKey: id, status: z.enum(["queued", "running", "completed", "error"]), scheduledAt: date, startedAt: date.nullable(), completedAt: date.nullable(), fence: z.number().int().nonnegative(), leaseUntil: date.nullable(), result: collectionSchema.nullable(), error: text.nullable() });
const decisionsSchema: z.ZodType<DecisionsView> = z.object({ proposals: z.array(proposalSchema), runs: z.array(runSchema), watches: z.array(watchSchema), occurrences: z.array(occurrenceSchema), cases: z.array(caseSchema).optional() });
const errorSchema = z.object({ code: id, message: text });
const watchCapabilitiesSchema: z.ZodType<WatchCapabilitiesView> = z.object({
  publicTopics: z.array(z.string().trim().min(3).max(200)).min(1).max(20),
  sourceUrls: z.array(z.string().max(2000).refine(value => safeSourceUrl(value) !== undefined)).min(1).max(3),
  minimumCadenceMinutes: z.number().int().min(1).max(10080),
  maximumCadenceMinutes: z.number().int().min(1).max(10080),
  profiles: z.array(z.object({ id, label: text, publicTopic: text, family: familySchema, sourceUrls: z.array(text) })).optional(),
}).refine(value => value.minimumCadenceMinutes <= value.maximumCadenceMinutes && (!value.profiles || (value.publicTopics.every(topic => value.profiles!.filter(profile => profile.publicTopic === topic).length === 1) && value.profiles.every(profile => value.publicTopics.includes(profile.publicTopic) && profile.sourceUrls.length > 0 && profile.sourceUrls.every(url => value.sourceUrls.includes(url))))));
const coverageSchema = z.array(z.object({ orderLineId: id, orderId: id, productId: id, unit: text, needDate: z.string().nullable(), quantity: z.number().finite().nonnegative(), covered: z.number().finite().nonnegative(), shortage: z.number().finite().nonnegative(), unknowns: z.array(text) }));

function record(value: JsonValue | undefined): Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function equivalentJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value: unknown, index: number) => equivalentJson(value, right[index]));
  const first = left as Record<string, unknown>; const second = right as Record<string, unknown>;
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => Object.hasOwn(second, key) && equivalentJson(first[key], second[key]));
}

function sameCaseRef(left: CaseRef | undefined, right: CaseRef | undefined): boolean {
  return left?.caseId === right?.caseId && left?.caseRevision === right?.caseRevision;
}

function sourceView(observation: SourceEvidence, evidenceRef?: EvidenceRef): SourceView {
  const provenance = observation.provenance;
  return { id: observation.id, title: observation.title, url: observation.url, kind: "public", status: "success", collectedAt: observation.collectedAt, ...(observation.publishedAt ? { publishedAt: observation.publishedAt } : {}), mode: observation.mode, observation: structuredClone(observation), ...(evidenceRef ? { evidenceRef: { ...evidenceRef } } : {}),
    ...(provenance ? { note: `${provenance.provider === "boamp" ? "BOAMP" : "Keenable"} · ${({ search_snippet: "search excerpt", fetch: "fetched page", api_record: "API record" })[provenance.method]}${provenance.truncated ? " · truncated content" : ""}.` } : {}),
  };
}

function label(table: Record<string, JsonValue>[], identifier: JsonValue | undefined, key = "label"): string {
  const row = table.find(item => item.id === identifier);
  const value = row?.[key];
  return typeof value === "string" ? value : typeof identifier === "string" ? identifier : "Not provided";
}

function displayUnit(value: JsonValue | undefined, quantity: JsonValue | undefined): string {
  if (value === "palette" || value === "palettes") return quantity === 1 ? "pallet" : "pallets";
  return typeof value === "string" ? value : "";
}

function describeReason(reason: string): string {
  const [code, reference, amount] = reason.split(":");
  const reasons: Record<string, string> = {
    UNCONFIRMED_INBOUND: "Unconfirmed inbound delivery", MISSING_NEED_DATE: "Missing need date", UNCOVERED: "Uncovered commitment",
    INSUFFICIENT_PHYSICAL_STOCK: "Insufficient physical stock", TRANSPORT_CAPACITY: "Insufficient transport capacity", EXPIRED_QUOTE: "Expired quote",
    SAME_SKU_AND_UNIT: "Same product and unit", NO_STOCK_EFFECT: "No stock effect in this proposal", SERVER_DECISION_REQUIRED: "Server-verified decision required",
    RELATION_UNVERIFIED: "The link between public evidence and our business needs verification", EXTERNAL_RELATION_UNVERIFIED: "The link to the public news remains unverified", HYPOTHETICAL_INBOUND_DELAY: "Calculated under an explicit delivery-delay assumption",
  };
  return reasons[code] ? `${reasons[code]}${reference ? ` (${reference}${amount ? `, shortfall: ${amount}` : ""})` : ""}` : reason;
}

function mapOption(option: BusinessOption, company: ContractCompany): OptionView {
  const tables = company.snapshot.dataset.tables;
  const effects = option.effects;
  const facts: OptionView["facts"] = [];
  if (typeof effects.quantity === "number" && typeof effects.unit === "string") facts.push({ label: "Quantity", value: `${effects.quantity} ${displayUnit(effects.unit, effects.quantity)}` });
  if (typeof effects.productId === "string") facts.push({ label: "Product", value: label(tables.products ?? [], effects.productId) });
  if (typeof effects.fromDepotId === "string") facts.push({ label: "From", value: label(tables.depots ?? [], effects.fromDepotId) });
  if (typeof effects.toDepotId === "string") facts.push({ label: "To", value: label(tables.depots ?? [], effects.toDepotId) });
  if (typeof effects.arrivalDate === "string") facts.push({ label: "Calculated arrival", value: formatDate(effects.arrivalDate, false) });
  return { id: option.id, title: option.label, summary: option.reasons.map(describeReason).join(". ") || (option.status === "feasible" ? "Feasible according to this evaluation." : "Review this option’s conditions."), status: option.status === "rejected" ? "blocked" : option.status, costEur: option.costEur, facts, conditions: option.conditions.map(describeReason) };
}

function mapTrace(trace: ToolTrace, run: AgentRun): ToolView {
  const output = record(trace.output);
  const result = record(output.result);
  const state = typeof result.status === "string" ? result.status : output.status;
  const failed = output.isError === true || typeof result.error === "string" || state === "error" || state === "uncertain";
  const manifest = z.object({ companyId: id, revision: id, policyVersion: id, assembledAt: date, snapshotAsOf: date, contractVersion: z.literal(CONTRACT_VERSION), toolsVersion: z.enum(["agent-tools/1", "agent-tools/2", "agent-tools/3"]), memoryIds: z.array(id), caseRef: caseRefSchema.optional(), researchScope: z.object({ profileId: id, profileVersion: id, namespace: z.enum(["live", "controlled"]) }).optional(), evidenceRef: evidenceRefSchema.optional() }).strict().safeParse(trace.output);
  const manifestRecorded = trace.tool === "context_manifest" && manifest.success && !failed && manifest.data.companyId === run.companyId && manifest.data.revision === run.revision && manifest.data.policyVersion === run.policyVersion && equivalentJson(manifest.data.caseRef, run.caseRef) && equivalentJson(manifest.data.researchScope, "researchScope" in run ? run.researchScope : undefined);
  const status: ToolView["status"] = trace.tool === "context_manifest" ? manifestRecorded ? "recorded" : "unknown" : failed ? "error" : state === "not_run" ? "not_run" : trace.tool === "model_intent" ? "intent" : ["running", "queued", "started"].includes(String(state)) ? "running" : output.isError === false && typeof output.callId === "string" && "result" in output ? "success" : ["success", "completed", "tool_calls", "needs_input", "end"].includes(String(state)) ? "success" : "unknown";
  const names: Record<string, string> = { read_research_context: "Reading saved research", refresh_research_context: "Refreshing research sources", read_company_context: "Reading company context", read_commitments: "Reading commitments", read_observation_context: "Reading public evidence and business link", evaluate_options: "Calculating options", prepare_proposal: "Preparing proposal", recall_decisions: "Recalling decisions", context_manifest: "Context assembled", model_intent: "Model request", model_result: "Model response" };
  let summary = status === "error" ? "The call did not return a usable result." : status === "not_run" ? "This call was not run." : status === "success" ? "Result received." : "Completion of this call is unconfirmed.";
  if (typeof output.callId === "string") summary += ` Call: ${output.callId}.`;
  if (typeof result.error === "string") summary += ` Code: ${result.error}.`;
  if (Array.isArray(result.options)) summary += ` ${result.options.length} option(s) calculated.`;
  if (typeof result.proposalId === "string") summary += ` Proposal: ${result.proposalId}.`;
  if (trace.tool === "model_intent") summary = "Call intent recorded. This does not prove a provider response.";
  if (trace.tool === "model_result" && typeof output.status === "string") summary = `Provider status: ${output.status}.`;
  if (typeof result.reused === "boolean") summary += result.reused ? " Saved research reused." : " Reuse not reported for this read.";
  if (typeof result.externalCalls === "number") summary += ` External source calls reported: ${result.externalCalls}.`;
  if (trace.tool === "context_manifest") summary = manifestRecorded ? "Recorded locally with the company, policy and revision used by this analysis. This is not a provider request." : manifest.success ? "The local context record does not confirm this analysis." : "The local context record is incomplete.";
  return { id: trace.id, name: names[trace.tool] ?? trace.tool, status, summary };
}

function mapRun(run: AgentRun): RunView {
  return { id: run.id, question: run.question, status: run.status, createdAt: run.createdAt, tools: run.traces.map(trace => mapTrace(trace, run)), ...(run.industrialScope ? { industrialScope: { ...run.industrialScope } } : {}), ...(run.industrialBasis ? { industrialBasis: structuredClone(run.industrialBasis) } : {}), ...(run.industrialIntentId ? { industrialIntentId: run.industrialIntentId } : {}), ...(run.industrialReportId ? { industrialReportId: run.industrialReportId } : {}), executionMode: run.mode, ...(run.caseRef ? { caseRef: { ...run.caseRef } } : {}), ...(run.researchScope ? { researchScope: { ...run.researchScope } } : {}), ...(run.researchDependencies ? { researchDependencies: structuredClone(run.researchDependencies) } : {}), ...(run.researchResult ? { researchResult: structuredClone(run.researchResult) } : {}), ...(run.model ? { model: run.model } : {}), ...(run.message ? { message: presentMessage(run.message) } : {}), ...(run.proposalId ? { proposalId: run.proposalId } : {}) };
}

function mapProposal(proposal: Proposal, company: ContractCompany, run: AgentRun | undefined, cases: DecisionCase[]): ProposalView {
  const tables = company.snapshot.dataset.tables;
  const coverage = coverageSchema.safeParse(proposal.evaluation.facts.coverage);
  const actualCoverage = coverageSchema.safeParse(proposal.evaluation.facts.actualCoverage);
  const current = cases.find(item => item.id === proposal.caseRef?.caseId);
  const exactCase = current && current.caseRevision === proposal.caseRef?.caseRevision ? current : undefined;
  const confirmed = exactCase?.confirmation;
  const confirmationCurrent = confirmed && confirmed.companyId === proposal.companyId && confirmed.caseId === exactCase.id && confirmed.caseRevision === exactCase.caseRevision && confirmed.businessRevision === proposal.revision && confirmed.policyVersion === proposal.policyVersion && confirmed.productId === exactCase.relation.productId && !exactCase.riskAssumption && proposal.evaluation.facts.coverageBasis === "confirmed_internal_synthetic" && equivalentJson(proposal.evaluation.facts.confirmation, confirmed) && equivalentJson(proposal.evaluation.facts.caseRef, proposal.caseRef);
  const exposures = (items: z.infer<typeof coverageSchema>): ProposalView["exposures"] => items.map(item => ({ id: item.orderLineId, label: label(tables.orders ?? [], item.orderId, "site"), detail: `${item.quantity} ${displayUnit(item.unit, item.quantity)} · needed ${formatDate(item.needDate ?? undefined, false)} · covered: ${item.covered}`, state: item.needDate === null ? "unknown" : item.shortage > 0 ? "exposed" : "covered" }));
  const sources: SourceView[] = [{ id: `company:${proposal.revision}`, title: `Company context · ${proposal.revision}`, kind: "synthetic", status: "success", note: `Synthetic dataset evaluated on ${formatDate(proposal.evaluation.evaluatedAt)}. Policy ${proposal.policyVersion}.` }];
  if (exactCase) sources.unshift(sourceView(exactCase.observation));
  return {
    id: proposal.id, runId: proposal.runId, title: proposal.title, summary: proposal.summary, status: proposal.status, revision: proposal.revision, policyVersion: proposal.policyVersion, createdAt: proposal.createdAt, dataOrigin: "synthetic",
    sources, options: proposal.evaluation.options.map(option => mapOption(option, company)), conditions: proposal.conditions.map(describeReason), unknowns: proposal.evaluation.unknowns.map(describeReason), constraints: proposal.evaluation.constraints.map(describeReason), tools: run?.traces.map(trace => mapTrace(trace, run)) ?? [],
    ...(proposal.caseRef ? { caseRef: { ...proposal.caseRef }, caseCurrent: exactCase !== undefined && exactCase.businessRevision === company.snapshot.revision && exactCase.policyVersion === company.snapshot.policyVersion, ...(!confirmationCurrent ? { approvalBlockedReason: "The link to our business needs verification. Approval requires a confirmed internal fact in the simulation." } : {}) } : {}),
    ...(proposal.researchDependencies ? { researchDependencies: structuredClone(proposal.researchDependencies), testOnly: proposal.researchDependencies.some(item => item.scope.namespace === "controlled") } : {}),
    ...(!run ? { decisionBlockedReason: "The historical analysis is unavailable. This proposal is readable, but decisions are suspended until its trace is received." } : {}),
    ...(proposal.optionId ? { decisionOptionId: proposal.optionId } : {}), ...(run ? { executionMode: run.mode } : {}),
    exposures: coverage.success ? exposures(coverage.data) : [],
    ...(actualCoverage.success && proposal.evaluation.facts.coverageBasis === "declared_hypothetical_inbound_delay" ? { actualExposures: exposures(actualCoverage.data) } : {}),
    ...(proposal.status === "approved" ? { decisionNote: "Approval recorded by the server. No purchase or stock transfer is confirmed by this status." } : proposal.status === "rejected" ? { decisionNote: "Rejection recorded by the server." } : {}),
  };
}

function mapWatch(watch: Watch, occurrences: DecisionsView["occurrences"]): WatchView {
  const last = occurrences.filter(item => item.watchId === watch.id).sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt))[0];
  const sources: SourceView[] = last?.result?.sources.flatMap((source, index) => {
    const note = source.error === "BOUNDED_OR_INVALID_RECORDS" ? "Partial collection: result limit reached or incomplete notices." : source.error;
    return source.evidence.length > 0 ? source.evidence.map(evidence => ({ ...sourceView(evidence, last.status === "completed" && evidence.mode === "direct" && /^[a-f0-9]{64}$/.test(evidence.contentHash) ? { occurrenceId: last.id, evidenceId: evidence.id, contentHash: evidence.contentHash } : undefined), status: source.status, ...(note ? { note: [note, sourceView(evidence).note].filter(Boolean).join(" ") } : {}) })) : [{ id: `${watch.id}:source:${index}`, title: source.url, url: source.url, kind: "public" as const, status: source.status, ...(note ? { note } : {}) }];
  }) ?? watch.sourceUrls.map((url, index) => ({ id: `${watch.id}:unread:${index}`, title: url, url, kind: "public", status: "not_run" }));
  return { id: watch.id, topic: watch.publicTopic, cadenceMinutes: watch.cadenceMinutes, status: !watch.enabled ? "paused" : last?.status === "error" ? "error" : "active", nextCheckAt: watch.nextRunAt, sources,
    ...(last?.completedAt ? { lastCheckedAt: last.completedAt } : {}), ...(last?.error ? { message: last.error } : last?.result ? { message: `Collection: ${last.result.status}. ${last.result.sources.length} source(s).` } : {}),
  };
}

export function projectWorkspace(company: ContractCompany, decisions: DecisionsView): WorkspaceView {
  const snapshot = company.snapshot;
  const sameScope = snapshot.dataset.company_id === snapshot.companyId && snapshot.policy.company_id === snapshot.companyId && snapshot.dataset.snapshot_revision === snapshot.revision && (!company.actor || company.actor.companyId === snapshot.companyId)
    && [...decisions.proposals, ...decisions.runs, ...decisions.watches, ...decisions.occurrences, ...(decisions.cases ?? [])].every(item => item.companyId === snapshot.companyId)
    && decisions.proposals.every(item => item.evaluation.companyId === item.companyId && item.evaluation.revision === item.revision && item.evaluation.policyVersion === item.policyVersion);
  if (!sameScope) throw new UiError("INVALID_SCOPE", "The response does not match the received company context.");
  for (const proposal of decisions.proposals) {
    const run = decisions.runs.find(item => item.id === proposal.runId);
    if (run && (run.revision !== proposal.revision || run.policyVersion !== proposal.policyVersion || run.proposalId !== proposal.id || !sameCaseRef(run.caseRef, proposal.caseRef) || !equivalentJson(run.researchDependencies, proposal.researchDependencies))) throw new UiError("INVALID_CORRELATION", "The proposal and analysis trace do not match.");
  }
  const actor = company.actor;
  return { company: { id: snapshot.companyId, name: label(snapshot.dataset.tables.company ?? [], snapshot.companyId, "name"), revision: snapshot.revision, policyVersion: snapshot.policyVersion, dataOrigin: "synthetic", asOf: snapshot.dataset.as_of,
    actor: actor ? { id: actor.actorId, name: label(snapshot.dataset.tables.employees ?? [], actor.actorId, "name"), role: actor.role } : null, canDecide: actor !== null && ["direction", "achats"].includes(actor.role) },
    proposals: decisions.proposals.map(proposal => mapProposal(proposal, company, decisions.runs.find(run => run.id === proposal.runId), decisions.cases ?? [])), runs: decisions.runs.map(mapRun), watches: decisions.watches.map(watch => mapWatch(watch, decisions.occurrences)), memory: [], cases: structuredClone(decisions.cases ?? []),
    catalog: {
      products: (snapshot.dataset.tables.products ?? []).flatMap(row => typeof row.id === "string" ? [{ id: row.id, label: label(snapshot.dataset.tables.products ?? [], row.id) }] : []),
      suppliers: (snapshot.dataset.tables.suppliers ?? []).flatMap(row => typeof row.id === "string" ? [{ id: row.id, label: label(snapshot.dataset.tables.suppliers ?? [], row.id, "name") }] : []),
      commitments: (snapshot.dataset.tables.order_lines ?? []).flatMap(row => {
        const order = snapshot.dataset.tables.orders?.find(value => value.id === row.order_id);
        const needDate = order?.need_date;
        return typeof row.id === "string" ? [{ id: row.id, label: `${label(snapshot.dataset.tables.orders ?? [], row.order_id, "site")} · ${String(row.quantity ?? "?")} ${displayUnit(row.unit, row.quantity)} · needed ${formatDate(typeof needDate === "string" ? needDate : undefined, false)}` }] : [];
      }),
      inbound: (snapshot.dataset.tables.purchase_order_lines ?? []).flatMap(row => {
        const purchase = snapshot.dataset.tables.purchase_orders?.find(item => item.id === row.purchase_order_id);
        return typeof row.id === "string" && typeof row.product_id === "string" ? [{ id: row.id, productId: row.product_id, supplierId: typeof purchase?.supplier_id === "string" ? purchase.supplier_id : null, expectedDate: typeof row.expected_date === "string" ? row.expected_date : null, label: `${String(row.purchase_order_id)} · ${label(snapshot.dataset.tables.products ?? [], row.product_id)} · ${String(row.quantity ?? "?")} ${displayUnit(row.unit, row.quantity)} · expected ${formatDate(typeof row.expected_date === "string" ? row.expected_date : undefined, false)}` }] : [];
      }),
    },
  };
}

export interface HttpUiOptions { fetch?: typeof fetch; timeoutMs?: number }

export function createHttpUiApi(options: HttpUiOptions = {}): UiApi {
  let lastWorkspace: WorkspaceView | undefined;
  let lastCompany: ContractCompany | undefined;
  let lastDecisions: DecisionsView | undefined;
  let watchCapabilities: WatchCapabilitiesView | undefined;
  let capabilitiesRequest = 0;
  let workspaceRequest = 0;
  let sessionEpoch = 0;
  const historicalRuns = new Map<string, AgentRun>();
  function invalidateContext(): void {
    workspaceRequest++; sessionEpoch++; lastWorkspace = undefined; lastCompany = undefined; lastDecisions = undefined; historicalRuns.clear();
  }
  const request = async <T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal, method?: string): Promise<T> => {
    const mutation = body !== undefined || method === "DELETE";
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
    try {
      const response = await (options.fetch ?? globalThis.fetch)(path, { method: method ?? (mutation ? "POST" : "GET"), credentials: "same-origin", headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      const envelope: unknown = await response.json();
      const failed = z.object({ data: z.null(), error: errorSchema }).safeParse(envelope);
      if (failed.success) throw new UiError(failed.data.error.code, failed.data.error.message, mutation && response.status >= 500 && failed.data.error.code !== "NOT_READY");
      if (!response.ok) throw new UiError("HTTP_ERROR", `The service refused the request (${response.status}).`, mutation && response.status >= 500);
      const parsed = z.object({ data: schema, error: z.null() }).safeParse(envelope);
      if (!parsed.success) throw new UiError("INVALID_RESPONSE", "The service response is incomplete or incompatible. Success is unconfirmed.", mutation);
      return parsed.data.data;
    } catch (error) {
      if (error instanceof UiError) throw error;
      throw new UiError("NETWORK_ERROR", "No service response received.", mutation);
    }
  };
  function caseContext(): ContractCompany & { actor: NonNullable<ContractCompany["actor"]> } {
    const context = lastCompany;
    if (!context?.actor || !["direction", "achats"].includes(context.actor.role)) throw new UiError("AUTH_REQUIRED", "A director or purchasing session is required.");
    return { ...context, actor: context.actor };
  }
  function researchContextFor(profileId: string): ContractCompany & { actor: NonNullable<ContractCompany["actor"]> } {
    caseIdentity.parse(profileId);
    const context = lastCompany;
    if (!context?.actor) throw new UiError("AUTH_REQUIRED", "Sign in to read saved research.");
    if (!watchCapabilities?.profiles?.some(profile => profile.id === profileId)) throw new UiError("RESEARCH_PROFILE", "Choose a research profile advertised by the server.");
    return { ...context, actor: context.actor };
  }
  function knownProof(input: CaseInput): SourceEvidence {
    const matches = (lastDecisions?.occurrences ?? []).filter(item => item.id === input.evidenceRef.occurrenceId && item.status === "completed").flatMap(item => item.result?.sources.flatMap(source => source.evidence) ?? []).filter(item => item.id === input.evidenceRef.evidenceId);
    const retained = (lastDecisions?.cases ?? []).filter(item => equivalentJson(item.evidenceRef, input.evidenceRef)).map(item => item.observation);
    const proof = matches.length === 1 ? matches[0] : matches.length === 0 ? retained[0] : undefined;
    if (!proof || proof.contentHash !== input.evidenceRef.contentHash || proof.mode !== "direct") throw new UiError("EVIDENCE_NOT_RECEIVED", "Choose evidence from a completed collection.");
    return proof;
  }
  function validateCaseReceipt(value: DecisionCase, input: CaseInput, context: ContractCompany & { actor: NonNullable<ContractCompany["actor"]> }, proof: SourceEvidence): void {
    if (value.companyId !== context.snapshot.companyId || value.actorId !== context.actor.actorId || !equivalentJson(value.evidenceRef, input.evidenceRef) || !equivalentJson(value.observation, proof) || !equivalentJson(value.relation, input.relation) || !equivalentJson(value.riskAssumption, input.riskAssumption)) throw new UiError("INVALID_RECEIPT", "The receipt does not match this case request. Refresh before retrying.", true);
  }
  async function readCaseHistory(identifier: string, signal?: AbortSignal): Promise<{ current: DecisionCase; versions: DecisionCase[] }> {
    caseIdentity.parse(identifier);
    const companyId = lastCompany?.snapshot.companyId;
    if (!companyId) throw new UiError("NO_CONTEXT", "Refresh the context before reading the case.");
    const result = await request(`/api/cases/${encodeURIComponent(identifier)}`, z.object({ current: caseSchema, versions: z.array(caseSchema) }), undefined, signal);
    if ([result.current, ...result.versions].some(item => item.id !== identifier || item.companyId !== companyId) || !result.versions.some(item => equivalentJson(item, result.current))) throw new UiError("INVALID_SCOPE", "The history does not match this case.");
    return result;
  }
  return {
    ...createIndustrialApi({ request, schemas: industrialSchemas, runSchema, projectRun: mapRun, authority: () => {
      if (!lastCompany?.actor) throw new UiError("AUTH_REQUIRED", "Sign in to read the company briefing.");
      return { actor: { ...lastCompany.actor }, sessionEpoch };
    } }),
    async readWatchCapabilities(signal): Promise<WatchCapabilitiesView> {
      const requestNumber = ++capabilitiesRequest;
      watchCapabilities = undefined;
      const result = await request("/api/watch-capabilities", watchCapabilitiesSchema, undefined, signal);
      if (signal?.aborted || requestNumber !== capabilitiesRequest) throw new UiError("WATCH_CAPABILITIES", "The topic request was replaced. Retry.");
      watchCapabilities = structuredClone(result);
      return result;
    },
    async readWorkspace(signal): Promise<WorkspaceView> {
      const requestNumber = ++workspaceRequest;
      const [company, decisions] = await Promise.all([request("/api/company", companySchema, undefined, signal), request("/api/decisions", decisionsSchema, undefined, signal)]);
      const missing = [...new Set(decisions.proposals.filter(proposal => !decisions.runs.some(run => run.id === proposal.runId)).map(proposal => proposal.runId))];
      const received = await Promise.all(missing.map(async identifier => {
        const cached = historicalRuns.get(identifier);
        if (cached?.companyId === company.snapshot.companyId) return cached;
        try {
          const run = await request(`/api/runs/${encodeURIComponent(identifier)}`, runSchema, undefined, signal);
          if (run.id !== identifier || run.companyId !== company.snapshot.companyId) return undefined;
          return run;
        } catch { return undefined; }
      }));
      decisions.runs.push(...received.filter((run): run is AgentRun => run !== undefined));
      const view = projectWorkspace(company, decisions);
      if (!signal?.aborted && requestNumber === workspaceRequest) {
        lastWorkspace = view; lastCompany = company; lastDecisions = decisions;
        for (const run of received) if (run && !["queued", "running"].includes(run.status)) historicalRuns.set(run.id, structuredClone(run));
        while (historicalRuns.size > 200) historicalRuns.delete(historicalRuns.keys().next().value!);
      }
      return view;
    },
    async readResearch(profileId, namespace, signal): Promise<ResearchContext> {
      z.enum(["live", "controlled"]).parse(namespace);
      const context = researchContextFor(profileId); const epoch = sessionEpoch;
      const value = await request(`/api/research/${encodeURIComponent(profileId)}?namespace=${namespace}`, researchSchemas.context, undefined, signal);
      if (epoch !== sessionEpoch || lastCompany?.actor?.actorId !== context.actor.actorId || lastCompany.snapshot.companyId !== context.snapshot.companyId) throw new UiError("SESSION_CHANGED", "The session changed. Reload saved research.");
      if (value.companyId !== context.snapshot.companyId || value.scope.profileId !== profileId || value.scope.namespace !== namespace) throw new UiError("INVALID_SCOPE", "The research does not match this company and profile.");
      return value;
    },
    async analyzeResearch(profileId, input): Promise<RunView> {
      const context = researchContextFor(profileId); caseContext(); const epoch = sessionEpoch;
      const body = z.object({ question: z.string().trim().min(1).max(3000), operationKey: operationKeySchema, namespace: z.enum(["live", "controlled"]) }).strict().parse({ question: input.question, operationKey: input.idempotencyKey, namespace: input.namespace });
      const run = await request(`/api/research/${encodeURIComponent(profileId)}/analyze`, runSchema, body);
      if (epoch !== sessionEpoch || lastCompany?.actor?.actorId !== context.actor.actorId || lastCompany.snapshot.companyId !== context.snapshot.companyId || run.companyId !== context.snapshot.companyId || run.actorId !== context.actor.actorId || run.operationKey !== body.operationKey || run.question !== body.question || run.caseRef || run.researchScope?.profileId !== profileId || run.researchScope.namespace !== body.namespace) throw new UiError("INVALID_RECEIPT", "The receipt does not match this research request. Reload before retrying.", true);
      return mapRun(run);
    },
    async askQuestion(input): Promise<RunView> {
      const body = z.object({ question: z.string().trim().min(1).max(3000), operationKey: id }).parse({ question: input.question, operationKey: input.idempotencyKey });
      const context = lastCompany;
      if (!context?.actor) throw new UiError("AUTH_REQUIRED", "Sign in to ask a question.");
      const run = await request("/api/questions", runSchema, body);
      if (run.companyId !== context.snapshot.companyId || run.actorId !== context.actor.actorId || run.operationKey !== body.operationKey || run.question !== body.question || run.researchScope || run.industrialScope) throw new UiError("INVALID_RECEIPT", "The receipt does not match your question. Refresh to check the analysis.", true);
      return mapRun(run);
    },
    async createWatch(input): Promise<WatchView> {
      const body = z.object({ publicTopic: z.string().trim().min(3).max(200), sourceUrls: z.array(z.string().refine(value => safeSourceUrl(value) !== undefined)).min(1).max(3), cadenceMinutes: z.number().int().min(1).max(10080) }).parse({ publicTopic: input.topic, sourceUrls: input.sourceUrls, cadenceMinutes: input.cadenceMinutes });
      const capabilities = watchCapabilities;
      const allowedSources = capabilities?.profiles?.find(profile => profile.publicTopic === body.publicTopic)?.sourceUrls ?? capabilities?.sourceUrls;
      if (!capabilities || !allowedSources || !capabilities.publicTopics.includes(body.publicTopic) || body.sourceUrls.some(url => !allowedSources.includes(url)) || body.cadenceMinutes < capabilities.minimumCadenceMinutes || body.cadenceMinutes > capabilities.maximumCadenceMinutes) throw new UiError("WATCH_CAPABILITIES", "Choose a topic, source and frequency offered by the server.");
      const context = lastCompany;
      if (!context?.actor) throw new UiError("AUTH_REQUIRED", "Sign in to create a watch.");
      const watch = await request("/api/watches", watchSchema, body);
      if (watch.companyId !== context.snapshot.companyId || watch.actorId !== context.actor.actorId || watch.publicTopic !== body.publicTopic || watch.cadenceMinutes !== body.cadenceMinutes || !equivalentJson(watch.sourceUrls.map(safeSourceUrl), body.sourceUrls.map(safeSourceUrl))) throw new UiError("INVALID_RECEIPT", "The receipt does not match this watch. Refresh to check its status.", true);
      return mapWatch(watch, []);
    },
    async readCase(identifier, signal): Promise<{ current: DecisionCase; versions: DecisionCase[] }> { return await readCaseHistory(identifier, signal); },
    async createCase(input): Promise<DecisionCase> {
      const body = caseInputSchema.parse(input); const context = caseContext(); const proof = knownProof(body);
      const value = await request("/api/cases", caseSchema, body);
      validateCaseReceipt(value, body, context, proof);
      if (value.previousRevision !== null) throw new UiError("INVALID_RECEIPT", "This receipt does not match a new case.", true);
      return value;
    },
    async reviseCase(identifier, input): Promise<DecisionCase> {
      caseIdentity.parse(identifier);
      const body = caseInputSchema.extend({ expectedCaseRevision: caseIdentity }).parse(input); const context = caseContext(); const proof = knownProof(body);
      const current = lastDecisions?.cases?.find(item => item.id === identifier);
      if (!current || current.caseRevision !== body.expectedCaseRevision) throw new UiError("STALE_CONTEXT", "Refresh the case before revising it.");
      const value = await request(`/api/cases/${encodeURIComponent(identifier)}/revise`, caseSchema, body);
      validateCaseReceipt(value, body, context, proof);
      if (value.id !== identifier || value.previousRevision !== body.expectedCaseRevision || value.caseRevision === body.expectedCaseRevision) throw new UiError("INVALID_RECEIPT", "The new version does not match this case.", true);
      return value;
    },
    async analyzeCase(identifier, input): Promise<RunView> {
      caseIdentity.parse(identifier);
      const body = z.object({ expectedCaseRevision: caseIdentity, question: z.string().trim().min(1).max(3000), operationKey: operationKeySchema }).strict().parse(input);
      const context = caseContext(); const current = lastDecisions?.cases?.find(item => item.id === identifier);
      if (!current || current.caseRevision !== body.expectedCaseRevision) throw new UiError("STALE_CONTEXT", "Refresh the case before analyzing it.");
      const run = await request(`/api/cases/${encodeURIComponent(identifier)}/analyze`, runSchema, body);
      if (run.companyId !== context.snapshot.companyId || run.actorId !== context.actor.actorId || run.operationKey !== body.operationKey || run.question !== body.question || run.caseRef?.caseId !== identifier) throw new UiError("INVALID_RECEIPT", "The receipt does not match this case analysis.", true);
      let receivedCase = current;
      if (run.caseRef.caseRevision !== body.expectedCaseRevision) {
        try {
          const history = await readCaseHistory(identifier);
          const version = history.versions.find(item => item.caseRevision === run.caseRef?.caseRevision);
          if (!version || version.previousRevision !== body.expectedCaseRevision || version.businessRevision !== run.revision || version.policyVersion !== run.policyVersion || (version.businessRevision === current.businessRevision && version.policyVersion === current.policyVersion) || !equivalentJson(version.evidenceRef, current.evidenceRef) || !equivalentJson(version.relation, current.relation) || !equivalentJson(version.riskAssumption, current.riskAssumption) || !equivalentJson(version.researchDependency, current.researchDependency)) throw new UiError("INVALID_RECEIPT", "The refreshed case version is unconfirmed.", true);
          receivedCase = version;
        } catch { throw new UiError("INVALID_RECEIPT", "Analysis sent, but its case version needs verification. Refresh.", true); }
      } else if (run.revision !== current.businessRevision || run.policyVersion !== current.policyVersion) throw new UiError("INVALID_RECEIPT", "The analysis version does not match the case.", true);
      const dependency = receivedCase.researchDependency;
      if (!equivalentJson(run.researchScope, dependency?.scope) || (run.researchDependencies !== undefined && !equivalentJson(run.researchDependencies, dependency ? [dependency] : [])) || (dependency && run.status === "proposal" && !run.researchDependencies)) throw new UiError("INVALID_RECEIPT", "The analysis research basis does not match this case.", true);
      return mapRun(run);
    },
    async decide(input: DecisionInput): Promise<{ message: string }> {
      const proposal = lastWorkspace?.proposals.find(item => item.id === input.proposalId);
      const expected = lastDecisions?.proposals.find(item => item.id === input.proposalId);
      if (!proposal || !expected || (input.action === "approve" && input.optionId !== proposal.decisionOptionId)) throw new UiError("OPTION_MISMATCH", "The decision must use the option attached to this proposal.");
      if (proposal.decisionBlockedReason) throw new UiError("TRACE_UNAVAILABLE", proposal.decisionBlockedReason);
      if (proposal.caseRef && (!proposal.caseCurrent || (input.action === "approve" && proposal.approvalBlockedReason))) throw new UiError("CASE_NOT_DECIDABLE", proposal.caseCurrent ? proposal.approvalBlockedReason! : "The case has changed. Analyze it again.");
      const body = z.object({ decision: z.enum(["approve", "reject"]), revision: id, policyVersion: id, operationKey: id }).parse({ decision: input.action, revision: input.revision, policyVersion: input.policyVersion, operationKey: input.idempotencyKey });
      const result = await request(`/api/proposals/${encodeURIComponent(input.proposalId)}/decision`, proposalSchema, body);
      if (result.id !== input.proposalId || result.status !== (input.action === "approve" ? "approved" : "rejected") || result.revision !== input.revision || result.policyVersion !== input.policyVersion || result.companyId !== expected.companyId || result.runId !== expected.runId || result.optionId !== expected.optionId || !sameCaseRef(result.caseRef, expected.caseRef) || !equivalentJson(result.researchDependencies, expected.researchDependencies) || !equivalentJson(result.evaluation, expected.evaluation)) throw new UiError("INVALID_RECEIPT", "The receipt does not match this decision. Refresh to check its status.", true);
      return { message: result.status === "approved" ? "Approval recorded. No purchase or transfer executed." : "Rejection recorded." };
    },
    async openSession(token): Promise<void> { invalidateContext(); try { await request("/api/session", z.object({ actor: actorSchema }), { token }); } finally { invalidateContext(); } },
    async closeSession(): Promise<void> { invalidateContext(); try { await request("/api/session", z.object({ closed: z.literal(true) }), undefined, undefined, "DELETE"); } finally { invalidateContext(); } },
  };
}
