import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAgentRunner } from '../agent/index.js';
import { businessEngine } from '../domain/index.js';
import { createApp } from './app.js';
import { createPool, readConfig } from './config.js';
import { migrate } from './migrate.js';
import { createConfiguredProvider } from './provider.js';
import { PgStore } from './store.js';
import { createRunWorker } from './worker.js';
import { createWatchServices } from './watch-service.js';
import { readCase, referenceOf } from './cases.js';
import { createResearchService } from './research-service.js';
import { createIndustrialFeedRead, industrialPublicWatchId } from './industrial-feed.js';

export async function start(): Promise<void> {
  const config = readConfig();
  const pool = await createPool();
  try { await migrate(pool); } catch (error) { await pool.end(); throw error; }
  const store = new PgStore(pool);
  const provider = createConfiguredProvider();
  const research = createResearchService(store, { collectorLimit: 3, publicContractsWatchId: industrialPublicWatchId(config.companyId) });
  const watches = createWatchServices(store, research.synchronizeWatch, { collectorLimit: 3 });
  const industrial = createIndustrialFeedRead(store, research, watches.service);
  const runWorker = createRunWorker(store, createAgentRunner(), (run, writeTrace, actor) => createAgentRunner({ ...(run.researchScope ? { researchPort: research.port(actor, run) } : {}), ...(provider ? { provider } : {}), maxDurationMs: 60000, currentVersion: async () => { const snapshot = await store.snapshot(run.companyId); return { companyId: snapshot.companyId, revision: snapshot.revision, policyVersion: snapshot.policyVersion }; }, ...(run.caseRef ? { currentCaseRef: async () => referenceOf(await readCase(store, run.companyId, run.caseRef!.caseId)) } : {}), writeTrace }), research);
  let staticRoot: string | undefined;
  try { await access(resolve('dist/client/index.html')); staticRoot = resolve('dist/client'); } catch { /* Vite serves development UI separately. */ }
  const app = await createApp({ store, config, evaluate: businessEngine, watches: watches.service, research, industrial, ...(staticRoot ? { staticRoot } : {}) });
  app.addHook('onClose', async () => { await Promise.all([runWorker.stop(), watches.worker.stop()]); await pool.end(); });
  const shutdown = async (): Promise<void> => { await app.close(); };
  process.once('SIGINT', async () => { await shutdown(); });
  process.once('SIGTERM', async () => { await shutdown(); });
  try { await app.listen({ host: config.host, port: config.port }); runWorker.start(); watches.worker.start(); }
  catch (error) { await app.close(); throw error; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await start(); } catch { process.stderr.write('Startup failed. Check database, migrations and server configuration.\n'); process.exitCode = 1; }
}
