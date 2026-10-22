import assert from 'node:assert/strict';
import { test } from 'vitest';
import { evaluateIndustrialPlan } from '../../src/domain/industrial.js';
import { industrialFixture } from './industrial-fixture.js';

test('common plan protects commitments and prepares a distinct existing CRM opportunity with exact cents', (): void => {
  const input = industrialFixture(), unchanged = structuredClone(input), result = evaluateIndustrialPlan(input), plan = result.plans[0]!;
  assert.equal(plan.status, 'feasible'); assert.deepEqual(result.affectedOrderLineIds, ['OL-A']);
  assert.deepEqual(result.coverage, { totalCommitments: 2, protectedCommitments: 2, worsenedOrderLineIds: [], remainingShortageOrderLineIds: [] });
  assert.deepEqual(plan.steps.map(s => s.kind), ['purchase', 'transfer', 'prepare_offer']);
  assert.equal(plan.steps[0]!.kind === 'purchase' && plan.steps[0]!.canonicalResourceId, 'URG-1');
  assert.deepEqual(plan.economics, { currency: 'EUR', grossNewSpendCents: 172000, riskMitigationSpendCents: 142000, opportunityRevenueCents: 380000, opportunityMaterialValuationCents: 240000, opportunityFreightCents: 26000, opportunityHandlingCents: 4000, opportunityContributionCents: 110000, missing: [] });
  assert.equal(plan.allocations.find(a => a.targetId === 'OL-B')?.canonicalResourceId, 'ST-C100');
  assert.equal(plan.allocations.find(a => a.targetKind === 'crm_demand')?.quantity, 20);
  assert.deepEqual(input, unchanged); assert.deepEqual(evaluateIndustrialPlan(input), result);
});

test('received 10000-line portfolio is fully calculated without broadening the single confirmed ETA', (): void => {
  const input = industrialFixture(true), otherAlpha = input.snapshot.dataset.tables.purchase_order_lines!.filter(l => String(l.id).startsWith('POL-IND-ALPHA')).map(l => ({ ...l }));
  const result = evaluateIndustrialPlan(input);
  assert.equal(result.coverage.totalCommitments, 10000); assert.equal(result.coverage.protectedCommitments, 10000);
  assert.equal(result.plans[0]?.status, 'feasible'); assert.deepEqual(result.affectedOrderLineIds, ['OL-A']);
  assert.deepEqual(input.snapshot.dataset.tables.purchase_order_lines!.filter(l => String(l.id).startsWith('POL-IND-ALPHA')), otherAlpha);
}, 60000);

test('physical stock used by an unreserved confirmed engagement and unused reservations remain unavailable', (): void => {
  for (const reserved of [false, true]) {
    const input = industrialFixture(), t = input.snapshot.dataset.tables;
    t.orders!.push({ id: 'O-EXTRA', depot_id: 'DEP-LYON', need_date: '2026-10-25', status: reserved ? 'cancelled' : 'confirmed' });
    t.order_lines!.push({ id: 'L-EXTRA', order_id: 'O-EXTRA', product_id: 'SKU-ISO100', quantity: 5, unit: 'palette' });
    if (reserved) t.reservations!.push({ id: 'RES-EXTRA', stock_id: 'ST-IND-DEP-LYON-SKU-ISO100', order_line_id: 'L-EXTRA', quantity: 5, unit: 'palette', status: 'active' });
    const result = evaluateIndustrialPlan(input);
    assert.equal(result.plans[0]?.status, 'conditional'); assert.equal(result.plans[0]?.steps.some(s => s.kind === 'prepare_offer'), false);
    assert.equal(result.coverage.worsenedOrderLineIds.length, 0);
  }
});

test('an unrelated uncovered commitment prevents an all-protected feasible claim', (): void => {
  const input = industrialFixture(), t = input.snapshot.dataset.tables;
  t.orders!.push({ id: 'O-EXTRA', depot_id: 'DEP-LILLE', need_date: '2026-10-23', status: 'confirmed' });
  t.order_lines!.push({ id: 'L-EXTRA', order_id: 'O-EXTRA', product_id: 'SKU-ISO100', quantity: 1, unit: 'palette' });
  const result = evaluateIndustrialPlan(input);
  assert.equal(result.coverage.totalCommitments, 3); assert.equal(result.plans[0]?.status, 'conditional');
  assert.equal(result.coverage.remainingShortageOrderLineIds.length, 1);
});

test('unapplied or unrelated confirmations, stale revisions, and future releases are rejected', (): void => {
  const unapplied = industrialFixture(); unapplied.snapshot.dataset.tables.purchase_order_lines!.find(l => l.id === 'POL-1')!.expected_date = '2026-10-23';
  assert.throws(() => evaluateIndustrialPlan(unapplied), /UNAPPLIED_CONFIRMATION/);
  const stale = industrialFixture(); stale.releasedEvent.contextRevision = 'OLD'; assert.throws(() => evaluateIndustrialPlan(stale), /STALE_INDUSTRIAL_CONTEXT/);
  const future = industrialFixture(); future.releasedEvent.releasedAt = '2026-10-23T09:00:00Z'; assert.throws(() => evaluateIndustrialPlan(future), /INVALID_INDUSTRIAL_EVENT/);
  const wrong = industrialFixture(); wrong.releasedEvent.confirmations[0]!.purchaseOrderLineId = 'POL-2'; assert.throws(() => evaluateIndustrialPlan(wrong), /INVALID_INDUSTRIAL_CONFIRMATION/);
});

test('missing demand, costs, independence, expiry and competitor confirmation stay explicit', (): void => {
  const unknown = industrialFixture(); unknown.demandId = 'UNKNOWN'; assert.equal(evaluateIndustrialPlan(unknown).impact, 'needs_input');
  for (const mode of ['valuation', 'origin', 'expiry', 'competitor'] as const) {
    const input = industrialFixture();
    if (mode === 'valuation') input.context.stockValuations = [];
    if (mode === 'origin') input.context.stockValuations[0]!.stockSource.affectedSiteRelation = 'unknown';
    if (mode === 'expiry') input.evaluatedAt = '2026-10-23T09:00:00Z';
    if (mode === 'competitor') input.releasedEvent.competitorConfirmations = [];
    const result = evaluateIndustrialPlan(input);
    assert.notEqual(result.plans[0]?.status, 'feasible');
    if (mode !== 'competitor') { assert.equal(result.plans[0]?.economics.opportunityContributionCents, null); assert.equal(result.plans[0]?.steps.some(s => s.kind === 'prepare_offer'), false); }
  }
  const independent = industrialFixture(); independent.context.independentAlternatives[0]!.affectedSiteRelation = 'unknown';
  assert.equal(evaluateIndustrialPlan(independent).plans[0]?.status, 'conditional');
});

test('one canonical emergency capacity cannot be duplicated by an alias or a new audit version', (): void => {
  const alias = industrialFixture(); alias.context.independentAlternatives.push(structuredClone(alias.context.independentAlternatives[0]!)); assert.throws(() => evaluateIndustrialPlan(alias));
  const used = industrialFixture(); used.executionState.capacityUses.push({ id: 'USE1', executionId: 'E1', stepId: 'S1', resourceKind: 'purchase_quote', canonicalResourceId: 'URG-1', resourceVersion: 'OLD-AUDIT-VERSION', quantity: 8, status: 'committed' });
  const result = evaluateIndustrialPlan(used); assert.equal(result.plans[0]?.steps.some(s => s.kind === 'purchase'), false); assert.equal(result.plans[0]?.status, 'conditional');
  used.executionState.capacityUses.push({ ...used.executionState.capacityUses[0]!, id: 'USE2', resourceVersion: 'NEW-VERSION', quantity: 1 }); assert.throws(() => evaluateIndustrialPlan(used), /OVERCOMMITTED_INDUSTRIAL_CAPACITY/);
});

test('stock holds and canonical transport use survive restart without physically moving stock', (): void => {
  const input = industrialFixture(), stock = input.snapshot.dataset.tables.inventory!.find(s => s.id === 'ST-IND-DEP-LYON-SKU-ISO100')!;
  input.executionState.stockHolds.push({ id: 'H1', executionId: 'E1', stepId: 'T1', stockId: String(stock.id), productId: 'SKU-ISO100', unit: 'palette', quantity: 5, status: 'active' });
  const result = evaluateIndustrialPlan(input); assert.equal(result.plans[0]?.steps.some(s => s.kind === 'prepare_offer'), false); assert.equal(stock.physical_quantity, 20);
  assert.deepEqual(evaluateIndustrialPlan(JSON.parse(JSON.stringify(input)) as typeof input), result);
  const transported = industrialFixture(); transported.executionState.capacityUses.push({ id: 'U1', executionId: 'E1', stepId: 'T1', resourceKind: 'transport_quote', canonicalResourceId: 'TR-IND-LYON-LILLE-OPPORTUNITY', resourceVersion: 'V1', quantity: 1, status: 'committed' });
  assert.equal(evaluateIndustrialPlan(transported).plans[0]?.steps.some(s => s.kind === 'prepare_offer'), false);
  const stale = industrialFixture(); stale.executionState.businessRevision = 'OLD'; assert.throws(() => evaluateIndustrialPlan(stale), /STALE_INDUSTRIAL_LEDGER/);
});

test('executed future purchase and transfer are read once, attributed draft consumes the demand after restart', (): void => {
  const input = industrialFixture(), state = input.executionState, t = input.snapshot.dataset.tables;
  t.purchase_orders!.push({ id: 'PO-EXEC', supplier_id: 'SUP-3', status: 'confirmed' });
  t.purchase_order_lines!.push({ id: 'POL-EXEC', purchase_order_id: 'PO-EXEC', product_id: 'SKU-ISO100', depot_id: 'DEP-LILLE', quantity: 8, unit: 'palette', expected_date: '2026-10-23' });
  state.capacityUses.push({ id: 'U1', executionId: 'E1', stepId: 'P1', resourceKind: 'purchase_quote', canonicalResourceId: 'URG-1', resourceVersion: 'V1', quantity: 8, status: 'committed' });
  state.stockHolds.push({ id: 'H1', executionId: 'E1', stepId: 'T1', stockId: 'ST-IND-DEP-LYON-SKU-ISO100', productId: 'SKU-ISO100', unit: 'palette', quantity: 20, status: 'active' });
  state.scheduledTransfers.push({ id: 'T1', executionId: 'E1', stepId: 'T1', sourceHoldIds: ['H1'], productId: 'SKU-ISO100', unit: 'palette', quantity: 20, fromDepotId: 'DEP-LYON', destinationDepotId: 'DEP-LILLE', dispatchDate: '2026-10-28', arrivalDate: '2026-10-29', status: 'confirmed_scheduled' });
  state.allocations.push({ id: 'A1', executionId: 'E1', resource: { kind: 'c1_inbound', id: 'POL-EXEC' }, target: { kind: 'commitment', id: 'OL-A' }, productId: 'SKU-ISO100', unit: 'palette', quantity: 8, status: 'active' }, { id: 'A2', executionId: 'E1', resource: { kind: 'scheduled_transfer', id: 'T1' }, target: { kind: 'crm_demand', id: 'CRM-IND-000' }, productId: 'SKU-ISO100', unit: 'palette', quantity: 20, status: 'active' });
  state.draftOffers.push({ id: 'OFFER1', executionId: 'E1', opportunityId: 'CRM-IND-000', demandVersion: '1', quantity: 20, allocationIds: ['A2'], status: 'draft' });
  const result = evaluateIndustrialPlan(input);
  assert.deepEqual(result.constraints, ['CRM_DEMAND_ALREADY_DRAFTED']); assert.equal(result.coverage.protectedCommitments, 2); assert.equal(result.plans.length, 0);
  assert.deepEqual(evaluateIndustrialPlan(JSON.parse(JSON.stringify(input)) as typeof input), result);
  const bad = structuredClone(input); bad.executionState.scheduledTransfers[0]!.quantity = 21; assert.throws(() => evaluateIndustrialPlan(bad), /INVALID_TRANSFER_HOLD/);
  const early = structuredClone(input); early.executionState.scheduledTransfers[0]!.arrivalDate = '2026-11-01'; assert.throws(() => evaluateIndustrialPlan(early), /INVALID_INDUSTRIAL_ALLOCATION_TARGET/);
});

test('integer overflow is rejected and expiry changes computation identity', (): void => {
  const input = industrialFixture(), result = evaluateIndustrialPlan(input);
  const later = structuredClone(input); later.evaluatedAt = '2026-10-22T09:00:01Z'; assert.notEqual(evaluateIndustrialPlan(later).calculationHash, result.calculationHash);
  input.context.stockValuations[0]!.unitCostCents = Number.MAX_SAFE_INTEGER; assert.throws(() => evaluateIndustrialPlan(input), /INDUSTRIAL_ARITHMETIC_OVERFLOW/);
});

test('CRM drafts cannot be backed by cancelled or unconfirmed purchase supply after restart', (): void => {
  for (const status of ['cancelled', 'planned_unconfirmed']) {
    const input = industrialFixture(), t = input.snapshot.dataset.tables, state = input.executionState;
    t.purchase_orders!.push({ id: 'PO-NOT-CONFIRMED', supplier_id: 'SUP-3', status });
    t.purchase_order_lines!.push({ id: 'POL-NOT-CONFIRMED', purchase_order_id: 'PO-NOT-CONFIRMED', product_id: 'SKU-ISO100', depot_id: 'DEP-LILLE', quantity: 20, unit: 'palette', expected_date: '2026-10-28' });
    state.allocations.push({ id: 'A1', executionId: 'E1', resource: { kind: 'c1_inbound', id: 'POL-NOT-CONFIRMED' }, target: { kind: 'crm_demand', id: 'CRM-IND-000' }, productId: 'SKU-ISO100', unit: 'palette', quantity: 20, status: 'active' });
    state.draftOffers.push({ id: 'DRAFT1', executionId: 'E1', opportunityId: 'CRM-IND-000', demandVersion: '1', quantity: 20, allocationIds: ['A1'], status: 'draft' });
    assert.throws(() => evaluateIndustrialPlan(JSON.parse(JSON.stringify(input)) as typeof input), /UNCONFIRMED_INDUSTRIAL_ALLOCATION/);
  }
});
