import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AgentRunnerInput, BusinessEvaluation, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import { createAgentRunner } from '../../src/agent/index.js';
import type { ModelProvider, ModelRequest } from '../../src/agent/index.js';

function input(): AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},
    snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    run:{id:'RUN-LANGUAGE',companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:'language-test',question:'Que faut-il faire ?',status:'running',revision:'R0',policyVersion:'P1',mode:'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null},memories:[]};
}
const currentVersion=async()=>({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'});

test('a free provider final message never becomes product copy',async()=>{
  const provider: ModelProvider={model:'language-test',version:'test/1',mode:'test',async complete():Promise<unknown>{return {type:'needs_input',message:'Veuillez préciser le fournisseur. FREE_FINAL_TEXT'};}};
  const result=await createAgentRunner({provider,currentVersion})(input());
  assert.equal(result.status,'needs_input');assert.match(result.message,/More information is needed/);
  assert.doesNotMatch(JSON.stringify(result),/Veuillez|FREE_FINAL_TEXT/);
});
test('a plain-question proposal uses English calculated copy and excludes free provider prose from returned traces',async()=>{
  let turn=0;
  const provider: ModelProvider={model:'language-test',version:'test/1',mode:'test',async complete(request:ModelRequest):Promise<unknown>{
    if(turn++===0)return {type:'tool_calls',calls:[{id:'eval',name:'evaluate_options',arguments:{targetOrderLineId:'OL-A'}}]};
    const evaluation=request.messages.findLast(message=>message.role==='tool' && message.name==='evaluate_options')!.content as unknown as BusinessEvaluation;
    return {type:'tool_calls',calls:[{id:'prepare',name:'prepare_proposal',arguments:{evaluationId:evaluation.id,optionId:evaluation.options.find(option=>option.kind==='wait')!.id,title:'Titre français FREE_TITLE',summary:'Résumé français FREE_SUMMARY'}}]};
  }};
  const result=await createAgentRunner({provider,currentVersion})(input());
  assert.equal(result.status,'proposal');assert.equal(result.proposal!.title,'Keep current coverage');
  assert.match(result.proposal!.summary,/current business coverage/);
  assert.doesNotMatch(JSON.stringify(result),/FREE_TITLE|FREE_SUMMARY/);
});
