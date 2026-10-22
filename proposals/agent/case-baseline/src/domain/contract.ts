import type { BusinessEngine, BusinessEvaluation, CompanySnapshot, JsonObject } from '../contracts/index.js';
import { evaluateOptions } from './engine.js';
import { DomainError, parseSnapshot, quantity, record, textField, referenceId } from './model.js';
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
      label:o.kind==='keep' ? 'Conserver la couverture actuelle' : o.kind==='emergency' ? 'Préparer un achat de secours' : 'Préparer un transfert',
      status:o.feasibility==='infeasible' ? 'rejected' : o.feasibility,costEur:o.costCents/100,
      conditions:[...o.unknowns,...o.constraints],reasons:o.constraints,
      effects:{targetOrderLineId:target,productId:o.productId,quantity:quantity(o.quantity,'quantity'),unit:o.unit,
        fromDepotId:o.fromDepotId,toDepotId:o.toDepotId,quoteId:o.quoteId,arrivalDate:o.arrivalDate,
        coverage:o.coverage.map(c=>({...c,allocations:c.allocations.map(a=>({...a}))})),simulationOnly:true},
    })),
  };
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
