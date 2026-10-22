import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Actor, CompanySnapshot } from '../../src/contracts/index.js';
import { PgStore } from '../../src/server/store.js';
import { migrate } from '../../src/server/migrate.js';
import { syntheticSnapshot } from '../../src/server/operator.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { IndustrialReadRepository, industrialHash } from '../../src/server/industrial-read.js';
import { importIndustrialDisplay, readIndustrialDisplay, withIndustrialDisplay } from '../../src/server/industrial-display.js';
import type { IndustrialDisplayProfile } from '../../src/contracts/industrial-api.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('explicit persistent presentation aliases retain native data identity', () => {
  const schema = `industrial_display_${randomUUID().replaceAll('-', '')}`;
  const companyId = 'CO-DEMO-INDUSTRIAL-CANDIDATE';
  const op: Actor = { companyId, actorId: 'OPERATOR-IMPORT', role: 'operator', approvalCeilingEur: 0 };
  const user: Actor = { companyId, actorId: 'EMP-PAUL', role: 'direction', approvalCeilingEur: 2000 };
  let pool: Pool; let store: PgStore; let repository: IndustrialReadRepository; let snapshot: CompanySnapshot; let profile: IndustrialDisplayProfile;
  const base = 'proposals/product/alignment-20261022/v2/';
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); await migrate(pool); store = new PgStore(pool);
    const dataset = datasetSchema.parse(JSON.parse(await readFile(`${base}portfolio-10000.json`, 'utf8')));
    const policy = policySchema.parse(JSON.parse(await readFile(`${base}portfolio-policy.json`, 'utf8')));
    snapshot = syntheticSnapshot(dataset, policy, companyId); await store.seed(snapshot);
    profile = JSON.parse(await readFile(`${base}display-profile-v1/display-aliases.v1.json`, 'utf8')) as IndustrialDisplayProfile;
    await store.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(), companyId, snapshot.revision, op.actorId, 'industrial_core_import', { files: [{ name: 'portfolio-10000.json', sha256: profile.baseCoreSha256 }] }]);
    repository = new IndustrialReadRepository(store, { decorate: async (client, _actor, _snapshot, _context, view) => await withIndustrialDisplay(client, view) });
    await repository.importContext(op, JSON.parse(await readFile(`${base}industrial-context.v2.json`, 'utf8')), snapshot.revision, randomUUID(), profile.baseContextSha256);
  });
  afterAll(async () => { if (pool) await pool.end(); const admin = new Pool({ connectionString: url }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  it('imports only attributed existing labels without changing core facts or revisions', async () => {
    const before = industrialHash(await store.snapshot(companyId));
    const key = randomUUID(); const imported = await importIndustrialDisplay(store, op, profile, snapshot.revision, key, repository.context.bind(repository));
    expect(imported.labels).toHaveLength(64);
    expect(await importIndustrialDisplay(store, op, profile, snapshot.revision, key, repository.context.bind(repository))).toEqual(imported);
    expect(industrialHash(await store.snapshot(companyId))).toBe(before);
    const view = await repository.workspace(user);
    expect(view.company.name).toBe('Rivebois Matériaux'); expect(view.company.counts.order_lines).toBe(10000);
    expect(view.display).toEqual(profile); expect(view.company.businessRevision).toBe(snapshot.revision);
    expect((await store.snapshot(companyId)).dataset.tables.company![0]!.name).toBe('Industrial Materials Group (synthetic)');
  });
  it('rejects foreign scope, invented labels, source drift, duplicates and nonoperators', async () => {
    const run = async (actor: Actor, value: unknown, revision = snapshot.revision): Promise<IndustrialDisplayProfile> => await importIndustrialDisplay(store, actor, value, revision, randomUUID(), repository.context.bind(repository));
    await expect(run(user, profile)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(run(op, { ...profile, companyId: 'FOREIGN' })).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    await expect(run(op, { ...profile, baseCoreSha256: '0'.repeat(64) })).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' });
    await expect(run(op, { ...profile, labels: [...profile.labels, profile.labels[0]!] })).rejects.toMatchObject({ code: 'INVALID_DISPLAY_PROFILE' });
    await expect(run(op, { ...profile, labels: [...profile.labels, { entityType: 'supplier', nativeId: 'INVENTED', displayName: 'Invented', synthetic: true }] })).rejects.toMatchObject({ code: 'INVALID_DISPLAY_PROFILE' });
    await expect(run(op, profile, 'OLD')).rejects.toMatchObject({ code: 'STALE_CONTEXT' });
    expect((await store.query('SELECT version FROM accel_industrial_display_versions')).rowCount).toBe(1);
  });
  it('retains the same native version after a new connection', async () => {
    const fresh = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    try {
      const value = await new PgStore(fresh).transaction(async client => await readIndustrialDisplay(client, companyId));
      expect(value).toEqual(profile);
    } finally { await fresh.end(); }
  });
  it('refuses a late older version and admits only one concurrent successor', async () => {
    await importIndustrialDisplay(store, op, { ...profile, version: 3 }, snapshot.revision, randomUUID(), repository.context.bind(repository));
    await expect(importIndustrialDisplay(store, op, { ...profile, version: 2 }, snapshot.revision, randomUUID(), repository.context.bind(repository))).rejects.toMatchObject({ code: 'DISPLAY_VERSION_CONFLICT' });
    const results = await Promise.allSettled([1, 2].map(async () => await importIndustrialDisplay(store, op, { ...profile, version: 4 }, snapshot.revision, randomUUID(), repository.context.bind(repository))));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({ code: 'DISPLAY_VERSION_CONFLICT' });
    const saved = await store.transaction(async client => await readIndustrialDisplay(client, companyId));
    expect(saved?.version).toBe(4);
    expect((await store.query('SELECT version FROM accel_industrial_display_versions ORDER BY version')).rows.map(row => row.version)).toEqual([1, 3, 4]);
  });
});
