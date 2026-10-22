import type { Actor, AgentRun, SqlPort } from '../contracts/index.js';
import type { ResearchContext, ResearchDependency, ResearchPort, ResearchScope } from '../contracts/research.js';
import { createResearchRepository } from '../data/research-repository.js';
import type { ResearchRepository } from '../data/research-repository.js';
import { createPublicCollector, PUBLIC_PROFILES } from '../watch/collector.js';
import { getSourceProfileById } from '../watch/source-policy.js';
import { validateCollectionResult } from '../data/validation.js';
import { z } from 'zod';
import type { SourceEvidence } from '../contracts/index.js';
import type { PgStore } from './store.js';
import { AppError } from './errors.js';
import { sameResearchScope } from './research-context.js';
import type { ResearchRepositoryOptions } from '../data/research-repository.js';

export interface ResearchService {
  resolve(profileId: string, namespace: ResearchScope['namespace']): ResearchScope;
  lookup(actor: Actor, scope: ResearchScope): Promise<ResearchContext>;
  port(actor: Actor, run: AgentRun): ResearchPort;
  repository: ResearchRepository;
  synchronizeWatch(client: SqlPort, companyId: string, watchId: string): Promise<void>;
}
export function parseControlledEvidence(scope: ResearchScope, value: unknown): SourceEvidence {
  const item = z.object({ collectedAt: z.iso.datetime({ offset: true }), mode: z.literal('test') }).passthrough().parse(value);
  const profile = getSourceProfileById(scope.profileId);
  if (scope.namespace !== 'controlled' || !profile || profile.sourceUrls.length !== 1) throw new AppError('INVALID_RESEARCH_SCOPE', 'An explicit controlled source profile is required.');
  const result = validateCollectionResult({ status: 'success', startedAt: item.collectedAt, completedAt: item.collectedAt, sources: [{ url: profile.sourceUrls[0], status: 'success', evidence: [item], error: null }] });
  return result.sources[0]!.evidence[0]!;
}
export async function invalidateResearchDependents(client: SqlPort, companyId: string, scope: ResearchScope, generation: number): Promise<void> {
  await client.query(`UPDATE proposals SET payload=jsonb_set(payload,'{status}','"stale"')
    WHERE company_id=$1 AND payload->>'status'='pending' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'researchDependencies','[]'::jsonb)) dependency
      WHERE dependency->'scope'=$2::jsonb AND (dependency->>'generation')::bigint<>$3)`, [companyId, JSON.stringify(scope), generation]);
}
export interface ResearchServiceOptions {
  collectorLimit?: number;
  publicContractsWatchId?: string;
  authorizeServiceLookup?: ResearchRepositoryOptions['authorizeServiceLookup'];
}
export function createResearchService(store: PgStore, options: ResearchServiceOptions = {}): ResearchService {
  const profiles = PUBLIC_PROFILES.map(profile => ({ profileId: profile.id, profileVersion: 'v1', freshForMs: 24 * 60 * 60 * 1000,
    ...(profile.id === 'soissons-project' ? { acceptPartialObservations: true, adoptWatchIds: ['watch:919a1330b176e3bc2f060cf1caea20a9f7debbfb2d12c9c90fc31d6109e480a2'] } : {}),
    ...(profile.id === 'public-contracts' && options.publicContractsWatchId ? { acceptPartialObservations: true, adoptWatchIds: [options.publicContractsWatchId] } : {}) }));
  const repository = createResearchRepository(store, { profiles, ...(options.authorizeServiceLookup ? { authorizeServiceLookup: options.authorizeServiceLookup } : {}), onGenerationChange: invalidateResearchDependents, createCollection: () => {
    let calls = 0;
    const countedFetch: typeof globalThis.fetch = async (input, init) => { calls += 1; return await globalThis.fetch(input, init); };
    return { collect: createPublicCollector({ getApiKey: () => process.env.KEENABLE_API_KEY, fetch: countedFetch, ...(options.collectorLimit !== undefined ? { limit: options.collectorLimit } : {}) }), externalCalls: (): number => calls };
  } });
  store.setResearchValidator(async (companyId, dependencies, client) => await repository.validate(companyId, dependencies, client));
  const resolve = (profileId: string, namespace: ResearchScope['namespace']): ResearchScope => {
    const profile = profiles.find(value => value.profileId === profileId);
    if (!profile || !['live', 'controlled'].includes(namespace)) throw new AppError('INVALID_RESEARCH_SCOPE', 'This research profile is not authorized.');
    return { profileId, profileVersion: profile.profileVersion, namespace };
  };
  return { repository, resolve, async lookup(actor, scope): Promise<ResearchContext> { return await repository.lookup(actor, scope); },
    async synchronizeWatch(client, companyId, watchId): Promise<void> {
      for (const profile of profiles) {
        if (!profile.adoptWatchIds?.includes(watchId)) continue;
        // validate reconciles the latest received occurrence under this transaction's lock.
        // Its boolean concerns this dummy dependency, which grants no authority and is discarded.
        await repository.validate(companyId, [{ scope: resolve(profile.profileId, 'live'), generation: 0, validUntil: null, evidenceRefs: [] }], client);
      }
    },
    port(actor, run): ResearchPort {
      if (actor.companyId !== run.companyId || actor.actorId !== run.actorId || !run.researchScope) throw new AppError('INVALID_RESEARCH_SCOPE', 'Research run authority is inconsistent.');
      const scope = resolve(run.researchScope.profileId, run.researchScope.namespace);
      if (scope.profileVersion !== run.researchScope.profileVersion) throw new AppError('STALE_CONTEXT', 'Research policy changed.', 409);
      return { async lookup(): Promise<ResearchContext> { return await repository.lookup(actor, scope); }, async refresh(): Promise<ResearchContext> { return await repository.refresh(actor, scope, `research:${run.id}`); }, async validate(dependencies: ResearchDependency[]): Promise<boolean> { return dependencies.every(value => sameResearchScope(value.scope, scope)) && await repository.validate(actor.companyId, dependencies); } };
    },
  };
}
