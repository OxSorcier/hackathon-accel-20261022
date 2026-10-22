import type { Actor, QuestionInput } from './index.js';
import type { IndustrialAnalysisIntent, IndustrialApproval, IndustrialBasis, IndustrialDemoExecution, IndustrialReport, ReleasedIndustrialEvent } from './industrial.js';
import type { ResearchContext } from './research.js';

export interface IndustrialDisplayProfile {
  companyId: string; version: number; baseCoreSha256: string; baseContextSha256: string;
  labels: { entityType: 'company' | 'depot' | 'supplier' | 'supplier_site' | 'customer' | 'project' | 'competitor'; nativeId: string; displayName: string; synthetic: true }[];
  companyProfileDisplay: { activity: string; summary: string; operations: string; disclosure: string };
}

export interface IndustrialCompanyView {
  id: string; name: string; businessRevision: string; policyVersion: string;
  dataOrigin: 'synthetic'; importedAt: string; counts: Record<string, number>;
}
export interface IndustrialContextSummary {
  revision: string; qualificationRevision: string; activity: string; countries: string[];
  regions: string[]; receivedAt: string;
  counts: { supplierSites: number; supplierDependencies: number; competitors: number; qualifiedDemands: number };
}
export interface IndustrialPlanState {
  planId: string; planVersion: string; planHash: string;
  status: 'pending' | 'approved' | 'rejected' | 'stale';
  approval: IndustrialApproval | null; execution: IndustrialDemoExecution | null;
  permissions: { canApprove: boolean; canReject: boolean; canSimulate: boolean; blockedReason: string | null };
}
export interface IndustrialReportView {
  report: IndustrialReport; freshness?: 'current' | 'stale'; planStates: IndustrialPlanState[];
}
export interface IndustrialWorkspace {
  company: IndustrialCompanyView; context: IndustrialContextSummary; actor: Actor;
  events: ReleasedIndustrialEvent[]; analyses: IndustrialAnalysisIntent[];
  reports: IndustrialReportView[];
  display?: IndustrialDisplayProfile;
  publicResearch?: ResearchContext;
  publicFeed?: { profileId: string; watchId: string | null; cadenceMinutes: number | null; nextRunAt: string | null; lastAttemptAt: string | null; lastAttemptStatus: 'queued' | 'running' | 'completed' | 'error' | null };
  capabilities: { automaticAnalysis: boolean; simulationOnly: true; publicEvidenceIsSeparate: true;
    decisionsConnected: boolean; simulationConnected: boolean; questionsConnected?: boolean };
}
export interface IndustrialDecisionInput {
  decision: 'approve' | 'reject'; expectedBasis: IndustrialBasis;
  expectedPlanVersion: string; expectedPlanHash: string; operationKey: string;
}
export interface IndustrialSimulationInput {
  expectedBusinessRevision: string; expectedPlanVersion: string;
  expectedPlanHash: string; operationKey: string;
}
export interface IndustrialQuestionInput extends QuestionInput { reportId?: string }
