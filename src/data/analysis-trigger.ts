import { createHash } from 'node:crypto';
import type { SqlPort } from '../contracts/index.ts';
import type { IndustrialAnalysisIntent, IndustrialBasis } from '../contracts/industrial.ts';
import type { ResearchDependency } from '../contracts/research.ts';
import { DataWatchError, identifier, isoDate } from './validation.ts';

type Budget = IndustrialAnalysisIntent['budget'];
export interface IndustrialServicePrincipal { id: string; companyId: string; role: 'analysis_only'; active: boolean }
export interface IndustrialTriggerOptions {
  servicePrincipalId: string;
  resolvePrincipal(client: SqlPort, companyId: string, principalId: string): Promise<IndustrialServicePrincipal | null>;
  validateBasis(client: SqlPort, basis: IndustrialBasis): Promise<boolean>;
  now?: () => Date;
}
export interface IndustrialAnalysisInput { basis: IndustrialBasis; analysisPolicyVersion: string; budget: Budget }
export type IndustrialEnqueueRun = (client: SqlPort, intent: IndustrialAnalysisIntent) => Promise<string>;
export interface IndustrialAnalysisTrigger {
  listReady(client: SqlPort, options: { limit: number }): Promise<IndustrialAnalysisIntent[]>;
  enqueue(client: SqlPort, input: IndustrialAnalysisInput): Promise<IndustrialAnalysisIntent>;
  promote(client: SqlPort, companyId: string, intentId: string, enqueueRun: IndustrialEnqueueRun): Promise<IndustrialAnalysisIntent>;
  reserveUsage(client: SqlPort, companyId: string, intentId: string, runId: string, kind: 'provider' | 'tool'): Promise<boolean>;
  finish(client: SqlPort, companyId: string, intentId: string, runId: string, status: 'done' | 'stale' | 'blocked' | 'uncertain', reason?: string): Promise<IndustrialAnalysisIntent>;
  get(client: SqlPort, companyId: string, intentId: string): Promise<IndustrialAnalysisIntent | null>;
}
function invalid(): never { throw new DataWatchError('INVALID_INDUSTRIAL_ANALYSIS'); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const row = value as Record<string, unknown>; if (Object.keys(row).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(row, key))) invalid(); return row;
}
function integer(value: unknown, max: number, min = 0): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) invalid(); return value; }
function budget(value: unknown): Budget {
  const row = record(value, ['maxProviderCalls','maxToolCalls','maxDurationMs','maxRunsPerEvent']);
  return { maxProviderCalls: integer(row.maxProviderCalls, 50, 1), maxToolCalls: integer(row.maxToolCalls, 100, 1), maxDurationMs: integer(row.maxDurationMs, 300_000, 1000), maxRunsPerEvent: integer(row.maxRunsPerEvent, 10, 1) };
}
function dependencies(value: unknown): ResearchDependency[] {
  if (!Array.isArray(value) || value.length > 10) invalid();
  const result = value.map((raw): ResearchDependency => {
    const dep = record(raw, ['scope','generation','validUntil','evidenceRefs']), scope = record(dep.scope, ['profileId','profileVersion','namespace']);
    if (scope.namespace !== 'live' && scope.namespace !== 'controlled') invalid();
    if (!Array.isArray(dep.evidenceRefs) || dep.evidenceRefs.length > 10) invalid();
    const refs = dep.evidenceRefs.map((rawRef) => { const ref = record(rawRef, ['occurrenceId','evidenceId','contentHash']); if (typeof ref.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(ref.contentHash)) invalid(); return { occurrenceId: identifier(ref.occurrenceId), evidenceId: identifier(ref.evidenceId), contentHash: ref.contentHash }; }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (new Set(refs.map((ref) => JSON.stringify(ref))).size !== refs.length) invalid();
    return { scope: { profileId: identifier(scope.profileId), profileVersion: identifier(scope.profileVersion), namespace: scope.namespace }, generation: integer(dep.generation, Number.MAX_SAFE_INTEGER), validUntil: dep.validUntil === null ? null : isoDate(dep.validUntil), evidenceRefs: refs };
  }).sort((a, b) => JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope)));
  if (new Set(result.map((dep) => JSON.stringify(dep.scope))).size !== result.length) invalid(); return result;
}
function basis(value: unknown): IndustrialBasis {
  const row = record(value, ['companyId','businessRevision','policyVersion','contextRevision','qualificationRevision','eventId','eventRevision','researchDependencies']);
  return { companyId: identifier(row.companyId), businessRevision: identifier(row.businessRevision), policyVersion: identifier(row.policyVersion), contextRevision: identifier(row.contextRevision), qualificationRevision: identifier(row.qualificationRevision), eventId: identifier(row.eventId), eventRevision: identifier(row.eventRevision), researchDependencies: dependencies(row.researchDependencies) };
}
function intent(row: Record<string, unknown>): IndustrialAnalysisIntent {
  const parsed = basis(row.basis), limits = budget(row.budget), status = row.status;
  if (!['ready','queued','running','done','stale','blocked','uncertain'].includes(String(status)) || row.company_id !== parsed.companyId || row.event_id !== parsed.eventId || (row.blocked_reason !== null && (typeof row.blocked_reason !== 'string' || row.blocked_reason.length > 300))) invalid();
  return { id: identifier(row.id), basis: parsed, analysisPolicyVersion: identifier(row.analysis_policy_version), servicePrincipalId: identifier(row.service_principal_id), status: status as IndustrialAnalysisIntent['status'], blockedReason: row.blocked_reason as string | null, runId: row.run_id === null ? null : identifier(row.run_id), budget: limits, createdAt: isoDate(row.created_at) };
}

/** Caller must supply a transaction client; no provider, worker or scheduler is created here. */
export function createIndustrialAnalysisTrigger(options: IndustrialTriggerOptions): IndustrialAnalysisTrigger {
  const principalId = identifier(options.servicePrincipalId), now = options.now ?? ((): Date => new Date());
  async function lock(client: SqlPort, companyId: string): Promise<void> {
    if (!(await client.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [identifier(companyId)])).rows.length) throw new DataWatchError('INDUSTRIAL_COMPANY_NOT_FOUND');
  }
  async function getRow(client: SqlPort, companyId: string, id: string): Promise<Record<string, unknown> | null> {
    return (await client.query('SELECT * FROM accel_industrial_analysis_intents WHERE company_id=$1 AND id=$2 FOR UPDATE', [identifier(companyId), identifier(id)])).rows[0] ?? null;
  }
  async function reason(client: SqlPort, value: IndustrialAnalysisIntent): Promise<string | null> {
    const principal = await options.resolvePrincipal(client, value.basis.companyId, value.servicePrincipalId);
    if (!principal || principal.id !== principalId || principal.id !== value.servicePrincipalId || principal.companyId !== value.basis.companyId || principal.role !== 'analysis_only' || principal.active !== true) return 'ANALYSIS_PRINCIPAL_UNAVAILABLE';
    const current = await options.validateBasis(client, value.basis); if (typeof current !== 'boolean') invalid();
    return current ? null : 'STALE_OR_UNQUALIFIED_BASIS';
  }
  async function setStatus(client: SqlPort, value: IndustrialAnalysisIntent, status: IndustrialAnalysisIntent['status'], blockedReason: string | null): Promise<IndustrialAnalysisIntent> {
    const row = (await client.query('UPDATE accel_industrial_analysis_intents SET status=$3,blocked_reason=$4 WHERE company_id=$1 AND id=$2 RETURNING *', [value.basis.companyId, value.id, status, blockedReason])).rows[0]; if (!row) invalid(); return intent(row);
  }
  return {
    async listReady(client, { limit }): Promise<IndustrialAnalysisIntent[]> {
      const rows = (await client.query("SELECT * FROM accel_industrial_analysis_intents WHERE status='ready' ORDER BY created_at,id LIMIT $1", [integer(limit,10,1)])).rows;
      return rows.map((row) => intent(row));
    },
    async enqueue(client, input): Promise<IndustrialAnalysisIntent> {
      const parsed = basis(input.basis), limits = budget(input.budget), policy = identifier(input.analysisPolicyVersion); await lock(client, parsed.companyId);
      // A freshness extension alone is not a newly qualified source version.
      const identity = { ...parsed, researchDependencies: parsed.researchDependencies.map((dep) => ({ scope:dep.scope,generation:dep.generation,evidenceRefs:dep.evidenceRefs })) };
      const key = createHash('sha256').update(JSON.stringify([identity,policy])).digest('hex'), id = `industrial-intent:${key}`;
      const previous = await getRow(client, parsed.companyId, id);
      if (previous) { const value = intent(previous); if (JSON.stringify(value.budget) !== JSON.stringify(limits) || value.servicePrincipalId !== principalId) throw new DataWatchError('INDUSTRIAL_IDEMPOTENCY_CONFLICT'); return value; }
      await client.query('INSERT INTO accel_industrial_analysis_budgets(company_id,event_id,max_runs) VALUES($1,$2,$3) ON CONFLICT(company_id,event_id) DO NOTHING', [parsed.companyId, parsed.eventId, limits.maxRunsPerEvent]);
      const eventBudget = (await client.query('SELECT max_runs FROM accel_industrial_analysis_budgets WHERE company_id=$1 AND event_id=$2 FOR UPDATE', [parsed.companyId, parsed.eventId])).rows[0];
      if (eventBudget?.max_runs !== limits.maxRunsPerEvent) throw new DataWatchError('INDUSTRIAL_BUDGET_POLICY_CONFLICT');
      const candidate: IndustrialAnalysisIntent = { id, basis: parsed, analysisPolicyVersion: policy, servicePrincipalId: principalId, status: 'ready', blockedReason: null, runId: null, budget: limits, createdAt: isoDate(now()) };
      const blocked = await reason(client, candidate);
      const saved = (await client.query(`INSERT INTO accel_industrial_analysis_intents(id,company_id,event_id,intent_key,basis,analysis_policy_version,service_principal_id,status,blocked_reason,budget,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [id,parsed.companyId,parsed.eventId,key,JSON.stringify(parsed),policy,principalId,blocked ? 'blocked' : 'ready',blocked,JSON.stringify(limits),candidate.createdAt])).rows[0]; if (!saved) invalid(); return intent(saved);
    },
    async promote(client, companyId, intentId, enqueueRun): Promise<IndustrialAnalysisIntent> {
      await lock(client, companyId); const row = await getRow(client, companyId, intentId); if (!row) throw new DataWatchError('INDUSTRIAL_INTENT_NOT_FOUND'); const value = intent(row);
      if (value.status !== 'ready') return value;
      const blocked = await reason(client, value); if (blocked) return await setStatus(client, value, blocked === 'STALE_OR_UNQUALIFIED_BASIS' ? 'stale' : 'blocked', blocked);
      const reserved = (await client.query('UPDATE accel_industrial_analysis_budgets SET runs_used=runs_used+1 WHERE company_id=$1 AND event_id=$2 AND runs_used<max_runs RETURNING runs_used', [companyId,value.basis.eventId])).rows[0];
      if (!reserved) return await setStatus(client, value, 'blocked', 'EVENT_RUN_BUDGET_EXHAUSTED');
      const runId = identifier(await enqueueRun(client, value));
      const saved = (await client.query("UPDATE accel_industrial_analysis_intents SET status='queued',run_id=$3 WHERE company_id=$1 AND id=$2 RETURNING *", [companyId,intentId,runId])).rows[0]; if (!saved) invalid(); return intent(saved);
    },
    async reserveUsage(client, companyId, intentId, runId, kind): Promise<boolean> {
      if (kind !== 'provider' && kind !== 'tool') invalid(); identifier(runId);
      await lock(client, companyId); const row = await getRow(client, companyId, intentId); if (!row) throw new DataWatchError('INDUSTRIAL_INTENT_NOT_FOUND'); const value = intent(row);
      if (value.runId !== runId) throw new DataWatchError('INDUSTRIAL_RUN_MISMATCH');
      if (value.status !== 'queued' && value.status !== 'running') return false;
      const blocked = await reason(client, value); if (blocked) { await setStatus(client, value, blocked === 'STALE_OR_UNQUALIFIED_BASIS' ? 'stale' : 'blocked', blocked); return false; }
      const at = isoDate(now()), started = row.started_at === null ? at : isoDate(row.started_at);
      if (Date.parse(at) >= Date.parse(started) + value.budget.maxDurationMs) { await setStatus(client, value, 'blocked', 'DURATION_BUDGET_EXHAUSTED'); return false; }
      const count = kind === 'provider' ? integer(row.provider_calls, Number.MAX_SAFE_INTEGER) : integer(row.tool_calls, Number.MAX_SAFE_INTEGER), limit = kind === 'provider' ? value.budget.maxProviderCalls : value.budget.maxToolCalls;
      if (count >= limit) { await setStatus(client, value, 'blocked', kind === 'provider' ? 'PROVIDER_CALL_BUDGET_EXHAUSTED' : 'TOOL_CALL_BUDGET_EXHAUSTED'); return false; }
      const column = kind === 'provider' ? 'provider_calls' : 'tool_calls';
      await client.query(`UPDATE accel_industrial_analysis_intents SET ${column}=${column}+1,status='running',started_at=COALESCE(started_at,$3::timestamptz) WHERE company_id=$1 AND id=$2`, [companyId,intentId,at]);
      return true;
    },
    async finish(client, companyId, intentId, runId, status, blockedReason): Promise<IndustrialAnalysisIntent> {
      if (!['done','stale','blocked','uncertain'].includes(status)) invalid(); identifier(runId);
      if (blockedReason !== undefined && (typeof blockedReason !== 'string' || blockedReason.length === 0 || blockedReason.length > 300)) invalid();
      await lock(client, companyId); const row = await getRow(client, companyId, intentId); if (!row) throw new DataWatchError('INDUSTRIAL_INTENT_NOT_FOUND'); const value = intent(row);
      if (value.runId !== runId) throw new DataWatchError('INDUSTRIAL_RUN_MISMATCH');
      if (value.status !== 'queued' && value.status !== 'running') return value;
      if (status === 'done') {
        const blocked = await reason(client, value); if (blocked) return await setStatus(client, value, blocked === 'STALE_OR_UNQUALIFIED_BASIS' ? 'stale' : 'blocked', blocked);
        if (row.started_at !== null && Date.parse(isoDate(now())) >= Date.parse(isoDate(row.started_at)) + value.budget.maxDurationMs) return await setStatus(client, value, 'blocked', 'DURATION_BUDGET_EXHAUSTED');
      }
      return await setStatus(client, value, status, status === 'done' ? null : blockedReason ?? 'ANALYSIS_REQUIRES_RECONCILIATION');
    },
    async get(client, companyId, intentId): Promise<IndustrialAnalysisIntent | null> { await lock(client, companyId); const row = await getRow(client, companyId, intentId); return row ? intent(row) : null; },
  };
}
