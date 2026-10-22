import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Actor, AgentRun, AgentRunnerResult, AttributedMemory, BusinessEngine, CompanySnapshot, DecisionInput, Proposal, QuestionInput, SqlPort, SqlResult } from '../contracts/index.js';
import { hashToken } from './auth.js';
import { snapshotSchema } from './validation.js';
import { AppError } from './errors.js';
import { assertCurrentCase, hasCurrentConfirmation, readCase, referenceOf, sameCaseRef } from './cases.js';
import type { ResearchContext, ResearchDependency, ResearchScope } from '../contracts/research.js';
import { sameResearchScope, sameResearchBasis, sameResearchDependencies } from './research-context.js';
import { assertGenericScope, hasIndustrialScope } from './industrial-boundary.js';
export { AppError } from './errors.js';
export type ResearchValidator = (companyId: string, dependencies: ResearchDependency[], client: SqlPort) => Promise<boolean>;
export interface RunFinalization { industrialReportId?: string; status?: 'stale_context' | 'budget_exhausted' | 'uncertain' | 'error'; message?: string }
export type RunFinalizer = (client: PoolClient, run: AgentRun, result: AgentRunnerResult, snapshot: CompanySnapshot, stale: boolean) => Promise<RunFinalization>;
export class PgStore implements SqlPort {
  constructor(public readonly pool: Pool) {}
  private researchValidator: ResearchValidator | null = null;
  private runFinalizer: RunFinalizer | null = null;
  setResearchValidator(validator: ResearchValidator): void { this.researchValidator = validator; }
  setRunFinalizer(finalizer: RunFinalizer): void { this.runFinalizer = finalizer; }
  async researchCurrent(companyId: string, dependencies: ResearchDependency[], client: SqlPort, requireFresh: boolean): Promise<boolean> {
    if (dependencies.length === 0 || !this.researchValidator) return false;
    if (requireFresh && dependencies.some(value => value.validUntil === null || !Number.isFinite(Date.parse(value.validUntil)) || Date.parse(value.validUntil) <= Date.now())) return false;
    return await this.researchValidator(companyId, dependencies, client);
  }
  async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<SqlResult<T>> { return await this.pool.query<T>(text, values); }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); await client.query("SET LOCAL lock_timeout = '10s'"); const value = await work(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async snapshot(companyId: string, client?: PoolClient, lock = false): Promise<CompanySnapshot> {
    const result = await (client ?? this.pool).query<{ snapshot: unknown }>(`SELECT snapshot FROM companies WHERE company_id=$1${lock ? ' FOR UPDATE' : ''}`, [companyId]);
    if (!result.rows[0]) throw new AppError('NO_COMPANY', 'Explicitly seed a synthetic company with the operator command.', 404);
    return snapshotSchema.parse(result.rows[0].snapshot);
  }
  async seed(snapshot: CompanySnapshot): Promise<void> {
    const parsed = snapshotSchema.parse(snapshot);
    if (parsed.companyId !== parsed.dataset.company_id || parsed.companyId !== parsed.policy.company_id) throw new AppError('SCOPE', 'Inconsistent company identity');
    const result = await this.pool.query('INSERT INTO companies(company_id,snapshot) VALUES($1,$2) ON CONFLICT DO NOTHING', [parsed.companyId, parsed]);
    if (result.rowCount !== 1) throw new AppError('EXISTS', 'Company already exists. Use a new identity or an explicit reset.', 409);
  }
  async session(actor: Actor): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.pool.query("INSERT INTO sessions(token_hash,actor,expires_at) VALUES($1,$2,now()+interval '4 hours')", [hashToken(token), actor]);
    return token;
  }
  async actor(token: string | undefined): Promise<Actor | null> {
    if (!token) return null;
    const result = await this.pool.query<{ actor: Actor }>('SELECT actor FROM sessions WHERE token_hash=$1 AND expires_at>now()', [hashToken(token)]);
    return result.rows[0]?.actor ?? null;
  }
  async queueQuestion(actor: Actor, input: QuestionInput, researchScope?: ResearchScope): Promise<AgentRun> {
    return await this.transaction(async client => {
      const snapshot = await this.snapshot(actor.companyId, client, true);
      await assertGenericScope(client, actor.companyId);
      const existing = await client.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE company_id=$1 AND operation_key=$2', [actor.companyId, input.operationKey]);
      const previous = existing.rows[0]?.payload;
      if (previous) {
        if (previous.caseRef || previous.actorId !== actor.actorId || previous.question !== input.question || !sameResearchScope(previous.researchScope, researchScope)) throw new AppError('OPERATION_CONFLICT', 'This key already identifies another request.', 409);
        return previous;
      }
      const run: AgentRun = { id: randomUUID(), companyId: actor.companyId, actorId: actor.actorId, operationKey: input.operationKey, question: input.question, status: 'queued', revision: snapshot.revision, policyVersion: snapshot.policyVersion, mode: 'direct', model: null, proposalId: null, message: null, traces: [], createdAt: new Date().toISOString(), completedAt: null };
      if (researchScope) run.researchScope = structuredClone(researchScope);
      await client.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)', [run.id, actor.companyId, input.operationKey, actor, run]);
      return run;
    });
  }
  async runs(companyId: string): Promise<AgentRun[]> { return (await this.pool.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE company_id=$1 ORDER BY payload->>\'createdAt\' DESC LIMIT 100', [companyId])).rows.map(row => row.payload); }
  async proposals(companyId: string): Promise<Proposal[]> { return (await this.pool.query<{ payload: Proposal }>('SELECT payload FROM proposals WHERE company_id=$1 ORDER BY payload->>\'createdAt\' DESC LIMIT 100', [companyId])).rows.map(row => row.payload); }
  async run(companyId: string, id: string): Promise<AgentRun> {
    const result = await this.pool.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE company_id=$1 AND id=$2', [companyId, id]);
    if (!result.rows[0]) throw new AppError('NOT_FOUND', 'Run not found', 404);
    return result.rows[0].payload;
  }
  async memories(companyId: string, scope?: ResearchScope): Promise<AttributedMemory[]> {
    return await this.transaction(async client => {
      await this.snapshot(companyId, client, true);
      const rows = (await client.query<{ payload: AttributedMemory; research_origin: boolean }>(`SELECT m.payload,
        (p.payload ? 'researchDependencies' OR r.payload ? 'researchScope' OR r.payload ? 'researchDependencies') AS research_origin
        FROM memories m JOIN proposals p ON p.company_id=m.company_id AND p.id=m.payload->>'proposalId'
        JOIN runs r ON r.company_id=p.company_id AND r.id=p.run_id
        WHERE m.company_id=$1 ORDER BY m.payload->>'createdAt' DESC LIMIT 20`, [companyId])).rows;
      const allowed: AttributedMemory[] = [];
      for (const { payload: memory, research_origin: researchOrigin } of rows) {
        const dependencies = memory.researchDependencies;
        if (researchOrigin && (dependencies === undefined || memory.testOnly === undefined)) continue;
        if (memory.testOnly && (!scope || scope.namespace !== 'controlled')) continue;
        if (dependencies) {
          if (!scope || dependencies.length === 0 || dependencies.some(value => !sameResearchScope(value.scope, scope)) || memory.testOnly !== dependencies.some(value => value.scope.namespace === 'controlled')) continue;
          if (!await this.researchCurrent(companyId, dependencies, client, true)) continue;
        } else if (memory.testOnly) continue;
        allowed.push(memory);
      }
      return allowed;
    });
  }
  async claimRun(): Promise<{ run: AgentRun; actor: Actor; fence: number } | null> {
    // Recovery has its own commit, so it never holds a run lock while waiting for a company lock.
    await this.pool.query("UPDATE runs SET payload=jsonb_set(jsonb_set(payload,'{status}','\"uncertain\"'),'{message}','\"Processing interrupted; provider outcome unknown. Reconcile before creating a new attempt.\"'), fence=fence+1 WHERE payload->>'status'='running' AND lease_until<now()");
    return await this.transaction(async client => {
      const candidate = await client.query<{ id: string; company_id: string }>("SELECT id,company_id FROM runs WHERE payload->>'status'='queued' ORDER BY payload->>'createdAt',id LIMIT 1");
      if (!candidate.rows[0]) return null;
      await this.snapshot(candidate.rows[0].company_id, client, true);
      const result = await client.query<{ id: string; actor: Actor; payload: AgentRun; fence: string }>("SELECT id,actor,payload,fence FROM runs WHERE id=$1 AND payload->>'status'='queued' FOR UPDATE SKIP LOCKED", [candidate.rows[0].id]);
      const row = result.rows[0];
      if (!row) return null;
      if (!row.payload.industrialScope && !row.payload.pdfProfileId && await hasIndustrialScope(client, row.payload.companyId)) {
        await client.query("UPDATE runs SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{status}','\"stale_context\"'),'{message}','\"Industrial scope required. No generic analysis was started.\"'),'{completedAt}',to_jsonb(clock_timestamp()::text)),lease_until=NULL,fence=fence+1 WHERE id=$1", [row.id]);
        return null;
      }
      const run: AgentRun = { ...row.payload, status: 'running' };
      const fence = Number(row.fence) + 1;
      await client.query("UPDATE runs SET payload=$2,fence=$3,lease_until=now()+interval '90 seconds' WHERE id=$1", [row.id, run, fence]);
      return { run, actor: row.actor, fence };
    });
  }
  /** The server pins consulted evidence before any provider call. Model output cannot choose it. */
  async bindResearch(run: AgentRun, fence: number, context: ResearchContext): Promise<AgentRun> {
    return await this.transaction(async client => {
      await this.snapshot(run.companyId, client, true);
      if (context.companyId !== run.companyId || !run.researchScope || !sameResearchScope(context.scope, run.researchScope)) throw new AppError('STALE_CONTEXT', 'Research scope changed.', 409);
      const dependency: ResearchDependency = { scope: structuredClone(context.scope), generation: context.generation, validUntil: context.state === 'reusable' ? context.validUntil : null, evidenceRefs: context.observations.map(value => structuredClone(value.ref)) };
      if (!await this.researchCurrent(run.companyId, [dependency], client, false)) throw new AppError('STALE_CONTEXT', 'Research changed before processing.', 409);
      const current = await client.query<{ payload: AgentRun }>("SELECT payload FROM runs WHERE id=$1 AND company_id=$2 AND fence=$3 AND lease_until>now() AND payload->>'status'='running' FOR UPDATE", [run.id, run.companyId, fence]);
      const durable = current.rows[0]?.payload;
      if (!durable || !sameResearchScope(durable.researchScope, run.researchScope)) throw new AppError('STALE_CONTEXT', 'Research run is no longer current.', 409);
      if (durable.researchDependencies && !sameResearchDependencies(durable.researchDependencies, [dependency])) throw new AppError('STALE_CONTEXT', 'Research was already pinned to another version.', 409);
      const updated = { ...durable, researchDependencies: [dependency] };
      await client.query('UPDATE runs SET payload=$2 WHERE id=$1', [run.id, updated]);
      return updated;
    });
  }
  async finishRun(run: AgentRun, fence: number, result: AgentRunnerResult): Promise<boolean> {
    return await this.transaction(async client => {
      const snapshot = await this.snapshot(run.companyId, client, true);
      const dossier = run.caseRef ? await readCase(client, run.companyId, run.caseRef.caseId, true) : null;
      const current = await client.query<{ payload: AgentRun }>('SELECT payload FROM runs WHERE id=$1 AND company_id=$3 AND fence=$2 AND lease_until>clock_timestamp() AND payload->>\'status\'=\'running\' FOR UPDATE', [run.id, fence, run.companyId]);
      if (!current.rowCount) return false;
      const durable = current.rows[0]!.payload;
      const dependencies = durable.researchDependencies ?? [];
      const researchStale = (dossier?.researchDependency !== undefined && !sameResearchScope(dossier.researchDependency.scope, durable.researchScope)) || durable.researchScope !== undefined && (dependencies.length !== 1 || !await this.researchCurrent(run.companyId, dependencies, client, result.proposal !== null));
      if (result.proposal && !sameCaseRef(result.proposal.caseRef, run.caseRef)) throw new AppError('INVALID_PROPOSAL', 'Inconsistent case reference');
      const modeStale = !run.industrialScope && !run.pdfProfileId && await hasIndustrialScope(client, run.companyId);
      const stale = modeStale || researchStale || snapshot.revision !== run.revision || snapshot.policyVersion !== run.policyVersion || (dossier !== null && (!sameCaseRef(referenceOf(dossier), run.caseRef) || dossier.businessRevision !== snapshot.revision || dossier.policyVersion !== snapshot.policyVersion));
      let proposal = stale ? null : result.proposal;
      if (proposal && (proposal.companyId !== run.companyId || proposal.runId !== run.id || proposal.revision !== run.revision || proposal.policyVersion !== run.policyVersion || proposal.status !== 'pending' || proposal.evaluation.companyId !== run.companyId || proposal.evaluation.revision !== run.revision || proposal.evaluation.policyVersion !== run.policyVersion)) throw new AppError('INVALID_PROPOSAL', 'Proposal is outside the current context');
      if (result.status !== 'proposal') proposal = null;
      if (proposal && dependencies.length > 0) proposal = { ...proposal, researchDependencies: structuredClone(dependencies) };
      if (proposal && dossier?.relation.status === 'unverified') {
        const target = proposal.evaluation.options.find(option => option.id === proposal!.optionId)?.effects.targetOrderLineId;
        if (typeof target !== 'string' || !dossier.candidateOrderLineIds.includes(target)) throw new AppError('INVALID_PROPOSAL', 'Proposal target is outside the current case.');
        const confirmed = await hasCurrentConfirmation(client, dossier, snapshot);
        proposal = { ...proposal, conditions: [...new Set([...proposal.conditions, confirmed ? 'EXTERNAL_RELATION_UNVERIFIED' : 'RELATION_UNVERIFIED'])] };
      }
      if (proposal) await client.query('INSERT INTO proposals(id,company_id,run_id,payload) VALUES($1,$2,$3,$4)', [proposal.id, run.companyId, run.id, proposal]);
      const uncertain = result.status === 'uncertain';
      const specialized = this.runFinalizer ? await this.runFinalizer(client, durable, result, snapshot, stale) : {};
      const updated: AgentRun = { ...durable, ...specialized, status: uncertain ? 'uncertain' : specialized.status ?? (stale ? 'stale_context' : result.status), proposalId: proposal?.id ?? null, model: result.model, traces: result.traces, message: specialized.message ?? (uncertain ? `${result.message}${stale ? ' The context also changed; no proposal was retained.' : ''}` : stale ? 'Context changed during calculation. Reevaluate before deciding.' : result.message), completedAt: new Date().toISOString(), ...(!stale && result.researchResult ? { researchResult: { ...result.researchResult, dependencies: structuredClone(dependencies) } } : {}), ...(!stale && !uncertain && result.pdfResult ? { pdfResult: result.pdfResult } : {}) };
      await client.query('UPDATE runs SET payload=$2,lease_until=NULL WHERE id=$1', [run.id, updated]);
      return true;
    });
  }
  async decide(actor: Actor, proposalId: string, input: DecisionInput, evaluate: BusinessEngine): Promise<Proposal> {
    return await this.transaction(async client => {
      const snapshot = await this.snapshot(actor.companyId, client, true);
      await assertGenericScope(client, actor.companyId);
      const duplicate = await client.query<{ proposal_id: string; actor_id: string; input: DecisionInput; result: Proposal }>('SELECT proposal_id,actor_id,input,result FROM decisions WHERE company_id=$1 AND operation_key=$2', [actor.companyId, input.operationKey]);
      const prior = duplicate.rows[0];
      if (prior) {
        if (prior.proposal_id !== proposalId || prior.actor_id !== actor.actorId || prior.input.decision !== input.decision || prior.input.revision !== input.revision || prior.input.policyVersion !== input.policyVersion) throw new AppError('OPERATION_CONFLICT', 'Decision key already used', 409);
        return prior.result;
      }
      const header = await client.query<{ payload: Proposal }>('SELECT payload FROM proposals WHERE id=$1 AND company_id=$2', [proposalId, actor.companyId]);
      const ref = header.rows[0]?.payload.caseRef;
      const dossier = ref ? await assertCurrentCase(client, actor.companyId, ref, snapshot) : null;
      const result = await client.query<{ payload: Proposal }>('SELECT payload FROM proposals WHERE id=$1 AND company_id=$2 FOR UPDATE', [proposalId, actor.companyId]);
      const proposal = result.rows[0]?.payload;
      if (!proposal) throw new AppError('NOT_FOUND', 'Proposal not found', 404);
      if (proposal.status === 'stale') throw new AppError('STALE_CONTEXT', 'Stale proposal. Reevaluate before deciding.', 409);
      if (proposal.status !== 'pending') throw new AppError('ALREADY_DECIDED', 'Proposal already decided', 409);
      if (snapshot.revision !== input.revision || snapshot.policyVersion !== input.policyVersion || proposal.revision !== snapshot.revision || proposal.policyVersion !== snapshot.policyVersion) throw new AppError('STALE_CONTEXT', 'Stale proposal. Reevaluate before deciding.', 409);
      if (dossier?.researchDependency && (!proposal.researchDependencies || !proposal.researchDependencies.some(value => sameResearchBasis(value, dossier.researchDependency!)))) throw new AppError('STALE_CONTEXT', 'The proposal is missing its required research dependency.', 409);
      if (proposal.researchDependencies && !await this.researchCurrent(actor.companyId, proposal.researchDependencies, client, true)) throw new AppError('STALE_CONTEXT', 'The research evidence changed or expired. Reevaluate before deciding.', 409);
      if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'This role cannot record a decision', 403);
      if (input.decision === 'approve') {
        if (dossier && !await hasCurrentConfirmation(client, dossier, snapshot)) throw new AppError('RELATION_UNVERIFIED', 'The external relation is unverified and no current internal confirmation authorises this decision.', 409);
        const evaluation = evaluate(snapshot);
        const option = evaluation.options.find(value => value.id === proposal.optionId);
        if (dossier && (typeof option?.effects.targetOrderLineId !== 'string' || !dossier.candidateOrderLineIds.includes(option.effects.targetOrderLineId))) throw new AppError('INADMISSIBLE', 'The option target is outside the current case.', 409);
        if (!option || option.status !== 'feasible' || !Number.isFinite(option.costEur) || option.costEur < 0) throw new AppError('INADMISSIBLE', 'This option does not satisfy the current constraints.', 409);
        if (option.costEur > actor.approvalCeilingEur) throw new AppError('BUDGET', 'The amount exceeds this actor’s approval ceiling.', 403);
      }
      const updated: Proposal = { ...proposal, status: input.decision === 'approve' ? 'approved' : 'rejected' };
      await client.query('UPDATE proposals SET payload=$2 WHERE id=$1', [proposalId, updated]);
      await client.query('INSERT INTO decisions(company_id,operation_key,proposal_id,actor_id,input,result) VALUES($1,$2,$3,$4,$5,$6)', [actor.companyId, input.operationKey, proposalId, actor.actorId, input, updated]);
      const memory: AttributedMemory = { id: randomUUID(), companyId: actor.companyId, actorId: actor.actorId, proposalId, revision: snapshot.revision, policyVersion: snapshot.policyVersion, content: `${input.decision}: ${proposal.title}`, conditions: proposal.conditions, createdAt: new Date().toISOString(), ...(proposal.caseRef ? { caseRef: proposal.caseRef } : {}), ...(proposal.researchDependencies ? { researchDependencies: structuredClone(proposal.researchDependencies), testOnly: proposal.researchDependencies.some(value => value.scope.namespace === 'controlled') } : {}) };
      await client.query('INSERT INTO memories(id,company_id,payload) VALUES($1,$2,$3)', [memory.id, actor.companyId, memory]);
      return updated;
    });
  }
  async replaceSnapshot(actor: Actor, expectedRevision: string, next: CompanySnapshot): Promise<CompanySnapshot> {
    return await this.transaction(async client => await this.replaceSnapshotWithin(client, actor, expectedRevision, next));
  }
  /** Caller keeps the company lock inside its existing transaction. */
  async replaceSnapshotWithin(client: PoolClient, actor: Actor, expectedRevision: string, next: CompanySnapshot): Promise<CompanySnapshot> {
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator session required', 403);
    const parsed = snapshotSchema.parse(next);
      const current = await this.snapshot(actor.companyId, client, true);
      if (current.revision !== expectedRevision) throw new AppError('STALE_CONTEXT', 'The expected operator revision is stale', 409);
      if (parsed.companyId !== actor.companyId || parsed.dataset.company_id !== actor.companyId || parsed.policy.company_id !== actor.companyId) throw new AppError('SCOPE', 'Inconsistent company identity');
      const revision = `R-${randomUUID()}`;
      const updated: CompanySnapshot = { ...parsed, revision, policyVersion: JSON.stringify(parsed.policy) === JSON.stringify(current.policy) ? current.policyVersion : `P-${randomUUID()}`, updatedAt: new Date().toISOString(), dataset: { ...parsed.dataset, snapshot_revision: revision } };
      await client.query('UPDATE companies SET snapshot=$2 WHERE company_id=$1', [actor.companyId, updated]);
      await client.query("UPDATE proposals SET payload=jsonb_set(payload,'{status}','\"stale\"') WHERE company_id=$1 AND payload->>'status'='pending'", [actor.companyId]);
      await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), actor.companyId, revision, actor.actorId, 'operator_snapshot', { previousRevision: current.revision }]);
      return updated;
  }
}
