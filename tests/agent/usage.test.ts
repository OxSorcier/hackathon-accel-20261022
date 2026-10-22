import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AgentRunnerInput, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import { createAgentRunner } from '../../src/agent/index.js';
import type { ModelProvider } from '../../src/agent/index.js';

function input(): AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    run:{id:'USAGE-TEST',companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:'usage',question:'Préciser la donnée',status:'running',revision:'R0',policyVersion:'P1',mode:'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null},memories:[]};
}
const currentVersion=async()=>({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'});
function provider(raw: unknown): ModelProvider {return {model:'usage-test-only',version:'test/1',mode:'test',async complete():Promise<unknown>{return raw;}};}

test('reported token counters are preserved without provider extras, reasoning or an invented cost',async()=>{
  const result=await createAgentRunner({provider:provider({type:'needs_input',message:'Date nécessaire',usage:{inputTokens:20,outputTokens:5,totalTokens:25,cost:99,reasoning:'HIDDEN_REASONING'},providerSecret:'HIDDEN_PROVIDER'}),currentVersion})(input());
  assert.equal(result.status,'needs_input');
  const output=result.traces.find(t=>t.tool==='model_result')!.output;
  assert.deepEqual(output,{status:'needs_input',usage:{inputTokens:20,outputTokens:5,totalTokens:25}});
  assert.doesNotMatch(JSON.stringify(result.traces),/cost|HIDDEN_REASONING|HIDDEN_PROVIDER/);
});
test('absent token usage remains unknown, while invalid reported counters are refused',async()=>{
  const missing=await createAgentRunner({provider:provider({type:'needs_input',message:'Date nécessaire'}),currentVersion})(input());
  assert.deepEqual(missing.traces.find(t=>t.tool==='model_result')!.output,{status:'needs_input'});
  for(const invalid of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'20',undefined]) {
    const result=await createAgentRunner({provider:provider({type:'needs_input',message:'x',usage:{inputTokens:invalid,outputTokens:1,totalTokens:2}}),currentVersion})(input());
    assert.equal(result.status,'error');assert.equal(result.proposal,null);
  }
});
