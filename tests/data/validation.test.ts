import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isoDate, validateCollectionResult, validateWatchInput } from '../../src/data/validation.ts';
import { BOAMP_SOURCE_URL, createPublicCollector, PUBLIC_TOPICS } from '../../src/watch/collector.ts';

test('validation refuse calendrier, sujet ou source non autorisés', (): void => {
  const valid = { publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL], cadenceMinutes: 15 };
  for (const invalid of [ { ...valid, cadenceMinutes: 0 }, { ...valid, cadenceMinutes: 2.5 }, { ...valid, cadenceMinutes: 10_081 },
    { ...valid, sourceUrls: [BOAMP_SOURCE_URL, BOAMP_SOURCE_URL] }, { ...valid, publicTopic: 'secret fournisseur' }, { ...valid, sourceUrls: ['https://www.boamp.fr@127.0.0.1'] } ]) {
    assert.throws((): void => { validateWatchInput(invalid); });
  }
});

test('les timestamps refusent un jour ou une heure normalisés silencieusement', (): void => {
  for (const value of ['2026-02-30T00:00:00Z', '2026-10-22T24:00:00Z', '2026-02-29T12:00:00+02:00']) assert.throws((): void => { isoDate(value); }, /INVALID_TIMESTAMP/);
  assert.equal(isoDate('2024-02-29T12:00:00+02:00'), '2024-02-29T10:00:00.000Z');
});

test('validation de persistance lie preuve, hash, URL et temps et retire les champs hors contrat', async (): Promise<void> => {
  const at = '2026-10-22T08:00:00.000Z';
  const result = await createPublicCollector({ now: (): Date => new Date(at), fetch: async (): Promise<Response> => new Response(JSON.stringify({ total_count: 1,
    results: [{ idweb: '26-1', objet: 'Isolant', dateparution: null }] })) })({ publicTopic: PUBLIC_TOPICS[0], sourceUrls: [BOAMP_SOURCE_URL] });
  assert.equal(validateCollectionResult(result).status, 'success');
  const extra = { ...result, privateData: 'excluded' };
  assert.equal('privateData' in validateCollectionResult(extra), false);
  for (const field of ['contentHash', 'url', 'dataOrigin', 'collectedAt'] as const) {
    const changed = structuredClone(result); const item = changed.sources[0]?.evidence[0]; assert.ok(item);
    Object.assign(item, { [field]: 'invalid' });
    assert.throws((): void => { validateCollectionResult(changed); });
  }
  assert.throws((): void => { validateCollectionResult({ ...result, status: 'empty' }); });
  const wrongClock = structuredClone(result); wrongClock.sources[0]!.evidence[0]!.collectedAt = '2026-10-22T08:01:00.000Z';
  assert.throws((): void => { validateCollectionResult(wrongClock); });
  for (const mode of [['direct'], { toString: (): string => 'direct' }, 1, true]) {
    const wrongMode = structuredClone(result); Object.assign(wrongMode.sources[0]!.evidence[0]!, { mode });
    assert.throws((): void => { validateCollectionResult(wrongMode); });
  }
});
