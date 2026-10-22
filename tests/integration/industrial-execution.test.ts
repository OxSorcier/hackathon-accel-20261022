import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll,beforeAll,beforeEach,describe,test } from 'vitest';
import type { Actor } from '../../src/contracts/index.js';
import type { IndustrialSimulationInput } from '../../src/contracts/industrial-api.js';
import type { IndustrialApproval, IndustrialReport } from '../../src/contracts/industrial.js';
import { evaluateIndustrialPlan } from '../../src/domain/industrial.js';
import { createIndustrialDemoExecutor,readIndustrialExecutionState,type IndustrialDemoExecutorOptions } from '../../src/server/industrial-execution.js';
import { industrialHash } from '../../src/server/industrial-read.js';
import { AppError,PgStore } from '../../src/server/store.js';
import { industrialFixture } from '../domain/industrial-fixture.js';

const schema=`industrial_execution_${randomUUID().replaceAll('-','')}`;
let admin:Pool,pool:Pool,store:PgStore,created=false;
const actor:Actor={actorId:'EMP-PAUL',companyId:'CO-DEMO-INDUSTRIAL-CANDIDATE',role:'direction',approvalCeilingEur:2000};
const at='2026-10-22T10:00:00Z';
async function seeded(full=false):Promise<{approval:IndustrialApproval;input:IndustrialSimulationInput;fixture:ReturnType<typeof industrialFixture>;revalidate:IndustrialDemoExecutorOptions['revalidate']}> {
  const fixture=industrialFixture(full);await store.seed(fixture.snapshot);fixture.snapshot=await store.snapshot(actor.companyId);
  const assessment=evaluateIndustrialPlan(fixture),plan=assessment.plans[0]!;assert.equal(plan.status,'feasible');const runId=randomUUID(),reportId=randomUUID();
  await pool.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)',[runId,actor.companyId,'execution-fixture-run',actor,{id:runId,companyId:actor.companyId,status:'proposal'}]);
  const report:IndustrialReport={id:reportId,companyId:actor.companyId,runId,basis:plan.basis,status:'prepared',title:'Controlled calculated report',summary:'Synthetic fixtures, no real supplier action',assessment,recommendedPlanId:plan.id,createdAt:at};
  await pool.query('INSERT INTO accel_industrial_reports(id,company_id,run_id,payload) VALUES($1,$2,$3,$4)',[reportId,actor.companyId,runId,report]);
  const approval:IndustrialApproval={id:randomUUID(),companyId:actor.companyId,planId:plan.id,planVersion:plan.version,planHash:industrialHash(plan),basis:plan.basis,actorId:actor.actorId,decision:'approved',decidedAt:at};
  await pool.query('INSERT INTO accel_industrial_approvals(id,company_id,report_id,plan_id,operation_key,command_hash,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[approval.id,actor.companyId,reportId,plan.id,'approval-fixture-key',industrialHash(approval),approval]);
  await pool.query('INSERT INTO accel_industrial_context_versions(company_id,revision,payload,source_manifest_hash,actor_id,operation_key,command_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[actor.companyId,fixture.context.revision,fixture.context,'a'.repeat(64),'OPERATOR','context-fixture-key','b'.repeat(64)]);
  await pool.query('INSERT INTO accel_industrial_context_heads(company_id,revision) VALUES($1,$2)',[actor.companyId,fixture.context.revision]);
  const input:IndustrialSimulationInput={expectedBusinessRevision:fixture.snapshot.revision,expectedPlanVersion:plan.version,expectedPlanHash:approval.planHash,operationKey:'simulate-fixture-key'};
  const revalidate:IndustrialDemoExecutorOptions['revalidate']=async(client,receivedActor,receivedApprovalId):Promise<Awaited<ReturnType<IndustrialDemoExecutorOptions['revalidate']>>>=>{
    assert.equal(receivedActor.companyId,actor.companyId);assert.equal(receivedApprovalId,approval.id);
    const snapshot=await store.snapshot(actor.companyId,client,true),executionState=await readIndustrialExecutionState(client,actor.companyId,snapshot.revision);
    const fresh=evaluateIndustrialPlan({...fixture,snapshot,executionState}),currentPlan=fresh.plans.find(item=>item.id===plan.id);if(!currentPlan)throw new AppError('NO_CURRENT_PLAN','Current calculation no longer admits this plan.',409);
    return {snapshot,approval,plan:currentPlan,executionState,context:fixture.context};
  };
  return {approval,input,fixture,revalidate};
}
function executor(revalidate:IndustrialDemoExecutorOptions['revalidate'],selectedStore=store){return createIndustrialDemoExecutor({store:selectedStore,revalidate,now:():Date=>new Date(at)});}
async function count(table:string):Promise<number>{assert.ok(['accel_industrial_executions','accel_industrial_resource_ledger','accel_industrial_demo_records','business_events'].includes(table));return (await pool.query<{n:number}>(`SELECT count(*)::integer AS n FROM ${table}`)).rows[0]!.n;}
function hasCode(...codes:string[]):(error:unknown)=>boolean{return (error):boolean=>error instanceof AppError&&codes.includes(error.code);}

describe.skipIf(!process.env.TEST_DATABASE_URL)('Industrial simulated execution, isolated PostgreSQL schema',():void=>{
  beforeAll(async():Promise<void>=>{
    try{
      const connectionString=process.env.TEST_DATABASE_URL;assert.ok(connectionString);admin=new Pool({connectionString,max:1,connectionTimeoutMillis:10000});
      await admin.query(`CREATE SCHEMA ${schema}`);created=true;pool=new Pool({connectionString,max:8,connectionTimeoutMillis:10000,options:`-c search_path=${schema}`});store=new PgStore(pool);
      for(const path of ['migrations/001_core.sql','migrations/009_industrial.sql','proposals/data/industrial-analysis-schema.sql'])await pool.query(await readFile(new URL(`../../${path}`,import.meta.url),'utf8'));
      assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0]?.name,schema);
    }catch{throw new Error('INDUSTRIAL_EXECUTION_TEST_SETUP_FAILED');}
  },60000);
  beforeEach(async():Promise<void>=>{await pool.query('TRUNCATE companies CASCADE');},60000);
  afterAll(async():Promise<void>=>{if(pool)await pool.end();if(admin){try{if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);}catch{throw new Error('INDUSTRIAL_EXECUTION_TEST_CLEANUP_FAILED');}finally{await admin.end();}}},60000);

  test('one approved mixed plan persists future orders and a draft, with unchanged physical stock and native reservations',async():Promise<void>=>{
    const data=await seeded(),before=structuredClone(data.fixture.snapshot.dataset.tables),result=await executor(data.revalidate).execute(actor,data.approval.id,data.input);
    assert.equal(result.status,'applied');assert.equal(result.simulation,true);assert.notEqual(result.afterRevision,result.beforeRevision);
    const snapshot=await store.snapshot(actor.companyId);assert.deepEqual(snapshot.dataset.tables.inventory,before.inventory);assert.deepEqual(snapshot.dataset.tables.reservations,before.reservations);assert.deepEqual(snapshot.dataset.tables.inbound_allocations,before.inbound_allocations);assert.deepEqual(snapshot.dataset.tables.order_lines,before.order_lines);
    assert.equal(snapshot.dataset.tables.purchase_orders!.length,before.purchase_orders!.length+1);assert.equal(snapshot.dataset.tables.purchase_order_lines!.length,before.purchase_order_lines!.length+1);
    const state=await store.transaction(async client=>await readIndustrialExecutionState(client,actor.companyId,snapshot.revision));assert.equal(state.stockHolds[0]?.quantity,20);assert.equal(state.scheduledTransfers[0]?.status,'confirmed_scheduled');assert.equal(state.capacityUses.length,2);assert.equal(state.allocations.length,2);assert.equal(state.draftOffers[0]?.status,'draft');assert.equal(state.draftOffers[0]?.demandVersion,data.fixture.context.commercialDemand[0]?.provenance.version);
    assert.equal(state.allocations.find(item=>item.target.kind==='commitment')?.target.id,'OL-A');assert.ok(state.allocations.every(item=>item.target.id!=='OL-B'));
    const historical=(await pool.query('SELECT payload FROM accel_industrial_reports')).rows[0]?.payload as IndustrialReport;assert.equal(historical.status,'prepared');assert.equal(historical.basis.businessRevision,result.beforeRevision);assert.notEqual(historical.basis.businessRevision,snapshot.revision);assert.equal(await count('business_events'),1);
  },60000);
  test('same key replay precedes current revision checks and another key cannot apply the same approval twice',async():Promise<void>=>{
    const data=await seeded(),run=executor(data.revalidate),first=await run.execute(actor,data.approval.id,data.input);
    const replay=await run.execute(actor,data.approval.id,data.input),otherKey=await run.execute(actor,data.approval.id,{...data.input,operationKey:'another-simulation-key'});
    assert.deepEqual(replay,first);assert.deepEqual(otherKey,first);assert.equal(await count('accel_industrial_executions'),1);assert.equal(await count('business_events'),1);
    await assert.rejects(run.execute(actor,data.approval.id,{...data.input,expectedPlanHash:'a'.repeat(64)}),hasCode('OPERATION_CONFLICT'));
  },60000);
  test('concurrent same and different keys serialize one application',async():Promise<void>=>{
    const data=await seeded(),run=executor(data.revalidate),results=await Promise.all(Array.from({length:6},async(_,index)=>await run.execute(actor,data.approval.id,{...data.input,operationKey:index%2?'other-concurrent-key':data.input.operationKey})));
    assert.equal(new Set(results.map(item=>item.id)).size,1);assert.equal(await count('accel_industrial_executions'),1);assert.equal(await count('business_events'),1);
  },60000);
  test('roles, spending ceiling, stale revision, exact approval/hash and callback rejection cannot create effects',async():Promise<void>=>{
    const data=await seeded(),run=executor(data.revalidate);
    await assert.rejects(run.execute({...actor,role:'logistique'},data.approval.id,data.input),hasCode('FORBIDDEN'));
    await assert.rejects(run.execute({...actor,approvalCeilingEur:100},data.approval.id,data.input),hasCode('BUDGET'));
    await assert.rejects(run.execute(actor,data.approval.id,{...data.input,expectedBusinessRevision:'OLD'}),hasCode('STALE_CONTEXT'));
    await assert.rejects(run.execute(actor,data.approval.id,{...data.input,expectedPlanHash:'a'.repeat(64)}),hasCode('STALE_OR_INADMISSIBLE_PLAN'));
    await assert.rejects(executor(async()=>{throw new AppError('SOURCE_CHANGED','Source no longer current.',409);}).execute(actor,data.approval.id,data.input),hasCode('SOURCE_CHANGED'));
    assert.equal(await count('accel_industrial_executions'),0);assert.equal(await count('accel_industrial_resource_ledger'),0);assert.equal((await store.snapshot(actor.companyId)).revision,data.fixture.snapshot.revision);
  },60000);
  test('failures at every write boundary roll back receipt, ledger, documents and revision',async():Promise<void>=>{
    const data=await seeded();
    for(const table of ['accel_industrial_executions','accel_industrial_resource_ledger','accel_industrial_demo_records','business_events','companies']){
      await pool.query("CREATE OR REPLACE FUNCTION fail_execution_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'INJECTED_WRITE_FAILURE'; END $$");
      await pool.query(`CREATE TRIGGER fail_execution_write BEFORE ${table==='companies'?'UPDATE':'INSERT'} ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_execution_write()`);
      try{await assert.rejects(executor(data.revalidate).execute(actor,data.approval.id,data.input),hasCode('EXECUTION_FAILED','EXECUTION_UNAVAILABLE'));}finally{await pool.query(`DROP TRIGGER fail_execution_write ON ${table}`);}
      assert.equal(await count('accel_industrial_executions'),0);assert.equal(await count('accel_industrial_resource_ledger'),0);assert.equal(await count('accel_industrial_demo_records'),0);assert.equal((await store.snapshot(actor.companyId)).revision,data.fixture.snapshot.revision);
    }
  },60000);
  test('lost application ACK recovers its committed receipt without retrying the effect',async():Promise<void>=>{
    const data=await seeded();class LostAckStore extends PgStore{private first=true;override async transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{const result=await super.transaction(work);if(this.first){this.first=false;throw new Error('SIMULATED_ACK_LOSS');}return result;}}
    const result=await executor(data.revalidate,new LostAckStore(pool)).execute(actor,data.approval.id,data.input);assert.equal(result.status,'applied');assert.equal(await count('accel_industrial_executions'),1);assert.equal(await count('business_events'),1);
  },60000);
  test('unavailable ACK reconciliation returns uncertain until explicit same-key readback proves the committed result',async():Promise<void>=>{
    const data=await seeded();class UnavailableAckStore extends PgStore{private call=0;override async transaction<T>(work:(client:PoolClient)=>Promise<T>):Promise<T>{this.call++;if(this.call>1)throw new Error('SIMULATED_RECOVERY_UNAVAILABLE');await super.transaction(work);throw new Error('SIMULATED_ACK_LOSS');}}
    const unknown=await executor(data.revalidate,new UnavailableAckStore(pool)).execute(actor,data.approval.id,data.input);assert.equal(unknown.status,'uncertain');assert.equal(unknown.afterRevision,null);assert.deepEqual(unknown.records,[]);
    const proved=await executor(data.revalidate).execute(actor,data.approval.id,data.input);assert.equal(proved.status,'applied');assert.equal(await count('accel_industrial_executions'),1);
  },60000);
  test('restart retains old revision commitments, prevents second opportunity and rejects incoherent ledger envelopes',async():Promise<void>=>{
    const data=await seeded();await executor(data.revalidate).execute(actor,data.approval.id,data.input);
    const restarted=new PgStore(pool),snapshot=await restarted.snapshot(actor.companyId),executionState=await restarted.transaction(async client=>await readIndustrialExecutionState(client,actor.companyId,snapshot.revision));
    const result=evaluateIndustrialPlan({...data.fixture,snapshot,executionState,evaluatedAt:at,releasedEvent:{...data.fixture.releasedEvent,id:'RELEASE-REBASED-READBACK',revision:'RELEASE-REBASED-R2',businessRevision:snapshot.revision,releasedAt:at}});
    assert.deepEqual(result.constraints,['CRM_DEMAND_ALREADY_DRAFTED']);assert.equal(result.plans.length,0);
    await pool.query("UPDATE accel_industrial_resource_ledger SET payload=jsonb_set(payload,'{executionId}','\"OTHER\"') WHERE kind='stock_hold'");
    await assert.rejects(restarted.transaction(async client=>await readIndustrialExecutionState(client,actor.companyId,snapshot.revision)),hasCode('INVALID_INDUSTRIAL_LEDGER'));
  },60000);
  test('full10000 commitments preserve all13 native inbound allocations and9999 stock reservations',async():Promise<void>=>{
    const data=await seeded(true),before=structuredClone(data.fixture.snapshot.dataset.tables);assert.equal(before.inbound_allocations?.length,13);assert.equal(before.reservations?.length,9999);
    const result=await executor(data.revalidate).execute(actor,data.approval.id,data.input);assert.equal(result.status,'applied');const snapshot=await store.snapshot(actor.companyId);
    assert.equal(snapshot.dataset.tables.order_lines?.length,10000);assert.deepEqual(snapshot.dataset.tables.inbound_allocations,before.inbound_allocations);assert.deepEqual(snapshot.dataset.tables.reservations,before.reservations);assert.deepEqual(snapshot.dataset.tables.inventory,before.inventory);
    const ledger=await store.transaction(async client=>await readIndustrialExecutionState(client,actor.companyId,snapshot.revision));assert.equal(ledger.allocations.length,2);
  },120000);
});
