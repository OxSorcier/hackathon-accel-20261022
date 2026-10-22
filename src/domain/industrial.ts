import { createHash } from 'node:crypto';
import type { IndustrialAllocation, IndustrialAssessment, IndustrialBasis, IndustrialContext, IndustrialEconomics, IndustrialEvaluationInput, IndustrialPlanStep } from '../contracts/industrial.js';
import { currentIndustrialContext } from '../data/industrial-relations.js';
import { policyFromContract } from './contract.js';
import { evaluateOptions, type Coverage } from './engine.js';
import { calendarDate, DomainError, parseSnapshot, quantity, referenceId, textField, type BusinessPolicy, type BusinessSnapshot } from './model.js';

function sum(a: number, b: number): number {
  const n = a + b; if (!Number.isSafeInteger(n)) throw new DomainError('INDUSTRIAL_ARITHMETIC_OVERFLOW'); return n;
}
function multiply(a: number, b: number): number {
  const n = a * b; if (!Number.isSafeInteger(n)) throw new DomainError('INDUSTRIAL_ARITHMETIC_OVERFLOW'); return n;
}
function timestamp(value: string): number {
  textField(value, 'industrial.timestamp'); calendarDate(value.slice(0, 10), 'industrial.timestamp');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new DomainError('INVALID_INDUSTRIAL_TIME');
  return Date.parse(value);
}
function inputHash(input: IndustrialEvaluationInput, context: IndustrialContext): string {
  return createHash('sha256').update(JSON.stringify({ snapshot: input.snapshot, context, release: input.releasedEvent, executionState: input.executionState, demandId: input.demandId, evaluatedAt: input.evaluatedAt })).digest('hex');
}
/** Compare every effective input, including the durable ledger, without recomputing portfolio coverage. */
export function industrialInputHash(input: IndustrialEvaluationInput): string {
  return inputHash(input, currentIndustrialContext(input.context, input.snapshot, input.evaluatedAt));
}
function coverage(snapshot: BusinessSnapshot, policy: BusinessPolicy): Coverage[] {
  const confirmed = new Set(snapshot.orders.filter(o => o.status === 'confirmed').map(o => o.id));
  const target = snapshot.lines.find(l => confirmed.has(l.order_id));
  return target ? evaluateOptions({ ...snapshot, transports: [], emergency: [] }, policy, target.id).baseline : [];
}

function executionView(input: IndustrialEvaluationInput, business: BusinessSnapshot, context: IndustrialContext): { snapshot: BusinessSnapshot; used: Map<string, number>; drafted: Map<string, number> } {
  const ledger = input.executionState;
  if (!ledger || ledger.companyId !== business.companyId || ledger.businessRevision !== business.revision) throw new DomainError('STALE_INDUSTRIAL_LEDGER');
  const lists = [ledger.stockHolds, ledger.capacityUses, ledger.scheduledTransfers, ledger.allocations, ledger.draftOffers];
  for (const rows of lists) {
    if (!Array.isArray(rows) || rows.length > 10000) throw new DomainError('INVALID_INDUSTRIAL_LEDGER');
    const ids = rows.map(r => textField(r.id, 'ledger.id'));
    if (new Set(ids).size !== ids.length) throw new DomainError('DUPLICATE_INDUSTRIAL_LEDGER_ID');
    for (const r of rows) { textField(r.executionId, 'ledger.executionId'); quantity(r.quantity, 'ledger.quantity'); }
  }
  const view = structuredClone(business), stocks = new Map(view.inventory.map(s => [s.id, s]));
  const holds = new Map(ledger.stockHolds.map(h => [h.id, h])), used = new Map<string, number>(), drafted = new Map<string, number>();
  const addUsed = (key: string, amount: number): void => { used.set(key, sum(used.get(key) ?? 0, amount)); };
  const activeReserved = new Map<string, number>();
  for (const r of business.reservations) if (r.status === 'active') activeReserved.set(r.stock_id, sum(activeReserved.get(r.stock_id) ?? 0, r.quantity));
  for (const h of ledger.stockHolds) {
    if (!['active', 'released', 'settled'].includes(h.status)) throw new DomainError('INVALID_INDUSTRIAL_HOLD');
    const stock = stocks.get(h.stockId);
    if (!stock || stock.product_id !== h.productId || stock.unit !== h.unit) throw new DomainError('INVALID_INDUSTRIAL_HOLD');
    if (h.status === 'active') { stock.physical_quantity -= h.quantity; if (stock.physical_quantity < (activeReserved.get(stock.id) ?? 0)) throw new DomainError('OVERCOMMITTED_INDUSTRIAL_HOLD'); }
  }
  for (const u of ledger.capacityUses) {
    if (!['purchase_quote', 'transport_quote'].includes(u.resourceKind) || !['committed', 'cancelled'].includes(u.status)) throw new DomainError('INVALID_INDUSTRIAL_CAPACITY_USE');
    textField(u.resourceVersion, 'resourceVersion'); textField(u.canonicalResourceId, 'canonicalResourceId');
    if (u.status === 'committed') addUsed(`${u.resourceKind}:${u.canonicalResourceId}`, u.quantity);
  }
  for (const [key, amount] of used) {
    const purchase = key.startsWith('purchase_quote:'); const id = key.slice(purchase ? 15 : 16);
    const capacity = purchase ? business.emergency.find(q => q.id === id)?.available_quantity : business.transports.find(q => q.id === id)?.capacity;
    if (capacity === undefined || amount > capacity) throw new DomainError('OVERCOMMITTED_INDUSTRIAL_CAPACITY');
  }
  const sources = new Map(view.inbound.map(p => [JSON.stringify(['c1_inbound', p.id]), p]));
  const transferHolds = new Set<string>();
  const resourceIds = new Set([...view.inventory.map(s => s.id), ...view.inbound.map(s => s.id)]);
  for (const t of ledger.scheduledTransfers) {
    if (!['confirmed_scheduled', 'cancelled', 'received'].includes(t.status) || !Array.isArray(t.sourceHoldIds) || t.sourceHoldIds.length === 0 || t.sourceHoldIds.length > 100 || new Set(t.sourceHoldIds).size !== t.sourceHoldIds.length || t.fromDepotId === t.destinationDepotId || !view.depots.includes(t.destinationDepotId)) throw new DomainError('INVALID_SCHEDULED_TRANSFER');
    calendarDate(t.dispatchDate, 'transfer.dispatchDate'); calendarDate(t.arrivalDate, 'transfer.arrivalDate');
    if (t.arrivalDate < t.dispatchDate) throw new DomainError('INVALID_SCHEDULED_TRANSFER');
    if (t.status !== 'confirmed_scheduled') continue;
    let held = 0;
    for (const holdId of t.sourceHoldIds) {
      const h = holds.get(holdId), stock = h ? stocks.get(h.stockId) : undefined;
      if (!h || h.status !== 'active' || h.executionId !== t.executionId || h.stepId !== t.stepId || stock?.depot_id !== t.fromDepotId || h.productId !== t.productId || h.unit !== t.unit || transferHolds.has(holdId)) throw new DomainError('INVALID_TRANSFER_HOLD');
      held = sum(held, h.quantity); transferHolds.add(holdId);
    }
    if (held !== t.quantity || resourceIds.has(t.id)) throw new DomainError('INVALID_TRANSFER_HOLD');
    resourceIds.add(t.id);
    const purchaseId = referenceId('industrial-ledger-transfer', [t.id]);
    view.purchases.push({ id: purchaseId, status: 'confirmed' });
    const source = { id: t.id, purchase_order_id: purchaseId, product_id: t.productId, depot_id: t.destinationDepotId, quantity: t.quantity, unit: t.unit, expected_date: t.arrivalDate };
    view.inbound.push(source); sources.set(JSON.stringify(['scheduled_transfer', t.id]), source);
  }
  const allocationIds = new Map(ledger.allocations.map(a => [a.id, a])), bySource = new Map<string, number>();
  for (const a of ledger.allocations) {
    if (!['active', 'released', 'settled'].includes(a.status)) throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION');
    if (a.status !== 'active') continue;
    let source: BusinessSnapshot['inbound'][number] | undefined;
    let sourceKey: string;
    if (a.resource.kind === 'held_stock') {
      const h = holds.get(a.resource.holdId), stock = h ? stocks.get(h.stockId) : undefined;
      if (!h || h.status !== 'active' || h.executionId !== a.executionId || transferHolds.has(h.id) || !stock) throw new DomainError('INVALID_ALLOCATION_HOLD');
      sourceKey = JSON.stringify(['held_stock', h.id]);
      source = sources.get(sourceKey);
      if (!source) {
        if (resourceIds.has(h.id)) throw new DomainError('AMBIGUOUS_INDUSTRIAL_RESOURCE');
        resourceIds.add(h.id); const purchaseId = referenceId('industrial-ledger-hold', [h.id]);
        view.purchases.push({ id: purchaseId, status: 'confirmed' });
        source = { id: h.id, purchase_order_id: purchaseId, product_id: h.productId, depot_id: stock.depot_id, quantity: h.quantity, unit: h.unit, expected_date: business.asOf.slice(0, 10) };
        sources.set(sourceKey, source); view.inbound.push(source);
      }
    } else if (a.resource.kind === 'c1_inbound' || a.resource.kind === 'scheduled_transfer') {
      sourceKey = JSON.stringify([a.resource.kind, a.resource.id]); source = sources.get(sourceKey);
    } else throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION');
    if (!source || source.product_id !== a.productId || source.unit !== a.unit) throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION');
    if (view.purchases.find(p => p.id === source.purchase_order_id)?.status !== 'confirmed') throw new DomainError('UNCONFIRMED_INDUSTRIAL_ALLOCATION');
    const total = sum(bySource.get(sourceKey) ?? 0, a.quantity); bySource.set(sourceKey, total);
    const native = business.inboundAllocations.filter(v => v.purchase_order_line_id === source.id).reduce((n, v) => sum(n, v.quantity), 0);
    const originalQuantity = a.resource.kind === 'c1_inbound' ? business.inbound.find(v => v.id === source!.id)!.quantity : a.resource.kind === 'scheduled_transfer' ? ledger.scheduledTransfers.find(t => t.id === source!.id)!.quantity : holds.get(a.resource.holdId)!.quantity;
    if (sum(native, total) > originalQuantity) throw new DomainError('OVERCOMMITTED_INDUSTRIAL_ALLOCATION');
    if (a.target.kind === 'commitment') {
      const line = business.lines.find(l => l.id === a.target.id), order = line ? business.orders.find(o => o.id === line.order_id) : undefined;
      if (!line || !order || order.status !== 'confirmed' || line.product_id !== a.productId || line.unit !== a.unit || order.depot_id !== source.depot_id) throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION_TARGET');
      view.inboundAllocations.push({ id: a.id, purchase_order_line_id: source.id, order_line_id: line.id, quantity: a.quantity, unit: a.unit });
    } else if (a.target.kind === 'crm_demand') {
      const demand = context.commercialDemand.find(d => d.opportunityId === a.target.id);
      if (!demand || demand.productId !== a.productId || demand.unit !== a.unit || demand.destinationDepotId !== source.depot_id || source.expected_date === null || source.expected_date > demand.needDate) throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION_TARGET');
      source.quantity -= a.quantity;
    } else throw new DomainError('INVALID_INDUSTRIAL_ALLOCATION_TARGET');
  }
  const claimedAllocations = new Set<string>();
  for (const offer of ledger.draftOffers) {
    if (!['draft', 'cancelled'].includes(offer.status) || !Array.isArray(offer.allocationIds) || offer.allocationIds.length === 0 || offer.allocationIds.length > 100 || new Set(offer.allocationIds).size !== offer.allocationIds.length) throw new DomainError('INVALID_INDUSTRIAL_DRAFT');
    if (offer.status !== 'draft') continue;
    const demand = context.commercialDemand.find(d => d.opportunityId === offer.opportunityId);
    if (!demand) throw new DomainError('UNKNOWN_DRAFT_DEMAND'); textField(offer.demandVersion, 'demandVersion');
    let allocated = 0;
    for (const allocationId of offer.allocationIds) {
      const a = allocationIds.get(allocationId);
      if (!a || a.status !== 'active' || a.executionId !== offer.executionId || a.target.kind !== 'crm_demand' || a.target.id !== offer.opportunityId || claimedAllocations.has(a.id)) throw new DomainError('INVALID_DRAFT_ALLOCATION');
      claimedAllocations.add(a.id); allocated = sum(allocated, a.quantity);
    }
    if (allocated !== offer.quantity) throw new DomainError('INVALID_DRAFT_ALLOCATION');
    const n = sum(drafted.get(offer.opportunityId) ?? 0, offer.quantity);
    if (n > demand.quantity) throw new DomainError('OVERCOMMITTED_CRM_DEMAND'); drafted.set(offer.opportunityId, n);
  }
  return { snapshot: view, used, drafted };
}

/** Reservations that were not consumed by coverage still cannot finance a commercial offer. */
function physicalSurplus(snapshot: BusinessSnapshot, covered: Coverage[]): Map<string, number> {
  const reserved = new Map<string, number>(), reservedByLine = new Map<string, number>();
  const key = (stockId: string, lineId: string): string => JSON.stringify([stockId, lineId]);
  for (const r of snapshot.reservations) if (r.status === 'active') {
    reserved.set(r.stock_id, sum(reserved.get(r.stock_id) ?? 0, r.quantity));
    const k = key(r.stock_id, r.order_line_id); reservedByLine.set(k, sum(reservedByLine.get(k) ?? 0, r.quantity));
  }
  const stocks = new Set(snapshot.inventory.map(s => s.id));
  const consumed = new Map<string, number>(), ownUsed = new Map<string, number>();
  for (const line of covered) for (const a of line.allocations) if (stocks.has(a.sourceId)) {
    consumed.set(a.sourceId, sum(consumed.get(a.sourceId) ?? 0, a.quantity));
    const k = key(a.sourceId, line.orderLineId), remaining = reservedByLine.get(k) ?? 0;
    const owned = Math.min(a.quantity, remaining); reservedByLine.set(k, remaining - owned);
    ownUsed.set(a.sourceId, sum(ownUsed.get(a.sourceId) ?? 0, owned));
  }
  return new Map(snapshot.inventory.map(stock => {
    const free = stock.physical_quantity - (reserved.get(stock.id) ?? 0) - ((consumed.get(stock.id) ?? 0) - (ownUsed.get(stock.id) ?? 0));
    if (!Number.isSafeInteger(free) || free < 0) throw new DomainError('INVALID_INDUSTRIAL_CAPACITY');
    return [stock.id, free];
  }));
}

/** Deterministic bounded candidate, not a global optimiser. No inventory, reservation or ERP mutation. */
export function evaluateIndustrialPlan(input: IndustrialEvaluationInput): IndustrialAssessment {
  const { snapshot, releasedEvent: release, evaluatedAt } = input;
  const now = timestamp(evaluatedAt), business = parseSnapshot(snapshot.dataset);
  const context = currentIndustrialContext(input.context, snapshot, evaluatedAt), policy = policyFromContract(snapshot);
  if (business.companyId !== snapshot.companyId || business.revision !== snapshot.revision || snapshot.dataOrigin !== 'synthetic' || timestamp(business.asOf) > now) throw new DomainError('INCOHERENT_SNAPSHOT');
  if (release.companyId !== snapshot.companyId || release.businessRevision !== snapshot.revision || release.policyVersion !== snapshot.policyVersion || release.contextRevision !== context.revision || release.qualificationRevision !== context.qualificationRevision) throw new DomainError('STALE_INDUSTRIAL_CONTEXT');
  textField(release.id, 'release.id'); textField(release.revision, 'release.revision'); textField(release.releasedByActorId, 'release.actorId');
  const event = release.event, releasedTime = timestamp(release.releasedAt), eventTime = timestamp(event.occurredAt);
  const site = context.supplierSites.find(s => s.supplierSiteId === event.supplierSiteId && s.supplierId === event.supplierId);
  if (!site || event.kind !== 'industrial_fire' || event.status !== 'declared_synthetic_scenario' || event.testOnly !== true || event.provenance.system !== 'SCENARIO' || eventTime > releasedTime || releasedTime > now || timestamp(event.provenance.receivedAt) > releasedTime || !Array.isArray(event.productIds) || event.productIds.length === 0 || event.productIds.some(id => !site.productIds.includes(id))) throw new DomainError('INVALID_INDUSTRIAL_EVENT');
  if (!Array.isArray(release.confirmations) || release.confirmations.length > 100 || !Array.isArray(release.competitorConfirmations) || release.competitorConfirmations.length > 100 || !Array.isArray(release.researchDependencies) || release.researchDependencies.length > 10) throw new DomainError('INVALID_INDUSTRIAL_RELEASE');
  for (const d of release.researchDependencies) {
    if (!d.scope || !['live', 'controlled'].includes(d.scope.namespace) || !Number.isSafeInteger(d.generation) || d.generation < 0 || d.validUntil === null || timestamp(d.validUntil) <= now || !Array.isArray(d.evidenceRefs) || d.evidenceRefs.length === 0 || d.evidenceRefs.length > 10) throw new DomainError('STALE_INDUSTRIAL_RESEARCH');
    textField(d.scope.profileId, 'profileId'); textField(d.scope.profileVersion, 'profileVersion');
    for (const ref of d.evidenceRefs) { textField(ref.occurrenceId, 'occurrenceId'); textField(ref.evidenceId, 'evidenceId'); if (!/^[a-f0-9]{64}$/.test(ref.contentHash)) throw new DomainError('INVALID_EVIDENCE_HASH'); }
  }
  const basis: IndustrialBasis = { companyId: snapshot.companyId, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, contextRevision: context.revision, qualificationRevision: context.qualificationRevision, eventId: event.eventId, eventRevision: release.revision, researchDependencies: structuredClone(release.researchDependencies) };
  const calculationHash = inputHash(input, context);
  const id = referenceId('industrial-assessment', [calculationHash]);
  const affected = new Set<string>(), seenConfirmations = new Set<string>();
  const nativePurchases = new Map(snapshot.dataset.tables.purchase_orders!.map(p => [p.id, p]));
  const inbound = new Map(business.inbound.map(p => [p.id, p]));
  for (const c of release.confirmations) {
    const line = inbound.get(c.purchaseOrderLineId);
    const relation = context.supplierDependencies.find(d => d.supplierId === c.supplierId && d.supplierSiteId === c.supplierSiteId && d.purchaseOrderLineIds.includes(c.purchaseOrderLineId) && d.productId === line?.product_id);
    if (seenConfirmations.has(c.confirmationId) || !line || !relation || c.eventId !== event.eventId || c.supplierId !== event.supplierId || c.supplierSiteId !== event.supplierSiteId || !event.productIds.includes(line.product_id) || nativePurchases.get(line.purchase_order_id)?.supplier_id !== c.supplierId || c.confirmationStatus !== 'synthetic_confirmed' || timestamp(c.confirmedAt) < eventTime || timestamp(c.confirmedAt) > releasedTime || timestamp(c.provenance.receivedAt) > releasedTime) throw new DomainError('INVALID_INDUSTRIAL_CONFIRMATION');
    seenConfirmations.add(c.confirmationId); calendarDate(c.confirmedExpectedDate, 'confirmedExpectedDate');
    if (line.expected_date !== c.confirmedExpectedDate || business.purchases.find(p => p.id === line.purchase_order_id)?.status !== 'confirmed') throw new DomainError('UNAPPLIED_CONFIRMATION');
    for (const lineId of relation.orderLineIds) affected.add(lineId);
    for (const a of business.inboundAllocations) if (a.purchase_order_line_id === line.id) affected.add(a.order_line_id);
  }
  const execution = executionView(input, business, context);
  const currentBusiness = execution.snapshot;
  const before = coverage(currentBusiness, policy), baseById = new Map(before.map(c => [c.orderLineId, c]));
  const constraints: string[] = [], unknowns = ['SYNTHETIC_OPERATOR_EVENT_NOT_PUBLICLY_VERIFIED', 'UPSTREAM_MANUFACTURING_ORIGIN_UNKNOWN', 'BOUNDED_CANDIDATE_NOT_GLOBAL_OPTIMUM', 'SERVER_REVALIDATION_AND_ACTOR_BUDGET_REQUIRED'];
  const qualifiedDemand = context.commercialDemand.find(d => d.opportunityId === input.demandId);
  const demand = qualifiedDemand ? { ...qualifiedDemand, quantity: qualifiedDemand.quantity - (execution.drafted.get(qualifiedDemand.opportunityId) ?? 0) } : undefined;
  const emptyCoverage = { totalCommitments: before.length, protectedCommitments: before.filter(c => c.shortage === 0 && c.needDate !== null).length, worsenedOrderLineIds: [], remainingShortageOrderLineIds: before.filter(c => c.shortage > 0 || c.needDate === null).map(c => c.orderLineId) };
  if (!demand) return { id, basis, evaluatedAt, testOnly: true, impact: 'needs_input', affectedOrderLineIds: [...affected].sort(), qualifiedDemandIds: [], coverage: emptyCoverage, plans: [], constraints: ['QUALIFIED_CRM_DEMAND_REQUIRED'], unknowns, calculationHash };
  if (demand.quantity === 0) return { id, basis, evaluatedAt, testOnly: true, impact: 'needs_input', affectedOrderLineIds: [...affected].sort(), qualifiedDemandIds: [demand.opportunityId], coverage: emptyCoverage, plans: [], constraints: ['CRM_DEMAND_ALREADY_DRAFTED'], unknowns, calculationHash };
  let matchingCompetitor = false;
  const competitorConfirmationIds = new Set<string>();
  for (const c of release.competitorConfirmations) {
    const competitor = context.competitors.find(v => v.id === c.competitorId);
    if (competitorConfirmationIds.has(c.confirmationId) || !competitor || c.eventId !== event.eventId || !event.competitorIds.includes(c.competitorId) || c.supplierSiteId !== event.supplierSiteId || !competitor.supplierSiteIds.includes(c.supplierSiteId) || !competitor.productIds.includes(c.productId) || c.confirmationStatus !== 'synthetic_confirmed' || timestamp(c.confirmedAt) < eventTime || timestamp(c.confirmedAt) > releasedTime || timestamp(c.provenance.receivedAt) > releasedTime) throw new DomainError('INVALID_COMPETITOR_CONFIRMATION');
    competitorConfirmationIds.add(c.confirmationId);
    quantity(c.quantity, 'competitor.quantity'); calendarDate(c.requestedDeliveryDate, 'requestedDeliveryDate'); calendarDate(c.cannotFulfilBefore, 'cannotFulfilBefore');
    if (c.relatedOpportunityId === demand.opportunityId && c.productId === demand.productId && c.unit === demand.unit && c.quantity >= demand.quantity && c.requestedDeliveryDate === demand.needDate && c.cannotFulfilBefore > demand.needDate) matchingCompetitor = true;
  }
  if (!matchingCompetitor) constraints.push('COMPETITOR_UNAVAILABILITY_CONFIRMATION_REQUIRED');
  if (demand.needDate < evaluatedAt.slice(0, 10)) constraints.push('CRM_NEED_DATE_PASSED');
  const simulated = structuredClone(currentBusiness), steps: IndustrialPlanStep[] = [], allocations: IndustrialAllocation[] = [];
  const purchases = new Map<string, { alternative: typeof context.independentAlternatives[number]; quantity: number }>();
  const resources = new Set([...business.inventory.map(s => s.id), ...business.inbound.map(s => s.id)]);
  for (const c of before) if (affected.has(c.orderLineId) && c.shortage > 0) {
    let needed = c.shortage;
    const candidates = context.independentAlternatives.filter(a => a.productId === c.productId && a.unit === c.unit && a.destinationDepotId === c.depotId && a.affectedSiteRelation === 'independent' && a.supplierSiteId !== event.supplierSiteId && a.arrivalDate >= evaluatedAt.slice(0, 10) && c.requiredDate !== null && a.arrivalDate <= c.requiredDate).sort((a, b) => a.canonicalResourceId.localeCompare(b.canonicalResourceId));
    for (const a of candidates) {
      if (!purchases.has(a.canonicalResourceId) && purchases.size >= 18) { constraints.push('BOUNDED_PURCHASE_CANDIDATE_LIMIT'); continue; }
      const used = sum(purchases.get(a.canonicalResourceId)?.quantity ?? 0, execution.used.get(`purchase_quote:${a.canonicalResourceId}`) ?? 0), amount = Math.min(needed, a.availableQuantity - used);
      if (amount <= 0) continue;
      purchases.set(a.canonicalResourceId, { alternative: a, quantity: sum(purchases.get(a.canonicalResourceId)?.quantity ?? 0, amount) }); needed -= amount;
      if (needed === 0) break;
    }
    if (needed > 0) constraints.push(`NO_CONFIRMED_INDEPENDENT_REPLACEMENT:${c.orderLineId}`);
  }
  let riskSpend = 0;
  const purchaseStepByResource = new Map<string, string>();
  for (const [resourceId, item] of purchases) {
    if (resources.has(resourceId)) throw new DomainError('AMBIGUOUS_INDUSTRIAL_RESOURCE');
    const a = item.alternative, stepId = referenceId('industrial-purchase', [id, resourceId]);
    const material = multiply(item.quantity, a.unitCostCents); riskSpend = sum(riskSpend, sum(material, a.freightCents));
    steps.push({ id: stepId, kind: 'purchase', canonicalResourceId: resourceId, quoteId: a.quoteId, supplierId: a.supplierId, supplierSiteId: a.supplierSiteId, productId: a.productId, unit: a.unit, quantity: item.quantity, destinationDepotId: a.destinationDepotId, arrivalDate: a.arrivalDate, materialCents: material, freightCents: a.freightCents, dependsOn: [] });
    purchaseStepByResource.set(resourceId, stepId);
    const purchaseId = referenceId('industrial-simulated-purchase', [id, resourceId]);
    if (simulated.purchases.some(p => p.id === purchaseId)) throw new DomainError('AMBIGUOUS_INDUSTRIAL_RESOURCE');
    simulated.purchases.push({ id: purchaseId, status: 'confirmed' });
    simulated.inbound.push({ id: resourceId, purchase_order_id: purchaseId, product_id: a.productId, depot_id: a.destinationDepotId, quantity: item.quantity, unit: a.unit, expected_date: a.arrivalDate });
  }
  const afterRisk = coverage(simulated, policy), surplus = physicalSurplus(simulated, afterRisk);
  const economic: IndustrialEconomics = { currency: 'EUR', grossNewSpendCents: riskSpend, riskMitigationSpendCents: riskSpend, opportunityRevenueCents: null, opportunityMaterialValuationCents: null, opportunityFreightCents: null, opportunityHandlingCents: null, opportunityContributionCents: null, missing: [] };
  const quotes = context.deliveryQuotes.filter(q => q.opportunityId === demand.opportunityId && q.productId === demand.productId && q.unit === demand.unit && q.destinationDepotId === demand.destinationDepotId && q.availableQuantity - (execution.used.get(`transport_quote:${q.transportQuoteId}`) ?? 0) >= demand.quantity && q.dispatchDate >= evaluatedAt.slice(0, 10) && q.arrivalDate <= demand.needDate && (surplus.get(q.sourceStockId) ?? 0) >= demand.quantity).sort((a, b) => a.quoteId.localeCompare(b.quoteId));
  let offered = false;
  for (const quote of quotes) {
    const valuation = context.stockValuations.find(v => v.stockId === quote.sourceStockId && v.productId === demand.productId && v.unit === demand.unit && v.stockSource.affectedSiteRelation === 'independent_on_hand_for_this_scenario');
    if (!valuation) continue;
    const stock = simulated.inventory.find(s => s.id === quote.sourceStockId)!;
    stock.physical_quantity -= demand.quantity;
    const transferred = coverage(simulated, policy);
    if (transferred.some(c => c.shortage > (baseById.get(c.orderLineId)?.shortage ?? 0))) { stock.physical_quantity += demand.quantity; continue; }
    const transferId = referenceId('industrial-transfer', [id, quote.quoteId]);
    steps.push({ id: transferId, kind: 'transfer', canonicalResourceId: stock.id, quoteId: quote.quoteId, quoteSource: 'industrial_delivery', productId: demand.productId, unit: demand.unit, quantity: demand.quantity, fromDepotId: quote.fromDepotId, destinationDepotId: demand.destinationDepotId, dispatchDate: quote.dispatchDate, arrivalDate: quote.arrivalDate, freightCents: quote.freightCents, handlingCents: quote.handlingCents, dependsOn: steps.filter(s => s.kind === 'purchase').map(s => s.id) });
    steps.push({ id: referenceId('industrial-offer', [id, demand.opportunityId]), kind: 'prepare_offer', opportunityId: demand.opportunityId, productId: demand.productId, unit: demand.unit, quantity: demand.quantity, destinationDepotId: demand.destinationDepotId, needDate: demand.needDate, saleUnitPriceCents: demand.saleUnitPriceCents, dependsOn: [transferId] });
    allocations.push({ canonicalResourceId: stock.id, targetKind: 'crm_demand', targetId: demand.opportunityId, productId: demand.productId, unit: demand.unit, quantity: demand.quantity, availableDate: quote.arrivalDate, supplyStepId: transferId });
    economic.opportunityRevenueCents = multiply(demand.quantity, demand.saleUnitPriceCents);
    economic.opportunityMaterialValuationCents = multiply(demand.quantity, valuation.unitCostCents);
    economic.opportunityFreightCents = quote.freightCents; economic.opportunityHandlingCents = quote.handlingCents;
    economic.opportunityContributionCents = sum(sum(economic.opportunityRevenueCents, -economic.opportunityMaterialValuationCents), -sum(quote.freightCents, quote.handlingCents));
    if (economic.opportunityContributionCents <= 0) constraints.push('NON_POSITIVE_OPPORTUNITY_CONTRIBUTION_REQUIRES_REVIEW');
    economic.grossNewSpendCents = sum(riskSpend, sum(quote.freightCents, quote.handlingCents)); offered = true; break;
  }
  if (!offered) { constraints.push('QUALIFIED_SURPLUS_DELIVERY_AND_VALUATION_REQUIRED'); economic.missing.push('CONFIRMED_COMBINED_COMMERCIAL_ALLOCATION'); }
  const final = coverage(simulated, policy), worsened = final.filter(c => c.shortage > (baseById.get(c.orderLineId)?.shortage ?? 0)).map(c => c.orderLineId);
  const remaining = final.filter(c => c.shortage > 0 || c.needDate === null).map(c => c.orderLineId);
  if (worsened.length) constraints.push('CONFIRMED_COMMITMENT_WORSENED');
  if (remaining.length) constraints.push('NOT_ALL_CONFIRMED_COMMITMENTS_PROTECTED');
  for (const c of final) for (const a of c.allocations) allocations.push({ canonicalResourceId: a.sourceId, targetKind: 'commitment', targetId: c.orderLineId, productId: c.productId, unit: c.unit, quantity: a.quantity, availableDate: a.availableDate, ...(purchaseStepByResource.has(a.sourceId) ? { supplyStepId: purchaseStepByResource.get(a.sourceId)! } : {}) });
  const coverageResult = { totalCommitments: final.length, protectedCommitments: final.length - remaining.length, worsenedOrderLineIds: worsened, remainingShortageOrderLineIds: remaining };
  const allConstraints = [...new Set(constraints)], feasible = allConstraints.length === 0;
  return { id, basis, evaluatedAt, testOnly: true, impact: affected.size ? 'mixed' : 'opportunity', affectedOrderLineIds: [...affected].sort(), qualifiedDemandIds: [demand.opportunityId], coverage: coverageResult,
    plans: [{ id: referenceId('industrial-plan', [calculationHash]), version: calculationHash, basis: structuredClone(basis), evaluationId: id, demandId: demand.opportunityId, targetOrderLineIds: [...affected].sort(), steps, allocations, economics: economic, constraints: allConstraints, unknowns: [...unknowns], status: feasible ? 'feasible' : worsened.length ? 'rejected' : 'conditional' }], constraints: allConstraints, unknowns, calculationHash };
}
