import type { EvidenceRef } from '../contracts/index.js';
import type { ResearchDependency, ResearchScope } from '../contracts/research.js';

export function sameResearchScope(left: ResearchScope | undefined, right: ResearchScope | undefined): boolean {
  return left?.profileId === right?.profileId && left?.profileVersion === right?.profileVersion && left?.namespace === right?.namespace;
}
export function sameEvidenceRef(left: EvidenceRef, right: EvidenceRef): boolean {
  return left.occurrenceId === right.occurrenceId && left.evidenceId === right.evidenceId && left.contentHash === right.contentHash;
}
export function sameResearchDependency(left: ResearchDependency, right: ResearchDependency): boolean {
  return sameResearchBasis(left, right) && left.validUntil === right.validUntil;
}
export function sameResearchBasis(left: ResearchDependency, right: ResearchDependency): boolean {
  return sameResearchScope(left.scope, right.scope) && left.generation === right.generation && left.evidenceRefs.length === right.evidenceRefs.length && left.evidenceRefs.every(value => right.evidenceRefs.some(other => sameEvidenceRef(value, other)));
}
export function sameResearchDependencies(left: ResearchDependency[], right: ResearchDependency[]): boolean {
  return left.length === right.length && left.every(value => right.some(other => sameResearchDependency(value, other)));
}
