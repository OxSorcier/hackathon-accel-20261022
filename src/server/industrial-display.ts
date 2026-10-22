import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Actor, CompanySnapshot } from '../contracts/index.js';
import type { IndustrialContext } from '../contracts/industrial.js';
import type { IndustrialDisplayProfile, IndustrialWorkspace } from '../contracts/industrial-api.js';
import { AppError, PgStore } from './store.js';
import { industrialHash } from './industrial-read.js';

const id = z.string().min(1).max(200);
const text = z.string().min(1).max(3000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const profileSchema: z.ZodType<IndustrialDisplayProfile> = z.object({ companyId: id, version: z.number().int().positive(), baseCoreSha256: hash, baseContextSha256: hash,
  labels: z.array(z.object({ entityType: z.enum(['company','depot','supplier','supplier_site','customer','project','competitor']), nativeId: id, displayName: z.string().min(1).max(300), synthetic: z.literal(true) }).strict()).min(1).max(500),
  companyProfileDisplay: z.object({ activity: text, summary: text, operations: text, disclosure: text }).strict(),
}).strict();

export async function readIndustrialDisplay(client: PoolClient, companyId: string): Promise<IndustrialDisplayProfile | null> {
  const row = (await client.query<{ payload: unknown }>('SELECT v.payload FROM accel_industrial_display_heads h JOIN accel_industrial_display_versions v USING(company_id,version) WHERE h.company_id=$1', [companyId])).rows[0];
  if (!row) return null;
  const result = profileSchema.parse(row.payload);
  if (result.companyId !== companyId) throw new AppError('INVALID_DISPLAY_PROFILE', 'Display profile scope is invalid.', 503);
  return result;
}

export async function withIndustrialDisplay(client: PoolClient, view: IndustrialWorkspace): Promise<IndustrialWorkspace> {
  const display = await readIndustrialDisplay(client, view.company.id);
  if (!display) return view;
  const name = display.labels.find(label => label.entityType === 'company' && label.nativeId === view.company.id)?.displayName;
  if (!name) throw new AppError('INVALID_DISPLAY_PROFILE', 'The company display identity is missing.', 503);
  return { ...view, company: { ...view.company, name }, display };
}

export async function importIndustrialDisplay(store: PgStore, actor: Actor, value: unknown, expectedRevision: string, operationKey: string, context: (client: PoolClient, snapshot: CompanySnapshot) => Promise<IndustrialContext>): Promise<IndustrialDisplayProfile> {
  if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Explicit operator import required.', 403);
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(operationKey)) throw new AppError('INVALID_INPUT', 'Invalid display import key.');
  const profile = profileSchema.parse(value); const commandHash = industrialHash({ actorId: actor.actorId, expectedRevision, profile });
  return await store.transaction(async client => {
    const snapshot = await store.snapshot(actor.companyId, client, true);
    const prior = (await client.query<{ command_hash: string; payload: IndustrialDisplayProfile }>('SELECT command_hash,payload FROM accel_industrial_display_versions WHERE company_id=$1 AND operation_key=$2', [actor.companyId, operationKey])).rows[0];
    if (prior) { if (prior.command_hash !== commandHash) throw new AppError('OPERATION_CONFLICT', 'Display key identifies a different import.', 409); return prior.payload; }
    if (profile.companyId !== actor.companyId || snapshot.revision !== expectedRevision) throw new AppError('STALE_CONTEXT', 'Display import company or revision changed.', 409);
    const received = await context(client, snapshot);
    const core = (await client.query<{ payload: { files?: { name: string; sha256: string }[] } }>("SELECT payload FROM business_events WHERE company_id=$1 AND kind='industrial_core_import' ORDER BY created_at LIMIT 1", [actor.companyId])).rows[0];
    const source = (await client.query<{ source_manifest_hash: string }>('SELECT v.source_manifest_hash FROM accel_industrial_context_heads h JOIN accel_industrial_context_versions v USING(company_id,revision) WHERE h.company_id=$1', [actor.companyId])).rows[0];
    if (!core?.payload.files?.some(file => file.name === 'portfolio-10000.json' && file.sha256 === profile.baseCoreSha256) || source?.source_manifest_hash !== profile.baseContextSha256) throw new AppError('SOURCE_MISMATCH', 'Display profile source versions differ.', 409);
    const tableByType = { company: 'company', depot: 'depots', supplier: 'suppliers', customer: 'customers', project: 'construction_projects' } as const;
    const seen = new Set<string>();
    for (const label of profile.labels) {
      const key = `${label.entityType}:${label.nativeId}`;
      const exists = label.entityType === 'supplier_site' ? received.supplierSites.some(item => item.supplierSiteId === label.nativeId)
        : label.entityType === 'competitor' ? received.competitors.some(item => item.id === label.nativeId)
        : snapshot.dataset.tables[tableByType[label.entityType]]?.some(item => item.id === label.nativeId);
      if (!exists || seen.has(key)) throw new AppError('INVALID_DISPLAY_PROFILE', 'Display label is unknown or duplicated.');
      seen.add(key);
    }
    if (profile.labels.filter(label => label.entityType === 'company' && label.nativeId === actor.companyId).length !== 1) throw new AppError('INVALID_DISPLAY_PROFILE', 'Exactly one company label is required.');
    const head = (await client.query<{ version: number }>('SELECT version FROM accel_industrial_display_heads WHERE company_id=$1', [actor.companyId])).rows[0];
    if (head && profile.version <= head.version) throw new AppError('DISPLAY_VERSION_CONFLICT', 'Publish a newer display version. Historical versions cannot replace the current head.', 409);
    await client.query('INSERT INTO accel_industrial_display_versions(company_id,version,payload,operation_key,command_hash,actor_id) VALUES($1,$2,$3,$4,$5,$6)', [actor.companyId, profile.version, profile, operationKey, commandHash, actor.actorId]);
    await client.query('INSERT INTO accel_industrial_display_heads(company_id,version) VALUES($1,$2) ON CONFLICT(company_id) DO UPDATE SET version=excluded.version', [actor.companyId, profile.version]);
    return profile;
  });
}
