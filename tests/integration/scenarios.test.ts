import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { businessEngine } from '../../src/domain/index.js';
import { buildModelContext } from '../../src/agent/index.js';
import type { AgentRunnerInput, CompanySnapshot } from '../../src/contracts/index.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
async function baseline(): Promise<CompanySnapshot> {
  const dataset = datasetSchema.parse(JSON.parse(await readFile('fixtures/company/dataset.json', 'utf8')));
  const policy = policySchema.parse(JSON.parse(await readFile('fixtures/company/company-policy.json', 'utf8')));
  return { companyId: dataset.company_id, revision: 'R0', policyVersion: 'P1', dataOrigin: 'synthetic', dataset, policy, updatedAt: dataset.as_of };
}
function patch(snapshot: CompanySnapshot, table: string, id: string, fields: Record<string, string>): void {
  const row = snapshot.dataset.tables[table]?.find(value => value.id === id);
  if (!row) throw new Error('Test input row missing'); Object.assign(row, fields);
}
describe('integrated released business scenarios, deterministic only', () => {
  it('distinguishes R0, S1, S2 and S3 without mutating input stock', async () => {
    const snapshot = await baseline();
    const stock = structuredClone(snapshot.dataset.tables.inventory);
    expect(businessEngine(snapshot).options.find(option => option.kind === 'wait' && option.effects.targetOrderLineId === 'OL-A')?.status).toBe('feasible');
    patch(snapshot, 'purchase_order_lines', 'POL-1', { expected_date: '2026-10-27' });
    expect(businessEngine(snapshot).options.find(option => option.kind === 'transfer')?.status).not.toBe('feasible');
    patch(snapshot, 'purchase_orders', 'PO-2', { status: 'confirmed' });
    const transfer = businessEngine(snapshot).options.find(option => option.kind === 'transfer');
    expect(transfer?.status).toBe('feasible'); expect(transfer?.costEur).toBe(120);
    patch(snapshot, 'purchase_order_lines', 'POL-2', { expected_date: '2026-11-07' });
    const evaluation = businessEngine(snapshot);
    expect(evaluation.options.find(option => option.kind === 'transfer')?.status).not.toBe('feasible');
    expect(evaluation.options.find(option => option.kind === 'emergency_purchase')?.costEur).toBe(1420);
    expect(snapshot.dataset.tables.inventory).toEqual(stock);
  });
  it('uses an independent C branch and refuses a transfer that breaks its confirmed need', async () => {
    const snapshot = await baseline();
    patch(snapshot, 'purchase_order_lines', 'POL-1', { expected_date: '2026-10-27' });
    patch(snapshot, 'purchase_orders', 'PO-2', { status: 'confirmed' });
    snapshot.dataset.tables.customers!.push({ id: 'CLI-C', company_id: snapshot.companyId, name: 'Chantier C fictif', sales_owner_id: 'EMP-PAUL' });
    snapshot.dataset.tables.orders!.push({ id: 'ORD-C', company_id: snapshot.companyId, customer_id: 'CLI-C', site: 'Chantier C', depot_id: 'DEP-CENTRE', need_date: '2026-10-24', status: 'confirmed' });
    snapshot.dataset.tables.order_lines!.push({ id: 'OL-C', company_id: snapshot.companyId, order_id: 'ORD-C', product_id: 'SKU-ISO100', quantity: 6, unit: 'palette' });
    expect(businessEngine(snapshot).options.find(option => option.kind === 'transfer')?.status).not.toBe('feasible');
    expect((businessEngine(snapshot).facts.coverage as unknown[]).length).toBe(3);
  });
  it('leaves construction material and future events out of the provider context', async () => {
    const snapshot = await baseline();
    const input: AgentRunnerInput = { actor: { actorId: 'EMP-PAUL', companyId: snapshot.companyId, role: 'direction', approvalCeilingEur: 2000 }, snapshot, memories: [], run: { id: 'context-test', companyId: snapshot.companyId, actorId: 'EMP-PAUL', operationKey: 'context-test', question: 'Les livraisons tiennent-elles ?', revision: snapshot.revision, policyVersion: snapshot.policyVersion, status: 'running', mode: 'test', model: null, proposalId: null, message: null, traces: [], createdAt: snapshot.updatedAt, completedAt: null } };
    const context = buildModelContext(input);
    expect(Object.keys(context).sort()).toEqual(['companyId', 'dataOrigin', 'manifest', 'policy', 'question']);
    expect(JSON.stringify(context)).not.toMatch(/EV-3|NOT_RUN|operator\/|\.preparation|expected_observation/);
  });
});
