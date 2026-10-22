import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot, ReleasedCaseContext } from '../../src/contracts/index.js';
import { evaluateCaseBusiness } from '../../src/domain/index.js';

function fixture(): {snapshot:CompanySnapshot;context:ReleasedCaseContext} {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  const content='Source reçue, lien et retard non prouvés'; const hash=createHash('sha256').update(content).digest('hex');
  return {snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    context:{ref:{caseId:'CASE-RISK',caseRevision:'CR1'},evidenceRef:{occurrenceId:'OCC',evidenceId:'E1',contentHash:hash},
      observation:{id:'E1',content,url:'https://public.example/article',title:'Information à vérifier',collectedAt:'2026-10-22T06:00:00Z',publishedAt:null,contentHash:hash,dataOrigin:'public',mode:'test'},
      relation:{status:'unverified',productId:'SKU-ISO100',supplierId:'SUP-1',basis:'Hypothèse déclarée'},candidateOrderLineIds:['OL-A'],businessRevision:'R0',policyVersion:'P1',qualification:'to_verify',impactKind:'risk',
      riskAssumption:{kind:'inbound_delay',purchaseOrderLineId:'POL-1',assumedExpectedDate:'2026-10-28',basis:'Date hypothétique à confirmer'}}};
}
function confirmed(): {snapshot:CompanySnapshot;context:ReleasedCaseContext} {
  const source=fixture();source.snapshot.revision='R1';source.snapshot.dataset.snapshot_revision='R1';
  source.snapshot.dataset.tables.purchase_order_lines!.find(row=>row.id==='POL-1')!.expected_date='2026-10-28';
  source.context.businessRevision='R1';delete source.context.riskAssumption;
  source.context.confirmation={kind:'inbound_date_confirmed',eventId:'EVENT-1',companyId:'CO-DEMO',caseId:source.context.ref.caseId,caseRevision:source.context.ref.caseRevision,
    purchaseOrderLineId:'POL-1',productId:'SKU-ISO100',previousExpectedDate:'2026-10-23',confirmedExpectedDate:'2026-10-28',actorId:'OPERATOR-1',confirmedAt:'2026-10-22T06:00:00Z',basis:'Synthetic operator confirmation',businessRevision:'R1',policyVersion:'P1',dataOrigin:'synthetic'};
  return source;
}
test('declared delay changes only the cloned coverage; original A stays covered and transfer cannot break B',()=>{
  const {snapshot,context}=fixture();const before=structuredClone(snapshot);
  const evaluation=evaluateCaseBusiness(snapshot,context,'OL-A');
  assert.equal((evaluation.facts.actualCoverage as Array<{shortage:number}>)[0]!.shortage,0);
  assert.equal((evaluation.facts.coverage as Array<{shortage:number}>)[0]!.shortage,8);
  assert.ok(evaluation.constraints.includes('HYPOTHETICAL_INBOUND_DELAY'));
  assert.ok(evaluation.options.every(o=>o.status!=='feasible'));
  assert.equal(evaluation.options.find(o=>o.kind==='emergency_purchase')!.costEur,1420);
  assert.deepEqual(snapshot,before);
});
test('unknown assumed date is explicit and a changed case revision changes evaluation identity',()=>{
  const {snapshot,context}=fixture();context.riskAssumption!.assumedExpectedDate=null;
  const a=evaluateCaseBusiness(snapshot,context,'OL-A');
  assert.equal((a.facts.riskAssumption as {assumedExpectedDate:string|null}).assumedExpectedDate,null);
  context.ref.caseRevision='CR2';const b=evaluateCaseBusiness(snapshot,context,'OL-A');assert.notEqual(a.id,b.id);
});
test('risk boundary refuses a wrong line, SKU, supplier, date, target or stale business version',()=>{
  for(const change of [
    (c:ReleasedCaseContext):void=>{c.riskAssumption!.purchaseOrderLineId='UNKNOWN';},
    (c:ReleasedCaseContext):void=>{c.relation.productId='SKU-ISO120';},
    (c:ReleasedCaseContext):void=>{c.relation.supplierId='SUP-2';},
    (c:ReleasedCaseContext):void=>{c.riskAssumption!.assumedExpectedDate='2026-02-30';},
    (c:ReleasedCaseContext):void=>{c.riskAssumption!.assumedExpectedDate='2026-10-20';},
    (c:ReleasedCaseContext):void=>{c.candidateOrderLineIds=['OL-B'];},
    (c:ReleasedCaseContext):void=>{c.businessRevision='OLD';},
  ]) {const {snapshot,context}=fixture();change(context);assert.throws(()=>evaluateCaseBusiness(snapshot,context,'OL-A'));}
});
test('confirmed internal date evaluates durable coverage and retains feasible options without public causality',()=>{
  const {snapshot,context}=confirmed();const before=structuredClone(snapshot);
  const evaluation=evaluateCaseBusiness(snapshot,context,'OL-A');
  assert.equal(evaluation.facts.coverageBasis,'confirmed_internal_synthetic');
  assert.deepEqual(evaluation.facts.actualCoverage,evaluation.facts.coverage);
  assert.equal((evaluation.facts.coverage as Array<{shortage:number}>)[0]!.shortage,8);
  assert.equal(evaluation.options.find(option=>option.kind==='emergency_purchase')!.status,'feasible');
  assert.ok(evaluation.constraints.includes('EXTERNAL_RELATION_UNVERIFIED'));
  assert.ok(!evaluation.constraints.includes('HYPOTHETICAL_INBOUND_DELAY'));
  assert.deepEqual(snapshot,before);
});
test('confirmation rejects mismatched attribution scope, current data and simultaneous hypothesis',()=>{
  for(const change of [
    (c:ReleasedCaseContext):void=>{c.confirmation!.companyId='FOREIGN';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.caseRevision='OLD';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.businessRevision='OLD';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.policyVersion='OLD';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.purchaseOrderLineId='POL-2';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.productId='SKU-ISO120';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.confirmedExpectedDate='2026-10-29';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.actorId='';},
    (c:ReleasedCaseContext):void=>{c.confirmation!.confirmedAt='2026-02-30T06:00:00Z';},
    (c:ReleasedCaseContext):void=>{c.riskAssumption=fixture().context.riskAssumption!;},
  ]) {const {snapshot,context}=confirmed();change(context);assert.throws(()=>evaluateCaseBusiness(snapshot,context,'OL-A'));}
});
