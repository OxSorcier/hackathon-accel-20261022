import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AgentRunnerInput, AttributedMemory, BusinessEvaluation, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import { createAgentRunner, buildModelContext, recallMemories } from '../../src/agent/index.js';
import type { ModelProvider, ModelRequest } from '../../src/agent/index.js';

function input(): AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},
    snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    run:{id:'RUN-1',companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:'question-1',question:'Comment couvrir A ?',status:'running',revision:'R0',policyVersion:'P1',mode:'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null},memories:[]};
}
function provider(steps: unknown[]): ModelProvider {
  let index=0;
  return {model:'scripted-test-provider',version:'test/1',mode:'test',async complete(request: ModelRequest,_signal: AbortSignal): Promise<unknown> {
    const step=steps[index++]; return typeof step==='function' ? (step as (request: ModelRequest)=>unknown)(request) : step;
  }};
}
const current=async () => ({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'});
test('no provider produces no simulated inference or proposal',async()=>{
  const result=await createAgentRunner()(input());
  assert.equal(result.status,'needs_input'); assert.equal(result.proposal,null); assert.equal(result.model,null);
});
test('model reads, evaluates then prepares a versioned non-executing proposal',async()=>{
  const model=provider([
    {type:'tool_calls',calls:[{id:'c1',name:'read_commitments',arguments:{}}]},
    {type:'tool_calls',calls:[{id:'c2',name:'evaluate_options',arguments:{targetOrderLineId:'OL-A'}}]},
    (request: ModelRequest): unknown => {
      const evaluation=request.messages.findLast(m=>m.role==='tool' && m.name==='evaluate_options')!.content as unknown as BusinessEvaluation;
      return {type:'tool_calls',calls:[{id:'c3',name:'prepare_proposal',arguments:{evaluationId:evaluation.id,optionId:evaluation.options.find(o=>o.kind==='wait')!.id,title:'Couvrir A',summary:'Conserver les ressources confirmées.'}}]};
    },
  ]);
  const source=input(); const before=structuredClone(source.snapshot);
  const result=await createAgentRunner({provider:model,currentVersion:current})(source);
  assert.equal(result.status,'proposal'); assert.equal(result.proposal?.revision,'R0');
  assert.equal(result.proposal?.status,'pending'); assert.equal(result.traces.filter(t=>t.tool==='read_commitments').length,1);
  assert.deepEqual(source.snapshot,before);
});
test('forged evaluation references and unknown fields never create a proposal',async()=>{
  const result=await createAgentRunner({provider:provider([
    {type:'tool_calls',calls:[{id:'c1',name:'prepare_proposal',arguments:{evaluationId:'invented',optionId:'keep',title:'x',summary:'x'}}]},
    {type:'tool_calls',calls:[{id:'c2',name:'read_commitments',arguments:{companyId:'OTHER'}}]},
    {type:'needs_input',message:'Préciser la demande'},
  ]),currentVersion:current})(input());
  assert.equal(result.proposal,null); assert.equal(result.status,'needs_input');
  assert.match(JSON.stringify(result.traces),/UNKNOWN_EVALUATION/);
  assert.match(JSON.stringify(result.traces),/UNKNOWN_ARGUMENT/);
});
test('revision change before prepare aborts publication',async()=>{
  let calls=0;
  const result=await createAgentRunner({provider:provider([
    {type:'tool_calls',calls:[{id:'c1',name:'evaluate_options',arguments:{targetOrderLineId:'OL-A'}}]},
    {type:'tool_calls',calls:[{id:'c2',name:'prepare_proposal',arguments:{evaluationId:'evaluation:CO-DEMO:R0:P1:OL-A',optionId:'keep',title:'x',summary:'x'}}]},
  ]),currentVersion:async()=>({companyId:'CO-DEMO',revision:++calls>=3?'R1':'R0',policyVersion:'P1'})})(input());
  assert.equal(result.status,'stale_context'); assert.equal(result.proposal,null);
});
test('tool and turn budgets stop a model loop; truncated responses are errors',async()=>{
  const result=await createAgentRunner({provider:provider([{type:'tool_calls',calls:[{id:'c1',name:'read_commitments',arguments:{}},{id:'c2',name:'read_commitments',arguments:{}}]}]),currentVersion:current,maxToolCalls:1})(input());
  assert.equal(result.status,'budget_exhausted'); assert.equal(result.proposal,null);
  const truncated=await createAgentRunner({provider:provider([{type:'truncated'}]),currentVersion:current})(input());
  assert.equal(truncated.status,'error');
});
test('timeout is uncertain and does not retry a provider call',async()=>{
  let calls=0;
  const model: ModelProvider={model:'hung-test',version:'test/1',mode:'test',async complete(): Promise<unknown> {calls++;return await new Promise(()=>{});}};
  const result=await createAgentRunner({provider:model,currentVersion:current,maxDurationMs:10})(input());
  assert.equal(result.status,'uncertain'); assert.equal(calls,1);
});
test('server version reads and trace sinks share the total time budget',async()=>{
  const model=provider([{type:'needs_input',message:'x'}]);
  const hung=async (): Promise<never> => await new Promise(()=>{});
  const version=await createAgentRunner({provider:model,currentVersion:hung,maxDurationMs:10})(input());
  assert.equal(version.status,'budget_exhausted');
  const sink=await createAgentRunner({provider:model,currentVersion:current,writeTrace:hung,maxDurationMs:10})(input());
  assert.equal(sink.status,'budget_exhausted');
});
test('provider uncertainty survives terminal trace errors or an exhausted sink budget',async()=>{
  const model: ModelProvider={model:'hung-test',version:'test/1',mode:'test',async complete(): Promise<unknown> {return await new Promise(()=>{});}};
  const result=await createAgentRunner({provider:model,currentVersion:current,writeTrace:async()=>{},maxDurationMs:10})(input());
  assert.equal(result.status,'uncertain');
  assert.equal(result.traces.at(-1)!.output && (result.traces.at(-1)!.output as {status:string}).status,'uncertain');
});
test('a decision after snapshot modification remains valid advice at a later reading time',()=>{
  const source=input();
  const memory: AttributedMemory={id:'M-new',companyId:'CO-DEMO',actorId:'EMP-PAUL',proposalId:'P1',revision:'R0',policyVersion:'P1',content:'Choix attribué',conditions:[],createdAt:'2026-10-22T08:00:00Z'};
  assert.deepEqual(recallMemories([memory],source.snapshot).accepted.map(m=>m.id),['M-new']);
});
test('a batch preserves all assistant calls before its correlated tool results',async()=>{
  let turn=0; let observed: string[][]=[];
  const model: ModelProvider={model:'batch-test',version:'test/1',mode:'test',async complete(request): Promise<unknown> {
    if(turn++===0) return {type:'tool_calls',calls:[{id:'c1',name:'read_commitments',arguments:{}},{id:'c2',name:'read_company_context',arguments:{}}]};
    observed=request.messages.map(m=>[m.role,m.callId]);
    return {type:'needs_input',message:'Préciser la demande'};
  }};
  const result=await createAgentRunner({provider:model,currentVersion:current})(input());
  assert.equal(result.status,'needs_input');
  assert.deepEqual(observed,[['assistant','c1'],['assistant','c2'],['tool','c1'],['tool','c2']]);
});
test('context whitelist drops construction fields, personnel and stale or foreign memories',()=>{
  const source=input();
  source.snapshot.dataset.tables.oracle=[{future:'SECRET_FUTURE'}];
  const memory: AttributedMemory={id:'M1',companyId:'CO-DEMO',actorId:'EMP-PAUL',proposalId:'P0',revision:'R0',policyVersion:'P1',content:'Préférer le transfert après confirmation',conditions:['confirmation'],createdAt:'2026-10-22T06:00:00Z'};
  source.memories=[memory,{...memory,id:'M2',companyId:'OTHER'},{...memory,id:'M3',revision:'OLD'}];
  const recalled=recallMemories(source.memories,source.snapshot);
  assert.deepEqual(recalled.accepted.map(m=>m.id),['M1']);
  assert.equal(recalled.excluded.length,2);
  const context=buildModelContext(source);
  const json=JSON.stringify(context);
  assert.doesNotMatch(json,/SECRET_FUTURE|paul@|Claire|\.preparation|approvalCeiling/);
  assert.deepEqual(context.manifest.memoryIds,['M1']);
});
