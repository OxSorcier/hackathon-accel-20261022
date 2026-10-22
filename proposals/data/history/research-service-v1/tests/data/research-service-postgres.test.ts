import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import type { Actor, CollectionResult, SourceEvidence, SqlPort, SqlResult } from '../../src/contracts/index.ts';
import type { ResearchScope } from '../../src/contracts/research.ts';
import { createResearchRepository, type ResearchRepositoryOptions, type ResearchStore } from '../../src/data/research-repository.ts';
import { createWatchRepository } from '../../src/data/watch-repository.ts';
import { DataWatchError } from '../../src/data/validation.ts';
import { KEENABLE_SOURCE_URL } from '../../src/watch/source-policy.ts';

const schema=`research_service_${randomUUID().replaceAll('-','')}`, companyId='SERVICE-A', principalId='SVC-RESEARCH';
const scope:ResearchScope={profileId:'soissons-project',profileVersion:'v1',namespace:'live'};
const actor:Actor={actorId:'EMP-PAUL',companyId,role:'direction',approvalCeilingEur:2000};
let pool:Pool,admin:Pool,store:ResearchStore,time:Date,calls:number; let created=false;
function port(client:Pool|PoolClient):SqlPort { return {async query<T extends Record<string,unknown>>(text:string,values?:unknown[]):Promise<SqlResult<T>> {const result=await client.query<T>(text,values);return {rows:result.rows,rowCount:result.rowCount};}};}
const authorize:NonNullable<ResearchRepositoryOptions['authorizeServiceLookup']>=async(client,company,receivedScope,id):Promise<boolean>=>{
  const row=(await client.query('SELECT role,active FROM test_service_principals WHERE company_id=$1 AND id=$2 AND profiles @> $3::jsonb FOR SHARE',[company,id,JSON.stringify([receivedScope])])).rows[0];
  return row?.role==='analysis_only'&&row.active===true;
};
function repository(watchId:string,options:Partial<ResearchRepositoryOptions>={}) {
  return createResearchRepository(store,{profiles:[{profileId:scope.profileId,profileVersion:'v1',freshForMs:60_000,adoptWatchIds:[watchId]}],now:():Date=>time,
    createCollection:()=>({externalCalls:():number=>calls,collect:async():Promise<CollectionResult>=>{calls++;throw new Error('SERVICE_MUST_NEVER_COLLECT');}}),authorizeServiceLookup:authorize,...options});
}
async function published():Promise<{watchId:string;hash:string}> {
  const watches=createWatchRepository(port(pool)),watch=await watches.createWatch(actor,{publicTopic:'projet usine isolants ROCKWOOL Soissons France',sourceUrls:[KEENABLE_SOURCE_URL],cadenceMinutes:15},'source',time);
  await watches.enqueueManual(actor,watch.id,'one',time);const claim=await watches.claimNext('fixture-worker',60_000,time);assert.ok(claim);
  const url='https://www.rockwool.com/fr/soissons/actualites/service-test/',content='SIMULATED source fixture, not an actual publisher statement or company relation.';
  const evidence:SourceEvidence={id:`keenable:${createHash('sha256').update(url).digest('hex')}`,url,title:'Service lookup fixture',content,publishedAt:null,collectedAt:time.toISOString(),contentHash:createHash('sha256').update(content).digest('hex'),dataOrigin:'public',mode:'direct',family:'supplier',provenance:{provider:'keenable',method:'fetch',endpoint:'https://api.keenable.ai/v1/fetch/public',profileId:scope.profileId,indexedAt:null,truncated:false}};
  await watches.finish(claim,{status:'success',sources:[{url:KEENABLE_SOURCE_URL,status:'success',evidence:[evidence],error:null}],startedAt:time.toISOString(),completedAt:time.toISOString()},time);
  return {watchId:watch.id,hash:evidence.contentHash};
}
describe.skipIf(!process.env.DATA_WATCH_TEST_DATABASE_URL)('Service-only research lookup, disposable PostgreSQL',():void=>{
  beforeAll(async():Promise<void>=>{
    const connectionString=process.env.DATA_WATCH_TEST_DATABASE_URL;assert.ok(connectionString);admin=new Pool({connectionString,max:1});await admin.query(`CREATE SCHEMA ${schema}`);created=true;
    pool=new Pool({connectionString,max:8,options:`-c search_path=${schema}`});await pool.query('CREATE TABLE companies(company_id text PRIMARY KEY)');
    for(const file of ['watch-schema.sql','research-schema.sql'])await pool.query(await readFile(new URL(`../../proposals/data/${file}`,import.meta.url),'utf8'));
    await pool.query('CREATE TABLE test_service_principals(company_id text,id text,role text,active boolean,profiles jsonb,PRIMARY KEY(company_id,id))');
    store={...port(pool),async transaction<T>(work:(client:SqlPort)=>Promise<T>):Promise<T>{const client=await pool.connect();try{await client.query('BEGIN');const result=await work(port(client));await client.query('COMMIT');return result;}catch(error:unknown){await client.query('ROLLBACK');throw error;}finally{client.release();}}};
    await store.transaction(async(client):Promise<void>=>{await client.query(await readFile(new URL('../../proposals/data/research-publication-order.sql',import.meta.url),'utf8'));});
  });
  beforeEach(async():Promise<void>=>{
    await pool.query('TRUNCATE test_service_principals,accel_research_commands,accel_research_scopes,accel_watch_evidence,accel_watch_occurrences,accel_watch_definitions,companies');
    await pool.query("INSERT INTO companies VALUES('SERVICE-A'),('SERVICE-B')");await pool.query("INSERT INTO test_service_principals VALUES($1,$2,'analysis_only',true,$3)",[companyId,principalId,JSON.stringify([scope])]);time=new Date();calls=0;
  });
  afterAll(async():Promise<void>=>{if(pool)await pool.end();if(admin){try{if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);}finally{await admin.end();}}});
  test('active same-company service retrieves identical public refs without collection or a fabricated human actor',async():Promise<void>=>{
    const source=await published(),repo=repository(source.watchId),human=await repo.lookup(actor,scope),service=await repo.lookupForService(companyId,scope,principalId);
    assert.equal(service.state,'reusable');assert.deepEqual(service.observations.map(item=>item.ref),human.observations.map(item=>item.ref));assert.equal(service.observations[0]?.ref.contentHash,source.hash);assert.equal(service.externalCalls,0);assert.equal(calls,0);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_research_commands')).rows[0]?.n,0);
    time=new Date(time.getTime()+60_001);const stale=await repo.lookupForService(companyId,scope,principalId);assert.equal(stale.state,'stale');assert.equal(stale.validUntil,null);assert.equal(calls,0);
  });
  test('missing authorization, inactive/wrong role/foreign company/profile, controlled namespace and unknown scope fail closed',async():Promise<void>=>{
    const source=await published(),repo=repository(source.watchId);
    await assert.rejects(repository(source.watchId,{authorizeServiceLookup:undefined}).lookupForService(companyId,scope,principalId),/RESEARCH_SERVICE_FORBIDDEN/);
    for(const sql of ["UPDATE test_service_principals SET active=false","UPDATE test_service_principals SET active=true,role='direction'","UPDATE test_service_principals SET role='analysis_only',profiles='[]'"]){await pool.query(sql);await assert.rejects(repo.lookupForService(companyId,scope,principalId),/RESEARCH_SERVICE_FORBIDDEN/);}
    await assert.rejects(repo.lookupForService('SERVICE-B',scope,principalId),/RESEARCH_SERVICE_FORBIDDEN/);
    await assert.rejects(repo.lookupForService(companyId,{...scope,namespace:'controlled'},principalId),/RESEARCH_SERVICE_FORBIDDEN/);
    await assert.rejects(repo.lookupForService(companyId,{...scope,profileVersion:'v999'},principalId),/RESEARCH_SCOPE_NOT_AUTHORISED/);
    assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_research_scopes')).rows[0]?.n,0);assert.equal(calls,0);
  });
  test('permission callback uses the transaction client and errors leave no projection',async():Promise<void>=>{
    const source=await published();const repo=repository(source.watchId,{authorizeServiceLookup:async(client,company,receivedScope,id):Promise<boolean>=>{assert.equal((await client.query('SELECT company_id FROM companies WHERE company_id=$1',[company])).rows.length,1);assert.deepEqual(receivedScope,scope);assert.equal(id,principalId);throw new DataWatchError('AUTH_LOOKUP_FAILED');}});
    await assert.rejects(repo.lookupForService(companyId,scope,principalId),/AUTH_LOOKUP_FAILED/);assert.equal((await pool.query('SELECT count(*)::integer AS n FROM accel_research_scopes')).rows[0]?.n,0);assert.equal(calls,0);
  });
  test('service adoption of failure shares the existing invalidation transaction and cannot swallow its callback error',async():Promise<void>=>{
    const source=await published(),initial=await repository(source.watchId).lookupForService(companyId,scope,principalId),watches=createWatchRepository(port(pool));
    await watches.enqueueManual(actor,source.watchId,'failure',time);const claim=await watches.claimNext('fixture-worker',60_000,time);assert.ok(claim);await watches.fail(claim,time);
    let fail=true;const repo=repository(source.watchId,{onGenerationChange:async():Promise<void>=>{if(fail)throw new DataWatchError('INVALIDATION_FAILED');}});
    await assert.rejects(repo.lookupForService(companyId,scope,principalId),/INVALIDATION_FAILED/);assert.equal((await pool.query('SELECT generation FROM accel_research_scopes')).rows[0]?.generation,String(initial.generation));
    fail=false;const failed=await repo.lookupForService(companyId,scope,principalId);assert.equal(failed.state,'error');assert.equal(failed.observations.length,0);assert.ok(failed.generation>initial.generation);assert.equal(calls,0);
  });
});
