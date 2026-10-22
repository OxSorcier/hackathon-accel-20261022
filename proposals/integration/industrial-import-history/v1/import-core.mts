import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPool } from '../flow-reception-source-v1/src/server/config.ts';
import { migrate } from '../flow-reception-source-v1/src/server/migrate.ts';
import { PgStore } from '../flow-reception-source-v1/src/server/store.ts';
import { datasetSchema, policySchema } from '../flow-reception-source-v1/src/server/validation.ts';
import { syntheticSnapshot } from '../flow-reception-source-v1/src/server/operator.ts';
import { parseSnapshot, policyFromContract } from '../flow-reception-source-v1/src/domain/index.ts';

const companyId = 'CO-DEMO-INDUSTRIAL-CANDIDATE';
const companyRevision = 'R-INDUSTRIAL-CANDIDATE-2';
const [mode, schema = 'adaptops_industrial_v2'] = process.argv.slice(2);
if (!['--check', '--apply', '--readback'].includes(mode ?? '') || !/^adaptops_industrial_v2(?:_[a-z0-9]{1,24})?$/.test(schema)) throw new Error('Invalid import command');
const root = process.cwd();
const coreDirectory = resolve(root, 'proposals/product/alignment-20261022/v2');
const digest = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  throw new Error('Unserializable input');
}
const expected = [
  { name: 'portfolio-10000.json', sha256: '88305b739661df5cdb7f1686ad461afa05f7f1d5206bbaec7055eada3f6333af' },
  { name: 'portfolio-policy.json', sha256: 'b957fac59b39b9f553bf0c6b86eaa9c9b11076c5bf25cf154aae223150505ae2' },
];
const texts: string[] = [];
for (const item of expected) {
  const bytes = await readFile(resolve(coreDirectory, item.name));
  if (digest(bytes) !== item.sha256) throw new Error('Frozen input changed');
  texts.push(bytes.toString('utf8'));
}
const dataset = datasetSchema.parse(JSON.parse(texts[0]!));
const policy = policySchema.parse(JSON.parse(texts[1]!));
if (dataset.company_id !== companyId || policy.company_id !== companyId || dataset.snapshot_revision !== companyRevision) throw new Error('Identity mismatch');
const snapshot = syntheticSnapshot(dataset, policy, companyId);
const parsed = parseSnapshot(snapshot.dataset); policyFromContract(snapshot);
if (parsed.lines.length !== 10000 || parsed.depots.length !== 6) throw new Error('Unexpected portfolio');
const dataHash = digest(canonical({ dataset, policy }));
const counts = Object.fromEntries(Object.entries(dataset.tables).map(([name, rows]) => [name, rows.length]));
if (mode === '--check') { process.stdout.write(JSON.stringify({ status: 'validated_without_database', companyId, companyRevision, counts, dataHash }) + '\n'); }
else {
  const envUrl = new URL(process.env.DATABASE_URL ?? '');
  const admin = await createPool();
  let stableBefore: string | null = null;
  try {
    const stable = await admin.query<{ digest: string }>("SELECT md5(snapshot::text) AS digest FROM public.companies WHERE company_id='CO-PARCOURS-PAUL-V2'");
    stableBefore = stable.rows[0]?.digest ?? null;
    if (mode === '--apply') await admin.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  } finally { await admin.end(); }
  envUrl.searchParams.set('options', `-c search_path=${schema}`);
  const candidateEnv = { ...process.env, DATABASE_URL: envUrl.toString() };
  const pool = await createPool(candidateEnv);
  let inserted = false;
  try {
    if (mode === '--apply') await migrate(pool, resolve(root, '.local/flow-reception-source-v1/migrations'));
    const selected = await pool.query<{ current_schema: string }>('SELECT current_schema()');
    if (selected.rows[0]?.current_schema !== schema) throw new Error('Schema isolation failed');
    const store = new PgStore(pool);
    if (mode === '--apply') await store.transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(22062027)');
      const existing = await client.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [companyId]);
      if (existing.rowCount === 0) {
        await client.query('INSERT INTO companies(company_id,snapshot) VALUES($1,$2)', [companyId, snapshot]);
        await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [`industrial-import:${dataHash}`, companyId, companyRevision, 'OPERATOR-EXPLICIT-IMPORT', 'industrial_core_import', { dataHash, files: expected, counts, dataOrigin: 'synthetic' }]);
        inserted = true;
      }
    });
  } finally { await pool.end(); }
  const fresh = await createPool(candidateEnv);
  let actualHash: string;
  let importCount: number;
  try {
    const restored = await new PgStore(fresh).snapshot(companyId);
    parseSnapshot(restored.dataset); policyFromContract(restored);
    actualHash = digest(canonical({ dataset: restored.dataset, policy: restored.policy }));
    if (actualHash !== dataHash || restored.revision !== companyRevision) throw new Error('Readback mismatch');
    const imports = await fresh.query<{ count: string }>("SELECT count(*)::text FROM business_events WHERE company_id=$1 AND kind='industrial_core_import' AND payload->>'dataHash'=$2", [companyId, dataHash]);
    importCount = Number(imports.rows[0]!.count); if (importCount !== 1) throw new Error('Missing or duplicate import receipt');
    const tls = await fresh.query<{ ssl: boolean; version: string | null }>('SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(envUrl.hostname) && !tls.rows[0]?.ssl) throw new Error('Verified remote TLS missing');
    const stable = await fresh.query<{ digest: string }>("SELECT md5(snapshot::text) AS digest FROM public.companies WHERE company_id='CO-PARCOURS-PAUL-V2'");
    if ((stable.rows[0]?.digest ?? null) !== stableBefore) throw new Error('Stable company changed');
    const receipt = { version: 1, checkedAt: new Date().toISOString(), mode, status: 'imported_and_read_back', schema, companyId, revision: companyRevision, dataOrigin: 'synthetic', files: expected, dataHash, actualHash, counts, inserted, importCount, freshConnectionReadback: true, stableCompanyUnchanged: true, tls: tls.rows[0], noProviderCalls: true, noSourceCollection: true, limits: ['Core C1 only; industrial sidecar, report, automatic analysis and execution are not imported or asserted.'] };
    const directory = resolve(root, '.local/industrial-import/receipts'); await mkdir(directory, { recursive: true });
    const file = resolve(directory, `${schema}-${mode.slice(2)}-${Date.now()}.json`); await writeFile(file, JSON.stringify(receipt, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ receipt: file, companyId, schema, inserted, counts, dataHash, verified: true }) + '\n');
  } finally { await fresh.end(); }
}
