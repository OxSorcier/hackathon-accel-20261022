import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createPublicCollector, BOAMP_SOURCE_URL, PUBLIC_TOPICS } from '../../src/watch/collector.ts';

const input = { publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL] };
const record = { idweb: '26-99752', objet: 'Fourniture isolants', dateparution: '2026-10-21', nomacheteur: 'Commune test', filename: 'BOAMP-26-99752' };
const response = (body: unknown): Response => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

test('normalise une preuve publique, déduplique et garde son identité quand la collecte change', async (): Promise<void> => {
  let time = '2026-10-22T08:00:00.000Z';
  const collector = createPublicCollector({ fetch: async (): Promise<Response> => response({ total_count: 2, results: [record, record] }), now: (): Date => new Date(time) });
  const first = await collector(input);
  time = '2026-10-22T08:01:00.000Z';
  const second = await collector(input);
  assert.equal(first.status, 'success');
  assert.equal(first.sources[0]?.evidence.length, 1);
  const evidence = first.sources[0]?.evidence[0];
  assert.equal(evidence?.dataOrigin, 'public');
  assert.equal(evidence?.mode, 'direct');
  assert.equal(evidence?.publishedAt, '2026-10-21T00:00:00.000Z');
  assert.match(evidence?.url ?? '', /26-99752/);
  assert.equal(evidence?.id, second.sources[0]?.evidence[0]?.id);
  assert.equal(evidence?.contentHash, second.sources[0]?.evidence[0]?.contentHash);
  assert.notEqual(evidence?.collectedAt, second.sources[0]?.evidence[0]?.collectedAt);
});

test('refuse sujet privé, URL arbitraire et redirection sans appel sortant non autorisé', async (): Promise<void> => {
  let calls = 0;
  const collector = createPublicCollector({ fetch: async (): Promise<Response> => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1' } }); } });
  assert.equal((await collector({ ...input, publicTopic: 'PO-1 SUP-1 retard confidentiel' })).status, 'not_run');
  assert.equal((await collector({ ...input, sourceUrls: ['http://127.0.0.1'] })).status, 'not_run');
  assert.equal(calls, 0);
  assert.equal((await collector(input)).status, 'error');
  assert.equal(calls, 1);
});

test('distingue vide, erreur native, partiel et schema invalide', async (): Promise<void> => {
  const collect = async (body: unknown): Promise<string> => (await createPublicCollector({ fetch: async (): Promise<Response> => response(body) })(input)).status;
  assert.equal(await collect({ total_count: 0, results: [] }), 'empty');
  assert.equal(await collect({ total_count: 1, results: [] }), 'partial');
  assert.equal(await collect({ total_count: 2, results: [record, { ...record, idweb: 'bad id' }] }), 'partial');
  assert.equal(await collect({ total_count: 999, results: [record] }), 'partial');
  assert.equal(await collect({ error: 'native failure' }), 'error');
  assert.equal(await collect({ total_count: 1, results: [{ ...record, dateparution: '2026-02-30' }] }), 'error');
  const failure = await createPublicCollector({ fetch: async (): Promise<Response> => new Response('down', { status: 503 }) })(input);
  assert.equal(failure.status, 'error');
  assert.match(failure.sources[0]?.error ?? '', /HTTP_503/);
});

test('borne le corps et conserve une erreur explicite sur JSON, réseau ou annulation', async (): Promise<void> => {
  const huge = await createPublicCollector({ maxBytes: 64, fetch: async (): Promise<Response> => response({ total_count: 1, results: [record] }) })(input);
  assert.equal(huge.status, 'error');
  assert.match(huge.sources[0]?.error ?? '', /BODY_TOO_LARGE/);
  const invalid = await createPublicCollector({ fetch: async (): Promise<Response> => new Response('{broken') })(input);
  assert.equal(invalid.status, 'error');
  const thrown = await createPublicCollector({ fetch: async (): Promise<Response> => { throw new Error('secret must not be returned'); } })(input);
  assert.equal(thrown.status, 'error');
  assert.doesNotMatch(JSON.stringify(thrown), /secret must/);
  const controller = new AbortController(); controller.abort();
  const aborted = await createPublicCollector()( { ...input, signal: controller.signal });
  assert.equal(aborted.status, 'error');
});

test('annule le flux quand Content-Length dépasse le budget avant lecture', async (): Promise<void> => {
  let canceled = 0;
  const stream = new ReadableStream<Uint8Array>({ cancel(): void { canceled++; } });
  const result = await createPublicCollector({ maxBytes: 64, fetch: async (): Promise<Response> => new Response(stream, { headers: { 'content-length': '65' } }) })(input);
  assert.equal(result.status, 'error');
  assert.equal(result.sources[0]?.error, 'BODY_TOO_LARGE');
  assert.equal(canceled, 1);
});
