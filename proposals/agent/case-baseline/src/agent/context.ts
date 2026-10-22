import type { AgentRunnerInput, AttributedMemory, CompanySnapshot, JsonObject } from '../contracts/index.js';
import { DomainError, parseSnapshot, policyFromContract } from '../domain/index.js';
import { textField } from '../domain/model.js';

export interface MemoryRecall { accepted: AttributedMemory[]; excluded: {id: string; reason: string}[] }
export interface ModelContext {
  question: string; companyId: string; dataOrigin: 'synthetic';
  policy: {version: string; replacementMarginDays: number; replacementOrderLineIds?: string[]; rules: string[]};
  manifest: {contractVersion: 'C1'; companyId: string; revision: string; policyVersion: string; snapshotAsOf: string; assembledAt: string; memoryIds: string[]; toolsVersion: 'agent-tools/1'};
}

/** Memory is advice only. A different revision/policy requires a new attributed decision. */
export function recallMemories(memories: AttributedMemory[], snapshot: CompanySnapshot, observedAt: string = new Date().toISOString()): MemoryRecall {
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
    if(reason) result.excluded.push({id,reason});
    else {
      ids.add(id);
      result.accepted.push({id,companyId:memory.companyId,actorId:memory.actorId,proposalId:memory.proposalId,revision:memory.revision,policyVersion:memory.policyVersion,content:memory.content,conditions:[...memory.conditions],createdAt:memory.createdAt});
    }
  }
  return result;
}

export function buildModelContext(input: AgentRunnerInput, observedAt: string = new Date().toISOString()): ModelContext {
  const snapshot=parseSnapshot(input.snapshot.dataset); const policy=policyFromContract(input.snapshot);
  if(input.actor.companyId!==snapshot.companyId || input.run.companyId!==snapshot.companyId || input.run.actorId!==input.actor.actorId || input.snapshot.companyId!==snapshot.companyId) throw new DomainError('SCOPE_MISMATCH');
  if(input.snapshot.revision!==snapshot.revision || input.run.revision!==snapshot.revision || input.run.policyVersion!==policy.version) throw new DomainError('STALE_CONTEXT');
  if(typeof input.run.question!=='string' || input.run.question.trim().length===0 || input.run.question.length>8000) throw new DomainError('INVALID_QUESTION');
  const memories=recallMemories(input.memories,input.snapshot,observedAt);
  return {
    question:input.run.question,companyId:snapshot.companyId,dataOrigin:'synthetic',
    policy:{version:policy.version,replacementMarginDays:policy.replacementMarginDays,replacementOrderLineIds:[...policy.replacementOrderLineIds],rules:input.snapshot.policy.rules.map(r=>r.rule)},
    manifest:{contractVersion:'C1',companyId:snapshot.companyId,revision:snapshot.revision,policyVersion:policy.version,snapshotAsOf:snapshot.asOf,assembledAt:observedAt,memoryIds:memories.accepted.map(m=>m.id),toolsVersion:'agent-tools/1'},
  };
}

export function releasedCommitments(input: AgentRunnerInput): JsonObject {
  const s=parseSnapshot(input.snapshot.dataset);
  return {companyId:s.companyId,revision:s.revision,policyVersion:input.snapshot.policyVersion,asOf:s.asOf,dataOrigin:s.dataOrigin,
    orders:s.orders.map(o=>({...o})),lines:s.lines.map(l=>({...l})),inventory:s.inventory.map(i=>({...i})),
    reservations:s.reservations.map(r=>({...r})),purchases:s.purchases.map(p=>({...p})),inbound:s.inbound.map(p=>({...p})),inboundAllocations:s.inboundAllocations.map(a=>({...a})),
    transports:s.transports.map(q=>({...q})),emergency:s.emergency.map(q=>({...q}))};
}
