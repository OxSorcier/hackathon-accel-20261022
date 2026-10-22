import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Actor, WatchInput } from '../contracts/index.js';
import type { IndustrialReportView, IndustrialWorkspace } from '../contracts/industrial-api.js';
import { BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL } from '../watch/source-policy.js';
import { IndustrialReadRepository, type IndustrialReadService } from './industrial-read.js';
import { withIndustrialDisplay } from './industrial-display.js';
import type { PgStore } from './store.js';
import type { ResearchService } from './research-service.js';
import type { WatchService } from './app.js';

export function industrialPublicWatchInput(): WatchInput {
  return { publicTopic: 'marchés publics matériaux France', sourceUrls: [BOAMP_SOURCE_URL, KEENABLE_SOURCE_URL], cadenceMinutes: 15 };
}
export function industrialPublicWatchId(companyId: string): string {
  const operationKey = `watch:${createHash('sha256').update(JSON.stringify(industrialPublicWatchInput())).digest('hex')}`;
  return `watch:${createHash('sha256').update(JSON.stringify([companyId, operationKey])).digest('hex')}`;
}

/** Reads the received canonical projection. It never creates a watch or calls a collector. */
export function createIndustrialFeedRead(store: PgStore, research: ResearchService, watches: WatchService): IndustrialReadService {
  const base = new IndustrialReadRepository(store);
  return {
    async isIndustrial(companyId): Promise<boolean> { return await base.isIndustrial(companyId); },
    async report(actor, id): Promise<IndustrialReportView> { return await base.report(actor, id); },
    async workspace(actor: Actor): Promise<IndustrialWorkspace> {
      const scope = research.resolve('public-contracts', 'live');
      const publicResearch = await research.lookup(actor, scope);
      const definitions = await watches.list(actor.companyId);
      const watch = definitions.find(value => value.id === industrialPublicWatchId(actor.companyId) && value.enabled);
      const row = watch ? (await store.query('SELECT started_at,status FROM accel_watch_occurrences WHERE company_id=$1 AND watch_id=$2 AND started_at IS NOT NULL ORDER BY started_at DESC,id LIMIT 1', [actor.companyId, watch.id])).rows[0] : undefined;
      const last = row ? z.object({ started_at: z.coerce.date(), status: z.enum(['running', 'completed', 'error']) }).parse(row) : undefined;
      return await new IndustrialReadRepository(store, { decorate: async (client, _actor, _snapshot, _context, view) => {
        const value = await withIndustrialDisplay(client, view);
        const dependency = { scope, generation: publicResearch.generation, validUntil: publicResearch.validUntil, evidenceRefs: publicResearch.observations.map(item => item.ref) };
        const current = publicResearch.state !== 'reusable' || await store.researchCurrent(actor.companyId, [dependency], client, true);
        return { ...value, publicResearch: current ? publicResearch : { ...publicResearch, state: 'stale', validUntil: null, observations: [], conditions: [...publicResearch.conditions, 'SOURCE_CHANGED_DURING_READ'] }, publicFeed: { profileId: scope.profileId, watchId: watch?.id ?? null, cadenceMinutes: watch?.cadenceMinutes ?? null, nextRunAt: watch?.nextRunAt ?? null, lastAttemptAt: last?.started_at.toISOString() ?? null, lastAttemptStatus: last?.status ?? null }, capabilities: { ...value.capabilities, questionsConnected: false } };
      } }).workspace(actor);
    },
  };
}
