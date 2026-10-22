import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CaseRef, CaseRelation, CompanyDataset, CompanyPolicy, CompanySnapshot, InternalConfirmation } from '../../src/contracts/index.js';
import { parseInternalConfirmation } from '../../src/domain/index.js';

function source(): {snapshot:CompanySnapshot;ref:CaseRef;relation:CaseRelation;confirmation:InternalConfirmation} {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},ref:{caseId:'CASE-1',caseRevision:'CR-1'},relation:{status:'unverified',productId:'SKU-ISO100',supplierId:'SUP-1',basis:'Declared relation'},
    confirmation:{kind:'inbound_date_confirmed',eventId:'EVENT-1',companyId:'CO-DEMO',caseId:'CASE-1',caseRevision:'CR-1',purchaseOrderLineId:'POL-1',productId:'SKU-ISO100',previousExpectedDate:'2026-10-23',confirmedExpectedDate:'2026-10-23',actorId:'OPERATOR-1',confirmedAt:'2026-10-22T09:00:00Z',basis:'Synthetic internal confirmation',businessRevision:'R0',policyVersion:'P1',dataOrigin:'synthetic'}};
}
test('server exposure list is validated and preserved without manufacturing one for old confirmations',()=>{
  const s=source();assert.equal('exposureOrderLineIds' in parseInternalConfirmation(s.snapshot,s.ref,s.relation,s.confirmation),false);
  for(const ids of [[],['OL-A','OL-C']]) {
    const result=parseInternalConfirmation(s.snapshot,s.ref,s.relation,{...s.confirmation,exposureOrderLineIds:ids});
    assert.deepEqual(result.exposureOrderLineIds,ids);assert.notEqual(result.exposureOrderLineIds,ids);
  }
  for(const ids of [null,'OL-A',[null],[''],['OL-A','OL-A'],['x'.repeat(161)],Array.from({length:10001},(_,i)=>`LINE-${i}`)]) {
    assert.throws(()=>parseInternalConfirmation(s.snapshot,s.ref,s.relation,{...s.confirmation,exposureOrderLineIds:ids}));
  }
});
