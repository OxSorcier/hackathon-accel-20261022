import { addDays, DomainError, parsePolicy, referenceId } from './model.js';
import type { BusinessPolicy, BusinessSnapshot, CurrentVersion } from './model.js';

export interface Allocation { sourceId: string; quantity: number; availableDate: string }
export interface Coverage { orderLineId: string; orderId: string; productId: string; depotId: string; unit: string; needDate: string | null; requiredDate: string | null; quantity: number; covered: number; shortage: number; allocations: Allocation[]; unknowns: string[] }
export interface EvaluatedOption {
  id: string; kind: 'keep' | 'transfer' | 'emergency'; feasibility: 'feasible' | 'conditional' | 'infeasible';
  targetOrderLineId: string; quantity: number; unit: string; productId: string; costCents: number;
  arrivalDate: string | null; quoteId: string | null; fromDepotId: string | null; toDepotId: string;
  coverage: Coverage[]; constraints: string[]; unknowns: string[];
}
export interface Evaluation { companyId: string; snapshotRevision: string; policyVersion: string; targetOrderLineId: string; evaluatedOn: string; baseline: Coverage[]; options: EvaluatedOption[] }
interface Pool { id: string; productId: string; depotId: string; unit: string; quantity: number; date: string | null; confirmed: boolean; owner: string | null }

function pools(s: BusinessSnapshot, assumeConfirmed: boolean): Pool[] {
  const today=s.asOf.slice(0,10); const result: Pool[]=[];
  for(const stock of s.inventory) {
    const reservations=s.reservations.filter(r=>r.stock_id===stock.id && r.status==='active');
    const reserved=reservations.reduce((q,r)=>q+r.quantity,0);
    result.push({id:stock.id,productId:stock.product_id,depotId:stock.depot_id,unit:stock.unit,quantity:stock.physical_quantity-reserved,date:today,confirmed:true,owner:null});
    for(const r of reservations) result.push({id:stock.id,productId:stock.product_id,depotId:stock.depot_id,unit:stock.unit,quantity:r.quantity,date:today,confirmed:true,owner:r.order_line_id});
  }
  for(const source of s.inbound) {
    const purchase=s.purchases.find(p=>p.id===source.purchase_order_id)!;
    if(purchase.status==='cancelled') continue;
    const allocations=s.inboundAllocations.filter(a=>a.purchase_order_line_id===source.id);
    const confirmed=purchase.status==='confirmed' || assumeConfirmed;
    const date=source.expected_date ?? (assumeConfirmed ? today : null);
    const base={id:source.id,productId:source.product_id,depotId:source.depot_id,unit:source.unit,date,confirmed};
    result.push({...base,quantity:source.quantity-allocations.reduce((q,a)=>q+a.quantity,0),owner:null});
    for(const a of allocations) result.push({...base,quantity:a.quantity,owner:a.order_line_id});
  }
  return result;
}

function cover(s: BusinessSnapshot, resources: Pool[], deadlines: Map<string,string> = new Map()): Coverage[] {
  const orders=new Map(s.orders.map(o=>[o.id,o]));
  const lines=s.lines.filter(l=>orders.get(l.order_id)!.status==='confirmed').slice().sort((a,b)=>{
    const dateA=deadlines.get(a.id) ?? orders.get(a.order_id)!.need_date ?? '9999-12-31';
    const dateB=deadlines.get(b.id) ?? orders.get(b.order_id)!.need_date ?? '9999-12-31';
    return dateA.localeCompare(dateB) || a.id.localeCompare(b.id);
  });
  const result: Coverage[]=[];
  for(const line of lines) {
    const order=orders.get(line.order_id)!; const requiredDate=deadlines.get(line.id) ?? order.need_date;
    const coverage: Coverage={orderLineId:line.id,orderId:order.id,productId:line.product_id,depotId:order.depot_id,unit:line.unit,needDate:order.need_date,requiredDate,quantity:line.quantity,covered:0,shortage:line.quantity,allocations:[],unknowns:[]};
    if(requiredDate===null) coverage.unknowns.push(`MISSING_NEED_DATE:${line.id}`);
    const candidates=resources.filter(p=>p.productId===line.product_id && p.depotId===order.depot_id && p.unit===line.unit && (p.owner===null || p.owner===line.id)).sort((a,b)=>Number(b.owner!==null)-Number(a.owner!==null) || (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.id.localeCompare(b.id));
    for(const p of candidates) {
      if(p.quantity<=0) continue;
      if(!p.confirmed || p.date===null) {coverage.unknowns.push(`UNCONFIRMED_INBOUND:${p.id}`);continue;}
      if(requiredDate===null || p.date>requiredDate) continue;
      const amount=Math.min(coverage.shortage,p.quantity); if(amount===0) break;
      p.quantity-=amount; coverage.covered+=amount; coverage.shortage-=amount;
      coverage.allocations.push({sourceId:p.id,quantity:amount,availableDate:p.date});
    }
    result.push(coverage);
  }
  return result.sort((a,b)=>a.orderLineId.localeCompare(b.orderLineId));
}

/** Pure simulation. It neither releases reservations nor creates a stock movement. */
export function evaluateOptions(snapshot: BusinessSnapshot, policyInput: BusinessPolicy, targetOrderLineId: string): Evaluation {
  const policy=parsePolicy(policyInput); const s=snapshot;
  if(s.companyId!==policy.companyId) throw new DomainError('SCOPE_MISMATCH');
  if(policy.replacementOrderLineIds.some(id=>!s.lines.some(line=>line.id===id))) throw new DomainError('UNKNOWN_POLICY_TARGET');
  const target=s.lines.find(l=>l.id===targetOrderLineId); const order=target ? s.orders.find(o=>o.id===target.order_id) : undefined;
  if(!target || !order || order.status!=='confirmed') throw new DomainError('UNKNOWN_TARGET');
  const today=s.asOf.slice(0,10); const baseline=cover(s,pools(s,false));
  const needed=baseline.find(c=>c.orderLineId===target.id)!.shortage;
  const base={targetOrderLineId,quantity:target.quantity,unit:target.unit,productId:target.product_id,toDepotId:order.depot_id};
  const classify=(coverage: Coverage[], sourceDepot: string | null, optimistic?: Coverage[]): Pick<EvaluatedOption,'feasibility'|'constraints'|'unknowns'> => {
    const relevant=coverage.filter(c=>c.orderLineId===target.id || c.depotId===sourceDepot || c.shortage>(baseline.find(b=>b.orderLineId===c.orderLineId)?.shortage ?? 0));
    const failures=relevant.filter(c=>c.shortage>0 || c.needDate===null);
    const unknowns=[...new Set(relevant.flatMap(c=>c.unknowns))];
    const conditional=failures.length>0 && optimistic!==undefined && failures.every(c=>optimistic.find(o=>o.orderLineId===c.orderLineId)?.shortage===0 && c.needDate!==null);
    return {feasibility:failures.length===0 ? 'feasible' : conditional ? 'conditional' : 'infeasible',constraints:failures.map(c=>`UNCOVERED:${c.orderLineId}:${c.shortage}`),unknowns};
  };
  const physicalIds=new Set(s.inventory.map(i=>i.id));
  const options: EvaluatedOption[]=[{...base,id:referenceId('keep',[target.id]),kind:'keep',costCents:0,arrivalDate:null,quoteId:null,fromDepotId:null,coverage:baseline,...classify(baseline,null,cover(s,pools(s,true)))}];
  for(const quote of s.transports.filter(q=>needed>0 && q.product_id===target.product_id && q.unit===target.unit && q.to_depot_id===order.depot_id)) {
    const arrivalDate=addDays(today,quote.lead_days);
    const simulate=(assume: boolean): {coverage: Coverage[]; missingStock: boolean} => {
      const resource=pools(s,assume); const deadlines=new Map<string,string>(); let remaining=needed;
      // A replacement deadline follows every affected baseline engagement, including free stock.
      const physical=resource.filter(p=>s.inventory.some(i=>i.id===p.id) && p.depotId===quote.from_depot_id && p.productId===target.product_id && p.unit===target.unit).sort((a,b)=>Number(a.owner!==null)-Number(b.owner!==null) || a.id.localeCompare(b.id));
      for(const p of physical) {
        const moved=Math.min(remaining,p.quantity); p.quantity-=moved; remaining-=moved;
      }
      // Deadlines can change allocation order. Follow indirect displacement to a fixed point.
      for(let pass=0;pass<=baseline.length;pass++) {
        const afterMovement=cover(s,structuredClone(resource),deadlines); let changed=false;
        for(const covered of baseline) {
          const beforePhysical=covered.allocations.filter(a=>physicalIds.has(a.sourceId)).reduce((q,a)=>q+a.quantity,0);
          const afterPhysical=afterMovement.find(c=>c.orderLineId===covered.orderLineId)!.allocations.filter(a=>physicalIds.has(a.sourceId)).reduce((q,a)=>q+a.quantity,0);
          if(policy.replacementOrderLineIds.includes(covered.orderLineId) && covered.orderLineId!==target.id && covered.depotId===quote.from_depot_id && covered.needDate!==null && !deadlines.has(covered.orderLineId) && afterPhysical<beforePhysical) {
            deadlines.set(covered.orderLineId,addDays(covered.needDate,-policy.replacementMarginDays)); changed=true;
          }
        }
        if(!changed) break;
      }
      resource.push({id:quote.id,productId:target.product_id,depotId:order.depot_id,unit:target.unit,quantity:needed-remaining,date:arrivalDate,confirmed:quote.confirmed || assume,owner:target.id});
      return {coverage:cover(s,resource,deadlines),missingStock:remaining>0};
    };
    const actual=simulate(false); const optimistic=simulate(true); const status=classify(actual.coverage,quote.from_depot_id,optimistic.coverage);
    const constraints=[...status.constraints];
    if(actual.missingStock) constraints.push('INSUFFICIENT_PHYSICAL_STOCK');
    if(quote.capacity<needed) constraints.push('TRANSPORT_CAPACITY');
    if(quote.valid_on!==today) constraints.push('EXPIRED_QUOTE');
    options.push({...base,quantity:needed,id:referenceId('transfer',[target.id,quote.id]),kind:'transfer',costCents:quote.costCents,arrivalDate,quoteId:quote.id,fromDepotId:quote.from_depot_id,coverage:actual.coverage,...status,constraints,feasibility:constraints.some(c=>['INSUFFICIENT_PHYSICAL_STOCK','TRANSPORT_CAPACITY','EXPIRED_QUOTE'].includes(c)) ? 'infeasible' : status.feasibility});
  }
  for(const quote of s.emergency.filter(q=>needed>0 && q.product_id===target.product_id && q.unit===target.unit && q.destination_depot_id===order.depot_id)) {
    const arrivalDate=addDays(today,quote.lead_days); const resources=pools(s,false);
    const purchased=Math.min(needed,quote.available_quantity);
    resources.push({id:quote.id,productId:target.product_id,depotId:order.depot_id,unit:target.unit,quantity:purchased,date:arrivalDate,confirmed:quote.confirmed,owner:target.id});
    const coverage=cover(s,resources); const optimistic=cover(s,[...pools(s,true),{id:quote.id,productId:target.product_id,depotId:order.depot_id,unit:target.unit,quantity:purchased,date:arrivalDate,confirmed:true,owner:target.id}]);
    const status=classify(coverage,null,optimistic); const constraints=[...status.constraints];
    if(quote.valid_on!==today) constraints.push('EXPIRED_QUOTE');
    const costCents=purchased*quote.unitPriceCents+quote.freightCents;
    if(!Number.isSafeInteger(costCents)) throw new DomainError('COST_OVERFLOW');
    options.push({...base,quantity:purchased,id:referenceId('emergency',[target.id,quote.id]),kind:'emergency',costCents,arrivalDate,quoteId:quote.id,fromDepotId:null,coverage,...status,constraints,feasibility:quote.valid_on===today ? status.feasibility : 'infeasible'});
  }
  return {companyId:s.companyId,snapshotRevision:s.revision,policyVersion:policy.version,targetOrderLineId,evaluatedOn:today,baseline,options};
}

export function assertCurrentEvaluation(evaluation: Evaluation, current: CurrentVersion): void {
  if(evaluation.companyId!==current.companyId) throw new DomainError('SCOPE_MISMATCH');
  if(evaluation.snapshotRevision!==current.revision || evaluation.policyVersion!==current.policyVersion) throw new DomainError('STALE_CONTEXT');
}
