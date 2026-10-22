import type { BusinessEngine, BusinessEvaluation, CaseRef, CaseRelation, CompanySnapshot, InternalConfirmation, JsonObject, ReleasedCaseContext, RiskAssumption } from '../contracts/index.js';
import { evaluateOptions } from './engine.js';
import { calendarDate, DomainError, parseSnapshot, quantity, record, textField, referenceId } from './model.js';
import type { BusinessPolicy } from './model.js';

/** C1 only encodes rules as prose. Unknown semantics fail closed until a typed policy is received. */
export function policyFromContract(snapshot: CompanySnapshot): BusinessPolicy {
  const expected: Record<string,string> = {
    'RULE-SKU':'same SKU and same unit; no implicit substitution',
    'RULE-RESERVE':'reserved stock is unavailable until a versioned plan replaces coverage before all confirmed need dates',
    'RULE-INBOUND':'unconfirmed inbound is not confirmed coverage',
    'RULE-PERMISSION':'only simulation actions; authenticated actor role and amount checked on exact current plan',
    'RULE-PRIORITY':'no implicit priority that breaks another confirmed order',
    'RULE-MARGIN':'replacement for B must be confirmed and available at least 2 calendar days before 2026-11-05',
  };
  const p=record(snapshot.policy,'policy');
  if(p.company_id!==snapshot.companyId || !Array.isArray(p.rules) || p.rules.length!==Object.keys(expected).length) throw new DomainError('UNSUPPORTED_POLICY');
  const seen=new Set<string>();
  for(const raw of p.rules) {
    const rule=record(raw,'rule'); const id=textField(rule.id,'rule.id');
    if(seen.has(id) || expected[id]!==rule.rule) throw new DomainError('UNSUPPORTED_POLICY');
    seen.add(id);
  }
  const business=parseSnapshot(snapshot.dataset);
  const replacementOrderLineIds=business.lines.filter(line=>line.order_id==='ORD-B').map(line=>line.id);
  if(replacementOrderLineIds.length===0) throw new DomainError('UNKNOWN_POLICY_TARGET');
  return {companyId:snapshot.companyId,version:textField(snapshot.policyVersion,'policyVersion'),replacementMarginDays:2,replacementOrderLineIds};
}

export function evaluateBusiness(snapshot: CompanySnapshot, targetOrderLineId?: string): BusinessEvaluation {
  const parsed=parseSnapshot(snapshot.dataset);
  if(parsed.companyId!==snapshot.companyId || parsed.revision!==snapshot.revision) throw new DomainError('INCOHERENT_SNAPSHOT');
  const policy=policyFromContract(snapshot);
  const ordered=parsed.lines.filter(l=>parsed.orders.find(o=>o.id===l.order_id)?.status==='confirmed').sort((a,b)=>{
    const dateA=parsed.orders.find(o=>o.id===a.order_id)!.need_date ?? '9999';
    const dateB=parsed.orders.find(o=>o.id===b.order_id)!.need_date ?? '9999';
    return dateA.localeCompare(dateB) || a.id.localeCompare(b.id);
  });
  const target=targetOrderLineId ?? ordered[0]?.id;
  if(!target) throw new DomainError('NO_CONFIRMED_COMMITMENT');
  const evaluation=evaluateOptions(parsed,policy,target);
  const facts: JsonObject={
    dataOrigin:parsed.dataOrigin, targetOrderLineId:target,
    coverage:evaluation.baseline.map(c=>({...c,allocations:c.allocations.map(a=>({...a}))})),
  };
  return {
    id:referenceId('evaluation',[snapshot.companyId,snapshot.revision,snapshot.policyVersion,target]),
    companyId:snapshot.companyId,revision:snapshot.revision,policyVersion:snapshot.policyVersion,evaluatedAt:parsed.asOf,
    constraints:['SAME_SKU_AND_UNIT','NO_STOCK_EFFECT','SERVER_DECISION_REQUIRED'],
    unknowns:[...new Set(evaluation.baseline.flatMap(c=>c.unknowns))], facts,
    options:evaluation.options.map(o=>({
      id:o.id,kind:o.kind==='keep' ? 'wait' : o.kind==='emergency' ? 'emergency_purchase' : 'transfer',
      label:o.kind==='keep' ? 'Keep current coverage' : o.kind==='emergency' ? 'Prepare an emergency purchase' : 'Prepare a transfer',
      status:o.feasibility==='infeasible' ? 'rejected' : o.feasibility,costEur:o.costCents/100,
      conditions:[...o.unknowns,...o.constraints],reasons:o.constraints,
      effects:{targetOrderLineId:target,productId:o.productId,quantity:quantity(o.quantity,'quantity'),unit:o.unit,
        fromDepotId:o.fromDepotId,toDepotId:o.toDepotId,quoteId:o.quoteId,arrivalDate:o.arrivalDate,
        coverage:o.coverage.map(c=>({...c,allocations:c.allocations.map(a=>({...a}))})),simulationOnly:true},
    })),
  };
}

/** A declared delay is input to a simulation, never a fact inferred from a public source. */
export function parseRiskAssumption(snapshot: CompanySnapshot, relation: CaseRelation, value: unknown): RiskAssumption {
  const raw=record(value,'riskAssumption');
  if(raw.kind!=='inbound_delay' || relation.status!=='unverified' || relation.productId===null) throw new DomainError('INVALID_RISK_ASSUMPTION');
  const purchaseOrderLineId=textField(raw.purchaseOrderLineId,'purchaseOrderLineId');
  const parsed=parseSnapshot(snapshot.dataset);
  const line=parsed.inbound.find(row=>row.id===purchaseOrderLineId);
  if(!line || line.product_id!==relation.productId) throw new DomainError('INVALID_RISK_LINE');
  const purchase=snapshot.dataset.tables.purchase_orders?.find(row=>row.id===line.purchase_order_id);
  if(!purchase || (relation.supplierId!==null && purchase.supplier_id!==relation.supplierId)) throw new DomainError('INVALID_RISK_SUPPLIER');
  const assumedExpectedDate=raw.assumedExpectedDate===null ? null : calendarDate(raw.assumedExpectedDate,'assumedExpectedDate');
  if(assumedExpectedDate!==null && line.expected_date!==null && assumedExpectedDate<line.expected_date) throw new DomainError('INVALID_RISK_DATE');
  if(typeof raw.basis!=='string' || raw.basis.trim().length===0 || raw.basis.length>4000) throw new DomainError('INVALID_RISK_BASIS');
  return {kind:'inbound_delay',purchaseOrderLineId,assumedExpectedDate,basis:raw.basis};
}

/** Structural/data validation only. The server separately verifies the immutable operator event. */
export function parseInternalConfirmation(snapshot: CompanySnapshot, ref: CaseRef, relation: CaseRelation, value: unknown): InternalConfirmation {
  const raw=record(value,'confirmation');const parsed=parseSnapshot(snapshot.dataset);
  if(raw.kind!=='inbound_date_confirmed' || raw.dataOrigin!=='synthetic' || snapshot.dataOrigin!=='synthetic' || raw.companyId!==snapshot.companyId || raw.caseId!==ref.caseId || raw.caseRevision!==ref.caseRevision || raw.businessRevision!==snapshot.revision || raw.policyVersion!==snapshot.policyVersion) throw new DomainError('INVALID_CONFIRMATION_SCOPE');
  const purchaseOrderLineId=textField(raw.purchaseOrderLineId,'purchaseOrderLineId');
  const line=parsed.inbound.find(row=>row.id===purchaseOrderLineId);
  const purchase=line ? parsed.purchases.find(row=>row.id===line.purchase_order_id) : undefined;
  const purchaseRecord=line ? snapshot.dataset.tables.purchase_orders?.find(row=>row.id===line.purchase_order_id) : undefined;
  if(!line || !purchase || purchase.status!=='confirmed' || raw.productId!==line.product_id || relation.status!=='unverified' || relation.productId!==line.product_id || (relation.supplierId!==null && purchaseRecord?.supplier_id!==relation.supplierId)) throw new DomainError('INVALID_CONFIRMATION_LINE');
  const confirmedExpectedDate=calendarDate(raw.confirmedExpectedDate,'confirmedExpectedDate');
  if(line.expected_date!==confirmedExpectedDate) throw new DomainError('STALE_CONFIRMATION');
  const previousExpectedDate=raw.previousExpectedDate===null ? null : calendarDate(raw.previousExpectedDate,'previousExpectedDate');
  const confirmedAt=textField(raw.confirmedAt,'confirmedAt');
  const time=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(confirmedAt);
  if(!time || Number(time[2])>23 || Number(time[3])>59 || Number(time[4])>59 || !Number.isFinite(Date.parse(confirmedAt))) throw new DomainError('INVALID_CONFIRMATION_TIME');
  calendarDate(time[1],'confirmedAt');
  if(typeof raw.basis!=='string' || raw.basis.trim().length===0 || raw.basis.length>4000) throw new DomainError('INVALID_CONFIRMATION_BASIS');
  const exposure = raw.exposureOrderLineIds;
  if (exposure !== undefined && (!Array.isArray(exposure) || exposure.length > 10000 || exposure.some(value => typeof value !== 'string' || value.length === 0 || value.length > 160) || new Set(exposure).size !== exposure.length)) throw new DomainError('INVALID_CONFIRMATION_EXPOSURE');
  return {kind:'inbound_date_confirmed',eventId:textField(raw.eventId,'eventId'),companyId:snapshot.companyId,caseId:ref.caseId,caseRevision:ref.caseRevision,
    purchaseOrderLineId,productId:line.product_id,previousExpectedDate,confirmedExpectedDate,actorId:textField(raw.actorId,'actorId'),confirmedAt,basis:raw.basis,businessRevision:snapshot.revision,policyVersion:snapshot.policyVersion,dataOrigin:'synthetic',...(exposure === undefined ? {} : {exposureOrderLineIds: [...exposure] as string[]})};
}

/** Compare actual and declared hypothetical coverage without writing either snapshot. */
export function evaluateCaseBusiness(snapshot: CompanySnapshot, context: ReleasedCaseContext, targetOrderLineId: string): BusinessEvaluation {
  const parsed=parseSnapshot(snapshot.dataset);
  if(context.businessRevision!==snapshot.revision || context.policyVersion!==snapshot.policyVersion) throw new DomainError('STALE_CONTEXT');
  textField(context.ref.caseId,'caseId');textField(context.ref.caseRevision,'caseRevision');
  const target=parsed.lines.find(line=>line.id===targetOrderLineId);
  if(context.relation.status!=='unverified' || !context.candidateOrderLineIds.includes(targetOrderLineId) || !target || (context.relation.productId!==null && target.product_id!==context.relation.productId)) throw new DomainError('INVALID_CASE_TARGET');
  if(context.riskAssumption!==undefined && context.confirmation!==undefined) throw new DomainError('CONFLICTING_CASE_BASIS');
  if((context.riskAssumption===undefined && context.confirmation===undefined && context.impactKind!=='undetermined') || ((context.riskAssumption!==undefined || context.confirmation!==undefined) && context.impactKind!=='risk')) throw new DomainError('INCOHERENT_CASE_IMPACT');
  const risk=context.riskAssumption===undefined ? undefined : parseRiskAssumption(snapshot,context.relation,context.riskAssumption);
  const confirmation=context.confirmation===undefined ? undefined : parseInternalConfirmation(snapshot,context.ref,context.relation,context.confirmation);
  const actual=evaluateBusiness(snapshot,targetOrderLineId);
  let evaluation=actual;
  if(risk) {
    const hypothetical=structuredClone(snapshot);
    const line=hypothetical.dataset.tables.purchase_order_lines!.find(row=>row.id===risk.purchaseOrderLineId)!;
    line.expected_date=risk.assumedExpectedDate;
    evaluation=evaluateBusiness(hypothetical,targetOrderLineId);
  }
  const caseRef={...context.ref};const evidenceRef={...context.evidenceRef};
  const relationCode=confirmation ? 'EXTERNAL_RELATION_UNVERIFIED' : 'RELATION_UNVERIFIED';
  const relationCondition: JsonObject={code:relationCode,caseRef,evidenceRef};
  const conditions=[relationCode,...(risk ? ['HYPOTHETICAL_INBOUND_DELAY'] : [])];
  const facts: JsonObject={...evaluation.facts,actualCoverage:actual.facts.coverage!,caseRef,evidenceRef,relationCondition,
    impactKind:context.impactKind,coverageBasis:confirmation ? 'confirmed_internal_synthetic' : risk ? 'declared_hypothetical_inbound_delay' : 'unchanged_current_snapshot',...(risk ? {riskAssumption:{...risk}} : {}),...(confirmation ? {confirmation:{...confirmation}} : {})};
  return {...evaluation,id:referenceId('case-evaluation',[snapshot.companyId,snapshot.revision,snapshot.policyVersion,context.ref.caseId,context.ref.caseRevision,context.evidenceRef.occurrenceId,context.evidenceRef.evidenceId,context.evidenceRef.contentHash,targetOrderLineId,JSON.stringify(risk ?? confirmation ?? null)]),
    facts,constraints:[...evaluation.constraints,...conditions],
    options:evaluation.options.map(option=>({...option,status:!confirmation && option.status==='feasible' ? 'conditional' : option.status,
      conditions:[...new Set([...option.conditions,...conditions])],effects:{...option.effects,relationCondition,...(risk ? {riskAssumption:{...risk}} : {}),...(confirmation ? {confirmationEventId:confirmation.eventId} : {})}}))};
}

/** C1 decision callback has no target argument. Return unique options for every current target. */
export const businessEngine: BusinessEngine = (snapshot: CompanySnapshot): BusinessEvaluation => {
  const parsed=parseSnapshot(snapshot.dataset);
  const targets=parsed.lines.filter(l=>parsed.orders.find(o=>o.id===l.order_id)?.status==='confirmed').map(l=>l.id).sort();
  if(targets.length===0) throw new DomainError('NO_CONFIRMED_COMMITMENT');
  const evaluations=targets.map(target=>evaluateBusiness(snapshot,target));
  const first=evaluations[0]!;
  const options=evaluations.flatMap(e=>e.options);
  if(new Set(options.map(o=>o.id)).size!==options.length) throw new DomainError('AMBIGUOUS_OPTION_ID');
  return {...first,id:referenceId('evaluation-all',[snapshot.companyId,snapshot.revision,snapshot.policyVersion]),
    options,unknowns:[...new Set(evaluations.flatMap(e=>e.unknowns))],
    facts:{dataOrigin:parsed.dataOrigin,targetOrderLineIds:targets,coverage:first.facts.coverage!}};
};
