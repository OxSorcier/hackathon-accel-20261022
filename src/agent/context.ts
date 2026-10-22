import type { AgentRunnerInput, AttributedMemory, CaseRef, CompanySnapshot, EvidenceRef, JsonObject } from '../contracts/index.js';
import { DomainError, parseSnapshot, policyFromContract } from '../domain/index.js';
import { textField } from '../domain/model.js';
import { parseCaseRef, sameCaseRef, validateCaseContext } from './case-context.js';
import type { ResearchDependency, ResearchScope } from '../contracts/research.js';
import { parseResearchDependencies, parseResearchScope } from './research-context.js';

export interface MemoryRecall { accepted: AttributedMemory[]; excluded: {id: string; reason: string}[] }
export interface ModelContext {
  question: string; companyId: string; dataOrigin: 'synthetic';
  policy: {version: string; replacementMarginDays?: number; replacementOrderLineIds?: string[]; rules: string[]};
  manifest: {contractVersion: 'C1'; companyId: string; revision: string; policyVersion: string; snapshotAsOf: string; assembledAt: string; memoryIds: string[]; toolsVersion: 'agent-tools/1' | 'agent-tools/2' | 'agent-tools/3' | 'agent-tools/4'; caseRef?: CaseRef; evidenceRef?: EvidenceRef; researchScope?: ResearchScope; industrialScope?: { contextRevision: string; qualificationRevision: string; reportId: string | null }; pdfProfileId?: string};
  case?: {ref: CaseRef; qualification: 'to_verify' | 'no_known_exposure'; relationStatus: 'unverified' | 'none'; candidateOrderLineIds: string[]; impactKind: 'risk' | 'undetermined'};
}

/** Initial manifest only. Portfolio records and prior responses are never pushed into model context. */
export function buildSpecializedModelContext(input: AgentRunnerInput, observedAt: string): ModelContext {
  const { snapshot, run, actor } = input;
  if (actor.companyId !== snapshot.companyId || run.companyId !== snapshot.companyId || run.actorId !== actor.actorId || snapshot.dataset.company_id !== snapshot.companyId || snapshot.policy.company_id !== snapshot.companyId) throw new DomainError('SCOPE_MISMATCH');
  if (run.revision !== snapshot.revision || run.policyVersion !== snapshot.policyVersion || snapshot.dataset.snapshot_revision !== snapshot.revision) throw new DomainError('STALE_CONTEXT');
  if (run.mode === 'replay' || input.caseContext || run.caseRef || snapshot.dataOrigin !== 'synthetic' || snapshot.dataset.data_origin !== 'synthetic' || !Number.isFinite(Date.parse(snapshot.dataset.as_of)) || !Number.isFinite(Date.parse(observedAt)) || Date.parse(snapshot.dataset.as_of) > Date.parse(observedAt)) throw new DomainError('INVALID_SPECIALIZED_CONTEXT');
  if (typeof run.question !== 'string' || !run.question.trim() || run.question.length > 8000) throw new DomainError('INVALID_QUESTION');
  const industrial = run.industrialScope;
  if (!industrial && actor.role === 'analysis_only') throw new DomainError('INVALID_SERVICE_SCOPE');
  const industrialScope = industrial ? { contextRevision: textField(industrial.contextRevision, 'contextRevision'), qualificationRevision: textField(industrial.qualificationRevision, 'qualificationRevision'), reportId: industrial.reportId === null ? null : textField(industrial.reportId, 'reportId') } : undefined;
  const pdfProfileId = run.pdfProfileId === undefined ? undefined : textField(run.pdfProfileId, 'pdfProfileId');
  const researchScope = run.researchScope === undefined ? undefined : parseResearchScope(run.researchScope);
  if (researchScope && researchScope.namespace === 'live' && run.mode !== 'direct') throw new DomainError('INVALID_RESEARCH_NAMESPACE');
  return { question: run.question, companyId: snapshot.companyId, dataOrigin: 'synthetic', policy: { version: snapshot.policyVersion, rules: ['Read only released server tools. Human approval and simulated execution are separate server operations.'] }, manifest: { contractVersion: 'C1', companyId: snapshot.companyId, revision: snapshot.revision, policyVersion: snapshot.policyVersion, snapshotAsOf: snapshot.dataset.as_of, assembledAt: observedAt, memoryIds: [], toolsVersion: 'agent-tools/4', ...(industrialScope ? { industrialScope } : {}), ...(pdfProfileId ? { pdfProfileId } : {}), ...(researchScope ? { researchScope } : {}) } };
}

/** Structural advice projection only. Research candidates still require the runner's current port validation. */
export function recallMemories(memories: AttributedMemory[], snapshot: CompanySnapshot, observedAt: string = new Date().toISOString(), currentCase?: CaseRef, researchScope?: ResearchScope): MemoryRecall {
  const readingTime=Date.parse(observedAt);
  if(!Number.isFinite(readingTime)) throw new DomainError('INVALID_MEMORY_READING_TIME');
  const result: MemoryRecall={accepted:[],excluded:[]}; const ids=new Set<string>();
  for(const memory of memories.slice(0,100)) {
    const id=textField(memory.id,'memory.id'); let reason: string | null=null;
    if(memory.companyId!==snapshot.companyId) reason='FOREIGN_COMPANY';
    else if(memory.revision!==snapshot.revision || memory.policyVersion!==snapshot.policyVersion) reason='REVALIDATION_REQUIRED';
    else if(ids.has(id)) reason='DUPLICATE_ID';
    else if(typeof memory.content!=='string' || memory.content.length===0 || memory.content.length>4000 || !Array.isArray(memory.conditions) || memory.conditions.length>30 || memory.conditions.some(c=>typeof c!=='string' || c.length>1000) || !memory.actorId || !memory.proposalId || !Number.isFinite(Date.parse(memory.createdAt))) reason='INVALID_ATTRIBUTION';
    else if(Date.parse(memory.createdAt)>readingTime) reason='FUTURE_MEMORY';
    let memoryCase: CaseRef | undefined;
    let memoryResearch: ResearchDependency[] | undefined;
    if(!reason) {
      try {if(memory.caseRef!==undefined) memoryCase=parseCaseRef(memory.caseRef);}
      catch {reason='INVALID_MEMORY_CASE';}
      if(!reason && ((currentCase===undefined && memoryCase!==undefined) || (currentCase!==undefined && (memoryCase===undefined || !sameCaseRef(memoryCase,currentCase))))) reason='CASE_REVALIDATION_REQUIRED';
    }
    if(!reason && (researchScope!==undefined || memory.researchDependencies!==undefined || memory.testOnly!==undefined)) {
      if(!researchScope) reason='RESEARCH_SCOPE_REQUIRED';
      else if(memory.researchDependencies===undefined || typeof memory.testOnly!=='boolean') reason='INVALID_MEMORY_RESEARCH';
      else {
        try {
          memoryResearch=parseResearchDependencies(memory.researchDependencies,parseResearchScope(researchScope));
          if(memoryResearch.length===0 || memory.testOnly!==(researchScope.namespace==='controlled') || memoryResearch.some(value=>value.evidenceRefs.length===0 || value.validUntil===null || Date.parse(value.validUntil)<=readingTime)) reason='RESEARCH_REVALIDATION_REQUIRED';
        } catch {reason='INVALID_MEMORY_RESEARCH';}
      }
    }
    if(reason) result.excluded.push({id,reason});
    else {
      ids.add(id);
      result.accepted.push({id,companyId:memory.companyId,actorId:memory.actorId,proposalId:memory.proposalId,revision:memory.revision,policyVersion:memory.policyVersion,content:memory.content,conditions:[...memory.conditions],createdAt:memory.createdAt,...(memoryCase ? {caseRef:memoryCase} : {}),...(memoryResearch ? {researchDependencies:memoryResearch,testOnly:memory.testOnly!} : {})});
    }
  }
  return result;
}

export function buildModelContext(input: AgentRunnerInput, observedAt: string = new Date().toISOString()): ModelContext {
  const snapshot=parseSnapshot(input.snapshot.dataset); const policy=policyFromContract(input.snapshot);
  if(input.actor.companyId!==snapshot.companyId || input.run.companyId!==snapshot.companyId || input.run.actorId!==input.actor.actorId || input.snapshot.companyId!==snapshot.companyId) throw new DomainError('SCOPE_MISMATCH');
  if(input.snapshot.revision!==snapshot.revision || input.run.revision!==snapshot.revision || input.run.policyVersion!==policy.version) throw new DomainError('STALE_CONTEXT');
  if(typeof input.run.question!=='string' || input.run.question.trim().length===0 || input.run.question.length>8000) throw new DomainError('INVALID_QUESTION');
  const released=validateCaseContext(input,observedAt);
  const researchScope=input.run.researchScope===undefined ? undefined : parseResearchScope(input.run.researchScope);
  if(researchScope && (input.run.mode==='replay' || (researchScope.namespace==='live' && input.run.mode!=='direct'))) throw new DomainError('INVALID_RESEARCH_NAMESPACE');
  // Research advice enters only through actual lookup and recall tools after asynchronous currentness checks.
  const memories=recallMemories(input.memories.filter(memory=>memory.researchDependencies===undefined && memory.testOnly===undefined),input.snapshot,observedAt,released?.ref,researchScope);
  return {
    question:input.run.question,companyId:snapshot.companyId,dataOrigin:'synthetic',
    policy:{version:policy.version,replacementMarginDays:policy.replacementMarginDays,replacementOrderLineIds:[...policy.replacementOrderLineIds],rules:input.snapshot.policy.rules.map(r=>r.rule)},
    manifest:{contractVersion:'C1',companyId:snapshot.companyId,revision:snapshot.revision,policyVersion:policy.version,snapshotAsOf:snapshot.asOf,assembledAt:observedAt,memoryIds:memories.accepted.map(m=>m.id),toolsVersion:researchScope ? 'agent-tools/3' : released ? 'agent-tools/2' : 'agent-tools/1',...(released ? {caseRef:{...released.ref},evidenceRef:{...released.evidenceRef}} : {}),...(researchScope ? {researchScope} : {})},
    ...(released ? {case:{ref:{...released.ref},qualification:released.qualification,relationStatus:released.relation.status,candidateOrderLineIds:[...released.candidateOrderLineIds],impactKind:released.impactKind}} : {}),
  };
}

export function releasedCommitments(input: AgentRunnerInput): JsonObject {
  const s=parseSnapshot(input.snapshot.dataset);
  return {companyId:s.companyId,revision:s.revision,policyVersion:input.snapshot.policyVersion,asOf:s.asOf,dataOrigin:s.dataOrigin,
    orders:s.orders.map(o=>({...o})),lines:s.lines.map(l=>({...l})),inventory:s.inventory.map(i=>({...i})),
    reservations:s.reservations.map(r=>({...r})),purchases:s.purchases.map(p=>({...p})),inbound:s.inbound.map(p=>({...p})),inboundAllocations:s.inboundAllocations.map(a=>({...a})),
    transports:s.transports.map(q=>({...q})),emergency:s.emergency.map(q=>({...q}))};
}
