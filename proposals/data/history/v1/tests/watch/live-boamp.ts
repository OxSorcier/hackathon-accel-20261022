import { createPublicCollector, BOAMP_SOURCE_URL, PUBLIC_TOPICS } from '../../src/watch/collector.ts';

async function main(): Promise<void> {
  const result = await createPublicCollector({ limit: 2 })({ publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL] });
  process.stdout.write(`${JSON.stringify({ status: result.status, startedAt: result.startedAt, completedAt: result.completedAt,
    sources: result.sources.map((source) => ({ url: source.url, status: source.status, error: source.error,
      evidence: source.evidence.map((item) => ({ id: item.id, url: item.url, title: item.title, publishedAt: item.publishedAt, collectedAt: item.collectedAt, contentHash: item.contentHash, mode: item.mode })) })) }, null, 2)}\n`);
  if (result.status === 'error' || result.status === 'not_run') process.exitCode = 1;
}
await main();
