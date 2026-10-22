import type { JsonObject } from '../contracts/index.js';
import type { IndustrialAssessment, IndustrialEvaluationInput, IndustrialPlanStep } from '../contracts/industrial.js';
import { DomainError } from '../domain/model.js';
import { industrialInputHash } from '../domain/industrial.js';
import { currentIndustrialContext } from '../data/industrial-relations.js';

const limit = 20;
function strings(values: string[]): string[] { return values.slice(0, limit).map(s => s.slice(0, 500)); }
function step(s: IndustrialPlanStep): JsonObject {
  const common = { id: s.id, kind: s.kind, productId: s.productId, unit: s.unit, quantity: s.quantity, destinationDepotId: s.destinationDepotId, dependsOn: strings(s.dependsOn) };
  if (s.kind === 'purchase') return { ...common, canonicalResourceId: s.canonicalResourceId, quoteId: s.quoteId, supplierId: s.supplierId, supplierSiteId: s.supplierSiteId, arrivalDate: s.arrivalDate, materialCents: s.materialCents, freightCents: s.freightCents };
  if (s.kind === 'transfer') return { ...common, canonicalResourceId: s.canonicalResourceId, quoteId: s.quoteId, quoteSource: s.quoteSource, fromDepotId: s.fromDepotId, dispatchDate: s.dispatchDate, arrivalDate: s.arrivalDate, freightCents: s.freightCents, handlingCents: s.handlingCents };
  return { ...common, opportunityId: s.opportunityId, needDate: s.needDate, saleUnitPriceCents: s.saleUnitPriceCents, state: 'draft_potential_revenue_only' };
}

/** Positive bounded view. Full commitments and allocations stay in the deterministic assessment. */
export function projectIndustrialModelContext(input: IndustrialEvaluationInput, assessment: IndustrialAssessment): JsonObject {
  const b = assessment.basis, e = input.releasedEvent;
  if (b.companyId !== input.snapshot.companyId || b.businessRevision !== input.snapshot.revision || b.policyVersion !== input.snapshot.policyVersion || b.contextRevision !== input.context.revision || b.qualificationRevision !== input.context.qualificationRevision || b.eventId !== e.event.eventId || b.eventRevision !== e.revision || assessment.evaluatedAt !== input.evaluatedAt || industrialInputHash(input) !== assessment.calculationHash) throw new DomainError('STALE_INDUSTRIAL_CONTEXT');
  const current = currentIndustrialContext(input.context, input.snapshot, input.evaluatedAt);
  const demand = current.commercialDemand.find(d => d.opportunityId === input.demandId && assessment.qualifiedDemandIds.includes(d.opportunityId));
  const ids = assessment.affectedOrderLineIds.slice(0, limit), selected = new Set(ids);
  const orders = new Map(input.snapshot.dataset.tables.orders!.map(o => [o.id, o]));
  const commitments = input.snapshot.dataset.tables.order_lines!.filter(l => selected.has(String(l.id))).map(l => ({ orderLineId: String(l.id), productId: String(l.product_id), quantity: Number(l.quantity), unit: String(l.unit), needDate: orders.get(l.order_id)?.need_date ?? null }));
  const plans = assessment.plans.slice(0, 3).map(p => {
    const allocations = p.allocations.filter(a => a.targetKind === 'crm_demand' || selected.has(a.targetId)).slice(0, limit).map(a => ({ canonicalResourceId: a.canonicalResourceId, targetKind: a.targetKind, targetId: a.targetId, productId: a.productId, unit: a.unit, quantity: a.quantity, availableDate: a.availableDate }));
    return { id: p.id, version: p.version, status: p.status, stepsTotal: p.steps.length, stepsReturned: Math.min(p.steps.length, limit), stepsTruncated: p.steps.length > limit, steps: p.steps.slice(0, limit).map(step), allocationsTotal: p.allocations.length, allocationsReturned: allocations.length, allocationsTruncated: p.allocations.length > allocations.length, allocations, economics: { currency: p.economics.currency, grossNewSpendCents: p.economics.grossNewSpendCents, riskMitigationSpendCents: p.economics.riskMitigationSpendCents, opportunityRevenueCents: p.economics.opportunityRevenueCents, opportunityMaterialValuationCents: p.economics.opportunityMaterialValuationCents, opportunityFreightCents: p.economics.opportunityFreightCents, opportunityHandlingCents: p.economics.opportunityHandlingCents, opportunityContributionCents: p.economics.opportunityContributionCents, missing: strings(p.economics.missing) }, constraints: strings(p.constraints), unknowns: strings(p.unknowns) };
  });
  return {
    schema: 'adaptops-industrial-model/1', testOnly: true, dataOrigin: 'synthetic', companyId: b.companyId,
    calculationHash: assessment.calculationHash, assessmentId: assessment.id, evaluatedAt: assessment.evaluatedAt,
    basis: { businessRevision: b.businessRevision, policyVersion: b.policyVersion, contextRevision: b.contextRevision, qualificationRevision: b.qualificationRevision, eventId: b.eventId, eventRevision: b.eventRevision },
    event: { eventId: e.event.eventId, kind: e.event.kind, occurredAt: e.event.occurredAt, qualification: 'declared_synthetic_operator_scenario', publicSourceCount: e.event.publicSourceEvidenceRefs.length },
    impact: assessment.impact,
    commitments: { total: assessment.coverage.totalCommitments, protected: assessment.coverage.protectedCommitments, affectedTotal: assessment.affectedOrderLineIds.length, returned: commitments.length, truncated: assessment.affectedOrderLineIds.length > commitments.length, details: commitments, remainingShortageCount: assessment.coverage.remainingShortageOrderLineIds.length, remainingShortageIds: strings(assessment.coverage.remainingShortageOrderLineIds), worsenedCount: assessment.coverage.worsenedOrderLineIds.length, worsenedIds: strings(assessment.coverage.worsenedOrderLineIds) },
    demand: demand ? { opportunityId: demand.opportunityId, customerId: demand.customerId, projectId: demand.projectId, productId: demand.productId, unit: demand.unit, quantity: demand.quantity, needDate: demand.needDate, saleUnitPriceCents: demand.saleUnitPriceCents, confirmedAt: demand.confirmedAt, predatesEvent: Date.parse(demand.confirmedAt) < Date.parse(e.event.occurredAt), qualification: 'existing_synthetic_confirmed_crm_demand' } : null,
    plansTotal: assessment.plans.length, plansReturned: plans.length, plansTruncated: assessment.plans.length > plans.length, plans,
    constraints: strings(assessment.constraints), unknowns: strings(assessment.unknowns), authority: 'server_revalidates_exact_plan_and_budget_before_demo_execution',
  };
}
