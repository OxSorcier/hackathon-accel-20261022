import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Actor, AgentRun, JsonObject } from '../contracts/index.js';
import type { IndustrialAgentPort, IndustrialAssessment, IndustrialEvaluationInput, IndustrialReport } from '../contracts/industrial.js';
import type { ResearchDependency } from '../contracts/research.js';
import { projectIndustrialModelContext } from '../agent/industrial-context.js';
import { currentIndustrialContext } from '../data/industrial-relations.js';
import { evaluateIndustrialPlan, industrialInputHash } from '../domain/industrial.js';
import { DomainError } from '../domain/model.js';

export interface IndustrialAgentPortOptions {
  run: AgentRun;
  actor: Actor;
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
  loadInput(client: PoolClient, demandId: string, evaluatedAt: string): Promise<IndustrialEvaluationInput>;
  readOverview(client: PoolClient): Promise<JsonObject>;
  validateBasis(client: PoolClient): Promise<boolean>;
  reserveUsage(kind: 'provider' | 'tool'): Promise<boolean>;
  now?: () => Date;
}
const id = z.string().trim().min(1).max(500);
const prepareSchema = z.object({ evaluationId: id, recommendedPlanId: id.nullable(), title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(4000) }).strict();
interface CachedEvaluation { demandId: string; evaluatedAt: string; inputHash: string; assessment: IndustrialAssessment }
function researchKey(values: readonly ResearchDependency[]): string {
  return JSON.stringify(values.map(d => JSON.stringify([d.scope.profileId, d.scope.profileVersion, d.scope.namespace, d.generation, d.validUntil === null ? null : new Date(d.validUntil).toISOString(), d.evidenceRefs.map(r => JSON.stringify([r.occurrenceId, r.evidenceId, r.contentHash])).sort()])).sort());
}
function companyDay(input: IndustrialEvaluationInput, instant: string): string {
  const companies = input.snapshot.dataset.tables.company?.filter(row => row.id === input.snapshot.companyId) ?? [];
  const zone = companies.length === 1 ? companies[0]!.timezone : undefined;
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 100) throw new DomainError('UNKNOWN_COMPANY_CALENDAR');
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, calendar: 'iso8601', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
    const value = (name: string): string => parts.find(p => p.type === name)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch { throw new DomainError('UNKNOWN_COMPANY_CALENDAR'); }
}

/** One run, one private cache. Publication, authority and SQL remain with the integrator. */
export function createIndustrialAgentPort(options: IndustrialAgentPortOptions): IndustrialAgentPort {
  const run = structuredClone(options.run), actor = structuredClone(options.actor), scope = run.industrialScope;
  if (!scope || !id.safeParse(run.id).success || !id.safeParse(actor.actorId).success || !id.safeParse(actor.companyId).success || actor.companyId !== run.companyId || actor.actorId !== run.actorId || !['direction', 'achats', 'logistique', 'operator', 'analysis_only'].includes(actor.role)) throw new DomainError('INDUSTRIAL_SCOPE_MISMATCH');
  const cache = new Map<string, CachedEvaluation>();
  const clock = (): string => {
    const date = (options.now ?? ((): Date => new Date()))();
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new DomainError('INVALID_INDUSTRIAL_TIME');
    return date.toISOString();
  };
  const validate = async (client: PoolClient): Promise<void> => {
    if (await options.validateBasis(client) !== true) throw new DomainError('STALE_CONTEXT');
  };
  const checkInput = (input: IndustrialEvaluationInput, demandId: string, evaluatedAt: string): void => {
    const s = input.snapshot, c = input.context, e = input.releasedEvent, b = run.industrialBasis;
    if (input.demandId !== demandId || input.evaluatedAt !== evaluatedAt || s.companyId !== run.companyId || s.revision !== run.revision || s.policyVersion !== run.policyVersion || c.companyId !== run.companyId || c.revision !== scope.contextRevision || c.qualificationRevision !== scope.qualificationRevision || (b && (b.companyId !== s.companyId || b.businessRevision !== s.revision || b.policyVersion !== s.policyVersion || b.contextRevision !== c.revision || b.qualificationRevision !== c.qualificationRevision || b.eventId !== e.event.eventId || b.eventRevision !== e.revision || researchKey(b.researchDependencies) !== researchKey(e.researchDependencies)))) throw new DomainError('INDUSTRIAL_SCOPE_MISMATCH');
  };
  const checkTime = (input: IndustrialEvaluationInput, assessment: IndustrialAssessment): void => {
    const current = clock(), day = companyDay(input, current);
    if (Date.parse(current) < Date.parse(input.evaluatedAt) || input.releasedEvent.researchDependencies.some(d => d.validUntil === null || Date.parse(d.validUntil) <= Date.parse(current))) throw new DomainError('STALE_CONTEXT');
    // Reuse the canonical currentness filter, including quote expiry, at actual preparation time.
    const currentInput = { ...input, context: currentIndustrialContext(input.context, input.snapshot, current) };
    if (industrialInputHash(currentInput) !== assessment.calculationHash) throw new DomainError('STALE_CONTEXT');
    for (const plan of assessment.plans) for (const step of plan.steps) {
      if ((step.kind === 'purchase' ? step.arrivalDate : step.kind === 'transfer' ? step.dispatchDate : step.needDate) < day) throw new DomainError('STALE_CONTEXT');
      if (step.kind === 'prepare_offer') continue;
      const quoteId = step.kind === 'transfer' && step.quoteSource === 'industrial_delivery' ? input.context.deliveryQuotes.find(q => q.quoteId === step.quoteId)?.transportQuoteId : step.quoteId;
      const quotes = input.snapshot.dataset.tables[step.kind === 'purchase' ? 'emergency_quotes' : 'transport_quotes'] ?? [];
      const matches = quotes.filter(q => q.id === quoteId);
      if (matches.length !== 1 || matches[0]!.valid_on !== day) throw new DomainError('STALE_CONTEXT');
    }
  };
  return {
    async overview(): Promise<JsonObject> {
      return await options.transaction(async client => {
        await validate(client);
        const value = structuredClone(await options.readOverview(client));
        const view = z.object({ companyId: id, businessRevision: id, policyVersion: id, contextRevision: id, qualificationRevision: id }).parse(value);
        if (view.companyId !== run.companyId || view.businessRevision !== run.revision || view.policyVersion !== run.policyVersion || view.contextRevision !== scope.contextRevision || view.qualificationRevision !== scope.qualificationRevision) throw new DomainError('INDUSTRIAL_SCOPE_MISMATCH');
        await validate(client); return value;
      });
    },
    async evaluate(received: string): Promise<JsonObject> {
      const demandId = id.parse(received), evaluatedAt = clock();
      if (cache.size >= 20) throw new DomainError('BUDGET_EXHAUSTED');
      const result = await options.transaction(async client => {
        await validate(client);
        const input = structuredClone(await options.loadInput(client, demandId, evaluatedAt));
        checkInput(input, demandId, evaluatedAt);
        const assessment = evaluateIndustrialPlan(input), projection = projectIndustrialModelContext(input, assessment);
        checkTime(input, assessment); await validate(client);
        return { projection, cached: { demandId, evaluatedAt, inputHash: assessment.calculationHash, assessment } };
      });
      cache.set(result.cached.assessment.id, structuredClone(result.cached));
      return result.projection;
    },
    async prepare(received): Promise<IndustrialReport> {
      const args = prepareSchema.parse(received), known = cache.get(args.evaluationId);
      if (!known) throw new DomainError('UNKNOWN_EVALUATION');
      return await options.transaction(async client => {
        await validate(client);
        const input = structuredClone(await options.loadInput(client, known.demandId, known.evaluatedAt));
        checkInput(input, known.demandId, known.evaluatedAt);
        if (industrialInputHash(input) !== known.inputHash) throw new DomainError('STALE_CONTEXT');
        const assessment = evaluateIndustrialPlan(input);
        if (assessment.id !== args.evaluationId || assessment.calculationHash !== known.assessment.calculationHash) throw new DomainError('STALE_CONTEXT');
        const selected = args.recommendedPlanId === null ? null : assessment.plans.find(p => p.id === args.recommendedPlanId);
        if (args.recommendedPlanId !== null && (!selected || selected.status === 'rejected')) throw new DomainError('INVALID_INDUSTRIAL_PLAN');
        checkTime(input, assessment); await validate(client); checkTime(input, assessment);
        return { id: `report:${run.id}`, companyId: run.companyId, runId: run.id, basis: structuredClone(assessment.basis), status: selected ? 'prepared' : 'needs_input', title: args.title, summary: args.summary, assessment, recommendedPlanId: args.recommendedPlanId, createdAt: clock() };
      });
    },
    async validate(): Promise<boolean> {
      return await options.transaction(async client => await options.validateBasis(client));
    },
    async reserveUsage(kind): Promise<boolean> {
      if (kind !== 'provider' && kind !== 'tool') throw new DomainError('INVALID_USAGE_KIND');
      // The received callback owns its durable transaction. Do not nest a company lock around it.
      return await options.reserveUsage(kind);
    },
  };
}
