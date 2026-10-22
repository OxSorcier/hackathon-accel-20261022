import type { EvidenceRef } from '../contracts/index.js';
import type { ResearchContext, ResearchDependency, ResearchObservation, ResearchResult, ResearchScope, ResearchState } from '../contracts/research.js';
import { calendarDate, DomainError } from '../domain/index.js';
import { record, textField } from '../domain/model.js';
import { parseObservation } from './case-context.js';

function timestamp(value: unknown): string {
  const result=textField(value,'research.date');
  const parts=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(result);
  if(!parts || Number(parts[2])>23 || Number(parts[3])>59 || Number(parts[4])>59 || !Number.isFinite(Date.parse(result))) throw new DomainError('INVALID_RESEARCH_DATE');
  calendarDate(parts[1],'research.date');return result;
}
function strings(value: unknown): string[] {
  if(!Array.isArray(value) || value.length>30 || value.some(item=>typeof item!=='string' || item.trim().length===0 || item.length>1000)) throw new DomainError('INVALID_RESEARCH_CONDITIONS');
  return value as string[];
}
function counter(value: unknown): number {
  if(typeof value!=='number' || !Number.isSafeInteger(value) || value<0) throw new DomainError('INVALID_RESEARCH_COUNTER');return value;
}
export function parseResearchScope(value: unknown): ResearchScope {
  const scope=record(value,'researchScope');
  if(scope.namespace!=='live' && scope.namespace!=='controlled') throw new DomainError('INVALID_RESEARCH_SCOPE');
  return {profileId:textField(scope.profileId,'profileId'),profileVersion:textField(scope.profileVersion,'profileVersion'),namespace:scope.namespace};
}
export function sameResearchScope(a: ResearchScope, b: ResearchScope): boolean {
  return a.profileId===b.profileId && a.profileVersion===b.profileVersion && a.namespace===b.namespace;
}
export function parseResearchDependencies(value: unknown, scope: ResearchScope): ResearchDependency[] {
  if(!Array.isArray(value) || value.length>10) throw new DomainError('INVALID_RESEARCH_DEPENDENCIES');
  return value.map((item:unknown)=>{
    const d=record(item,'researchDependency');const receivedScope=parseResearchScope(d.scope);
    if(!sameResearchScope(receivedScope,scope) || !Array.isArray(d.evidenceRefs) || d.evidenceRefs.length>10) throw new DomainError('INVALID_RESEARCH_DEPENDENCIES');
    const evidenceRefs: EvidenceRef[]=d.evidenceRefs.map((item:unknown)=>{
      const ref=record(item,'research.ref');
      if(typeof ref.contentHash!=='string' || !/^[a-f0-9]{64}$/.test(ref.contentHash)) throw new DomainError('INVALID_EVIDENCE_HASH');
      return {occurrenceId:textField(ref.occurrenceId,'occurrenceId'),evidenceId:textField(ref.evidenceId,'evidenceId'),contentHash:ref.contentHash};
    });
    if(new Set(evidenceRefs.map(ref=>JSON.stringify(ref))).size!==evidenceRefs.length) throw new DomainError('INVALID_RESEARCH_DEPENDENCIES');
    return {scope:receivedScope,generation:counter(d.generation),validUntil:d.validUntil===null ? null : timestamp(d.validUntil),evidenceRefs};
  });
}

/** Only received evidence fields cross this boundary. The port supplies scope authority. */
export function projectResearchContext(value: unknown, companyId: string, scope: ResearchScope, observedAt: string): ResearchContext {
  const c=record(value,'researchContext');const receivedScope=parseResearchScope(c.scope);
  if(c.companyId!==companyId || !sameResearchScope(receivedScope,scope)) throw new DomainError('SCOPE_MISMATCH');
  const checkedAt=timestamp(c.checkedAt);const validUntil=c.validUntil===null ? null : timestamp(c.validUntil);
  if(Date.parse(checkedAt)>Date.parse(observedAt)) throw new DomainError('FUTURE_RESEARCH');
  const states: ResearchState[]=['reusable','missing','stale','partial','empty','error','uncertain'];
  if(typeof c.state!=='string' || !states.includes(c.state as ResearchState) || typeof c.reused!=='boolean' || !Array.isArray(c.observations) || c.observations.length>10) throw new DomainError('INVALID_RESEARCH_CONTEXT');
  const state=c.state as ResearchState;
  const observations: ResearchObservation[]=c.observations.map((item:unknown)=>{
    const o=record(item,'researchObservation');
    if(o.qualification!=='source_observation_only' || o.testOnly!==(scope.namespace==='controlled')) throw new DomainError('INVALID_RESEARCH_QUALIFICATION');
    const evidence=parseObservation(o.evidence,checkedAt);
    if(evidence.mode!==(scope.namespace==='controlled' ? 'test' : 'direct') || (evidence.provenance!==undefined && evidence.provenance.profileId!==scope.profileId)) throw new DomainError('INVALID_RESEARCH_NAMESPACE');
    const ref=record(o.ref,'research.ref');
    if(ref.evidenceId!==evidence.id || ref.contentHash!==evidence.contentHash) throw new DomainError('EVIDENCE_REF_MISMATCH');
    return {ref:{occurrenceId:textField(ref.occurrenceId,'occurrenceId'),evidenceId:evidence.id,contentHash:evidence.contentHash},evidence,qualification:'source_observation_only',testOnly:o.testOnly as boolean,conditions:[...strings(o.conditions)]};
  });
  if(new Set(observations.map(o=>JSON.stringify(o.ref))).size!==observations.length) throw new DomainError('INVALID_RESEARCH_DEPENDENCIES');
  if(state==='reusable' && (observations.length===0 || validUntil===null || Date.parse(validUntil)<=Date.parse(observedAt))) throw new DomainError('EXPIRED_RESEARCH');
  if((state==='missing' || state==='empty') && observations.length>0) throw new DomainError('INVALID_RESEARCH_CONTEXT');
  const occurrenceId=c.occurrenceId===null ? null : textField(c.occurrenceId,'occurrenceId');
  if(observations.length>0 && occurrenceId===null) throw new DomainError('INVALID_RESEARCH_CONTEXT');
  if(typeof c.reason!=='string' || c.reason.length===0 || c.reason.length>2000) throw new DomainError('INVALID_RESEARCH_REASON');
  return {companyId,scope:receivedScope,generation:counter(c.generation),state,checkedAt,validUntil,occurrenceId,observations,conditions:[...strings(c.conditions)],reason:c.reason,reused:c.reused,externalCalls:counter(c.externalCalls)};
}

export function dependencyFromResearch(context: ResearchContext): ResearchDependency {
  return {scope:{...context.scope},generation:context.generation,validUntil:context.state==='reusable' ? context.validUntil : null,evidenceRefs:context.observations.map(o=>({...o.ref}))};
}
export function resultFromResearch(context: ResearchContext): ResearchResult {
  return {outcome:context.state==='uncertain' ? 'uncertain' : context.state==='reusable' ? 'available' : 'needs_refresh',dependencies:[dependencyFromResearch(context)],observations:structuredClone(context.observations),conditions:[...context.conditions]};
}
