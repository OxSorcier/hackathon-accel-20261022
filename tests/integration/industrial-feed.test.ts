import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/contracts/index.js';
import type { IndustrialDisplayProfile } from '../../src/contracts/industrial-api.js';
import { PgStore } from '../../src/server/store.js';
import { migrate } from '../../src/server/migrate.js';
import { syntheticSnapshot } from '../../src/server/operator.js';
import { datasetSchema, policySchema } from '../../src/server/validation.js';
import { IndustrialReadRepository } from '../../src/server/industrial-read.js';
import { importIndustrialDisplay } from '../../src/server/industrial-display.js';
import { createResearchService } from '../../src/server/research-service.js';
import { createWatchServices } from '../../src/server/watch-service.js';
import { createIndustrialFeedRead, industrialPublicWatchId, industrialPublicWatchInput } from '../../src/server/industrial-feed.js';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('known company and bounded existing watch feed, injected HTTP only', () => {
  const schema = `industrial_feed_${randomUUID().replaceAll('-','')}`;
  const companyId = 'CO-DEMO-INDUSTRIAL-CANDIDATE';
  const actor: Actor = { companyId, actorId: 'EMP-PAUL', role: 'direction', approvalCeilingEur: 2000 };
  const operator: Actor = { ...actor, actorId: 'OPERATOR-IMPORT', role: 'operator', approvalCeilingEur: 0 };
  let pool: Pool; let store: PgStore;
  beforeAll(async () => {
    const admin = new Pool({ connectionString: url }); await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` }); await migrate(pool); store = new PgStore(pool);
    const base = 'proposals/product/alignment-20261022/v2/';
    const dataset = datasetSchema.parse(JSON.parse(await readFile(`${base}portfolio-10000.json`,'utf8'))), policy = policySchema.parse(JSON.parse(await readFile(`${base}portfolio-policy.json`,'utf8')));
    const snapshot = syntheticSnapshot(dataset, policy, companyId); await store.seed(snapshot);
    const display = JSON.parse(await readFile(`${base}display-profile-v1/display-aliases.v1.json`,'utf8')) as IndustrialDisplayProfile;
    await store.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [randomUUID(),companyId,snapshot.revision,operator.actorId,'industrial_core_import',{files:[{name:'portfolio-10000.json',sha256:display.baseCoreSha256}]}]);
    const read = new IndustrialReadRepository(store); await read.importContext(operator,JSON.parse(await readFile(`${base}industrial-context.v2.json`,'utf8')),snapshot.revision,randomUUID(),display.baseContextSha256);
    await importIndustrialDisplay(store,operator,display,snapshot.revision,randomUUID(),read.context.bind(read));
  });
  afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); if(pool)await pool.end(); const admin=new Pool({connectionString:url});await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end(); });
  it('uses the one existing worker, retains partial raw status, and reads only eligible native notices', async () => {
    let calls=0; const requests:string[]=[];
    vi.stubEnv('KEENABLE_API_KEY','synthetic-test-not-a-secret');
    vi.stubGlobal('fetch',async (input:Parameters<typeof fetch>[0]):Promise<Response> => {
      calls++; const address=input instanceof Request?input.url:String(input);requests.push(address);
      if(address.startsWith('https://www.boamp.fr/'))return new Response(JSON.stringify({total_count:20,results:Array.from({length:20},(_,index)=>({idweb:`26-${1000+index}`,objet:`Explicit synthetic BOAMP protocol record ${index}`,dateparution:'2026-10-21',nomacheteur:'Synthetic public buyer for integration protocol',filename:'synthetic-test'}))}),{status:200,headers:{'content-type':'application/json'}});
      if(address.startsWith('https://api.keenable.ai/'))return new Response('{}',{status:503,headers:{'content-type':'application/json'}});
      throw new Error('No external HTTP is allowed in this test');
    });
    const research=createResearchService(store,{collectorLimit:3,publicContractsWatchId:industrialPublicWatchId(companyId)}), watches=createWatchServices(store,research.synchronizeWatch,{collectorLimit:3});
    const feed=createIndustrialFeedRead(store,research,watches.service);
    expect((await feed.workspace(actor)).publicResearch?.state).toBe('missing'); expect(calls).toBe(0);
    const watch=await watches.service.create(actor,industrialPublicWatchInput());expect(watch.id).toBe(industrialPublicWatchId(companyId));
    expect(await watches.worker.tick()).toBe(true);
    const raw=(await watches.service.occurrences(companyId))[0]!;expect(raw.status).toBe('completed');expect(raw.result?.status).toBe('partial');
    expect(raw.result?.sources.flatMap(source=>source.evidence)).toHaveLength(3);expect(new URL(requests[0]!).searchParams.get('limit')).toBe('3');
    const count=calls;const view=await feed.workspace(actor);
    expect(view.company.name).toBe('Rivebois Matériaux');expect(view.publicResearch?.state).toBe('reusable');expect(view.publicResearch?.observations).toHaveLength(3);
    expect(view.publicResearch?.observations.every(item=>item.qualification==='source_observation_only'&&item.evidence.provenance?.provider==='boamp'&&item.evidence.provenance.method==='api_record'&&item.evidence.publishedAt==='2026-10-21T00:00:00.000Z')).toBe(true);
    expect(view.publicResearch?.conditions).toContain('PUBLIC_NOTICE_LEAD_NOT_QUALIFIED_CRM_DEMAND');
    expect(view.publicFeed).toMatchObject({watchId:watch.id,cadenceMinutes:15,lastAttemptStatus:'completed'});
    expect(view.capabilities).toMatchObject({automaticAnalysis:false,questionsConnected:false,decisionsConnected:false,simulationConnected:false});expect(view.reports).toEqual([]);expect(view.events).toEqual([]);
    expect(await watches.worker.tick()).toBe(false);expect(calls).toBe(count);
    const freshPool=new Pool({connectionString:url,options:`-c search_path=${schema}`});
    try {const freshStore=new PgStore(freshPool),freshResearch=createResearchService(freshStore,{collectorLimit:3,publicContractsWatchId:industrialPublicWatchId(companyId)}),freshWatches=createWatchServices(freshStore,freshResearch.synchronizeWatch,{collectorLimit:3});const reread=await createIndustrialFeedRead(freshStore,freshResearch,freshWatches.service).workspace(actor);expect(reread.publicResearch?.observations.map(value=>value.ref)).toEqual(view.publicResearch?.observations.map(value=>value.ref));expect(reread.publicResearch?.generation).toBe(view.publicResearch?.generation);expect(calls).toBe(count);}finally{await freshPool.end();}
  });
});
