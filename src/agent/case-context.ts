import { createHash } from 'node:crypto';
import type { AgentRunnerInput, CaseRef, EvidenceRef, ReleasedCaseContext, SourceEvidence } from '../contracts/index.js';
import { calendarDate, DomainError, parseInternalConfirmation, parseRiskAssumption, parseSnapshot } from '../domain/index.js';
import { record, textField } from '../domain/model.js';
import type { ResearchDependency } from '../contracts/research.js';

function boundedText(value: unknown, field: string, maximum: number): string {
  if(typeof value!=='string' || value.trim().length===0 || value.length>maximum) throw new DomainError('INVALID_CASE_FIELD',field);
  return value;
}
function enumField<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if(typeof value!=='string' || !allowed.includes(value as T)) throw new DomainError('INVALID_CASE_FIELD',field);
  return value as T;
}
function timestamp(value: unknown, field: string): string {
  const result=boundedText(value,field,100);
  const parts=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(result);
  if(!parts || Number(parts[2])>23 || Number(parts[3])>59 || Number(parts[4])>59 || !Number.isFinite(Date.parse(result))) throw new DomainError('INVALID_CASE_FIELD',field);
  calendarDate(parts[1],field);
  return result;
}
function nullableTimestamp(value: unknown, field: string): string | null {return value===null ? null : timestamp(value,field);}
function publicUrl(value: unknown, field: string): string {
  const text=boundedText(value,field,2000); let url: URL;
  try {url=new URL(text);} catch {throw new DomainError('INVALID_CASE_FIELD',field);}
  if(url.protocol!=='https:' || url.username || url.password) throw new DomainError('INVALID_CASE_FIELD',field);
  if([...url.searchParams.keys()].some(key=>/^(?:api[_-]?key|token|access_token|secret|authorization|password)$/i.test(key))) throw new DomainError('INVALID_CASE_FIELD',field);
  return text;
}
function hash(value: unknown): string {
  if(typeof value!=='string' || !/^[a-f0-9]{64}$/.test(value)) throw new DomainError('INVALID_EVIDENCE_HASH');
  return value;
}

export function parseCaseRef(value: unknown): CaseRef {
  const ref=record(value,'caseRef');
  return {caseId:textField(ref.caseId,'caseId'),caseRevision:textField(ref.caseRevision,'caseRevision')};
}
export function sameCaseRef(a: CaseRef, b: CaseRef): boolean {return a.caseId===b.caseId && a.caseRevision===b.caseRevision;}

export function parseObservation(value: unknown, observedAt: string): SourceEvidence {
  const o=record(value,'observation'); const content=boundedText(o.content,'content',12000);
  const contentHash=hash(o.contentHash);
  if(createHash('sha256').update(content).digest('hex')!==contentHash) throw new DomainError('INVALID_EVIDENCE_HASH');
  if(o.dataOrigin!=='public') throw new DomainError('INVALID_EVIDENCE_ORIGIN');
  const collectedAt=timestamp(o.collectedAt,'collectedAt'); const publishedAt=nullableTimestamp(o.publishedAt,'publishedAt');
  if(Date.parse(collectedAt)>Date.parse(observedAt) || (publishedAt!==null && Date.parse(publishedAt)>Date.parse(collectedAt))) throw new DomainError('FUTURE_EVIDENCE');
  const result: SourceEvidence={id:textField(o.id,'observation.id'),url:publicUrl(o.url,'url'),title:boundedText(o.title,'title',4000),content,contentHash,publishedAt,collectedAt,dataOrigin:'public',mode:enumField(o.mode,['direct','replay','test'],'mode')};
  if(o.provenance!==undefined) {
    const p=record(o.provenance,'provenance'); if(typeof p.truncated!=='boolean') throw new DomainError('INVALID_CASE_FIELD','truncated');
    result.provenance={provider:enumField(p.provider,['boamp','keenable'],'provider'),endpoint:publicUrl(p.endpoint,'endpoint'),method:enumField(p.method,['search_snippet','fetch','api_record'],'method'),profileId:textField(p.profileId,'profileId'),indexedAt:nullableTimestamp(p.indexedAt,'indexedAt'),truncated:p.truncated};
  }
  if(o.family!==undefined) result.family=enumField<NonNullable<SourceEvidence['family']>>(o.family,['sector','regional','supplier','incident','project','public_contract','regulation_fr','regulation_eu'],'family');
  if(o.regulation!==undefined) {
    const r=record(o.regulation,'regulation');
    result.regulation={jurisdiction:enumField(r.jurisdiction,['FR','EU'],'jurisdiction'),officialIdentifier:r.officialIdentifier===null ? null : boundedText(r.officialIdentifier,'officialIdentifier',500),
      entryIntoForceAt:nullableTimestamp(r.entryIntoForceAt,'entryIntoForceAt'),appliesFrom:nullableTimestamp(r.appliesFrom,'appliesFrom'),deadlineAt:nullableTimestamp(r.deadlineAt,'deadlineAt'),scope:r.scope===null ? null : boundedText(r.scope,'scope',4000),applicability:enumField(r.applicability,['to_verify','unknown'],'applicability')};
  }
  return result;
}

/** The server supplies authority. This projection validates and copies only the published C1 fields. */
export function validateCaseContext(input: AgentRunnerInput, observedAt: string): ReleasedCaseContext | undefined {
  if(input.run.caseRef===undefined && input.caseContext===undefined) return undefined;
  if(input.run.caseRef===undefined || input.caseContext===undefined) throw new DomainError('MISSING_CASE_CONTEXT');
  const expected=parseCaseRef(input.run.caseRef); const c=record(input.caseContext,'caseContext'); const ref=parseCaseRef(c.ref);
  if(!sameCaseRef(expected,ref)) throw new DomainError('STALE_CONTEXT');
  if(c.businessRevision!==input.run.revision || c.businessRevision!==input.snapshot.revision || c.policyVersion!==input.run.policyVersion || c.policyVersion!==input.snapshot.policyVersion) throw new DomainError('STALE_CONTEXT');
  if(input.actor.companyId!==input.run.companyId || input.run.companyId!==input.snapshot.companyId || (c.companyId!==undefined && c.companyId!==input.snapshot.companyId)) throw new DomainError('SCOPE_MISMATCH');
  const s=parseSnapshot(input.snapshot.dataset);
  if(s.companyId!==input.snapshot.companyId || s.revision!==input.snapshot.revision) throw new DomainError('SCOPE_MISMATCH');
  const evidence=record(c.evidenceRef,'evidenceRef');
  const evidenceRef: EvidenceRef={occurrenceId:textField(evidence.occurrenceId,'occurrenceId'),evidenceId:textField(evidence.evidenceId,'evidenceId'),contentHash:hash(evidence.contentHash)};
  const observation=parseObservation(c.observation,observedAt);
  if(observation.id!==evidenceRef.evidenceId || observation.contentHash!==evidenceRef.contentHash) throw new DomainError('EVIDENCE_REF_MISMATCH');
  if(c.testOnly!==undefined && typeof c.testOnly!=='boolean') throw new DomainError('INVALID_CASE_TEST_FLAG');
  let researchDependency: ResearchDependency | undefined;
  if(c.researchDependency!==undefined) {
    const d=record(c.researchDependency,'case.researchDependency');const ds=record(d.scope,'case.researchScope');const rs=record(input.run.researchScope,'run.researchScope');
    const namespace=c.testOnly===true ? 'controlled' : 'live';
    if(ds.namespace!==namespace || rs.namespace!==namespace || ds.profileId!==rs.profileId || ds.profileVersion!==rs.profileVersion) throw new DomainError('INVALID_CASE_RESEARCH_SCOPE');
    if(typeof d.generation!=='number' || !Number.isSafeInteger(d.generation) || d.generation<0 || !Array.isArray(d.evidenceRefs) || d.evidenceRefs.length>10) throw new DomainError('INVALID_CASE_RESEARCH_DEPENDENCY');
    const evidenceRefs: EvidenceRef[]=d.evidenceRefs.map((value:unknown)=>{const ref=record(value,'case.researchRef');return {occurrenceId:textField(ref.occurrenceId,'occurrenceId'),evidenceId:textField(ref.evidenceId,'evidenceId'),contentHash:hash(ref.contentHash)};});
    if(new Set(evidenceRefs.map(ref=>JSON.stringify(ref))).size!==evidenceRefs.length || !evidenceRefs.some(ref=>ref.occurrenceId===evidenceRef.occurrenceId && ref.evidenceId===evidenceRef.evidenceId && ref.contentHash===evidenceRef.contentHash)) throw new DomainError('INVALID_CASE_RESEARCH_DEPENDENCY');
    researchDependency={scope:{profileId:textField(ds.profileId,'profileId'),profileVersion:textField(ds.profileVersion,'profileVersion'),namespace},generation:d.generation,validUntil:d.validUntil===null ? null : timestamp(d.validUntil,'case.researchValidUntil'),evidenceRefs};
  }
  if(c.testOnly===true ? observation.mode!=='test' || researchDependency===undefined : observation.mode!=='direct') throw new DomainError('INVALID_CASE_EVIDENCE_MODE');
  const rawRelation=record(c.relation,'relation');
  const relation={status:enumField(rawRelation.status,['unverified','none'],'relation.status'),productId:rawRelation.productId===null ? null : textField(rawRelation.productId,'productId'),supplierId:rawRelation.supplierId===null ? null : textField(rawRelation.supplierId,'supplierId'),basis:boundedText(rawRelation.basis,'basis',4000)};
  if(relation.productId!==null && !s.products.some(p=>p.id===relation.productId)) throw new DomainError('UNKNOWN_CASE_PRODUCT');
  if(relation.supplierId!==null) {
    const suppliers=input.snapshot.dataset.tables.suppliers;
    const supplier=Array.isArray(suppliers) ? suppliers.find(row=>row.id===relation.supplierId) : undefined;
    if(!supplier || (supplier.company_id!==undefined && supplier.company_id!==s.companyId)) throw new DomainError('UNKNOWN_CASE_SUPPLIER');
  }
  if(!Array.isArray(c.candidateOrderLineIds) || c.candidateOrderLineIds.length>10000) throw new DomainError('INVALID_CASE_CANDIDATES');
  const candidateOrderLineIds=c.candidateOrderLineIds.map((value: unknown)=>textField(value,'candidateOrderLineId'));
  if(new Set(candidateOrderLineIds).size!==candidateOrderLineIds.length) throw new DomainError('INVALID_CASE_CANDIDATES');
  for(const candidate of candidateOrderLineIds) {
    const line=s.lines.find(l=>l.id===candidate); const order=line ? s.orders.find(o=>o.id===line.order_id) : undefined;
    if(!line || !order || order.status!=='confirmed' || (relation.productId!==null && line.product_id!==relation.productId)) throw new DomainError('INVALID_CASE_CANDIDATES');
  }
  const qualification=enumField(c.qualification,['to_verify','no_known_exposure'],'qualification');
  if(relation.status==='none' && (candidateOrderLineIds.length>0 || relation.productId!==null || relation.supplierId!==null || qualification!=='no_known_exposure')) throw new DomainError('INCOHERENT_CASE_RELATION');
  if(relation.status==='unverified' && (qualification!=='to_verify' || (candidateOrderLineIds.length>0 && relation.productId===null && relation.supplierId===null))) throw new DomainError('INCOHERENT_CASE_RELATION');
  const impactKind=enumField(c.impactKind,['risk','undetermined'],'impactKind');
  if(c.riskAssumption!==undefined && c.confirmation!==undefined) throw new DomainError('CONFLICTING_CASE_BASIS');
  if((c.riskAssumption===undefined && c.confirmation===undefined && impactKind!=='undetermined') || ((c.riskAssumption!==undefined || c.confirmation!==undefined) && impactKind!=='risk')) throw new DomainError('INCOHERENT_CASE_IMPACT');
  const riskAssumption=c.riskAssumption===undefined ? undefined : parseRiskAssumption(input.snapshot,relation,c.riskAssumption);
  const confirmation=c.confirmation===undefined ? undefined : parseInternalConfirmation(input.snapshot,ref,relation,c.confirmation);
  if(confirmation && Date.parse(confirmation.confirmedAt)>Date.parse(observedAt)) throw new DomainError('FUTURE_CONFIRMATION');
  return {ref,evidenceRef,observation,relation,candidateOrderLineIds,businessRevision:input.snapshot.revision,policyVersion:input.snapshot.policyVersion,qualification,impactKind,...(riskAssumption ? {riskAssumption} : {}),...(confirmation ? {confirmation} : {}),...(c.testOnly===undefined ? {} : {testOnly:c.testOnly as boolean}),...(researchDependency ? {researchDependency} : {})};
}
