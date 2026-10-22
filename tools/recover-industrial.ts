import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { createPool } from '../src/server/config.js';
import { migrate } from '../src/server/migrate.js';
import { PgStore } from '../src/server/store.js';
import { syntheticSnapshot } from '../src/server/operator.js';
import { datasetSchema, policySchema } from '../src/server/validation.js';
import { parseSnapshot, policyFromContract } from '../src/domain/index.js';
import { parseIndustrialContext } from '../src/data/industrial-relations.js';
import { IndustrialReadRepository, industrialHash } from '../src/server/industrial-read.js';
import { importIndustrialDisplay } from '../src/server/industrial-display.js';
import type { Actor } from '../src/contracts/index.js';

const base = 'proposals/product/alignment-20261022/v2/';
const pins = {
  'portfolio-10000.json': '88305b739661df5cdb7f1686ad461afa05f7f1d5206bbaec7055eada3f6333af',
  'portfolio-policy.json': 'b957fac59b39b9f553bf0c6b86eaa9c9b11076c5bf25cf154aae223150505ae2',
  'industrial-context.v2.json': '95a9aeb940ad51f576779e161e633f47e39d78678355b86b01bfd3386ed3235e',
  'display-profile-v1/display-aliases.v1.json': '472a7b9558bda98e14b9a9a7f747fda6da95f1abc9598b500e6392b6c4052c25',
};
const companyId = 'CO-DEMO-INDUSTRIAL-CANDIDATE';

/** Explicit operator utility. It does not run at application startup or call external services. */
export async function recoverIndustrial(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const mode = z.enum(['--check', '--init', '--readback']).parse(args[0]);
  if (args.length !== 1) throw new Error('Use exactly one recovery mode');
  const inputs: Record<string, unknown> = {};
  for (const [name, hash] of Object.entries(pins)) {
    const bytes = await readFile(base + name);
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Frozen input changed');
    inputs[name] = JSON.parse(bytes.toString('utf8')) as unknown;
  }
  const dataset = datasetSchema.parse(inputs['portfolio-10000.json']);
  const policy = policySchema.parse(inputs['portfolio-policy.json']);
  if (dataset.company_id !== companyId || policy.company_id !== companyId) throw new Error('Company mismatch');
  const snapshot = syntheticSnapshot(dataset, policy, companyId);
  const parsed = parseSnapshot(snapshot.dataset); policyFromContract(snapshot);
  if (parsed.lines.length !== 10000 || parsed.depots.length !== 6) throw new Error('Unexpected portfolio');
  const context = inputs['industrial-context.v2.json'];
  parseIndustrialContext(context, snapshot);
  const display = inputs['display-profile-v1/display-aliases.v1.json'];
  const counts = Object.fromEntries(Object.entries(dataset.tables).map(([name, rows]) => [name, rows.length]));
  const dataHash = industrialHash({ dataset, policy });
  if (mode === '--check') {
    process.stdout.write(JSON.stringify({ status: 'validated_without_database', companyId, counts, dataHash }) + '\n');
    return;
  }
  const schema = z.string().regex(/^physical_recovery_[a-z0-9_]{1,40}$/).parse(env.DATABASE_SCHEMA);
  if (mode === '--init') {
    const admin = await createPool({ ...env, DATABASE_SCHEMA: undefined });
    try { await admin.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`); } finally { await admin.end(); }
  }
  const pool = await createPool({ ...env, DATABASE_SCHEMA: schema });
  try {
    if (mode === '--init') await migrate(pool);
    const selected = await pool.query<{ name: string }>('SELECT current_schema() AS name');
    if (selected.rows[0]?.name !== schema) throw new Error('Schema isolation failed');
    const store = new PgStore(pool);
    if (mode === '--init') {
      await store.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(22062027)');
        const existing = await client.query<{ snapshot: unknown }>('SELECT snapshot FROM companies WHERE company_id=$1 FOR UPDATE', [companyId]);
        if (existing.rowCount) {
          const current = await store.snapshot(companyId, client);
          if (current.revision !== snapshot.revision || industrialHash({ dataset: current.dataset, policy: current.policy }) !== dataHash) {
            throw new Error('Existing company changed. Use readback or a new recovery schema');
          }
          const receipt = await client.query<{ payload: { dataHash?: string } }>("SELECT payload FROM business_events WHERE company_id=$1 AND kind='industrial_core_import'", [companyId]);
          if (receipt.rows.length !== 1 || receipt.rows[0]?.payload.dataHash !== dataHash) throw new Error('Existing import receipt differs');
          return;
        }
        await client.query('INSERT INTO companies(company_id,snapshot) VALUES($1,$2)', [companyId, snapshot]);
        await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)',
          [`public-recovery:${dataHash}`, companyId, snapshot.revision, 'OPERATOR-PUBLIC-RECOVERY', 'industrial_core_import', { dataHash, files: Object.entries(pins).map(([name, sha256]) => ({ name, sha256 })), counts, dataOrigin: 'synthetic' }]);
      });
      const actor: Actor = { companyId, actorId: 'OPERATOR-PUBLIC-RECOVERY', role: 'operator', approvalCeilingEur: 0 };
      const reader = new IndustrialReadRepository(store);
      await reader.importContext(actor, context, snapshot.revision, 'public-recovery-context-v1', pins['industrial-context.v2.json']);
      await importIndustrialDisplay(store, actor, display,
        snapshot.revision, 'public-recovery-display-v1', reader.context.bind(reader));
    }
    const current = await store.snapshot(companyId);
    const actor: Actor = { companyId, actorId: 'EMP-PAUL', role: 'direction', approvalCeilingEur: 2000 };
    const view = await new IndustrialReadRepository(store).workspace(actor);
    process.stdout.write(JSON.stringify({ status: 'read_back', schema, companyId, revision: current.revision, contextRevision: view.context.revision, counts: view.company.counts,
      reports: view.reports.length, events: view.events.length, noProviderCalls: true, noEventReleased: true }) + '\n');
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await recoverIndustrial(process.argv.slice(2)); }
  catch { process.stderr.write('Recovery failed. Check mode, pinned data, database access and dedicated DATABASE_SCHEMA. No reset was performed. A partial import can be retried with --init; an evolved company requires --readback.\n'); process.exitCode = 1; }
}
