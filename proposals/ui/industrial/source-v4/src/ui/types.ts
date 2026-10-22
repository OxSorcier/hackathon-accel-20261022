import type { CaseAnalysisInput, CaseInput, CaseRef, CaseRevisionInput, DecisionCase, EvidenceRef, SourceEvidence } from "../contracts/index.js";
import type { ResearchContext, ResearchDependency, ResearchResult, ResearchScope } from "../contracts/research.js";
import type { IndustrialDecisionInput, IndustrialReportView, IndustrialSimulationInput, IndustrialWorkspace } from "../contracts/industrial-api.js";
import type { IndustrialApproval, IndustrialDemoExecution, IndustrialQuestionScope, IndustrialBasis } from "../contracts/industrial.js";

export type Revision = string | number;
export type DataOrigin = "synthetic" | "live" | "replay";
export type Tone = "neutral" | "good" | "warning" | "danger" | "info";

export interface CompanyView {
  id: string;
  name: string;
  revision: Revision;
  policyVersion: string;
  asOf: string;
  dataOrigin: DataOrigin;
  actor: { id?: string; name: string; role: string } | null;
  canDecide: boolean;
}

export interface SourceView {
  id: string;
  title: string;
  url?: string;
  kind: "public" | "company" | "synthetic";
  status: "success" | "empty" | "partial" | "error" | "not_run";
  collectedAt?: string;
  publishedAt?: string;
  note?: string;
  mode?: "direct" | "replay" | "test";
  evidenceRef?: EvidenceRef;
  observation?: SourceEvidence;
}

export interface ToolView {
  id: string;
  name: string;
  status: "success" | "error" | "running" | "not_run" | "intent" | "unknown" | "recorded";
  summary: string;
}

export interface OptionView {
  id: string;
  title: string;
  summary: string;
  status: "feasible" | "conditional" | "blocked";
  costEur?: number;
  facts: { label: string; value: string }[];
  conditions: string[];
}

export interface ProposalView {
  id: string;
  runId: string;
  title: string;
  summary: string;
  status: "pending" | "approved" | "rejected" | "stale";
  revision: Revision;
  policyVersion: string;
  createdAt: string;
  dataOrigin: DataOrigin;
  sources: SourceView[];
  exposures: { id: string; label: string; detail: string; state: "exposed" | "watch" | "covered" | "unknown" }[];
  options: OptionView[];
  conditions: string[];
  unknowns: string[];
  constraints: string[];
  decisionOptionId?: string;
  executionMode?: "direct" | "replay" | "test";
  tools: ToolView[];
  decisionNote?: string;
  caseRef?: CaseRef;
  caseCurrent?: boolean;
  approvalBlockedReason?: string;
  decisionBlockedReason?: string;
  actualExposures?: ProposalView["exposures"];
  researchDependencies?: ResearchDependency[];
  testOnly?: boolean;
}

export interface RunView {
  industrialScope?: IndustrialQuestionScope;
  industrialBasis?: IndustrialBasis;
  industrialIntentId?: string;
  industrialReportId?: string;
  id: string;
  question: string;
  status: "queued" | "running" | "proposal" | "needs_input" | "stale_context" | "error" | "budget_exhausted" | "uncertain";
  createdAt: string;
  message?: string;
  proposalId?: string;
  tools: ToolView[];
  executionMode?: "direct" | "replay" | "test";
  model?: string;
  caseRef?: CaseRef;
  researchScope?: ResearchScope;
  researchDependencies?: ResearchDependency[];
  researchResult?: ResearchResult;
}

export interface WatchView {
  id: string;
  topic: string;
  cadenceMinutes: number;
  status: "active" | "draft" | "paused" | "error";
  lastCheckedAt?: string;
  nextCheckAt?: string;
  message?: string;
  sources: SourceView[];
}

export interface WorkspaceView {
  company: CompanyView;
  proposals: ProposalView[];
  runs: RunView[];
  watches: WatchView[];
  memory: { id: string; text: string; author: string; createdAt: string; conditions: string }[];
  cases: DecisionCase[];
  catalog: {
    products: { id: string; label: string }[];
    suppliers: { id: string; label: string }[];
    commitments: { id: string; label: string }[];
    inbound: { id: string; label: string; productId: string; supplierId: string | null; expectedDate: string | null }[];
  };
}

export interface QuestionInput {
  question: string;
  idempotencyKey: string;
}

export interface WatchInput {
  topic: string;
  sourceUrls: string[];
  cadenceMinutes: number;
  idempotencyKey: string;
}

export interface WatchCapabilitiesView {
  publicTopics: string[];
  sourceUrls: string[];
  minimumCadenceMinutes: number;
  maximumCadenceMinutes: number;
  profiles?: { id: string; label: string; publicTopic: string; family: string; sourceUrls: string[] }[];
}

export interface DecisionInput {
  proposalId: string;
  optionId?: string;
  action: "approve" | "reject";
  revision: Revision;
  policyVersion: string;
  idempotencyKey: string;
}

/** Projection UI only. Identity, authorization and business calculations stay on the server. */
export interface UiApi {
  readIndustrial?(signal?: AbortSignal): Promise<IndustrialWorkspace>;
  askIndustrialQuestion?(input: QuestionInput & { reportId?: string }): Promise<RunView>;
  readIndustrialRun?(id: string, signal?: AbortSignal): Promise<RunView>;
  readIndustrialReport?(id: string, signal?: AbortSignal): Promise<IndustrialReportView>;
  decideIndustrialPlan?(planId: string, input: IndustrialDecisionInput): Promise<IndustrialApproval>;
  simulateIndustrialApproval?(approvalId: string, input: IndustrialSimulationInput): Promise<IndustrialDemoExecution>;
  readWorkspace(signal?: AbortSignal): Promise<WorkspaceView>;
  askQuestion(input: QuestionInput): Promise<RunView>;
  createWatch(input: WatchInput): Promise<WatchView>;
  decide(input: DecisionInput): Promise<{ message: string }>;
  readWatchCapabilities?(signal?: AbortSignal): Promise<WatchCapabilitiesView>;
  readCase?(id: string, signal?: AbortSignal): Promise<{ current: DecisionCase; versions: DecisionCase[] }>;
  createCase?(input: CaseInput): Promise<DecisionCase>;
  reviseCase?(id: string, input: CaseRevisionInput): Promise<DecisionCase>;
  analyzeCase?(id: string, input: CaseAnalysisInput): Promise<RunView>;
  readResearch?(profileId: string, namespace: ResearchScope["namespace"], signal?: AbortSignal): Promise<ResearchContext>;
  analyzeResearch?(profileId: string, input: QuestionInput & { namespace: ResearchScope["namespace"] }): Promise<RunView>;
  openSession?(token: string): Promise<void>;
  closeSession?(): Promise<void>;
}

export class UiError extends Error {
  public constructor(public readonly code: string, message: string, public readonly uncertain = false) {
    super(message);
    this.name = "UiError";
  }
}
