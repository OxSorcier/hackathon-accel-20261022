import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Actor, CompanySnapshot, JsonObject } from '../contracts/index.js';
import type { IndustrialSimulationInput } from '../contracts/industrial-api.js';
import type { CoordinatedIndustrialPlan, IndustrialApproval, IndustrialCapacityUse, IndustrialContext, IndustrialDemoExecution, IndustrialDraftOfferRef, IndustrialExecutionState, IndustrialPersistedAllocation, IndustrialPlanStep, IndustrialScheduledTransfer, IndustrialStockHold } from '../contracts/industrial.js';
import { currentIndustrialContext } from '../data/industrial-relations.js';
import { isoDate } from '../data/validation.js';
import { AppError, PgStore } from './store.js';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9:_.-]+$/);
const quantity = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const calendar = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
});
const target = z.discriminatedUnion('kind', [z.object({kind:z.literal('commitment'),id}).strict(),z.object({kind:z.literal('crm_demand'),id}).strict()]);
const holdSchema: z.ZodType<IndustrialStockHold> = z.object({id,executionId:id,stepId:id,stockId:id,productId:id,unit:id,quantity,status:z.enum(['active','released','settled'])}).strict();
const useSchema: z.ZodType<IndustrialCapacityUse> = z.object({id,executionId:id,stepId:id,resourceKind:z.enum(['purchase_quote','transport_quote']),canonicalResourceId:id,resourceVersion:id,quantity,status:z.enum(['committed','cancelled'])}).strict();
const transferSchema: z.ZodType<IndustrialScheduledTransfer> = z.object({id,executionId:id,stepId:id,sourceHoldIds:z.array(id).min(1).max(100),productId:id,unit:id,quantity,fromDepotId:id,destinationDepotId:id,dispatchDate:calendar,arrivalDate:calendar,status:z.enum(['confirmed_scheduled','cancelled','received'])}).strict();
const resource = z.discriminatedUnion('kind',[z.object({kind:z.literal('c1_inbound'),id}).strict(),z.object({kind:z.literal('scheduled_transfer'),id}).strict(),z.object({kind:z.literal('held_stock'),holdId:id}).strict()]);
const allocationSchema: z.ZodType<IndustrialPersistedAllocation> = z.object({id,executionId:id,resource,target,productId:id,unit:id,quantity,status:z.enum(['active','released','settled'])}).strict();
const draftSchema: z.ZodType<IndustrialDraftOfferRef> = z.object({id,executionId:id,opportunityId:id,demandVersion:id,quantity,allocationIds:z.array(id).min(1).max(100),status:z.enum(['draft','cancelled'])}).strict();
const inputSchema: z.ZodType<IndustrialSimulationInput> = z.object({expectedBusinessRevision:id,expectedPlanVersion:id,expectedPlanHash:z.string().regex(/^[a-f0-9]{64}$/),operationKey:z.string().min(8).max(128).regex(/^[A-Za-z0-9:_.-]+$/)}).strict();
const receiptSchema: z.ZodType<IndustrialDemoExecution> = z.object({id,companyId:id,planId:id,planVersion:id,planHash:z.string().regex(/^[a-f0-9]{64}$/),approvalId:id,operationKey:z.string().min(8).max(128),actorId:id,commandHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['applied','failed','uncertain']),beforeRevision:id,afterRevision:id.nullable(),records:z.array(z.object({kind:z.enum(['purchase_order','transfer_order','origin_stock_reservation','planned_allocation','crm_offer']),id,status:z.string().min(1).max(100)}).strict()).max(10000),completedAt:z.string().nullable(),code:z.string().nullable(),simulation:z.literal(true)}).strict();

function failure(code = 'INVALID_INDUSTRIAL_EXECUTION', status = 409): never { throw new AppError(code,'The simulated execution cannot be applied in its current state.',status); }
function checked<T>(schema: z.ZodType<T>, value: unknown): T { const result=schema.safeParse(value); if(!result.success) failure(); return result.data; }
function hash(value: unknown): string {
  const canonical=(item:unknown):string=>{
    if(item===null||typeof item==='string'||typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item))return JSON.stringify(item);
    if(Array.isArray(item))return `[${item.map(canonical).join(',')}]`;
    if(typeof item==='object'&&item!==null)return `{${Object.entries(item).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>`${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
    return failure();
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function nativeId(prefix:string,parts:string[]):string{return `${prefix}:${hash(parts).slice(0,40)}`;}
function safeSum(a:number,b:number):number{const result=a+b;if(!Number.isSafeInteger(result))failure();return result;}
function integer(value:unknown,min=0):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min)failure();return value;}
function cents(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value)||value<0)failure();const result=Math.round(value*100);if(!Number.isSafeInteger(result)||Math.abs(value*100-result)>0.000001)failure();return result;}

type LedgerValue = IndustrialStockHold | IndustrialCapacityUse | IndustrialScheduledTransfer | IndustrialPersistedAllocation | IndustrialDraftOfferRef;
type LedgerKind = 'stock_hold'|'capacity_use'|'scheduled_transfer'|'allocation'|'draft_offer';
interface LedgerEntry {kind:LedgerKind;stepId:string;value:LedgerValue}
interface LedgerRow extends Record<string,unknown> {company_id:string;id:string;execution_id:string;step_id:string;kind:string;payload:unknown;created_revision:string;execution_payload:unknown;approval_id:string;execution_operation_key:string;execution_command_hash:string}

/** Caller supplies a transaction client; the company lock keeps revision and ledger coherent. */
export async function readIndustrialExecutionState(client:PoolClient,companyId:string,businessRevision:string):Promise<IndustrialExecutionState>{
  checked(id,companyId);checked(id,businessRevision);
  const company=(await client.query<{revision:string}>('SELECT snapshot->>\'revision\' AS revision FROM companies WHERE company_id=$1 FOR UPDATE',[companyId])).rows[0];
  if(!company||company.revision!==businessRevision)failure('STALE_INDUSTRIAL_LEDGER');
  const state:IndustrialExecutionState={companyId,businessRevision,stockHolds:[],capacityUses:[],scheduledTransfers:[],allocations:[],draftOffers:[]};
  const rows=(await client.query<LedgerRow>(`SELECT l.*,e.payload AS execution_payload,e.approval_id,e.operation_key AS execution_operation_key,e.command_hash AS execution_command_hash FROM accel_industrial_resource_ledger l JOIN accel_industrial_executions e ON e.company_id=l.company_id AND e.id=l.execution_id WHERE l.company_id=$1 ORDER BY l.id`,[companyId])).rows;
  if(rows.length>50000)failure('INDUSTRIAL_LEDGER_LIMIT');
  for(const row of rows){
    checked(id,row.id);checked(id,row.step_id);checked(id,row.created_revision);
    const execution=checked(receiptSchema,row.execution_payload);
    if(row.company_id!==companyId||execution.companyId!==companyId||execution.id!==row.execution_id||execution.approvalId!==row.approval_id||execution.operationKey!==row.execution_operation_key||execution.commandHash!==row.execution_command_hash||execution.status!=='applied'||execution.afterRevision!==row.created_revision||execution.completedAt===null)failure('INVALID_INDUSTRIAL_LEDGER');
    isoDate(execution.completedAt);
    let value:LedgerValue;
    switch(row.kind){
      case 'stock_hold':value=checked(holdSchema,row.payload);state.stockHolds.push(value);break;
      case 'capacity_use':value=checked(useSchema,row.payload);state.capacityUses.push(value);break;
      case 'scheduled_transfer':value=checked(transferSchema,row.payload);if(value.arrivalDate<value.dispatchDate||new Set(value.sourceHoldIds).size!==value.sourceHoldIds.length)failure();state.scheduledTransfers.push(value);break;
      case 'allocation':value=checked(allocationSchema,row.payload);state.allocations.push(value);break;
      case 'draft_offer':value=checked(draftSchema,row.payload);if(new Set(value.allocationIds).size!==value.allocationIds.length)failure();state.draftOffers.push(value);break;
      default:return failure('INVALID_INDUSTRIAL_LEDGER');
    }
    if(value.id!==row.id||value.executionId!==row.execution_id||('stepId' in value&&value.stepId!==row.step_id))failure('INVALID_INDUSTRIAL_LEDGER');
    const expectedKind=row.kind==='stock_hold'?'origin_stock_reservation':row.kind==='scheduled_transfer'?'transfer_order':row.kind==='allocation'?'planned_allocation':row.kind==='draft_offer'?'crm_offer':null;
    if(expectedKind&&!execution.records.some(record=>record.kind===expectedKind&&record.id===value.id))failure('INVALID_INDUSTRIAL_LEDGER');
  }
  for(const values of [state.stockHolds,state.capacityUses,state.scheduledTransfers,state.allocations,state.draftOffers])if(values.length>10000)failure('INDUSTRIAL_LEDGER_LIMIT');
  return state;
}

export interface RevalidatedIndustrialExecution {snapshot:CompanySnapshot;approval:IndustrialApproval;plan:CoordinatedIndustrialPlan;executionState:IndustrialExecutionState;context:IndustrialContext}
export interface IndustrialDemoExecutorOptions {store:PgStore;revalidate(client:PoolClient,actor:Actor,approvalId:string,input:IndustrialSimulationInput):Promise<RevalidatedIndustrialExecution>;now?:()=>Date}
export interface IndustrialDemoExecutor {execute(actor:Actor,approvalId:string,input:IndustrialSimulationInput):Promise<IndustrialDemoExecution>}

const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),dependsOn=z.array(id).max(50);
const stepSchema:z.ZodType<IndustrialPlanStep>=z.discriminatedUnion('kind',[
  z.object({id,kind:z.literal('purchase'),canonicalResourceId:id,quoteId:id,supplierId:id,supplierSiteId:id,productId:id,unit:id,quantity,destinationDepotId:id,arrivalDate:calendar,materialCents:money,freightCents:money,dependsOn}).strict(),
  z.object({id,kind:z.literal('transfer'),canonicalResourceId:id,quoteId:id,quoteSource:z.enum(['c1_transport','industrial_delivery']),productId:id,unit:id,quantity,fromDepotId:id,destinationDepotId:id,dispatchDate:calendar,arrivalDate:calendar,freightCents:money,handlingCents:money,dependsOn}).strict(),
  z.object({id,kind:z.literal('prepare_offer'),opportunityId:id,productId:id,unit:id,quantity,destinationDepotId:id,needDate:calendar,saleUnitPriceCents:money,dependsOn}).strict(),
]);
const plannedAllocationSchema=z.object({canonicalResourceId:id,targetKind:z.enum(['commitment','crm_demand']),targetId:id,productId:id,unit:id,quantity,availableDate:calendar,supplyStepId:id.optional()}).strict();
interface NativeRecord {id:string;kind:IndustrialDemoExecution['records'][number]['kind'];status:string;payload:JsonObject}
interface ExecutionEffects {snapshot:CompanySnapshot;ledger:LedgerEntry[];documents:NativeRecord[]}

function effects(value:RevalidatedIndustrialExecution,actor:Actor,executionId:string,revision:string,at:string):ExecutionEffects{
  const {plan,executionState:existing}=value,snapshot=structuredClone(value.snapshot),context=currentIndustrialContext(value.context,value.snapshot,at);
  const steps=checked(z.array(stepSchema).min(1).max(50),plan.steps),byStep=new Map(steps.map(step=>[step.id,step]));
  if(byStep.size!==steps.length)failure();
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(stepId:string):void=>{if(visiting.has(stepId))failure();if(visited.has(stepId))return;const step=byStep.get(stepId);if(!step||new Set(step.dependsOn).size!==step.dependsOn.length)failure();visiting.add(stepId);for(const dep of step.dependsOn)visit(dep);visiting.delete(stepId);visited.add(stepId);};
  for(const step of steps)visit(step.id);
  const ledger:LedgerEntry[]=[],documents:NativeRecord[]=[],supplies=new Map<string,{resource:IndustrialPersistedAllocation['resource'];step:Extract<IndustrialPlanStep,{kind:'purchase'|'transfer'}>;quantity:number}>();
  function rows(name:string):JsonObject[]{const result=snapshot.dataset.tables[name];if(!Array.isArray(result))failure();return result;}
  function row(name:string,key:string):JsonObject{const result=rows(name).find(item=>item.id===key);if(!result)failure();return result;}
  function add(entry:LedgerEntry):void{ledger.push(entry);}
  function document(kind:NativeRecord['kind'],key:string,status:string,payload:JsonObject):void{documents.push({id:key,kind,status,payload});}
  function provenance(key:string):JsonObject{return {system:'ERP_DEMO',nativeId:key,version:revision,receivedAt:at,actorId:actor.actorId};}
  const timezone=rows('company')[0]?.timezone??'UTC';if(typeof timezone!=='string')failure();
  let formatter:Intl.DateTimeFormat;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{return failure();}
  const parts=formatter.formatToParts(new Date(at)),part=(type:string):string=>parts.find(item=>item.type===type)?.value??'',today=`${part('year')}-${part('month')}-${part('day')}`;
  function capacity(kind:IndustrialCapacityUse['resourceKind'],key:string,amount:number):void{
    const native=row(kind==='purchase_quote'?'emergency_quotes':'transport_quotes',key),limit=integer(kind==='purchase_quote'?native.available_quantity:native.capacity);
    const prior=existing.capacityUses.filter(use=>use.status==='committed'&&use.resourceKind===kind&&use.canonicalResourceId===key).reduce((n,use)=>safeSum(n,use.quantity),0);
    const current=ledger.filter(entry=>entry.kind==='capacity_use').map(entry=>entry.value as IndustrialCapacityUse).filter(use=>use.resourceKind===kind&&use.canonicalResourceId===key).reduce((n,use)=>safeSum(n,use.quantity),0);
    if(safeSum(safeSum(prior,current),amount)>limit||native.valid_on!==today||!['confirmed','synthetic_confirmed'].includes(String(native.quote_status)))failure('INDUSTRIAL_RESOURCE_UNAVAILABLE');
  }
  let spend=0;
  for(const step of steps){
    const product=row('products',step.productId);if(product.unit!==step.unit)failure();row('depots',step.destinationDepotId);
    if(step.kind==='purchase'){
      const quote=row('emergency_quotes',step.canonicalResourceId),alternative=context.independentAlternatives.find(item=>item.canonicalResourceId===step.canonicalResourceId);
      if(step.quoteId!==step.canonicalResourceId||!alternative||alternative.supplierSiteId!==step.supplierSiteId||alternative.affectedSiteRelation!=='independent'||step.arrivalDate!==alternative.arrivalDate||quote.supplier_id!==step.supplierId||quote.product_id!==step.productId||quote.unit!==step.unit||quote.destination_depot_id!==step.destinationDepotId||step.quantity>alternative.availableQuantity||step.arrivalDate<today||step.materialCents!==step.quantity*cents(quote.unit_price_eur)||step.freightCents!==cents(quote.freight_eur)||!Number.isSafeInteger(step.materialCents)||step.materialCents%step.quantity!==0)failure();
      row('suppliers',step.supplierId);capacity('purchase_quote',step.canonicalResourceId,step.quantity);
      const purchaseId=nativeId('PO-IND',[executionId,step.id]),lineId=nativeId('POL-IND',[executionId,step.id]);
      if(rows('purchase_orders').some(item=>item.id===purchaseId)||rows('purchase_order_lines').some(item=>item.id===lineId))failure();
      const purchase:JsonObject={id:purchaseId,supplier_id:step.supplierId,status:'confirmed',data_origin:'synthetic',demo_execution_id:executionId,provenance:provenance(purchaseId)};
      const line:JsonObject={id:lineId,purchase_order_id:purchaseId,product_id:step.productId,depot_id:step.destinationDepotId,quantity:step.quantity,unit:step.unit,expected_date:step.arrivalDate,unit_cost_eur:step.materialCents/step.quantity/100,data_origin:'synthetic',provenance:provenance(lineId)};
      rows('purchase_orders').push(purchase);rows('purchase_order_lines').push(line);
      add({kind:'capacity_use',stepId:step.id,value:{id:nativeId('capacity-use',[executionId,step.id]),executionId,stepId:step.id,resourceKind:'purchase_quote',canonicalResourceId:step.canonicalResourceId,resourceVersion:hash(quote),quantity:step.quantity,status:'committed'}});
      supplies.set(step.id,{resource:{kind:'c1_inbound',id:lineId},step,quantity:step.quantity});
      document('purchase_order',purchaseId,'confirmed_future',{purchase_order:purchase,purchase_order_line:line,simulation:true});spend=safeSum(spend,safeSum(step.materialCents,step.freightCents));
    }else if(step.kind==='transfer'){
      const stock=row('inventory',step.canonicalResourceId),delivery=step.quoteSource==='industrial_delivery'?context.deliveryQuotes.find(item=>item.quoteId===step.quoteId):null;
      const quoteId=step.quoteSource==='industrial_delivery'?delivery?.transportQuoteId:step.quoteId;if(!quoteId)failure();const quote=row('transport_quotes',quoteId);
      if(stock.product_id!==step.productId||stock.unit!==step.unit||stock.depot_id!==step.fromDepotId||step.fromDepotId===step.destinationDepotId||quote.from_depot_id!==step.fromDepotId||quote.to_depot_id!==step.destinationDepotId||quote.product_id!==step.productId||quote.unit!==step.unit||cents(quote.cost_eur)!==safeSum(step.freightCents,step.handlingCents)||step.dispatchDate<today||step.arrivalDate<step.dispatchDate)failure();
      const minimum=new Date(`${checked(calendar,quote.valid_on)}T00:00:00Z`);minimum.setUTCDate(minimum.getUTCDate()+integer(quote.lead_days));if(!Number.isFinite(minimum.getTime())||step.arrivalDate<minimum.toISOString().slice(0,10))failure();
      if(step.quoteSource==='industrial_delivery'&&(!delivery||delivery.sourceStockId!==stock.id||delivery.dispatchDate!==step.dispatchDate||delivery.arrivalDate!==step.arrivalDate||delivery.freightCents!==step.freightCents||delivery.handlingCents!==step.handlingCents||delivery.availableQuantity<step.quantity))failure();
      const reserved=rows('reservations').filter(item=>item.stock_id===stock.id&&item.status==='active').reduce((n,item)=>safeSum(n,integer(item.quantity)),0);
      const held=existing.stockHolds.filter(item=>item.stockId===stock.id&&item.status==='active').reduce((n,item)=>safeSum(n,item.quantity),0);
      const newHeld=ledger.filter(entry=>entry.kind==='stock_hold').map(entry=>entry.value as IndustrialStockHold).filter(item=>item.stockId===stock.id).reduce((n,item)=>safeSum(n,item.quantity),0);
      if(safeSum(safeSum(safeSum(reserved,held),newHeld),step.quantity)>integer(stock.physical_quantity))failure('INDUSTRIAL_STOCK_UNAVAILABLE');
      capacity('transport_quote',quoteId,step.quantity);
      const hold:IndustrialStockHold={id:nativeId('stock-hold',[executionId,step.id]),executionId,stepId:step.id,stockId:step.canonicalResourceId,productId:step.productId,unit:step.unit,quantity:step.quantity,status:'active'};
      const transfer:IndustrialScheduledTransfer={id:nativeId('transfer-order',[executionId,step.id]),executionId,stepId:step.id,sourceHoldIds:[hold.id],productId:step.productId,unit:step.unit,quantity:step.quantity,fromDepotId:step.fromDepotId,destinationDepotId:step.destinationDepotId,dispatchDate:step.dispatchDate,arrivalDate:step.arrivalDate,status:'confirmed_scheduled'};
      add({kind:'stock_hold',stepId:step.id,value:hold});add({kind:'scheduled_transfer',stepId:step.id,value:transfer});
      add({kind:'capacity_use',stepId:step.id,value:{id:nativeId('capacity-use',[executionId,step.id]),executionId,stepId:step.id,resourceKind:'transport_quote',canonicalResourceId:quoteId,resourceVersion:hash(quote),quantity:step.quantity,status:'committed'}});
      supplies.set(step.id,{resource:{kind:'scheduled_transfer',id:transfer.id},step,quantity:step.quantity});
      document('origin_stock_reservation',hold.id,'active',{...hold,simulation:true});document('transfer_order',transfer.id,'confirmed_scheduled',{...transfer,simulation:true});spend=safeSum(spend,safeSum(step.freightCents,step.handlingCents));
    }
  }
  if(spend!==integer(plan.economics.grossNewSpendCents)||plan.economics.currency!=='EUR')failure();
  const allocated=new Map<string,number>(),newAllocations:{stepId:string;value:IndustrialPersistedAllocation}[]=[],allocationIdentities=new Set<string>();
  for(const allocation of checked(z.array(plannedAllocationSchema).max(20000),plan.allocations)){
    // Whole-portfolio coverage is explanatory. Only newly supplied resources are a write delta.
    if(allocation.supplyStepId===undefined)continue;
    const supplied=supplies.get(allocation.supplyStepId);if(!supplied||allocation.canonicalResourceId!==supplied.step.canonicalResourceId||allocation.productId!==supplied.step.productId||allocation.unit!==supplied.step.unit||allocation.availableDate!==supplied.step.arrivalDate)failure();
    const identity=JSON.stringify([allocation.supplyStepId,allocation.targetKind,allocation.targetId]);if(allocationIdentities.has(identity))failure();allocationIdentities.add(identity);
    const total=safeSum(allocated.get(allocation.supplyStepId)??0,allocation.quantity);if(total>supplied.quantity)failure();allocated.set(allocation.supplyStepId,total);
    if(allocation.targetKind==='commitment'){
      const line=row('order_lines',allocation.targetId),order=row('orders',String(line.order_id));
      if(order.status!=='confirmed'||line.product_id!==allocation.productId||line.unit!==allocation.unit||order.depot_id!==supplied.step.destinationDepotId||typeof order.need_date!=='string'||allocation.availableDate>order.need_date)failure();
    }else{
      const demand=context.commercialDemand.find(item=>item.opportunityId===allocation.targetId);
      if(!demand||demand.productId!==allocation.productId||demand.unit!==allocation.unit||demand.destinationDepotId!==supplied.step.destinationDepotId||allocation.availableDate>demand.needDate)failure();
    }
    const value:IndustrialPersistedAllocation={id:nativeId('planned-allocation',[executionId,identity]),executionId,resource:supplied.resource,target:{kind:allocation.targetKind,id:allocation.targetId},productId:allocation.productId,unit:allocation.unit,quantity:allocation.quantity,status:'active'};
    newAllocations.push({stepId:allocation.supplyStepId,value});add({kind:'allocation',stepId:allocation.supplyStepId,value});document('planned_allocation',value.id,'active',{...value,simulation:true});
  }
  for(const [stepId,supplied]of supplies)if(allocated.get(stepId)!==supplied.quantity)failure('UNALLOCATED_INDUSTRIAL_SUPPLY');
  const claimed=new Set<string>(),offered=new Set<string>();
  for(const step of steps)if(step.kind==='prepare_offer'){
    const demand=context.commercialDemand.find(item=>item.opportunityId===step.opportunityId);if(!demand||offered.has(step.opportunityId)||step.productId!==demand.productId||step.unit!==demand.unit||step.destinationDepotId!==demand.destinationDepotId||step.needDate!==demand.needDate||step.saleUnitPriceCents!==demand.saleUnitPriceCents||step.needDate<today)failure();offered.add(step.opportunityId);
    const candidates=newAllocations.filter(item=>item.value.target.kind==='crm_demand'&&item.value.target.id===step.opportunityId);
    if(candidates.length===0||candidates.some(item=>!step.dependsOn.includes(item.stepId)||claimed.has(item.value.id)))failure();
    const amount=candidates.reduce((n,item)=>safeSum(n,item.value.quantity),0),previous=existing.draftOffers.filter(item=>item.opportunityId===step.opportunityId&&item.status==='draft').reduce((n,item)=>safeSum(n,item.quantity),0);
    if(amount!==step.quantity||safeSum(previous,amount)>demand.quantity)failure('INDUSTRIAL_DEMAND_UNAVAILABLE');for(const item of candidates)claimed.add(item.value.id);
    const offer:IndustrialDraftOfferRef={id:nativeId('crm-offer',[executionId,step.id]),executionId,opportunityId:step.opportunityId,demandVersion:checked(id,demand.provenance.version),quantity:step.quantity,allocationIds:candidates.map(item=>item.value.id),status:'draft'};
    add({kind:'draft_offer',stepId:step.id,value:offer});document('crm_offer',offer.id,'draft',{...offer,product_id:step.productId,unit:step.unit,sale_unit_price_cents:step.saleUnitPriceCents,currency:'EUR',potential_revenue_cents:integer(step.quantity*step.saleUnitPriceCents),simulation:true});
  }
  if(newAllocations.some(item=>item.value.target.kind==='crm_demand'&&!claimed.has(item.value.id)))failure();
  snapshot.revision=revision;snapshot.dataset.snapshot_revision=revision;snapshot.dataset.as_of=at;snapshot.updatedAt=at;
  return {snapshot,ledger,documents};
}

/** One database transaction is the complete simulated effect. No external ERP call is made. */
export function createIndustrialDemoExecutor(options:IndustrialDemoExecutorOptions):IndustrialDemoExecutor{
  const now=options.now??(():Date=>new Date());
  return {async execute(actor,approvalId,raw):Promise<IndustrialDemoExecution>{
    checked(id,actor.companyId);checked(id,actor.actorId);checked(id,approvalId);
    if(actor.role!=='direction'&&actor.role!=='achats')failure('FORBIDDEN',403);
    const ceiling=cents(actor.approvalCeilingEur),input=checked(inputSchema,raw),commandHash=hash({actorId:actor.actorId,approvalId,expectedBusinessRevision:input.expectedBusinessRevision,expectedPlanVersion:input.expectedPlanVersion,expectedPlanHash:input.expectedPlanHash});
    let attempt:IndustrialDemoExecution|null=null;
    const prior=async(client:PoolClient):Promise<IndustrialDemoExecution|null>=>{
      const result=await client.query<{payload:unknown}>('SELECT payload FROM accel_industrial_executions WHERE company_id=$1 AND (operation_key=$2 OR approval_id=$3) ORDER BY operation_key=$2 DESC LIMIT 2',[actor.companyId,input.operationKey,approvalId]);
      if(!result.rows.length)return null;if(result.rows.length>1)failure('OPERATION_CONFLICT');
      const value=checked(receiptSchema,result.rows[0]!.payload);if(value.companyId!==actor.companyId||value.actorId!==actor.actorId||value.approvalId!==approvalId||value.commandHash!==commandHash)failure('OPERATION_CONFLICT');return value;
    };
    try{return await options.store.transaction(async(client):Promise<IndustrialDemoExecution>=>{
      const current=await options.store.snapshot(actor.companyId,client,true),duplicate=await prior(client);if(duplicate)return duplicate;
      if(current.revision!==input.expectedBusinessRevision)failure('STALE_CONTEXT');
      const stored=(await client.query<{payload:IndustrialApproval}>('SELECT payload FROM accel_industrial_approvals WHERE company_id=$1 AND id=$2 FOR UPDATE',[actor.companyId,approvalId])).rows[0]?.payload;
      if(!stored)failure('APPROVAL_NOT_FOUND',404);
      const verified=await options.revalidate(client,actor,approvalId,input),{approval,plan}=verified;
      const state=await readIndustrialExecutionState(client,actor.companyId,current.revision);
      const head=(await client.query<{revision:string;qualification_revision:string}>('SELECT h.revision,v.payload->>\'qualificationRevision\' AS qualification_revision FROM accel_industrial_context_heads h JOIN accel_industrial_context_versions v USING(company_id,revision) WHERE h.company_id=$1',[actor.companyId])).rows[0];
      if(!head||head.revision!==verified.context.revision||head.qualification_revision!==verified.context.qualificationRevision)failure('STALE_INDUSTRIAL_CONTEXT');
      if(hash(verified.snapshot)!==hash(current)||hash(approval)!==hash(stored)||hash(verified.executionState)!==hash(state)||approval.id!==approvalId||approval.companyId!==actor.companyId||approval.decision!=='approved'||approval.planId!==plan.id||approval.planVersion!==plan.version||approval.planHash!==hash(plan)||input.expectedPlanHash!==approval.planHash||input.expectedPlanVersion!==plan.version||hash(approval.basis)!==hash(plan.basis)||plan.basis.companyId!==actor.companyId||plan.basis.businessRevision!==current.revision||plan.basis.policyVersion!==current.policyVersion||verified.context.companyId!==actor.companyId||verified.context.revision!==plan.basis.contextRevision||verified.context.qualificationRevision!==plan.basis.qualificationRevision||plan.status!=='feasible'||!Array.isArray(plan.constraints)||plan.constraints.length!==0)failure('STALE_OR_INADMISSIBLE_PLAN');
      if(integer(plan.economics.grossNewSpendCents)>ceiling)failure('BUDGET',403);
      const at=isoDate(now()),executionId=randomUUID(),revision=`R-${randomUUID()}`,delta=effects(verified,actor,executionId,revision,at);
      const receipt:IndustrialDemoExecution={id:executionId,companyId:actor.companyId,planId:plan.id,planVersion:plan.version,planHash:approval.planHash,approvalId,operationKey:input.operationKey,actorId:actor.actorId,commandHash,status:'applied',beforeRevision:current.revision,afterRevision:revision,records:delta.documents.map(item=>({kind:item.kind,id:item.id,status:item.status})),completedAt:at,code:null,simulation:true};attempt=receipt;
      await client.query('INSERT INTO accel_industrial_executions(id,company_id,approval_id,operation_key,command_hash,payload) VALUES($1,$2,$3,$4,$5,$6)',[executionId,actor.companyId,approvalId,input.operationKey,commandHash,receipt]);
      for(const entry of delta.ledger)await client.query('INSERT INTO accel_industrial_resource_ledger(company_id,id,execution_id,step_id,kind,payload,created_revision) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.companyId,entry.value.id,executionId,entry.stepId,entry.kind,entry.value,revision]);
      for(const item of delta.documents)await client.query('INSERT INTO accel_industrial_demo_records(company_id,id,execution_id,kind,payload) VALUES($1,$2,$3,$4,$5)',[actor.companyId,item.id,executionId,item.kind,item.payload]);
      await client.query('UPDATE companies SET snapshot=$2 WHERE company_id=$1',[actor.companyId,delta.snapshot]);
      await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actor.companyId,revision,actor.actorId,'industrial_demo_execution',{executionId,approvalId,planId:plan.id,previousRevision:current.revision,simulation:true}]);
      await client.query("UPDATE proposals SET payload=jsonb_set(payload,'{status}','\"stale\"') WHERE company_id=$1 AND payload->>'status'='pending'",[actor.companyId]);
      // Reports and approvals stay immutable; their old basis is projected stale on read.
      await client.query("UPDATE accel_industrial_analysis_intents SET status='stale',blocked_reason='BUSINESS_REVISION_CHANGED' WHERE company_id=$1 AND status IN ('ready','queued')",[actor.companyId]);
      await client.query("UPDATE runs SET payload=jsonb_set(jsonb_set(payload,'{status}','\"stale_context\"'),'{completedAt}',to_jsonb($2::text)) WHERE company_id=$1 AND payload->>'status'='queued'",[actor.companyId,at]);
      const readback=await prior(client),updated=await options.store.snapshot(actor.companyId,client),loaded=await readIndustrialExecutionState(client,actor.companyId,revision);
      if(!readback||hash(readback)!==hash(receipt)||hash(updated)!==hash(delta.snapshot)||loaded.stockHolds.length!==state.stockHolds.length+delta.ledger.filter(item=>item.kind==='stock_hold').length||loaded.allocations.length!==state.allocations.length+delta.ledger.filter(item=>item.kind==='allocation').length)failure('EXECUTION_READBACK_FAILED',503);
      const actualLedger=(await client.query<{id:string;kind:string;step_id:string;payload:unknown;created_revision:string}>('SELECT id,kind,step_id,payload,created_revision FROM accel_industrial_resource_ledger WHERE company_id=$1 AND execution_id=$2',[actor.companyId,executionId])).rows.sort((a,b)=>a.id.localeCompare(b.id));
      const expectedLedger=delta.ledger.map(entry=>({id:entry.value.id,kind:entry.kind,step_id:entry.stepId,payload:entry.value,created_revision:revision})).sort((a,b)=>a.id.localeCompare(b.id));
      const actualDocuments=(await client.query<{id:string;kind:string;payload:unknown}>('SELECT id,kind,payload FROM accel_industrial_demo_records WHERE company_id=$1 AND execution_id=$2',[actor.companyId,executionId])).rows.sort((a,b)=>a.id.localeCompare(b.id));
      const expectedDocuments=delta.documents.map(item=>({id:item.id,kind:item.kind,payload:item.payload})).sort((a,b)=>a.id.localeCompare(b.id));
      if(hash(actualLedger)!==hash(expectedLedger)||hash(actualDocuments)!==hash(expectedDocuments))failure('EXECUTION_READBACK_FAILED',503);
      return readback;
    });}catch(error:unknown){
      if(error instanceof AppError)throw error;
      if(attempt===null)throw new AppError('EXECUTION_UNAVAILABLE','The database is unavailable. No simulated effect was confirmed.',503);
      try{
        const recovered=await options.store.transaction(async(client):Promise<IndustrialDemoExecution|null>=>{await options.store.snapshot(actor.companyId,client,true);return await prior(client);});
        if(recovered)return recovered;
      }catch(recovery:unknown){if(recovery instanceof AppError&&recovery.code==='OPERATION_CONFLICT')throw recovery;const uncertain=attempt as IndustrialDemoExecution;return {...uncertain,status:'uncertain',afterRevision:null,records:[],completedAt:isoDate(now()),code:'ACK_UNCERTAIN'};}
      throw new AppError('EXECUTION_FAILED','The transaction did not apply the simulated effect. No automatic effect retry was made.',503);
    }
  }};
}
