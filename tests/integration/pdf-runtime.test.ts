import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AgentRun, Actor, JsonObject } from '../../src/contracts/index.js';
import type { IndustrialDisplayProfile } from '../../src/contracts/industrial-api.js';
import { createApp } from '../../src/server/app.js';
import { businessEngine } from '../../src/domain/index.js';
import { createPdfDocuments, PDF_PROFILE } from '../../src/server/pdf-documents.js';
import type { PdfExtraction } from '../../src/server/pdf-client.js';
import { IndustrialRuntime, authorizeIndustrialResearch } from '../../src/server/industrial-runtime.js';
import { createRunWorker } from '../../src/server/worker.js';
import type { ModelProvider } from '../../src/agent/index.js';
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
  const schema = `pdf_runtime_${randomUUID().replaceAll('-','')}`;
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
  it('registers authenticated acquisition and cache-only manual model pages, then reads the same citation after reconnect', async () => {
    let downloads=0,extractions=0;
    const bytes=new TextEncoder().encode('%PDF-1.7\nCONTROLLED TEST native public document protocol');
    const text='CONTROLLED TEST extracted native page. This financial text establishes no incident or supplier delay.';
    const digest=(value:Uint8Array|string):string=>createHash('sha256').update(value).digest('hex');
    const documents=createPdfDocuments(store,async work=>await store.transaction(work),{fetch:async()=>{downloads++;return new Response(bytes,{status:200,headers:{'content-type':'application/pdf','content-length':String(bytes.length)}});},client:{async extract():Promise<PdfExtraction>{extractions++;return{schemaVersion:'pdf-extraction/v1',status:'complete',documentHash:digest(bytes),byteLength:bytes.length,pageCount:1,pages:[{number:1,text,textHash:digest(text),characterCount:Array.from(text).length}],emptyPages:[],characterCount:Array.from(text).length,extractorVersion:'pypdf/6.21.2+accel.1'};}}});
    const research=createResearchService(store,{collectorLimit:3,publicContractsWatchId:industrialPublicWatchId(companyId),authorizeServiceLookup:authorizeIndustrialResearch}),watches=createWatchServices(store,research.synchronizeWatch,{collectorLimit:3}),runtime=new IndustrialRuntime(store,research,watches.service,companyId,documents);
    store.setRunFinalizer(runtime.finalize.bind(runtime));
    const app=await createApp({store,config:{host:'127.0.0.1',port:3000,origin:'http://127.0.0.1:3000',companyId,demoToken:'x'.repeat(32),operatorToken:'y'.repeat(32),secureCookies:false},evaluate:businessEngine,industrial:runtime,documents});
    try{
      expect((await app.inject({method:'GET',url:'/api/pdf-documents'})).statusCode).toBe(401);
      const session=await store.session(actor),headers={origin:'http://127.0.0.1:3000',cookie:`accel_session=${session}`};
      const acquired=await app.inject({method:'POST',url:`/api/pdf-documents/${PDF_PROFILE.id}/acquire`,headers,payload:{}});expect(acquired.statusCode).toBe(200);expect(acquired.json().data).toMatchObject({status:'done',cacheHit:false,downloadCalls:1,modalCalls:1});
      const repeated=await app.inject({method:'POST',url:`/api/pdf-documents/${PDF_PROFILE.id}/acquire`,headers,payload:{}});expect(repeated.json().data).toMatchObject({status:'done',cacheHit:true,modalCalls:0});expect(downloads).toBe(2);expect(extractions).toBe(1);
      const queued=await app.inject({method:'POST',url:'/api/industrial/questions',headers,payload:{question:'Read the cached ROCKWOOL financial document page1 and cite the exact page and limits.',operationKey:'pdf-runtime-question-0001'}});expect(queued.statusCode).toBe(202);
      const run=queued.json().data as AgentRun;expect(run.pdfProfileId).toBe(PDF_PROFILE.id);expect(run.industrialIntentId).toBeUndefined();
      await store.query("UPDATE runs SET payload=jsonb_set(payload,'{mode}','\"test\"') WHERE id=$1",[run.id]);
      let calls=0;const call=(name:string,args:Record<string,unknown>={}):unknown=>({type:'tool_calls',calls:[{id:`pdf-${++calls}`,name,arguments:args}]});
      const model:ModelProvider={mode:'test',model:'explicit-pdf-protocol',version:'test/v1',async complete(request):Promise<unknown>{
        const page=request.messages.findLast(message=>message.name==='read_pdf_pages'&&message.role==='tool'&&!message.isError)?.content as JsonObject|undefined;if(page)return{type:'end',message:`The native financial page is cached and cited at ${PDF_PROFILE.url}#page=1. It does not prove an incident.`};
        const list=request.messages.findLast(message=>message.name==='list_pdf_documents'&&message.role==='tool'&&!message.isError)?.content as JsonObject|undefined;if(list)return call('read_pdf_pages',{documentHash:(list.documents as JsonObject[])[0]!.documentHash,pageNumbers:[1]});
        return call('list_pdf_documents');
      }};
      const worker=createRunWorker(store,async()=>{throw new Error('Generic path forbidden');},(value,sink,authority)=>runtime.runnerFor(value,sink,authority,model),research,runtime);expect(await worker.tick()).toBe(true);
      const result=(await app.inject({method:'GET',url:'/api/runs/'+run.id,headers})).json().data as AgentRun;
      expect(result.status).toBe('needs_input');expect(result.pdfResult?.outcome).toBe('available');expect(result.pdfResult?.pages[0]).toMatchObject({citationUrl:`${PDF_PROFILE.url}#page=1`,excerptHash:digest(text),ref:{documentHash:digest(bytes),pageNumber:1,pageTextHash:digest(text)}});expect(result.traces.find(trace=>trace.tool==='read_pdf_pages')?.output).toMatchObject({result:{externalCalls:0}});expect(extractions).toBe(1);
      const freshPool=new Pool({connectionString:url,options:`-c search_path=${schema}`});try{const fresh=new PgStore(freshPool),cached=createPdfDocuments(fresh,async work=>await fresh.transaction(work),{fetch:async()=>{throw new Error('No restart HTTP');},client:{async extract():Promise<PdfExtraction>{throw new Error('No restart extraction');}}});expect((await cached.read(actor,digest(bytes)))?.status).toBe('done');expect((await fresh.run(companyId,run.id)).pdfResult).toEqual(result.pdfResult);}finally{await freshPool.end();}
      const operatorSession=await store.session(operator);expect((await app.inject({method:'POST',url:`/api/pdf-documents/${PDF_PROFILE.id}/acquire`,headers:{...headers,cookie:`accel_session=${operatorSession}`},payload:{}})).statusCode).toBe(403);
    }finally{await app.close();}
  },30000);
});
