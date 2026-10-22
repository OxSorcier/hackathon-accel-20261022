import { readFileSync } from 'node:fs';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot } from '../../src/contracts/index.js';
import type { IndustrialContext, IndustrialEvaluationInput, ReleasedIndustrialEvent } from '../../src/contracts/industrial.js';

const root = new URL('../../proposals/product/alignment-20261022/v2/', import.meta.url);
const dataset = JSON.parse(readFileSync(new URL('portfolio-10000.json', root), 'utf8')) as CompanyDataset;
const policy = JSON.parse(readFileSync(new URL('portfolio-policy.json', root), 'utf8')) as CompanyPolicy;
const context = JSON.parse(readFileSync(new URL('industrial-context.v2.json', root), 'utf8')) as IndustrialContext;
const operator = JSON.parse(readFileSync(new URL('operator-event.v2.json', root), 'utf8')) as Pick<ReleasedIndustrialEvent, 'event' | 'confirmations' | 'competitorConfirmations'>;

/** Test-only explicit operator release. Never imported by a product entry point. */
export function industrialFixture(full = false): IndustrialEvaluationInput {
  const snapshot: CompanySnapshot = { companyId: dataset.company_id, revision: dataset.snapshot_revision, policyVersion: 'P-INDUSTRIAL-1', dataOrigin: 'synthetic', dataset: structuredClone(dataset), policy: structuredClone(policy), updatedAt: dataset.as_of };
  const c = structuredClone(context);
  if (!full) {
    const t = snapshot.dataset.tables;
    t.order_lines = t.order_lines!.filter(l => ['OL-A', 'OL-B'].includes(String(l.id)));
    const lineIds = new Set(t.order_lines.map(l => l.id));
    t.reservations = t.reservations!.filter(r => lineIds.has(r.order_line_id));
    t.inbound_allocations = t.inbound_allocations!.filter(a => lineIds.has(a.order_line_id));
    t.inventory!.find(s => s.id === 'ST-IND-DEP-LYON-SKU-ISO100')!.physical_quantity = 20;
    c.supplierDependencies = c.supplierDependencies.filter(d => d.purchaseOrderLineIds.includes('POL-1'));
  }
  snapshot.dataset.tables.purchase_order_lines!.find(l => l.id === 'POL-1')!.expected_date = '2026-11-20';
  const releasedEvent: ReleasedIndustrialEvent = { id: 'RELEASE-IND-1', companyId: snapshot.companyId, revision: 'RELEASE-R1', contextRevision: c.revision, qualificationRevision: c.qualificationRevision, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, ...structuredClone(operator), releasedByActorId: 'OPERATOR', releasedAt: '2026-10-22T07:05:00Z', researchDependencies: [] };
  return { snapshot, context: c, releasedEvent, executionState: { companyId: snapshot.companyId, businessRevision: snapshot.revision, stockHolds: [], capacityUses: [], scheduledTransfers: [], allocations: [], draftOffers: [] }, demandId: 'CRM-IND-000', evaluatedAt: '2026-10-22T09:00:00Z' };
}
