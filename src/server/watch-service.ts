import { createHash } from 'node:crypto';
import { createWatchRepository, type WatchRepository } from '../data/watch-repository.js';
import type { SqlPort } from '../contracts/index.js';
import { createWatchEngine } from '../watch/engine.js';
import { createPublicCollector } from '../watch/collector.js';
import type { WatchService } from './app.js';
import type { Worker } from './worker.js';
import type { PgStore } from './store.js';

export type WatchPublicationHook = (client: SqlPort, companyId: string, watchId: string) => Promise<void>;
/** Only SQL publication shares the decision lock; external collection stays outside it. */
export function createSerializedWatchRepository(store: PgStore, onPublished?: WatchPublicationHook): WatchRepository {
  const base = createWatchRepository(store);
  return { ...base,
    async finish(claim, result, now) {
      return await store.transaction(async client => {
        await store.snapshot(claim.occurrence.companyId, client, true);
        const saved = await createWatchRepository(client).finish(claim, result, now);
        if (saved && onPublished) await onPublished(client, saved.companyId, saved.watchId);
        return saved;
      });
    },
    async fail(claim, now) {
      return await store.transaction(async client => {
        await store.snapshot(claim.occurrence.companyId, client, true);
        const saved = await createWatchRepository(client).fail(claim, now);
        if (saved && onPublished) await onPublished(client, saved.companyId, saved.watchId);
        return saved;
      });
    },
  };
}
export interface WatchServiceOptions { collectorLimit?: number }
export function createWatchServices(store: PgStore, onPublished?: WatchPublicationHook, options: WatchServiceOptions = {}): { service: WatchService; worker: Worker } {
  const repo = createSerializedWatchRepository(store, onPublished);
  const engine = createWatchEngine({ repository: repo, collector: createPublicCollector({ getApiKey: () => process.env.KEENABLE_API_KEY, ...(options.collectorLimit !== undefined ? { limit: options.collectorLimit } : {}) }) });
  let stopped = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<boolean> | null = null;
  const tick = async (): Promise<boolean> => {
    if (pending) return false;
    pending = (async (): Promise<boolean> => (await engine.runOnce(`watch-${process.pid}`)).status !== 'idle')();
    try { return await pending; } finally { pending = null; }
  };
  const loop = async (): Promise<void> => {
    try { await tick(); } catch { process.stderr.write('Watch worker unavailable\n'); }
    if (!stopped) timer = setTimeout(async () => { await loop(); }, 1000);
  };
  return {
    service: {
      async create(actor, input) { return await repo.createWatch(actor, input, `watch:${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`); },
      async list(companyId) { return await repo.listWatches(companyId); },
      async occurrences(companyId) { return await repo.listOccurrences(companyId); },
      async trigger(actor, watchId, operationKey) { return await repo.enqueueManual(actor, watchId, operationKey); },
    },
    worker: { tick, start(): void { if (!stopped) return; stopped = false; timer = setTimeout(async () => { await loop(); }, 0); }, async stop(): Promise<void> { stopped = true; if (timer) clearTimeout(timer); if (pending) await pending; } },
  };
}
