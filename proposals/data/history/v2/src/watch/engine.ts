import type { CollectionResult, Collector, WatchOccurrence } from '../contracts/index.ts';
import type { ClaimedOccurrence, WatchRepository } from '../data/watch-repository.ts';
import { DataWatchError, identifier, validateCollectionResult } from '../data/validation.ts';

export interface WatchEngineOptions {
  repository: WatchRepository;
  collector: Collector;
  now?: () => Date;
  leaseMs?: number;
  collectionTimeoutMs?: number;
}
export interface WatchTickResult {
  status: 'idle' | 'completed' | 'error' | 'lease_lost';
  occurrence: WatchOccurrence | null;
}
export interface WatchEngine { runOnce(workerId: string): Promise<WatchTickResult> }

export function createWatchEngine(options: WatchEngineOptions): WatchEngine {
  const now = options.now ?? ((): Date => new Date());
  const leaseMs = options.leaseMs ?? 60_000;
  const timeoutMs = options.collectionTimeoutMs ?? 15_000;
  const pending = new Map<string, { claim: ClaimedOccurrence; result: CollectionResult; publishing: Promise<WatchTickResult> | null }>();
  async function publish(entry: { claim: ClaimedOccurrence; result: CollectionResult; publishing: Promise<WatchTickResult> | null }): Promise<WatchTickResult> {
    if (entry.publishing) return await entry.publishing;
    entry.publishing = (async (): Promise<WatchTickResult> => {
      try {
        const saved = await options.repository.finish(entry.claim, entry.result, now());
        pending.delete(entry.claim.occurrence.id);
        return { status: saved ? saved.status === 'error' ? 'error' : 'completed' : 'lease_lost', occurrence: saved };
      } catch (error: unknown) {
        if (!(error instanceof DataWatchError) || error.code === 'WATCH_STORAGE_ERROR') throw error;
        pending.delete(entry.claim.occurrence.id);
        const failed = await options.repository.fail(entry.claim, now());
        return { status: failed ? 'error' : 'lease_lost', occurrence: failed };
      }
    })();
    try { return await entry.publishing; } finally { entry.publishing = null; }
  }
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300_000 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs >= leaseMs - 100) throw new DataWatchError('INVALID_ENGINE_BUDGET');
  return {
    async runOnce(workerId: string): Promise<WatchTickResult> {
      identifier(workerId);
      const retry = pending.values().next().value;
      if (retry) return await publish(retry);
      await options.repository.enqueueDue(now());
      const claim = await options.repository.claimNext(workerId, leaseMs, now());
      if (!claim) return { status: 'idle', occurrence: null };
      const abort = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let result: CollectionResult;
      try {
        const expired = new Promise<never>((_resolve, reject): void => {
          timer = setTimeout((): void => { abort.abort(); reject(new DataWatchError('COLLECTION_TIMEOUT')); }, timeoutMs);
        });
        result = validateCollectionResult(await Promise.race([
          options.collector({ publicTopic: claim.watch.publicTopic, sourceUrls: claim.watch.sourceUrls, signal: abort.signal }), expired,
        ]));
      } catch {
        const failed = await options.repository.fail(claim, now());
        return { status: failed ? 'error' : 'lease_lost', occurrence: failed };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        abort.abort();
      }
      const publication = { claim, result, publishing: null };
      pending.set(claim.occurrence.id, publication);
      return await publish(publication);
    },
  };
}
