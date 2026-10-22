import type { EvidenceRef, SourceEvidence } from './index.js';

/** Server-bound research scope. Namespace is never selected by a model argument. */
export interface ResearchScope { profileId: string; profileVersion: string; namespace: 'live' | 'controlled' }
export type ResearchState = 'reusable' | 'missing' | 'stale' | 'partial' | 'empty' | 'error' | 'uncertain';
export interface ResearchDependency {
  scope: ResearchScope; generation: number; validUntil: string | null; evidenceRefs: EvidenceRef[];
}
export interface ResearchObservation {
  ref: EvidenceRef; evidence: SourceEvidence; qualification: 'source_observation_only';
  testOnly: boolean; conditions: string[];
}
export interface ResearchContext {
  companyId: string; scope: ResearchScope; generation: number; state: ResearchState;
  checkedAt: string; validUntil: string | null; occurrenceId: string | null;
  observations: ResearchObservation[]; conditions: string[]; reason: string;
  reused: boolean; externalCalls: number;
}
export interface ResearchResult {
  outcome: 'available' | 'needs_refresh' | 'uncertain'; dependencies: ResearchDependency[];
  observations: ResearchObservation[]; conditions: string[];
}
/** Factory binds actor, company, authorized scope and a stable per-run refresh key. */
export interface ResearchPort {
  lookup(): Promise<ResearchContext>;
  refresh(): Promise<ResearchContext>;
  validate(dependencies: ResearchDependency[]): Promise<boolean>;
}
