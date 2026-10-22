import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { AgentRunnerInput, BusinessEvaluation, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import type { ResearchContext, ResearchPort, ResearchScope } from '../../src/contracts/research.js';
import { createAgentRunner } from '../../src/agent/index.js';
import type { AgentOptions, ModelProvider, ModelRequest } from '../../src/agent/index.js';

const scope: ResearchScope={profileId:'soissons-project',profileVersion:'RP1',namespace:'controlled'};
const at='2026-10-22T10:00:01Z';
function input(id='RUN-RESEARCH'): AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    run:{id,companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:id,question:'Retrieve previous research for the authorized public profile.',status:'running',revision:'R0',policyVersion:'P1',mode:'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null,researchScope:{...scope}},memories:[]};
}
function context(version=0): ResearchContext {
  const scenario=JSON.parse(readFileSync(new URL('../../proposals/data/RESEARCH-MEMORY-CONTROLLED-SCENARIO.json',import.meta.url),'utf8')) as {sourceUrl:string;versions:Array<{content:string;publishedAt:string}>};
  const source=scenario.versions[version]!;const hash=createHash('sha256').update(source.content).digest('hex');
  const id=`keenable:${createHash('sha256').update(scenario.sourceUrl).digest('hex')}`;
  return {companyId:'CO-DEMO',scope:{...scope},generation:version+1,state:'reusable',checkedAt:'2026-10-22T10:00:00Z',validUntil:'2026-10-22T11:00:00Z',occurrenceId:`OCC-${version+1}`,conditions:['RELATION_UNVERIFIED'],reason:'Stored controlled research evidence',reused:true,externalCalls:0,
    observations:[{ref:{occurrenceId:`OCC-${version+1}`,evidenceId:id,contentHash:hash},qualification:'source_observation_only',testOnly:true,conditions:['CONTROLLED_TEST_ONLY'],
      evidence:{id,url:scenario.sourceUrl,title:'Controlled research evidence',content:source.content,contentHash:hash,publishedAt:source.publishedAt,collectedAt:'2026-10-22T09:00:00Z',mode:'test',dataOrigin:'public'}}]};
}
function call(id:string,name:string): unknown {return {type:'tool_calls',calls:[{id,name,arguments:{}}]};}
function provider(steps:Array<unknown | ((request:ModelRequest)=>unknown)>,observe?:(r:ModelRequest)=>void): ModelProvider {
  let turn=0;return {model:'research-scripted-test',version:'test/1',mode:'test',async complete(request):Promise<unknown>{observe?.(request);const step=steps[turn++];return typeof step==='function' ? (step as (r:ModelRequest)=>unknown)(request) : step;}};
}
function options(researchPort:ResearchPort,model:ModelProvider): AgentOptions {
  return {researchPort,provider:model,currentVersion:async()=>({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'}),now:()=>Date.parse(at)};
}
function storePort(current:()=>ResearchContext,refresh?:()=>Promise<ResearchContext>): ResearchPort {
  return {async lookup():Promise<ResearchContext>{return structuredClone(current());},async refresh():Promise<ResearchContext>{return refresh ? await refresh() : structuredClone(current());},async validate(deps):Promise<boolean>{return deps.every(d=>d.generation===current().generation && (d.validUntil===null || Date.parse(d.validUntil)>Date.parse(at)));}};
}
const done={type:'end',message:'Done'};

test('independent runner invocations retrieve the evidence through the port without previous answer in initial context',async()=>{
  const stored=context();let lookups=0;let refreshes=0;
  const port=storePort(()=>stored);const counted:ResearchPort={...port,async lookup(){lookups++;return await port.lookup();},async refresh(){refreshes++;return await port.refresh();}};
  for(const id of ['NEW-SESSION-1','NEW-SESSION-2']) {
    const first:string[]=[];
    const model=provider([call('lookup','read_research_context'),done],request=>{if(request.messages.length===0)first.push(JSON.stringify(request));});
    const result=await createAgentRunner(options(counted,model))(input(id));
    assert.equal(result.researchResult?.outcome,'available');assert.equal(result.researchResult.observations[0]!.ref.contentHash,stored.observations[0]!.ref.contentHash);
    assert.doesNotMatch(first.join(''),/industrial project is planned|Project timing only/);
    assert.equal(result.researchDependencies?.[0]!.generation,1);
    assert.match(result.message,/research evidence is available/);
  }
  assert.equal(lookups,2);assert.equal(refreshes,0);
});
test('changed evidence is retrieved under the same source identity in a later run and old in-flight dependencies abort',async()=>{
  let stored=context();const port=storePort(()=>stored);
  const first=await createAgentRunner(options(port,provider([call('read','read_research_context'),done])))(input('FIRST'));
  stored=context(1);
  const second=await createAgentRunner(options(port,provider([call('read','read_research_context'),done])))(input('SECOND'));
  assert.equal(first.researchResult!.observations[0]!.ref.evidenceId,second.researchResult!.observations[0]!.ref.evidenceId);
  assert.notEqual(first.researchResult!.observations[0]!.ref.contentHash,second.researchResult!.observations[0]!.ref.contentHash);
  stored=context();
  const model=provider([call('read','read_research_context'),()=>{stored=context(1);return done;}]);
  const stale=await createAgentRunner(options(port,model))(input('RACING'));
  assert.equal(stale.status,'stale_context');assert.equal(stale.proposal,null);
});
test('refresh requires an actual lookup and a new generation terminates the run without keeping earlier calculations',async()=>{
  let stored=context();stored.state='missing';stored.generation=0;stored.validUntil=null;stored.occurrenceId=null;stored.observations=[];
  let calls=0;const port=storePort(()=>stored,async()=>{calls++;stored=context(1);return {...stored,reused:false,externalCalls:1};});
  const result=await createAgentRunner(options(port,provider([call('early','refresh_research_context'),call('read','read_research_context'),call('refresh','refresh_research_context')])))(input());
  assert.equal(calls,1);assert.equal(result.status,'stale_context');assert.equal(result.proposal,null);
  assert.match(JSON.stringify(result.traces),/RESEARCH_LOOKUP_REQUIRED/);
});
test('same-generation refresh reuses current proof with zero external calls and uncertain refresh is terminal',async()=>{
  const stored=context();let refreshes=0;
  const same=storePort(()=>stored,async()=>{refreshes++;return structuredClone(stored);});
  const reused=await createAgentRunner(options(same,provider([call('read','read_research_context'),call('refresh','refresh_research_context'),done])))(input());
  assert.equal(reused.researchResult?.outcome,'available');assert.equal(refreshes,1);
  const uncertain=storePort(()=>stored,async()=>({...stored,generation:2,state:'uncertain',reused:false,externalCalls:1}));
  const result=await createAgentRunner(options(uncertain,provider([call('read','read_research_context'),call('refresh','refresh_research_context')])))(input());
  assert.equal(result.status,'uncertain');assert.equal(result.researchResult?.outcome,'uncertain');assert.equal(result.proposal,null);
});
test('research boundaries reject foreign scope, namespace, hash, dates, promoted facts and too many observations',async()=>{
  for(const mutate of [
    (c:ResearchContext):void=>{c.companyId='OTHER';},(c:ResearchContext):void=>{c.scope.profileVersion='WRONG';},
    (c:ResearchContext):void=>{c.scope.namespace='live';},(c:ResearchContext):void=>{c.observations[0]!.evidence.content+='tampered';},
    (c:ResearchContext):void=>{c.observations[0]!.testOnly=false;},(c:ResearchContext):void=>{c.observations[0]!.evidence.mode='direct';},
    (c:ResearchContext):void=>{c.checkedAt='2026-02-30T10:00:00Z';},(c:ResearchContext):void=>{c.checkedAt='2026-10-23T10:00:00Z';},
    (c:ResearchContext):void=>{c.observations[0]!.qualification='qualified_fact' as 'source_observation_only';},
    (c:ResearchContext):void=>{c.observations=Array.from({length:11},()=>structuredClone(c.observations[0]!));},
  ]) {
    const stored=context();mutate(stored);
    const result=await createAgentRunner(options(storePort(()=>stored),provider([call('read','read_research_context'),done])))(input());
    assert.notEqual(result.researchResult?.outcome,'available');assert.equal(result.proposal,null);
    assert.doesNotMatch(JSON.stringify(result.traces),/"companyId":"OTHER"|tampered|qualified_fact/);
  }
});
test('lookup is positively projected and a missing record does not appear as successfully reused research',async()=>{
  const stored=context();Object.assign(stored,{oracle:'HIDDEN_ORACLE'});Object.assign(stored.observations[0]!.evidence,{apiKey:'HIDDEN_KEY'});
  const result=await createAgentRunner(options(storePort(()=>stored),provider([call('read','read_research_context'),done])))(input());
  assert.equal(result.researchResult?.outcome,'available');assert.doesNotMatch(JSON.stringify(result),/HIDDEN_ORACLE|HIDDEN_KEY/);
  stored.state='missing';stored.generation=0;stored.validUntil=null;stored.occurrenceId=null;stored.observations=[];
  const missing=await createAgentRunner(options(storePort(()=>stored),provider([call('read','read_research_context'),done])))(input());
  assert.equal(missing.researchResult?.outcome,'needs_refresh');assert.deepEqual(missing.researchResult.observations,[]);
});
test('business proposals inherit research dependencies that the model cannot remove',async()=>{
  const stored=context();const model=provider([call('read','read_research_context'),{type:'tool_calls',calls:[{id:'eval',name:'evaluate_options',arguments:{targetOrderLineId:'OL-A'}}]},(request:ModelRequest):unknown=>{
    const evaluation=request.messages.findLast(m=>m.role==='tool'&&m.name==='evaluate_options')!.content as unknown as BusinessEvaluation;
    return {type:'tool_calls',calls:[{id:'prepare',name:'prepare_proposal',arguments:{evaluationId:evaluation.id,optionId:evaluation.options.find(o=>o.kind==='wait')!.id,title:'x',summary:'x'}}]};
  }]);
  const result=await createAgentRunner(options(storePort(()=>stored),model))(input());
  assert.equal(result.status,'proposal');assert.deepEqual(result.proposal!.researchDependencies,result.researchDependencies);
  assert.equal(result.proposal!.researchDependencies?.[0]!.evidenceRefs[0]!.contentHash,stored.observations[0]!.ref.contentHash);
});
test('an uncertain stored attempt is terminal and never admits an automatic refresh',async()=>{
  const stored=context();stored.state='uncertain';stored.validUntil=null;let refreshes=0;
  const port=storePort(()=>stored,async()=>{refreshes++;return stored;});
  const result=await createAgentRunner(options(port,provider([call('read','read_research_context'),call('refresh','refresh_research_context'),done])))(input());
  assert.equal(result.status,'uncertain');assert.equal(result.researchResult?.outcome,'uncertain');assert.equal(refreshes,0);
});
test('a refreshed source cannot replace dependencies under an unchanged generation',async()=>{
  const stored=context();const changed={...context(1),generation:stored.generation};
  const result=await createAgentRunner(options(storePort(()=>stored,async()=>changed),provider([call('read','read_research_context'),call('refresh','refresh_research_context'),done])))(input());
  assert.equal(result.status,'stale_context');assert.equal(result.proposal,null);
  assert.equal(result.researchDependencies?.[0]!.evidenceRefs[0]!.contentHash,stored.observations[0]!.ref.contentHash);
});
test('missing or expired research cannot drive a business calculation',async()=>{
  const stored=context();stored.state='stale';stored.validUntil='2026-10-22T09:30:00Z';
  const result=await createAgentRunner(options(storePort(()=>stored),provider([call('read','read_research_context'),{type:'tool_calls',calls:[{id:'eval',name:'evaluate_options',arguments:{targetOrderLineId:'OL-A'}}]},done])))(input());
  assert.equal(result.researchResult?.outcome,'needs_refresh');assert.equal(result.proposal,null);
  assert.match(JSON.stringify(result.traces),/RESEARCH_NEEDS_REFRESH/);
});
test('lookup and validation share the run budget and a lost refresh remains uncertain',async()=>{
  const stored=context();const hung=async():Promise<never>=>await new Promise(()=>{});
  const port=storePort(()=>stored);
  const lookup=await createAgentRunner({...options({...port,lookup:hung},provider([call('read','read_research_context')])),maxDurationMs:10})(input());
  assert.equal(lookup.status,'budget_exhausted');
  const source=input();source.run.researchDependencies=[{scope,generation:1,validUntil:stored.validUntil,evidenceRefs:stored.observations.map(o=>o.ref)}];
  const validate=await createAgentRunner({...options({...port,validate:hung},provider([])),maxDurationMs:10})(source);
  assert.equal(validate.status,'budget_exhausted');assert.equal(validate.model,null);
  let attempts=0;
  const lost=await createAgentRunner(options({...port,async refresh():Promise<ResearchContext>{attempts++;throw new Error('lost');}},provider([call('read','read_research_context'),call('refresh','refresh_research_context')])))(input());
  assert.equal(lost.status,'uncertain');assert.equal(attempts,1);assert.equal(lost.proposal,null);
});
test('freshness expiry is rechecked after the provider and changed versions are checked after a trace sink',async()=>{
  let stored=context();let now=Date.parse(at);stored.validUntil='2026-10-22T10:00:02Z';
  const expired=await createAgentRunner({...options(storePort(()=>stored),provider([call('read','read_research_context'),()=>{now+=2000;return done;}])),now:()=>now})(input());
  assert.equal(expired.status,'stale_context');assert.equal(expired.researchResult?.outcome,'needs_refresh');
  stored=context();
  const raced=await createAgentRunner({...options(storePort(()=>stored),provider([call('read','read_research_context'),done])),writeTrace:async t=>{if(t.tool==='read_research_context')stored=context(1);}})(input());
  assert.equal(raced.status,'stale_context');assert.equal(raced.proposal,null);
});
