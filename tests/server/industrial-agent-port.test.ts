import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import type { Actor, AgentRun, JsonObject } from '../../src/contracts/index.js';
import type { IndustrialEvaluationInput } from '../../src/contracts/industrial.js';
import { createIndustrialAgentPort, type IndustrialAgentPortOptions } from '../../src/server/industrial-agent-port.js';
import { industrialFixture } from '../domain/industrial-fixture.js';

function harness(full = false): {
  options: IndustrialAgentPortOptions; input: IndustrialEvaluationInput;
  loads: { demandId: string; evaluatedAt: string }[]; usage: string[];
  setValid(value: boolean): void; failAfterRead(): void; setTime(value: string): void;
} {
  const input = industrialFixture(full), loads: { demandId: string; evaluatedAt: string }[] = [], usage: string[] = [];
  let valid = true, failAfter = false, time = input.evaluatedAt;
  const run: AgentRun = { id: 'RUN-IND-1', companyId: input.snapshot.companyId, actorId: 'PAUL', revision: input.snapshot.revision, policyVersion: input.snapshot.policyVersion, industrialScope: { contextRevision: input.context.revision, qualificationRevision: input.context.qualificationRevision, reportId: null }, operationKey: 'ind-test', question: 'Prepare the received industrial plan.', status: 'running', mode: 'test', model: null, proposalId: null, message: null, traces: [], createdAt: time, completedAt: null };
  const actor: Actor = { companyId: run.companyId, actorId: run.actorId, role: 'direction', approvalCeilingEur: 2000 };
  const client = {} as PoolClient;
  const overview = (): JsonObject => ({ companyId: run.companyId, businessRevision: run.revision, policyVersion: run.policyVersion, contextRevision: input.context.revision, qualificationRevision: input.context.qualificationRevision, runtimeState: { report: null, approvals: [], executions: [] } });
  const options: IndustrialAgentPortOptions = {
    run, actor,
    async transaction<T>(work: (value: PoolClient) => Promise<T>): Promise<T> { return await work(client); },
    async validateBasis(received): Promise<boolean> { expect(received).toBe(client); return valid; },
    async loadInput(received, demandId, evaluatedAt): Promise<IndustrialEvaluationInput> { expect(received).toBe(client); loads.push({ demandId, evaluatedAt }); if (failAfter) valid = false; return { ...structuredClone(input), demandId, evaluatedAt }; },
    async readOverview(received): Promise<JsonObject> { expect(received).toBe(client); if (failAfter) valid = false; return overview(); },
    async reserveUsage(kind): Promise<boolean> { usage.push(kind); return usage.length <= 2; },
    now: (): Date => new Date(time),
  };
  return { options, input, loads, usage, setValid(value): void { valid = value; }, failAfterRead(): void { failAfter = true; }, setTime(value): void { time = value; } };
}
function selection(value: JsonObject): { evaluationId: string; recommendedPlanId: string; title: string; summary: string } {
  const rows = value.plans as JsonObject[];
  return { evaluationId: String(value.assessmentId), recommendedPlanId: String(rows[0]!.id), title: 'Controlled industrial report', summary: 'A deterministic joint plan. Potential revenue only.' };
}

describe('run-bound industrial agent port', () => {
  it('keeps the full calculation private while returning a bounded model projection', async () => {
    const h = harness(true), port = createIndustrialAgentPort(h.options), before = JSON.stringify(h.input);
    const projection = await port.evaluate(h.input.demandId), args = selection(projection);
    const commitments = projection.commitments as JsonObject;
    expect(commitments.total).toBe(10000); expect((commitments.details as JsonObject[]).length).toBeLessThanOrEqual(20);
    const report = await port.prepare(args);
    expect(report).toMatchObject({ id: 'report:RUN-IND-1', runId: 'RUN-IND-1', companyId: h.input.snapshot.companyId, status: 'prepared', recommendedPlanId: args.recommendedPlanId });
    expect(report.assessment.coverage).toMatchObject({ totalCommitments: 10000, protectedCommitments: 10000 });
    expect(report.assessment.plans[0]!.allocations.length).toBeGreaterThan(10000);
    expect(h.loads).toHaveLength(2); expect(h.loads[1]).toEqual(h.loads[0]);
    expect(JSON.stringify(h.input)).toBe(before); expect(h.usage).toEqual([]);
  }, 60000);

  it('does not accept an evaluation from another run or another instance', async () => {
    const h = harness(), first = createIndustrialAgentPort(h.options), args = selection(await first.evaluate(h.input.demandId));
    const second = createIndustrialAgentPort({ ...h.options, run: { ...h.options.run, id: 'RUN-IND-2' } });
    await expect(second.prepare(args)).rejects.toThrow('UNKNOWN_EVALUATION');
    expect(() => createIndustrialAgentPort({ ...h.options, actor: { ...h.options.actor, companyId: 'FOREIGN' } })).toThrow('INDUSTRIAL_SCOPE_MISMATCH');
    expect(() => createIndustrialAgentPort({ ...h.options, run: { ...h.options.run, actorId: 'FOREIGN' } })).toThrow('INDUSTRIAL_SCOPE_MISMATCH');
  });

  it('rejects a foreign or changed callback input even when the callback says the basis is valid', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options);
    h.input.context.qualificationRevision = 'OTHER';
    await expect(port.evaluate(h.input.demandId)).rejects.toThrow('INDUSTRIAL_SCOPE_MISMATCH');
    const foreign = harness(); foreign.input.snapshot.companyId = 'FOREIGN';
    await expect(createIndustrialAgentPort(foreign.options).evaluate(foreign.input.demandId)).rejects.toThrow('INDUSTRIAL_SCOPE_MISMATCH');
  });

  it('recalculates from the current full input and refuses an unversioned stock change', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options), args = selection(await port.evaluate(h.input.demandId));
    h.input.snapshot.dataset.tables.inventory![0]!.physical_quantity = Number(h.input.snapshot.dataset.tables.inventory![0]!.physical_quantity) + 1;
    await expect(port.prepare(args)).rejects.toThrow('STALE_CONTEXT');
  });

  it('rejects a release that drops research dependencies already bound to the run', async () => {
    const h = harness(), s = h.input.snapshot, c = h.input.context, e = h.input.releasedEvent;
    h.options.run.industrialBasis = { companyId: s.companyId, businessRevision: s.revision, policyVersion: s.policyVersion, contextRevision: c.revision, qualificationRevision: c.qualificationRevision, eventId: e.event.eventId, eventRevision: e.revision, researchDependencies: [{ scope: { profileId: 'soissons-project', profileVersion: 'v1', namespace: 'controlled' }, generation: 1, validUntil: '2026-10-23T09:00:00Z', evidenceRefs: [{ occurrenceId: 'O-1', evidenceId: 'E-1', contentHash: 'a'.repeat(64) }] }] };
    await expect(createIndustrialAgentPort(h.options).evaluate(h.input.demandId)).rejects.toThrow('INDUSTRIAL_SCOPE_MISMATCH');
    e.researchDependencies = structuredClone(h.options.run.industrialBasis.researchDependencies);
    const matching = createIndustrialAgentPort(h.options), args = selection(await matching.evaluate(h.input.demandId));
    expect((await matching.prepare(args)).basis.researchDependencies).toEqual(e.researchDependencies);
    e.researchDependencies[0]!.generation = 2;
    await expect(matching.prepare(args)).rejects.toThrow('INDUSTRIAL_SCOPE_MISMATCH');
  });

  it('checks authority both before and after each transactional tool', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options);
    h.setValid(false); expect(await port.validate()).toBe(false);
    await expect(port.evaluate(h.input.demandId)).rejects.toThrow('STALE_CONTEXT'); expect(h.loads).toHaveLength(0);
    h.setValid(true); h.failAfterRead();
    await expect(port.overview()).rejects.toThrow('STALE_CONTEXT');
    h.setValid(true); await expect(port.evaluate(h.input.demandId)).rejects.toThrow('STALE_CONTEXT');
  });

  it('retains neither an evaluation nor a report after a transaction fails to commit', async () => {
    const h = harness(); let commit = false, returnedId = '';
    const port = createIndustrialAgentPort({ ...h.options, async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
      return await h.options.transaction(async client => {
        const result = await work(client);
        if (result && typeof result === 'object' && 'cached' in result) returnedId = String((result.cached as { assessment: { id: string } }).assessment.id);
        if (!commit) throw new Error('Commit failed'); return result;
      });
    } });
    await expect(port.evaluate(h.input.demandId)).rejects.toThrow('Commit failed');
    commit = true;
    await expect(port.prepare({ evaluationId: returnedId, recommendedPlanId: null, title: 'No cache', summary: 'No committed calculation.' })).rejects.toThrow('UNKNOWN_EVALUATION');
  });

  it('refuses a forged plan and enforces current quote validity without changing evaluatedAt', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options), args = selection(await port.evaluate(h.input.demandId));
    await expect(port.prepare({ ...args, recommendedPlanId: 'FORGED' })).rejects.toThrow('INVALID_INDUSTRIAL_PLAN');
    const expiry = Math.min(...h.input.context.deliveryQuotes.map(q => Date.parse(q.validUntil)), ...h.input.context.independentAlternatives.map(q => Date.parse(q.validUntil)));
    h.setTime(new Date(expiry + 1).toISOString());
    await expect(port.prepare(args)).rejects.toThrow('STALE_CONTEXT');
    expect(h.loads.every(l => l.evaluatedAt === new Date(h.input.evaluatedAt).toISOString())).toBe(true);
  });

  it('requires the native company calendar and refuses a quote after Paris midnight', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options), args = selection(await port.evaluate(h.input.demandId));
    h.setTime('2026-10-22T21:00:00Z'); expect((await port.prepare(args)).status).toBe('prepared');
    h.setTime('2026-10-22T22:30:00Z'); await expect(port.prepare(args)).rejects.toThrow('STALE_CONTEXT');
    const unknown = harness(); delete unknown.input.snapshot.dataset.tables.company![0]!.timezone;
    await expect(createIndustrialAgentPort(unknown.options).evaluate(unknown.input.demandId)).rejects.toThrow('UNKNOWN_COMPANY_CALENDAR');
  });

  it('isolates returned projections and reports from its cache and validates authored text', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options), projection = await port.evaluate(h.input.demandId), args = selection(projection);
    (projection.plans as JsonObject[])[0]!.id = 'FORGED';
    const report = await port.prepare(args); report.assessment.plans[0]!.steps.length = 0;
    expect((await port.prepare(args)).assessment.plans[0]!.steps.length).toBeGreaterThan(0);
    await expect(port.prepare({ ...args, title: ' ' })).rejects.toThrow();
    await expect(port.prepare({ ...args, summary: 'a'.repeat(4001) })).rejects.toThrow();
    expect((await port.prepare({ ...args, recommendedPlanId: null })).status).toBe('needs_input');
  });

  it('answers post-action overview without calculating and delegates durable usage once per request', async () => {
    const h = harness(), port = createIndustrialAgentPort(h.options);
    const overview = await port.overview(); expect(overview.runtimeState).toEqual({ report: null, approvals: [], executions: [] }); expect(h.loads).toHaveLength(0);
    expect(await port.reserveUsage('provider')).toBe(true); expect(await port.reserveUsage('tool')).toBe(true); expect(await port.reserveUsage('provider')).toBe(false);
    expect(h.usage).toEqual(['provider', 'tool', 'provider']);
  });
});
