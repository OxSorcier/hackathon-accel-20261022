import assert from 'node:assert/strict';
import { test } from 'vitest';
import { projectIndustrialModelContext } from '../../src/agent/industrial-context.js';
import { evaluateIndustrialPlan } from '../../src/domain/industrial.js';
import { industrialFixture } from '../domain/industrial-fixture.js';

test('model sees a bounded positive projection and potential contribution, never full ERP or operator construction', (): void => {
  const input = industrialFixture(), assessment = evaluateIndustrialPlan(input);
  Object.assign(assessment, { hiddenOracle: 'SECRET_ORACLE' });
  const view = projectIndustrialModelContext(input, assessment), encoded = JSON.stringify(view);
  for (const secret of ['SECRET_ORACLE', 'SECRET_CONTEXT', 'SECRET_CONSTRUCTION', 'operator-event.v2.json', 'portfolio-10000.json']) assert.equal(encoded.includes(secret), false);
  assert.ok(encoded.length < 18000); assert.equal((view.demand as Record<string, unknown>).predatesEvent, true);
  assert.equal(view.testOnly, true); assert.ok(encoded.includes('draft_potential_revenue_only')); assert.ok(encoded.includes('UPSTREAM_MANUFACTURING_ORIGIN_UNKNOWN'));
  const changed = structuredClone(input); changed.snapshot.revision = 'NEW'; assert.throws(() => projectIndustrialModelContext(changed, assessment), /STALE_INDUSTRIAL_CONTEXT/);
  const changedData = structuredClone(input); changedData.snapshot.dataset.tables.orders![0]!.constructionNote = 'SECRET_CONSTRUCTION'; assert.throws(() => projectIndustrialModelContext(changedData, assessment), /STALE_INDUSTRIAL_CONTEXT/);
});

test('large calculated allocations stay server-side with truthful counts and explicit truncation', (): void => {
  const input = industrialFixture(), assessment = evaluateIndustrialPlan(input);
  const p = assessment.plans[0]!, a = p.allocations[0]!;
  for (let i = 0; i < 10000; i++) p.allocations.push({ ...a, targetId: `EXTRA-${i}` });
  assessment.affectedOrderLineIds.push(...Array.from({ length: 100 }, (_, i) => `EXTRA-${i}`));
  const view = projectIndustrialModelContext(input, assessment), plans = view.plans as Record<string, unknown>[], plan = plans[0]!;
  assert.equal(plan.allocationsTotal, p.allocations.length); assert.equal(plan.allocationsTruncated, true);
  assert.ok((plan.allocations as unknown[]).length <= 20); assert.ok(JSON.stringify(view).length < 18000);
});

test('SCENARIO and future CRM demand excluded by calculation never reappear in the model projection', (): void => {
  const input = industrialFixture(); input.context.commercialDemand[0]!.provenance.system = 'SCENARIO';
  const assessment = evaluateIndustrialPlan(input), view = projectIndustrialModelContext(input, assessment);
  assert.equal(assessment.impact, 'needs_input'); assert.deepEqual(assessment.qualifiedDemandIds, []);
  assert.equal(view.demand, null); assert.equal(JSON.stringify(view).includes('existing_synthetic_confirmed_crm_demand'), false);
});
