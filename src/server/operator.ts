import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createPool } from './config.js';
import { migrate } from './migrate.js';
import { PgStore } from './store.js';
import { datasetSchema, policySchema, snapshotSchema } from './validation.js';
import type { CompanyDataset, CompanyPolicy, CompanySnapshot } from '../contracts/index.js';

export function syntheticSnapshot(dataset: CompanyDataset, policy: CompanyPolicy, companyId: string): CompanySnapshot {
  const source = snapshotSchema.parse({ companyId: dataset.company_id, revision: dataset.snapshot_revision, policyVersion: 'P1', dataOrigin: 'synthetic', dataset, policy, updatedAt: dataset.as_of });
  const copy = structuredClone(source);
  return snapshotSchema.parse({ ...copy, companyId, dataset: { ...copy.dataset, company_id: companyId, tables: { ...copy.dataset.tables, company: [{ ...copy.dataset.tables.company![0]!, id: companyId }] } }, policy: { ...copy.policy, company_id: companyId }, updatedAt: new Date().toISOString() });
}
export async function runOperator(args: string[]): Promise<void> {
  const [command, target = 'CO-DEMO', file, expectedRevision] = args;
  if (!['seed', 'replace'].includes(command ?? '') || !/^[A-Z0-9_-]{1,80}$/.test(target)) throw new Error('Usage: operator seed COMPANY_ID | operator replace COMPANY_ID SNAPSHOT_JSON EXPECTED_REVISION');
  const pool = await createPool();
  try {
    await migrate(pool); const store = new PgStore(pool);
    if (command === 'seed') {
      const dataset = datasetSchema.parse(JSON.parse(await readFile('fixtures/company/dataset.json', 'utf8')));
      const policy = policySchema.parse(JSON.parse(await readFile('fixtures/company/company-policy.json', 'utf8')));
      await store.seed(syntheticSnapshot(dataset, policy, target));
      process.stdout.write(`Synthetic session ${target} created. No provider called.\n`);
    } else {
      if (!file || !expectedRevision) throw new Error('Snapshot path and expected revision required');
      const snapshot = snapshotSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      const updated = await store.replaceSnapshot({ companyId: target, actorId: 'OPERATOR', role: 'operator', approvalCeilingEur: 0 }, expectedRevision, snapshot);
      process.stdout.write(`Synthetic session updated: ${updated.revision}\n`);
    }
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runOperator(process.argv.slice(2)); } catch { process.stderr.write('Operator command failed. Verify arguments and current revision. Existing state was preserved unless a successful update was acknowledged.\n'); process.exitCode = 1; }
}
