import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { AgentRunnerInput, AttributedMemory, BusinessEvaluation, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import type { ResearchContext, ResearchDependency, ResearchPort, ResearchScope } from '../../src/contracts/research.js';
import { buildModelContext, createAgentRunner, recallMemories } from '../../src/agent/index.js';
import type { ModelProvider, ModelRequest } from '../../src/agent/index.js';

const scope:ResearchScope={profileId:'soissons-project',profileVersion:'v1',namespace:'controlled'};
const now=()=>Date.parse('2026-10-22T11:00:00Z');
function input(researchScope?:ResearchScope):AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},run:{id:'R-MEMORY',companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:'memory-provenance',question:'Read attributed prior decision advice.',status:'running',revision:'R0',policyVersion:'P1',mode:researchScope?.namespace==='live'?'direct':'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null,...(researchScope?{researchScope}: {})},memories:[]};
}
function context(researchScope=scope):ResearchContext {
  const content='CONTROLLED TEST SOURCE. No company relationship is established.';
  const contentHash=createHash('sha256').update(content).digest('hex');
  return {companyId:'CO-DEMO',scope:{...researchScope},generation:1,state:'reusable',checkedAt:'2026-10-22T10:00:00Z',validUntil:'2099-12-01T00:00:00Z',occurrenceId:'O-1',conditions:[],reason:'Attributed source observation only',reused:true,externalCalls:0,observations:[{ref:{occurrenceId:'O-1',evidenceId:'E-1',contentHash},evidence:{id:'E-1',url:'https://example.org/controlled',title:'Controlled test only',content,contentHash,publishedAt:null,collectedAt:'2026-10-22T10:00:00Z',mode:researchScope.namespace==='controlled'?'test':'direct',dataOrigin:'public'},qualification:'source_observation_only',testOnly:researchScope.namespace==='controlled',conditions:[]}]};
}
function dependency():ResearchDependency { const current=context();return {scope:{...scope},generation:1,validUntil:'2099-11-01T00:00:00Z',evidenceRefs:current.observations.map(value=>value.ref)}; }
function memory():AttributedMemory {return {id:'M-CONTROLLED',companyId:'CO-DEMO',actorId:'EMP-PAUL',proposalId:'P-CONTROLLED',revision:'R0',policyVersion:'P1',content:'approve: CONTROLLED_ADVICE_SENTINEL',conditions:['Advice only'],createdAt:'2026-10-22T10:00:00Z',researchDependencies:[dependency()],testOnly:true};}
function call(id:string,name:string,args:Record<string,string>={}):unknown {return {type:'tool_calls',calls:[{id,name,arguments:args}]};}
function provider(steps:(unknown|((request:ModelRequest)=>unknown))[],mode:'test'|'direct'='test'):ModelProvider {let turn=0;return {model:'memory-provenance-protocol',version:'test/1',mode,async complete(request):Promise<unknown>{const next=steps[turn++];return typeof next==='function'?(next as (r:ModelRequest)=>unknown)(request):next;}};}
function port(researchScope=scope,valid:(deps:ResearchDependency[])=>boolean=()=>true):ResearchPort {return {async lookup(){return context(researchScope);},async refresh(){throw new Error('NO_REFRESH');},async validate(deps){return valid(deps);}};}
const currentVersion=async()=>({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'});

test('controlled research advice without a case never enters a free question or a live research recall',async()=>{
  for(const researchScope of [undefined,{...scope,namespace:'live' as const}]) {
    const source=input(researchScope);source.memories=[memory()];let recall:unknown;
    const result=await createAgentRunner({now,currentVersion,researchPort:port(researchScope),provider:provider([call('recall','recall_decisions'),(request:ModelRequest):unknown=>{recall=request.messages.find(value=>value.name==='recall_decisions'&&value.role==='tool')?.content;return {type:'end',message:'Done'};}],source.run.mode==='direct'?'direct':'test')})(source);
    assert.equal(result.proposal,null);assert.doesNotMatch(JSON.stringify(recall),/CONTROLLED_ADVICE_SENTINEL/);
    assert.deepEqual(buildModelContext(source).manifest.memoryIds,[]);
  }
});
test('controlled advice needs actual research lookup and current port validation before release',async()=>{
  for(const readFirst of [false,true]) {
    const source=input(scope);source.memories=[memory()];let recall:unknown;let memoryChecks=0;
    const steps=[...(readFirst?[call('read','read_research_context')]:[]),call('recall','recall_decisions'),(request:ModelRequest):unknown=>{recall=request.messages.find(value=>value.name==='recall_decisions'&&value.role==='tool')?.content;return {type:'end',message:'Done'};}];
    await createAgentRunner({now,currentVersion,researchPort:port(scope,deps=>{if(deps[0]?.validUntil==='2099-11-01T00:00:00Z')memoryChecks++;return true;}),provider:provider(steps)})(source);
    if(readFirst) {assert.match(JSON.stringify(recall),/CONTROLLED_ADVICE_SENTINEL/);assert.match(JSON.stringify(recall),/researchDependencies/);assert.ok(memoryChecks>0);}
    else {assert.doesNotMatch(JSON.stringify(recall),/CONTROLLED_ADVICE_SENTINEL/);assert.equal(memoryChecks,0);}
    assert.deepEqual(buildModelContext(source).manifest.memoryIds,[]);
  }
});
test('stale, malformed or mismatched research provenance is excluded while legacy free-question advice remains usable',()=>{
  const source=input(scope);
  for(const mutate of [
    (m:AttributedMemory):void=>{delete m.researchDependencies;},
    (m:AttributedMemory):void=>{delete m.testOnly;},
    (m:AttributedMemory):void=>{m.testOnly=false;},
    (m:AttributedMemory):void=>{m.researchDependencies=[];},
    (m:AttributedMemory):void=>{m.researchDependencies![0]!.scope.profileVersion='old';},
    (m:AttributedMemory):void=>{m.researchDependencies![0]!.validUntil=null;},
    (m:AttributedMemory):void=>{m.researchDependencies![0]!.validUntil='2026-10-22T10:59:59Z';},
    (m:AttributedMemory):void=>{m.researchDependencies![0]!.evidenceRefs=[];},
  ]) {const candidate=memory();mutate(candidate);assert.equal(recallMemories([candidate],source.snapshot,new Date(now()).toISOString(),undefined,scope).accepted.length,0);}
  const legacy=memory();delete legacy.testOnly;delete legacy.researchDependencies;
  assert.equal(recallMemories([legacy],source.snapshot,new Date(now()).toISOString()).accepted.length,1);
});
test('a version rejected by the port or an unavailable memory validator releases no old advice',async()=>{
  for(const unavailable of [false,true]) {
    const source=input(scope);source.memories=[memory()];let recall:unknown;
    const researchPort=port(scope,deps=>{if(deps[0]?.validUntil==='2099-11-01T00:00:00Z'){if(unavailable)throw new Error('VALIDATOR_UNAVAILABLE');return false;}return true;});
    await createAgentRunner({now,currentVersion,researchPort,provider:provider([call('read','read_research_context'),call('recall','recall_decisions'),(request:ModelRequest):unknown=>{recall=request.messages.find(value=>value.name==='recall_decisions'&&value.role==='tool')?.content;return {type:'end',message:'Done'};}])})(source);
    assert.doesNotMatch(JSON.stringify(recall),/CONTROLLED_ADVICE_SENTINEL/);
  }
});
test('an actual controlled agent proposal without a case carries provenance that a later free question excludes',async()=>{
  const source=input(scope);
  const result=await createAgentRunner({now,currentVersion,researchPort:port(),provider:provider([call('read','read_research_context'),call('evaluate','evaluate_options',{targetOrderLineId:'OL-A'}),(request:ModelRequest):unknown=>{const evaluation=request.messages.findLast(value=>value.name==='evaluate_options'&&value.role==='tool')!.content as unknown as BusinessEvaluation;return call('prepare','prepare_proposal',{evaluationId:evaluation.id,optionId:evaluation.options.find(value=>value.kind==='wait')!.id,title:'Attributed option',summary:'Review before deciding.'});}])})(source);
  assert.equal(result.status,'proposal');assert.equal(result.proposal?.caseRef,undefined);assert.deepEqual(result.proposal?.researchDependencies?.[0]?.scope,scope);
  // Server attribution shape, not a simulated database decision. Integrated decide is owned by the integrator.
  const attributed={...memory(),proposalId:result.proposal!.id,researchDependencies:result.proposal!.researchDependencies};
  assert.equal(recallMemories([attributed],source.snapshot,new Date(now()).toISOString()).accepted.length,0);
});
