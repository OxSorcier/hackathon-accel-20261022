import type { Actor, QuestionInput } from './index.js';
import type { IndustrialAnalysisIntent, IndustrialApproval, IndustrialBasis, IndustrialDemoExecution, IndustrialReport, ReleasedIndustrialEvent } from './industrial.js';

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
  report: IndustrialReport; planStates: IndustrialPlanState[];
}
export interface IndustrialWorkspace {
  company: IndustrialCompanyView; context: IndustrialContextSummary; actor: Actor;
  events: ReleasedIndustrialEvent[]; analyses: IndustrialAnalysisIntent[];
  reports: IndustrialReportView[];
  capabilities: { automaticAnalysis: boolean; simulationOnly: true; publicEvidenceIsSeparate: true;
    decisionsConnected: boolean; simulationConnected: boolean };
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
