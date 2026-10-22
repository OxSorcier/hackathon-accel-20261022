import type { CollectionResult, Collector, WatchOccurrence } from '../contracts/index.ts';
import type { WatchRepository } from '../data/watch-repository.ts';
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
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300_000 || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs >= leaseMs - 100) throw new DataWatchError('INVALID_ENGINE_BUDGET');
  return {
    async runOnce(workerId: string): Promise<WatchTickResult> {
      identifier(workerId);
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
      const saved = await options.repository.finish(claim, result, now());
      return { status: saved ? saved.status === 'error' ? 'error' : 'completed' : 'lease_lost', occurrence: saved };
    },
  };
}
