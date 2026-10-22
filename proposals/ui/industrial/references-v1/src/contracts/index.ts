/** Canonical shared contract C1. Builders propose extensions in proposals/. */
import type { ResearchDependency, ResearchResult, ResearchScope } from './research.js';
import type { IndustrialBasis, IndustrialQuestionScope, IndustrialReport } from './industrial.js';
import type { PdfRunResult } from './pdf.js';
export const CONTRACT_VERSION = 'C1' as const;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type DataOrigin = 'synthetic' | 'public';
export type ExecutionMode = 'direct' | 'replay' | 'test';
export type Role = 'direction' | 'achats' | 'logistique' | 'operator' | 'analysis_only';
export interface Actor { actorId: string; companyId: string; role: Role; approvalCeilingEur: number }
export interface CompanyDataset {
  schema: string; company_id: string; data_origin: 'synthetic'; snapshot_revision: string;
  as_of: string; tables: Record<string, JsonObject[]>;
}
export interface CompanyPolicy {
  schema?: string; company_id: string; data_origin: 'synthetic';
  rules: { id: string; rule: string }[]; role_approval_note: string;
  agent_context_excludes: string[]; public_search_inputs: string;
}
export interface CompanySnapshot {
  companyId: string; revision: string; policyVersion: string; dataOrigin: 'synthetic';
  dataset: CompanyDataset; policy: CompanyPolicy; updatedAt: string;
}
export interface SourceEvidence {
  id: string; url: string; title: string; content: string; publishedAt: string | null;
  collectedAt: string; contentHash: string; dataOrigin: 'public'; mode: ExecutionMode;
  provenance?: { provider: 'boamp' | 'keenable'; endpoint: string; method: 'search_snippet' | 'fetch' | 'api_record'; profileId: string; indexedAt: string | null; truncated: boolean };
  family?: 'sector' | 'regional' | 'supplier' | 'incident' | 'project' | 'public_contract' | 'regulation_fr' | 'regulation_eu';
  regulation?: { jurisdiction: 'FR' | 'EU'; officialIdentifier: string | null; entryIntoForceAt: string | null; appliesFrom: string | null; deadlineAt: string | null; scope: string | null; applicability: 'to_verify' | 'unknown' };
}
export interface PublicSourceProfile { id: string; label: string; publicTopic: string; family: NonNullable<SourceEvidence['family']>; sourceUrls: string[] }
export interface WatchCapabilities { publicTopics: readonly string[]; sourceUrls: readonly string[]; minimumCadenceMinutes: number; maximumCadenceMinutes: number; profiles?: readonly PublicSourceProfile[] }
export type CollectionStatus = 'success' | 'empty' | 'partial' | 'error' | 'not_run';
export interface SourceResult { url: string; status: CollectionStatus; evidence: SourceEvidence[]; error: string | null }
export interface CollectionResult { status: CollectionStatus; sources: SourceResult[]; startedAt: string; completedAt: string }
export interface BusinessOption {
  id: string; kind: 'transfer' | 'emergency_purchase' | 'wait' | 'request_confirmation';
  label: string; status: 'feasible' | 'conditional' | 'rejected'; costEur: number;
  conditions: string[]; effects: JsonObject; reasons: string[];
}
export interface BusinessEvaluation {
  id: string; companyId: string; revision: string; policyVersion: string; evaluatedAt: string;
  constraints: string[]; unknowns: string[]; options: BusinessOption[]; facts: JsonObject;
}
export interface Proposal {
  id: string; companyId: string; runId: string; revision: string; policyVersion: string;
  evaluation: BusinessEvaluation; optionId: string | null; title: string; summary: string;
  conditions: string[]; status: 'pending' | 'approved' | 'rejected' | 'stale'; createdAt: string;
  caseRef?: CaseRef;
  researchDependencies?: ResearchDependency[];
}
export interface ToolTrace { id: string; tool: string; input: JsonValue; output: JsonValue; startedAt: string; completedAt: string }
export type RunStatus = 'queued' | 'running' | 'proposal' | 'needs_input' | 'stale_context' | 'error' | 'budget_exhausted' | 'uncertain';
export interface AgentRun {
  id: string; companyId: string; actorId: string; operationKey: string; question: string;
  status: RunStatus; revision: string; policyVersion: string; mode: ExecutionMode;
  model: string | null; proposalId: string | null; message: string | null; traces: ToolTrace[];
  createdAt: string; completedAt: string | null;
  caseRef?: CaseRef;
  researchScope?: ResearchScope;
  researchDependencies?: ResearchDependency[];
  researchResult?: ResearchResult;
  industrialScope?: IndustrialQuestionScope;
  industrialBasis?: IndustrialBasis;
  industrialIntentId?: string;
  industrialReportId?: string;
  pdfProfileId?: string;
  pdfResult?: PdfRunResult;
}
export interface AttributedMemory {
  id: string; companyId: string; actorId: string; proposalId: string; revision: string;
  policyVersion: string; content: string; conditions: string[]; createdAt: string;
  caseRef?: CaseRef;
  researchDependencies?: ResearchDependency[];
  testOnly?: boolean;
}
export interface CaseRef { caseId: string; caseRevision: string }
export interface EvidenceRef { occurrenceId: string; evidenceId: string; contentHash: string }
export interface CaseRelation { status: 'unverified' | 'none'; productId: string | null; supplierId: string | null; basis: string }
export interface RiskAssumption { kind: 'inbound_delay'; purchaseOrderLineId: string; assumedExpectedDate: string | null; basis: string }
export interface InternalConfirmation {
  kind: 'inbound_date_confirmed'; eventId: string; companyId: string; caseId: string; caseRevision: string;
  purchaseOrderLineId: string; productId: string; previousExpectedDate: string | null; confirmedExpectedDate: string;
  actorId: string; confirmedAt: string; basis: string; businessRevision: string; policyVersion: string; dataOrigin: 'synthetic';
  exposureOrderLineIds?: string[];
}
export interface CaseConfirmationInput { expectedRevision: string; expectedCaseRevision: string; purchaseOrderLineId: string; confirmedExpectedDate: string; basis: string; operationKey: string }
export interface DecisionCase {
  id: string; companyId: string; caseRevision: string; previousRevision: string | null;
  evidenceRef: EvidenceRef; observation: SourceEvidence; relation: CaseRelation;
  candidateOrderLineIds: string[]; businessRevision: string; policyVersion: string;
  qualification: 'to_verify' | 'no_known_exposure'; actorId: string; createdAt: string;
  impactKind: 'risk' | 'undetermined'; riskAssumption?: RiskAssumption;
  confirmation?: InternalConfirmation;
  testOnly?: boolean;
  researchDependency?: ResearchDependency;
}
export interface ReleasedCaseContext {
  ref: CaseRef; evidenceRef: EvidenceRef; observation: SourceEvidence; relation: CaseRelation;
  candidateOrderLineIds: string[]; businessRevision: string; policyVersion: string;
  qualification: DecisionCase['qualification'];
  impactKind: DecisionCase['impactKind']; riskAssumption?: RiskAssumption;
  confirmation?: InternalConfirmation;
  testOnly?: boolean;
  researchDependency?: ResearchDependency;
}
export interface CaseInput { evidenceRef: EvidenceRef; relation: CaseRelation; operationKey: string; riskAssumption?: RiskAssumption }
export interface CaseRevisionInput extends CaseInput { expectedCaseRevision: string }
export interface CaseAnalysisInput { expectedCaseRevision: string; question: string; operationKey: string }
export interface Watch {
  id: string; companyId: string; actorId: string; publicTopic: string; sourceUrls: string[];
  cadenceMinutes: number; enabled: boolean; nextRunAt: string; createdAt: string;
}
export interface WatchOccurrence {
  id: string; watchId: string; companyId: string; operationKey: string; status: 'queued' | 'running' | 'completed' | 'error';
  scheduledAt: string; startedAt: string | null; completedAt: string | null;
  fence: number; leaseUntil: string | null; result: CollectionResult | null; error: string | null;
}
export interface QuestionInput { question: string; operationKey: string }
export interface DecisionInput { decision: 'approve' | 'reject'; revision: string; policyVersion: string; operationKey: string }
export interface WatchInput { publicTopic: string; sourceUrls: string[]; cadenceMinutes: number }
export interface ApiError { code: string; message: string }
export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };
export interface CompanyView { snapshot: CompanySnapshot; actor: Actor | null; contractVersion: typeof CONTRACT_VERSION }
export interface DecisionsView { proposals: Proposal[]; runs: AgentRun[]; watches: Watch[]; occurrences: WatchOccurrence[]; cases?: DecisionCase[] }
export interface SqlResult<T> { rows: T[]; rowCount: number | null }
export interface SqlPort { query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> }
export interface AgentRunnerInput { actor: Actor; snapshot: CompanySnapshot; run: AgentRun; memories: AttributedMemory[]; caseContext?: ReleasedCaseContext }
export interface AgentRunnerResult {
  status: Exclude<RunStatus, 'queued' | 'running'>; proposal: Proposal | null;
  traces: ToolTrace[]; message: string; model: string | null;
  researchDependencies?: ResearchDependency[];
  researchResult?: ResearchResult;
  industrialReport?: IndustrialReport;
  pdfResult?: PdfRunResult;
}
export type AgentRunner = (input: AgentRunnerInput) => Promise<AgentRunnerResult>;
export type BusinessEngine = (snapshot: CompanySnapshot) => BusinessEvaluation;
export interface CollectorInput { publicTopic: string; sourceUrls: string[]; signal?: AbortSignal }
export type Collector = (input: CollectorInput) => Promise<CollectionResult>;
