import type { SqlPort } from '../contracts/index.js';
import { AppError } from './errors.js';

/** Mutations and claims call this while holding the company row lock. */
export async function hasIndustrialScope(client: SqlPort, companyId: string): Promise<boolean> {
  const result = await client.query(`SELECT 1 FROM accel_industrial_context_heads WHERE company_id=$1
    UNION ALL SELECT 1 FROM business_events WHERE company_id=$1 AND kind='industrial_core_import' LIMIT 1`, [companyId]);
  return result.rowCount === 1;
}

export async function assertGenericScope(client: SqlPort, companyId: string): Promise<void> {
  if (await hasIndustrialScope(client, companyId)) throw new AppError('INDUSTRIAL_SCOPE_REQUIRED', 'Use the bounded industrial analysis for this company.', 409);
}
