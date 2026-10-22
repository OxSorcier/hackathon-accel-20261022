import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, test } from 'vitest';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot, JsonObject } from '../../src/contracts/index.ts';
import type { IndustrialContext } from '../../src/contracts/industrial.ts';
import { currentIndustrialContext, parseIndustrialContext } from '../../src/data/industrial-relations.ts';

let context: IndustrialContext; let snapshot: CompanySnapshot;
const at = '2026-10-22T09:00:00Z';
describe('Industrial context against the existing candidate ERP/CRM master', (): void => {
  beforeAll(async (): Promise<void> => {
    const root = new URL('../../proposals/product/alignment-20261022/v2/', import.meta.url);
    const dataset = JSON.parse(await readFile(new URL('portfolio-10000.json', root), 'utf8')) as CompanyDataset;
    const policy = JSON.parse(await readFile(new URL('portfolio-policy.json', root), 'utf8')) as CompanyPolicy;
    context = JSON.parse(await readFile(new URL('industrial-context.v2.json', root), 'utf8')) as IndustrialContext;
    snapshot = { companyId: dataset.company_id, revision: dataset.snapshot_revision, policyVersion: 'P-INDUSTRIAL-1', dataOrigin: 'synthetic', dataset, policy, updatedAt: dataset.as_of };
  });
  test('received candidate preserves attributed native identities, exact capacity aliases and distinct costs', (): void => {
    const parsed = parseIndustrialContext(context, snapshot); assert.equal(parsed.projectOwners.length, 24); assert.equal(parsed.commercialDemand[0]?.quantity, 20);
    assert.equal(parsed.independentAlternatives.find((item) => item.canonicalResourceId === 'URG-1')?.availableQuantity, 8);
    assert.equal(parsed.deliveryQuotes[0]?.freightCents, 26_000); assert.equal(parsed.deliveryQuotes[0]?.handlingCents, 4000);
    assert.notEqual(parsed.deliveryQuotes[0]?.transportQuoteId, parsed.deliveryQuotes[1]?.transportQuoteId);
    assert.equal(parsed.stockValuations[0]?.stockSource.upstreamManufacturingOrigin, 'unknown');
    assert.deepEqual(currentIndustrialContext(context, snapshot, at), parsed);
    assert.deepEqual(currentIndustrialContext(context, snapshot, '2026-10-22T02:00:00-05:00'), parsed);
  });
  test('cross-company, unknown fields, unowned actor and supplier/site mismatches are rejected', (): void => {
    assert.throws(() => parseIndustrialContext({ ...context, companyId: 'OTHER' }, snapshot));
    assert.throws(() => parseIndustrialContext({ ...context, operatorEvent: { kind: 'industrial_fire' } }, snapshot));
    const actor = structuredClone(context); actor.companyProfile.provenance.actorId = 'EXTERNAL'; assert.throws(() => parseIndustrialContext(actor, snapshot));
    const site = structuredClone(context); site.supplierDependencies[0]!.supplierSiteId = 'PLANT-EMERGENCY-FR'; assert.throws(() => parseIndustrialContext(site, snapshot));
  });
  test('resource aliases never add capacity or alter SKU/unit, quote route or cent costs', (): void => {
    const capacity = structuredClone(context); capacity.independentAlternatives[0]!.availableQuantity = 9; assert.throws(() => parseIndustrialContext(capacity, snapshot));
    const duplicate = structuredClone(context); duplicate.independentAlternatives.push(structuredClone(duplicate.independentAlternatives[0]!)); assert.throws(() => parseIndustrialContext(duplicate, snapshot));
    const unit = structuredClone(context); unit.deliveryQuotes[0]!.unit = 'tonne'; assert.throws(() => parseIndustrialContext(unit, snapshot));
    const route = structuredClone(context); route.deliveryQuotes[0]!.destinationDepotId = 'DEP-CENTRE'; assert.throws(() => parseIndustrialContext(route, snapshot));
    const cost = structuredClone(context); cost.deliveryQuotes[0]!.handlingCents = 0; assert.throws(() => parseIndustrialContext(cost, snapshot));
    const early = structuredClone(context); early.deliveryQuotes[0]!.arrivalDate = '2026-10-28'; assert.throws(() => parseIndustrialContext(early, snapshot));
  });
  test('qualified CRM details must agree with the actual current synthetic request', (): void => {
    for (const change of [ { quantity: 21 }, { customerId: 'CLI-B' }, { saleUnitPriceCents: 19_001 }, { confirmedAt: '2026-10-22T07:00:00Z' } ]) {
      const changed = structuredClone(context); Object.assign(changed.commercialDemand[0]!, change); assert.throws(() => parseIndustrialContext(changed, snapshot));
    }
  });
  test('SCENARIO provenance is excluded with dependent relations and current future planning remains usable', (): void => {
    const scenario = structuredClone(context); scenario.supplierSites[0]!.provenance.system = 'SCENARIO'; scenario.commercialDemand[0]!.provenance.system = 'SCENARIO';
    const projected = currentIndustrialContext(scenario, snapshot, at);
    assert.equal(projected.supplierSites.some((item) => item.supplierSiteId === scenario.supplierSites[0]!.supplierSiteId), false);
    assert.equal(projected.supplierDependencies.length, 0); assert.equal(projected.competitors.length, 0); assert.equal(projected.commercialDemand.length, 0);
    assert.equal(projected.deliveryQuotes.some((item) => item.opportunityId !== undefined), false);
    assert.equal(currentIndustrialContext(context, snapshot, at).commercialDemand[0]?.needDate, '2026-10-29');
    assert.throws(() => currentIndustrialContext(context, snapshot, '2026-10-21T09:00:00Z'), /INDUSTRIAL_CONTEXT_NOT_CURRENT/);
    const future = structuredClone(context); future.companyProfile.provenance.system = 'SCENARIO'; assert.throws(() => currentIndustrialContext(future, snapshot, at), /INDUSTRIAL_CONTEXT_NOT_CURRENT/);
  });
  test('an alias cannot promote native future or SCENARIO provenance into current CRM and quote resources', (): void => {
    for (const table of ['company','crm_opportunities','transport_quotes','emergency_quotes']) {
      for (const change of [{system:'SCENARIO'}, {receivedAt:'2026-10-23T08:50:00+02:00'}] as JsonObject[]) {
        const changed = structuredClone(snapshot), targetId = table === 'company' ? snapshot.companyId : table === 'crm_opportunities' ? context.commercialDemand[0]!.opportunityId : table === 'transport_quotes' ? context.deliveryQuotes[0]!.transportQuoteId : context.independentAlternatives[1]!.canonicalResourceId;
        const row = changed.dataset.tables[table]!.find((item) => item.id === targetId)!;
        row.provenance = {...context.companyProfile.provenance,...row.provenance as JsonObject,...change}; assert.throws(() => currentIndustrialContext(context,changed,at));
      }
    }
  });
  test('native expired quotes or an extended alias deadline never acquire current capacity', (): void => {
    for (const table of ['transport_quotes','emergency_quotes']) {
      const changed = structuredClone(snapshot); for (const row of changed.dataset.tables[table]!) row.valid_on = '2026-10-21';
      assert.throws(() => currentIndustrialContext(context,changed,at));
    }
    const extended = structuredClone(context); extended.deliveryQuotes[0]!.validUntil = '2026-10-23T23:59:59+02:00'; assert.throws(() => parseIndustrialContext(extended,snapshot));
    const alternate = structuredClone(context); alternate.independentAlternatives[0]!.validUntil = '2026-10-23T23:59:59+02:00'; assert.throws(() => parseIndustrialContext(alternate,snapshot));
  });
  test('current native CRM dequalification, cancellation or missing status cannot reuse historical confirmation fields', (): void => {
    for (const status of ['to_qualify','cancelled',null]) {
      const changed = structuredClone(snapshot), row = changed.dataset.tables.crm_opportunities!.find((item) => item.id === context.commercialDemand[0]!.opportunityId)!;
      if (status === null) delete row.status; else row.status = status;
      assert.throws(() => currentIndustrialContext(context,changed,at));
    }
  });
});
