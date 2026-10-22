import { createPublicCollector, KEENABLE_SOURCE_URL } from '../../src/watch/collector.ts';
import { validateCollectionResult } from '../../src/data/validation.ts';

async function main(): Promise<void> {
  const result = validateCollectionResult(await createPublicCollector({ getApiKey: (): string | undefined => process.env.KEENABLE_API_KEY, limit: 5, maxFetches: 3, timeoutMs: 12_000 })(
    { publicTopic: 'projet usine isolants ROCKWOOL Soissons France', sourceUrls: [KEENABLE_SOURCE_URL] }));
  process.stdout.write(`${JSON.stringify({ observedAt: new Date().toISOString(), kind: 'real_keenable_collection', status: result.status, startedAt: result.startedAt, completedAt: result.completedAt,
    sources: result.sources.map((source) => ({ url: source.url, status: source.status, error: source.error, evidence: source.evidence.map((item) => ({ id: item.id, url: item.url, title: item.title,
      publishedAt: item.publishedAt, collectedAt: item.collectedAt, contentHash: item.contentHash, contentCharacters: item.content.length, provenance: item.provenance, family: item.family, regulation: item.regulation })) })),
    limits: ['Public statements are dated; no present production capacity is inferred', 'No verified relationship with synthetic suppliers or SKUs', 'This probe does not execute a model or calculate a proposal'] }, null, 2)}\n`);
  if (result.status === 'error' || result.status === 'not_run') process.exitCode = 1;
}
await main();
