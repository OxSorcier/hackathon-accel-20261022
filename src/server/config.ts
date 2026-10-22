import { readFile } from 'node:fs/promises';
import { Pool, type PoolConfig } from 'pg';
import { z } from 'zod';
import type { LoginConfig } from './auth.js';
export interface AppConfig extends LoginConfig { origin: string; host: string; port: number; secureCookies: boolean }
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const origin = z.url().parse(env.APP_ORIGIN ?? 'http://127.0.0.1:3000');
  return { origin: new URL(origin).origin, host: env.HOST ?? '127.0.0.1', port: z.coerce.number().int().min(1).max(65535).parse(env.PORT ?? 3000), companyId: env.DEMO_COMPANY_ID ?? 'CO-DEMO', demoToken: env.DEMO_LOGIN_TOKEN ?? '', operatorToken: env.OPERATOR_LOGIN_TOKEN ?? '', secureCookies: origin.startsWith('https://') };
}
export async function createPool(env: NodeJS.ProcessEnv = process.env): Promise<Pool> {
  const raw = z.string().min(1).parse(env.DATABASE_URL);
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database protocol');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const sslMode = url.searchParams.get('sslmode');
  if (!local && sslMode === 'disable') throw new Error('Remote database requires verified TLS');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  const config: PoolConfig = { connectionString: url.toString(), max: 8, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 };
  config.ssl = local && !env.DATABASE_CA_FILE ? false : { rejectUnauthorized: true, ...(env.DATABASE_CA_FILE ? { ca: await readFile(env.DATABASE_CA_FILE, 'utf8') } : {}) };
  const pool = new Pool(config);
  pool.on('error', () => { process.stderr.write('PostgreSQL pool connection failed\n'); });
  return pool;
}
