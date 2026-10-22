import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateOptions, parseSnapshot, assertCurrentEvaluation, evaluateBusiness, businessEngine } from '../../src/domain/index.js';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot } from '../../src/contracts/index.js';

const fixture = (): Record<string, unknown> => JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const policy = { companyId: 'CO-DEMO', version: 'P1', replacementMarginDays: 2, replacementOrderLineIds:['OL-B'] };
function scenario(inboundStatus = 'planned_unconfirmed', replacementDate: string | null = '2026-10-29'): Record<string, unknown> {
  const raw = fixture();
  const tables = raw.tables as Record<string, Array<Record<string, unknown>>>;
  tables.purchase_order_lines![0]!.expected_date = '2026-10-28';
  tables.purchase_orders![1]!.status = inboundStatus;
  tables.purchase_order_lines![1]!.expected_date = replacementDate;
  return raw;
}
const run = (raw: unknown) => evaluateOptions(parseSnapshot(raw), policy, 'OL-A');

test('baseline covers A and reserved B with distinct identified resources', () => {
  const evaluation = run(fixture());
  assert.deepEqual(evaluation.baseline.map(c => c.shortage), [0, 0]);
  assert.equal(evaluation.baseline[1]!.allocations[0]!.sourceId, 'ST-C100');
});
test('an unconfirmed replacement cannot make a reserved transfer feasible', () => {
  const raw = scenario(); const before = structuredClone(raw);
  const result = run(raw);
  assert.equal(result.baseline[0]!.shortage, 8);
  const transfer = result.options.find(o => o.kind === 'transfer')!;
  assert.equal(transfer.feasibility, 'conditional');
  assert.equal(transfer.costCents, 12000);
  assert.equal(transfer.coverage.find(c => c.orderLineId === 'OL-B')!.shortage, 8);
  assert.deepEqual(raw, before);
});
test('confirmed replacement must meet the two calendar day margin', () => {
  assert.equal(run(scenario('confirmed', '2026-11-03')).options.find(o => o.kind === 'transfer')!.feasibility, 'feasible');
  assert.equal(run(scenario('confirmed', '2026-11-04')).options.find(o => o.kind === 'transfer')!.feasibility, 'infeasible');
});
test('C shares replacement resources and cannot be omitted', () => {
  const raw = scenario('confirmed', '2026-11-03');
  const tables = raw.tables as Record<string, Array<Record<string, unknown>>>;
  tables.orders!.push({id:'ORD-C',depot_id:'DEP-CENTRE',need_date:'2026-11-03',status:'confirmed'});
  tables.order_lines!.push({id:'OL-C',order_id:'ORD-C',product_id:'SKU-ISO100',quantity:8,unit:'palette'});
  assert.equal(run(raw).options.find(o => o.kind === 'transfer')!.feasibility, 'infeasible');
});
test('ISO120 is never substituted and emergency cost is calculated in cents', () => {
  const result = run(scenario());
  assert.equal(result.options.filter(o => o.kind === 'transfer').length, 1);
  const emergency = result.options.find(o => o.kind === 'emergency')!;
  assert.equal(emergency.costCents, 142000);
  assert.equal(emergency.feasibility, 'feasible');
});
test('missing dates stay unknown and stale revisions are rejected immediately', () => {
  const raw = scenario('confirmed', null);
  assert.equal(run(raw).options.find(o => o.kind === 'transfer')!.feasibility, 'conditional');
  const evaluation = run(raw);
  assert.throws(() => assertCurrentEvaluation(evaluation, { companyId:'CO-DEMO',revision:'R1',policyVersion:'P1' }), /STALE_CONTEXT/);
  assert.throws(() => assertCurrentEvaluation(evaluation, { companyId:'OTHER',revision:'R0',policyVersion:'P1' }), /SCOPE_MISMATCH/);
});
test('boundary validation rejects duplicate ids, unit mismatches, over-reservation and invalid dates', () => {
  for (const change of [
    (t: Record<string, Array<Record<string, unknown>>>) => t.inventory!.push({...t.inventory![0]}),
    (t: Record<string, Array<Record<string, unknown>>>) => {t.reservations![0]!.unit='tonne';},
    (t: Record<string, Array<Record<string, unknown>>>) => {t.reservations![0]!.quantity=9;},
    (t: Record<string, Array<Record<string, unknown>>>) => {t.orders![0]!.need_date='2026-02-30';},
  ]) {
    const raw = fixture(); change(raw.tables as Record<string, Array<Record<string, unknown>>>);
    assert.throws(() => parseSnapshot(raw));
  }
});
test('replacement margin follows baseline coverage even after a reservation is released',()=>{
  const raw=scenario('confirmed','2026-11-04');
  const tables=raw.tables as Record<string,Array<Record<string,unknown>>>;
  tables.reservations![0]!.status='released';
  const transfer=run(raw).options.find(o=>o.kind==='transfer')!;
  assert.equal(transfer.feasibility,'infeasible');
  assert.equal(transfer.coverage.find(c=>c.orderLineId==='OL-B')!.requiredDate,'2026-11-03');
});
test('moving free surplus leaves an unchanged physical commitment intact',()=>{
  const raw=scenario('confirmed','2026-11-04');
  const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.inventory![1]!.physical_quantity=16; t.orders![1]!.need_date='2026-10-23';
  const option=run(raw).options.find(o=>o.kind==='transfer')!;
  assert.equal(option.feasibility,'feasible');
  assert.equal(option.coverage.find(c=>c.orderLineId==='OL-B')!.requiredDate,'2026-10-23');
});
test('partial emergency purchase proposes and prices exactly the missing quantity',()=>{
  const raw=scenario(); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.inventory![0]!.physical_quantity=4; t.emergency_quotes![0]!.available_quantity=4;
  const option=run(raw).options.find(o=>o.kind==='emergency')!;
  assert.equal(option.feasibility,'feasible'); assert.equal(option.quantity,4); assert.equal(option.costCents,80000);
  assert.equal(option.coverage.find(c=>c.orderLineId==='OL-A')!.allocations.find(a=>a.sourceId==='URG-1')!.quantity,4);
});
test('canonical engine reevaluates the exact target-bound option across all commitments',()=>{
  const raw=fixture(); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.orders!.push({id:'ORD-C',depot_id:'DEP-CENTRE',need_date:'2026-11-05',status:'confirmed'});
  t.order_lines!.push({id:'OL-C',order_id:'ORD-C',product_id:'SKU-ISO100',quantity:8,unit:'palette'});
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  const snapshot: CompanySnapshot={companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset:raw as unknown as CompanyDataset,policy,updatedAt:'2026-10-22T08:55:00+02:00'};
  const c=evaluateBusiness(snapshot,'OL-C').options.find(o=>o.kind==='wait')!;
  const a=evaluateBusiness(snapshot,'OL-A').options.find(o=>o.kind==='wait')!;
  assert.notEqual(c.id,a.id);
  assert.equal(c.status,'conditional');
  assert.equal(businessEngine(snapshot).options.find(o=>o.id===c.id)!.status,'conditional');
});
test('source IDs cannot alias physical stock and a future inbound resource',()=>{
  const raw=scenario('confirmed','2026-10-29'); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.purchase_order_lines![1]!.id='ST-C100';
  assert.throws(()=>parseSnapshot(raw),/AMBIGUOUS_RESOURCE_ID/);
});
test('option identities remain distinct when native identifiers contain separators',()=>{
  const raw=fixture(); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.purchase_orders![0]!.status='planned_unconfirmed'; t.purchase_order_lines![0]!.quantity=16;
  t.orders!.push({id:'ORD-X',depot_id:'DEP-LILLE',need_date:'2026-10-23',status:'confirmed'});
  t.order_lines!.push({id:'OL-A:URG-X',order_id:'ORD-X',product_id:'SKU-ISO100',quantity:16,unit:'palette'});
  t.emergency_quotes!.push({...t.emergency_quotes![0],id:'URG-X:URG-1'});
  const a=run(raw); const x=evaluateOptions(parseSnapshot(raw),policy,'OL-A:URG-X');
  const ids=[...a.options,...x.options].map(o=>o.id);
  assert.equal(new Set(ids).size,ids.length);
});
test('indirect physical reallocation cannot remove the replacement margin from B',()=>{
  const raw=scenario('confirmed','2026-11-04'); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.reservations=[]; t.inventory!.push({...t.inventory![1],id:'ST-Z100'});
  t.orders!.push({id:'ORD-C',depot_id:'DEP-CENTRE',need_date:'2026-11-04',status:'confirmed'});
  t.order_lines!.push({id:'OL-C',order_id:'ORD-C',product_id:'SKU-ISO100',quantity:8,unit:'palette'});
  const option=run(raw).options.find(o=>o.kind==='transfer')!;
  assert.equal(option.coverage.find(c=>c.orderLineId==='OL-B')!.requiredDate,'2026-11-03');
  assert.equal(option.feasibility,'feasible');
  assert.ok(option.coverage.find(c=>c.orderLineId==='OL-B')!.allocations.every(a=>a.availableDate<='2026-11-03'));
  assert.equal(option.coverage.find(c=>c.orderLineId==='OL-C')!.shortage,0);
});
test('the policy margin belongs to B; C can be replaced on its confirmed need date',()=>{
  const raw=scenario('confirmed','2026-11-04'); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.inventory!.push({...t.inventory![1],id:'ST-AAA100'});
  t.orders!.push({id:'ORD-C',depot_id:'DEP-CENTRE',need_date:'2026-11-04',status:'confirmed'});
  t.order_lines!.push({id:'OL-C',order_id:'ORD-C',product_id:'SKU-ISO100',quantity:8,unit:'palette'});
  t.reservations!.push({id:'RES-C',stock_id:'ST-AAA100',order_line_id:'OL-C',quantity:8,unit:'palette',status:'active'});
  const option=run(raw).options.find(o=>o.kind==='transfer')!;
  assert.equal(option.feasibility,'feasible');
  const c=option.coverage.find(c=>c.orderLineId==='OL-C')!;
  assert.equal(c.requiredDate,'2026-11-04'); assert.equal(c.shortage,0);
});
test('interchangeable physical stocks keep a physically covered commitment intact',()=>{
  const raw=scenario('confirmed','2026-11-04'); const t=raw.tables as Record<string,Array<Record<string,unknown>>>;
  t.reservations=[]; t.inventory!.push({...t.inventory![1],id:'ST-Z100'}); t.orders![1]!.need_date='2026-10-23';
  const option=run(raw).options.find(o=>o.kind==='transfer')!;
  assert.equal(option.feasibility,'feasible');
  assert.equal(option.coverage.find(c=>c.orderLineId==='OL-B')!.requiredDate,'2026-10-23');
});
