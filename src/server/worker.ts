import type { Actor, AgentRunner, AgentRun, AgentRunnerResult, ToolTrace } from '../contracts/index.js';
import type { ResearchContext, ResearchScope } from '../contracts/research.js';
import { PgStore } from './store.js';
import { assertCurrentCase, releaseCase } from './cases.js';
import { AppError } from './errors.js';

export interface Worker { tick(): Promise<boolean>; start(): void; stop(): Promise<void> }
export type RunnerFactory = (run: AgentRun, sink: (trace: ToolTrace) => Promise<void>, actor: Actor) => AgentRunner;
export interface WorkerResearch { lookup(actor: Actor, scope: ResearchScope): Promise<ResearchContext> }
export interface RunWorkerHooks { beforeClaim(): Promise<void> }
export function createRunWorker(store: PgStore, runner: AgentRunner, factory?: RunnerFactory, research?: WorkerResearch, hooks?: RunWorkerHooks): Worker {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<boolean> | null = null;
  let stopped = true;
  const execute = async (): Promise<boolean> => {
    if (hooks) await hooks.beforeClaim();
    const claim = await store.claimRun();
    if (!claim) return false;
    const { actor, fence } = claim;
    let run = claim.run;
    let received: AgentRunnerResult | null = null;
    try {
      const snapshot = await store.snapshot(run.companyId);
      if (snapshot.revision !== run.revision || snapshot.policyVersion !== run.policyVersion) {
        await store.finishRun(run, fence, { status: 'stale_context', proposal: null, traces: [], message: 'Context changed before processing', model: null }); return true;
      }
      if (run.researchScope) {
        if (!research) throw new AppError('RESEARCH_UNAVAILABLE', 'Research retrieval is not connected.', 503);
        run = await store.bindResearch(run, fence, await research.lookup(actor, run.researchScope));
      }
      const activeRunner = factory ? factory(run, async trace => {
        const result = await store.query("UPDATE runs SET payload=jsonb_set(payload,'{traces}',(payload->'traces') || $3::jsonb) WHERE id=$1 AND fence=$2 AND lease_until>now() AND payload->>'status'='running'", [run.id, fence, JSON.stringify([trace])]);
        if (result.rowCount !== 1) throw new Error('LEASE_LOST');
      }, actor) : runner;
      let caseContext;
      if (run.caseRef) {
        try { caseContext = releaseCase(await assertCurrentCase(store, run.companyId, run.caseRef, snapshot, false)); }
        catch (error) { if (!(error instanceof AppError) || !['STALE_CONTEXT', 'NOT_FOUND'].includes(error.code)) throw error; await store.finishRun(run, fence, { status: 'stale_context', proposal: null, traces: [], message: 'Case changed before processing', model: null }); return true; }
      }
      received = await activeRunner({ actor, snapshot, run, memories: await store.memories(run.companyId, run.researchScope), ...(caseContext ? { caseContext } : {}) });
      await store.finishRun(run, fence, received);
    } catch {
      if (received) {
        // Retry only the same fenced database publication, never the provider call.
        // A second failure leaves the lease and durable intent for reconciliation.
        await store.finishRun(run, fence, received);
      } else {
        const durable = await store.run(run.companyId, run.id);
        const attempted = durable.traces.some(trace => trace.tool === 'model_intent');
        await store.finishRun(run, fence, { status: attempted ? 'uncertain' : 'error', proposal: null, traces: durable.traces, message: attempted ? 'Processing interrupted after provider intent. Reconcile the attempt before retrying.' : 'Processing failed. Check server configuration and data.', model: durable.model });
      }
    }
    return true;
  };
  const tick = async (): Promise<boolean> => {
    if (pending) return false;
    pending = execute();
    try { return await pending; } finally { pending = null; }
  };
  const loop = async (): Promise<void> => {
    try { await tick(); } catch { process.stderr.write('Run worker unavailable\n'); }
    if (!stopped) timer = setTimeout(async () => { await loop(); }, 1000);
  };
  return { tick, start(): void { if (!stopped) return; stopped = false; timer = setTimeout(async () => { await loop(); }, 0); }, async stop(): Promise<void> { stopped = true; if (timer) clearTimeout(timer); if (pending) await pending; } };
}
