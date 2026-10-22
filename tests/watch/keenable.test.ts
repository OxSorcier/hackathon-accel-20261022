import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createKeenableCollector } from '../../src/watch/keenable.ts';
import { getWatchCapabilities, KEENABLE_SOURCE_URL, PUBLIC_PROFILES } from '../../src/watch/source-policy.ts';
import { validateCollectionResult, validateWatchInput } from '../../src/data/validation.ts';

const at = '2026-10-22T10:00:00.000Z';
const hit = { title: 'Usine et matériaux isolants', url: 'https://www.batiactu.com/edito/isolants-123.php', description: 'Publication sectorielle', snippet: 'Une usine française modernise sa production.', published_at: '2026-10-21T08:00:00Z', acquired_at: '2026-10-21T09:00:00Z' };
const json = (body: unknown): Response => new Response(JSON.stringify(body));
const input = { publicTopic: 'actualités sectorielles matériaux et bois France', sourceUrls: ['https://api.keenable.ai/v1/search'] };

function fixtureFetch(overrides: Record<string, unknown> = {}): typeof globalThis.fetch {
  return async (url, init): Promise<Response> => {
    if (String(url).includes('/search')) {
      const body: unknown = JSON.parse(String(init?.body));
      assert.ok(typeof body === 'object' && body !== null && 'query' in body);
      assert.doesNotMatch(JSON.stringify(body), /CO-DEMO|EMP-|SUP-|PO-|client privé/);
      return json({ query: body.query, mode: 'realtime', results: [hit], ...overrides });
    }
    return json({ url: hit.url, title: hit.title, content: '# Une usine modernise sa production\nInformation originale de la publication.', published_at: Date.parse(hit.published_at) / 1000 });
  };
}

test('Keenable lie Search et Fetch, source originale, dates et hash stable sans fuite de clé', async (): Promise<void> => {
  let time = at; const endpoints: string[] = [];
  const collector = createKeenableCollector({ now: (): Date => new Date(time), getApiKey: (): string => 'synthetic-credential', fetch: async (url, init): Promise<Response> => {
    endpoints.push(String(url)); assert.equal(new Headers(init?.headers).get('X-API-Key'), 'synthetic-credential');
    return await fixtureFetch()(url, init);
  } });
  const first = await collector(input); time = '2026-10-22T10:01:00.000Z'; const second = await collector(input);
  assert.equal(first.status, 'success'); const item = first.sources[0]?.evidence[0]; assert.ok(item);
  assert.equal(item.url, hit.url); assert.match(item.id, /^keenable:[a-f0-9]{64}$/);
  assert.equal(item.publishedAt, '2026-10-21T08:00:00.000Z'); assert.equal(item.family, 'sector');
  assert.equal(item.provenance?.method, 'fetch'); assert.equal(item.provenance?.provider, 'keenable');
  assert.equal(item.provenance?.indexedAt, '2026-10-21T09:00:00.000Z');
  assert.equal(item.id, second.sources[0]?.evidence[0]?.id); assert.equal(item.contentHash, second.sources[0]?.evidence[0]?.contentHash);
  assert.ok(endpoints.every((url) => url.startsWith('https://api.keenable.ai/v1/')));
  assert.doesNotMatch(JSON.stringify(first), /synthetic-credential/);
  assert.equal(validateCollectionResult(first).sources[0]?.evidence[0]?.provenance?.method, 'fetch');
});

test('accès public explicite sans crédit, requêtes bornées et refus avant accès privé', async (): Promise<void> => {
  let calls = 0; let keysRead = 0;
  const denied = createKeenableCollector({ getApiKey: (): undefined => { keysRead++; return undefined; }, fetch: async (): Promise<Response> => { calls++; return json({}); } });
  assert.equal((await denied({ ...input, publicTopic: 'client privé PO-1' })).status, 'not_run');
  assert.equal((await denied({ ...input, sourceUrls: ['http://127.0.0.1'] })).status, 'not_run');
  assert.equal(calls, 0); assert.equal(keysRead, 0);
  const collector = createKeenableCollector({ now: (): Date => new Date(at), fetch: async (url, init): Promise<Response> => {
    calls++; assert.match(String(url), /\/public(?:\?|$)/); assert.ok(new Headers(init?.headers).get('X-Keenable-Title'));
    assert.equal(new Headers(init?.headers).has('X-API-Key'), false); return await fixtureFetch()(url, init);
  } });
  assert.equal((await collector(input)).status, 'success'); assert.equal(calls, 2);
});

test('partiel pour snippet seul, troncature ou Fetch échoué ; empty et erreurs natives distincts', async (): Promise<void> => {
  const snippets = await createKeenableCollector({ maxFetches: 0, now: (): Date => new Date(at), fetch: fixtureFetch() })(input);
  assert.equal(snippets.status, 'partial'); assert.equal(snippets.sources[0]?.evidence[0]?.provenance?.method, 'search_snippet');
  const failed = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (url, init): Promise<Response> => String(url).includes('/fetch') ? new Response(null, { status: 503 }) : await fixtureFetch()(url, init) })(input);
  assert.equal(failed.status, 'partial'); assert.equal(failed.sources[0]?.evidence[0]?.provenance?.method, 'search_snippet');
  const empty = await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch({ results: [] }) })(input);
  assert.equal(empty.status, 'empty');
  const nativeError = await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch({ error: 'upstream error', results: undefined }) })(input);
  assert.equal(nativeError.status, 'error');
  const truncated = await createKeenableCollector({ maxContentChars: 64, now: (): Date => new Date(at), fetch: fixtureFetch() })(input);
  assert.equal(truncated.status, 'partial'); assert.equal(truncated.sources[0]?.evidence[0]?.provenance?.truncated, true);
});

test('ne lit aucun hôte privé ou hors profil, refuse incohérences URL et requête', async (): Promise<void> => {
  for (const url of ['http://127.0.0.1', 'https://127.0.0.1/', 'https://www.batiactu.com.evil.example/', 'https://user:pass@www.batiactu.com/', 'https://www.batiactu.com/?api_key=private']) {
    let fetches = 0;
    const result = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
      if (String(endpoint).includes('/fetch')) fetches++;
      return await fixtureFetch({ results: [{ ...hit, url }] })(endpoint, init);
    } })(input);
    assert.equal(result.status, 'error'); assert.equal(fetches, 0);
  }
  assert.equal((await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch({ query: 'other query' }) })(input)).status, 'error');
  const mismatch = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => String(endpoint).includes('/fetch') ? json({ url: 'https://www.batiactu.com/another', title: hit.title, content: 'Different document' }) : await fixtureFetch()(endpoint, init) })(input);
  assert.equal(mismatch.status, 'partial'); assert.equal(mismatch.sources[0]?.evidence[0]?.provenance?.method, 'search_snippet');
});

test('Keenable refuse redirections, corps surdimensionné, dates impossibles et annule les flux', async (): Promise<void> => {
  for (const status of [302, 401, 429, 503]) {
    const result = await createKeenableCollector({ fetch: async (): Promise<Response> => new Response(null, { status }) })(input);
    assert.equal(result.status, 'error'); assert.match(result.sources[0]?.error ?? '', new RegExp(`HTTP_${status}`));
  }
  let canceled = 0;
  const body = new ReadableStream<Uint8Array>({ cancel(): void { canceled++; } });
  const oversized = await createKeenableCollector({ maxBytes: 64, fetch: async (): Promise<Response> => new Response(body, { headers: { 'content-length': '65' } }) })(input);
  assert.equal(oversized.status, 'error'); assert.equal(canceled, 1);
  const invalidDate = await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch({ results: [{ ...hit, published_at: '2026-02-30T00:00:00Z' }] }) })(input);
  assert.equal(invalidDate.status, 'error');
  const futureDate = await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch({ results: [{ ...hit, published_at: '2027-01-01T00:00:00Z' }] }) })(input);
  assert.equal(futureDate.status, 'error');
  const aborted = new AbortController(); aborted.abort(); let requests = 0;
  assert.equal((await createKeenableCollector({ fetch: async (): Promise<Response> => { requests++; return json({}); } })({ ...input, signal: aborted.signal })).status, 'error');
  assert.equal(requests, 0);
});

test('persistance refuse fausse provenance, changement de famille et identité de source croisée', async (): Promise<void> => {
  const valid = await createKeenableCollector({ now: (): Date => new Date(at), fetch: fixtureFetch() })(input);
  for (const change of [ { id: 'keenable:wrong' }, { family: 'regulation_eu' }, { provenance: undefined },
    { provenance: { ...valid.sources[0]!.evidence[0]!.provenance, endpoint: 'https://evil.example/' } } ]) {
    const value = structuredClone(valid); Object.assign(value.sources[0]!.evidence[0]!, change);
    assert.throws((): void => { validateCollectionResult(value); });
  }
  const crossed = structuredClone(valid); crossed.sources[0]!.url = 'https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records';
  assert.throws((): void => { validateCollectionResult(crossed); });
});

test('conserve la contradiction entre date visible éditeur et métadonnée API', async (): Promise<void> => {
  const url = 'https://www.rockwool.com/fr/soissons/actualites/actualite-du-05-mars-2026/';
  const result = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/search')) return await fixtureFetch({ results: [{ ...hit, url, published_at: '2026-03-06T07:20:00Z', acquired_at: null }] })(endpoint, init);
    return json({ url, title: 'Actualité du 05 mars 2026', content: 'Le projet industriel dispose d’un calendrier prévisionnel, sans date visible dans cet extrait de corps.', published_at: 1772781600 });
  } })(input);
  assert.equal(result.status, 'partial');
  const item = result.sources[0]?.evidence[0]; assert.ok(item);
  assert.equal(item.publishedAt, null);
  assert.match(item.content, /2026-03-05/); assert.match(item.content, /2026-03-06/); assert.match(item.content, /Date conflict/);
});

test('le profil Soissons exclut un résultat britannique du même éditeur et normalise ses alias publics', async (): Promise<void> => {
  const publicTopic = 'projet usine isolants ROCKWOOL Soissons France';
  const url = 'https://rockwool.com/fr/soissons/actualites/actualite-du-10-juillet-2026';
  let fetches = 0;
  const result = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/search')) { const body = JSON.parse(String(init?.body)) as Record<string, unknown>; return json({ query: body.query, mode: body.mode, results: [{ ...hit, url, published_at: null }, { ...hit, url: 'https://rockwool.com/uk/news/training/' }] }); }
    fetches++; return json({ url: 'https://www.rockwool.com/fr/soissons/actualites/actualite-du-10-juillet-2026/', title: 'Actualité du 10 juillet 2026', content: 'Le communiqué décrit la poursuite de la construction du projet.' });
  } })({ publicTopic, sourceUrls: [KEENABLE_SOURCE_URL] });
  assert.equal(fetches, 1); assert.equal(result.sources[0]?.evidence.length, 1);
  assert.equal(result.sources[0]?.evidence[0]?.provenance?.method, 'fetch');
  assert.equal(result.sources[0]?.evidence[0]?.publishedAt, '2026-07-10T00:00:00.000Z');
});

test('capacités couvrent les familles reçues ; réglementation conserve inconnues et source officielle', async (): Promise<void> => {
  const capabilities = getWatchCapabilities(); assert.ok(capabilities.sourceUrls.includes(KEENABLE_SOURCE_URL));
  for (const family of ['sector', 'regional', 'supplier', 'incident', 'project', 'public_contract', 'regulation_fr', 'regulation_eu']) assert.ok(PUBLIC_PROFILES.some((profile) => profile.family === family));
  const profile = PUBLIC_PROFILES.find((item) => item.family === 'regulation_eu'); assert.ok(profile);
  validateWatchInput({ publicTopic: profile.publicTopic, sourceUrls: [KEENABLE_SOURCE_URL], cadenceMinutes: 15 });
  const url = 'https://eur-lex.europa.eu/eli/reg/2024/3110/oj';
  const result = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/search')) { const body = JSON.parse(String(init?.body)) as Record<string, unknown>; assert.equal(body.site, 'eur-lex.europa.eu'); return json({ query: body.query, mode: 'realtime', results: [{ ...hit, url }] }); }
    return json({ url, title: 'Règlement produits construction', content: 'Texte officiel de test sans extraction de dates juridiques.' });
  } })({ publicTopic: profile.publicTopic, sourceUrls: [KEENABLE_SOURCE_URL] });
  const item = validateCollectionResult(result).sources[0]?.evidence[0]; assert.ok(item);
  assert.equal(item.family, 'regulation_eu'); assert.equal(item.regulation?.jurisdiction, 'EU');
  assert.equal(item.regulation?.applicability, 'to_verify'); assert.equal(item.regulation?.deadlineAt, null); assert.equal(item.regulation?.entryIntoForceAt, null);
  assert.match(item.regulation?.officialIdentifier ?? '', /2024\/3110/);
});

test('borne la preuve complète, déclare aussi la troncature des snippets et préserve les deux dates API', async (): Promise<void> => {
  const long = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/search')) return await fixtureFetch({ results: [{ ...hit, title: 'T'.repeat(4000) }] })(endpoint, init);
    return json({ url: hit.url, title: 'T'.repeat(4000), content: 'B'.repeat(7999), published_at: Date.parse(hit.published_at) / 1000 });
  } })(input);
  const item = validateCollectionResult(long).sources[0]?.evidence[0]; assert.ok(item);
  assert.ok(item.content.length <= 12_000); assert.equal(item.provenance?.truncated, true); assert.equal(long.status, 'partial');
  const snippet = await createKeenableCollector({ maxFetches: 0, maxContentChars: 32, now: (): Date => new Date(at), fetch: fixtureFetch({ results: [{ ...hit, snippet: 'S'.repeat(200) }] }) })(input);
  assert.equal(snippet.sources[0]?.evidence[0]?.provenance?.truncated, true);
  const conflict = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/search')) return await fixtureFetch()(endpoint, init);
    return json({ url: hit.url, title: hit.title, content: 'Le fabricant publie une information sectorielle sur ses matériaux.', published_at: Date.parse('2026-10-20T08:00:00Z') / 1000 });
  } })(input);
  assert.equal(conflict.sources[0]?.evidence[0]?.publishedAt, null);
  assert.match(conflict.sources[0]?.evidence[0]?.content ?? '', /2026-10-21/); assert.match(conflict.sources[0]?.evidence[0]?.content ?? '', /2026-10-20/);
});

test('refuse un chemin au pourcentage invalide avant Fetch et identifie la copie indexée', async (): Promise<void> => {
  let fetches = 0;
  const result = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/fetch')) fetches++;
    return await fixtureFetch({ results: [{ ...hit, url: 'https://www.rockwool.com/fr/article%ZZ' }] })(endpoint, init);
  } })(input);
  assert.equal(result.status, 'error'); assert.equal(fetches, 0);
  const indexed = await createKeenableCollector({ now: (): Date => new Date(at), fetch: async (endpoint, init): Promise<Response> => {
    if (String(endpoint).includes('/fetch')) assert.equal(new URL(String(endpoint)).searchParams.get('live'), 'false');
    return await fixtureFetch()(endpoint, init);
  } })(input);
  assert.match(indexed.sources[0]?.evidence[0]?.content ?? '', /indexed copy/);
});

test('un domaine officiel du profil UE reste admissible jusqu’à la persistance', async (): Promise<void> => {
  const url = 'https://environment.ec.europa.eu/topics/waste-and-recycling/construction-and-demolition-waste_en';
  const result = await createKeenableCollector({ maxFetches: 0, now: (): Date => new Date(at), fetch: async (_endpoint, init): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return json({ query: body.query, mode: body.mode, results: [{ ...hit, url }] });
  } })({ publicTopic: 'réglementation européenne produits construction', sourceUrls: [KEENABLE_SOURCE_URL] });
  assert.equal(validateCollectionResult(result).sources[0]?.evidence[0]?.url, url);
});
