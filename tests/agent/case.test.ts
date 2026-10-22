import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AgentRunnerInput, AttributedMemory, BusinessEvaluation, CaseRef, CompanyDataset, CompanyPolicy } from '../../src/contracts/index.js';
import { buildModelContext, createAgentRunner, recallMemories } from '../../src/agent/index.js';
import type { AgentOptions, ModelProvider, ModelRequest } from '../../src/agent/index.js';
import type { ResearchScope } from '../../src/contracts/research.js';

const caseRef: CaseRef={caseId:'CASE-1',caseRevision:'CR-1'};
const researchScope: ResearchScope={profileId:'sector-profile',profileVersion:'RP1',namespace:'controlled'};
const current=async () => ({companyId:'CO-DEMO',revision:'R0',policyVersion:'P1'});
function input(): AgentRunnerInput {
  const dataset=JSON.parse(readFileSync(new URL('../../fixtures/company/dataset.json',import.meta.url),'utf8')) as CompanyDataset;
  const policy=JSON.parse(readFileSync(new URL('../../fixtures/company/company-policy.json',import.meta.url),'utf8')) as CompanyPolicy;
  const content='Information publique reçue. Aucune confirmation sur les fournisseurs fictifs.';
  const hash=createHash('sha256').update(content).digest('hex');
  return {actor:{actorId:'EMP-PAUL',companyId:'CO-DEMO',role:'direction',approvalCeilingEur:2000},
    snapshot:{companyId:'CO-DEMO',revision:'R0',policyVersion:'P1',dataOrigin:'synthetic',dataset,policy,updatedAt:dataset.as_of},
    run:{id:'RUN-CASE',companyId:'CO-DEMO',actorId:'EMP-PAUL',operationKey:'case-question',question:'Que faut-il vérifier ?',status:'running',revision:'R0',policyVersion:'P1',mode:'test',model:null,proposalId:null,message:null,traces:[],createdAt:dataset.as_of,completedAt:null,caseRef:{...caseRef},researchScope},
    memories:[],caseContext:{ref:{...caseRef},evidenceRef:{occurrenceId:'OCC-1',evidenceId:'EVIDENCE-1',contentHash:hash},
      observation:{id:'EVIDENCE-1',url:'https://public.example/article',title:'Source publique',content,contentHash:hash,publishedAt:null,collectedAt:'2026-10-22T06:00:00Z',dataOrigin:'public',mode:'test'},
      relation:{status:'unverified',productId:'SKU-ISO100',supplierId:'SUP-1',basis:'Hypothèse déclarée par la société, à vérifier.'},
      candidateOrderLineIds:['OL-A'],businessRevision:'R0',policyVersion:'P1',qualification:'to_verify',impactKind:'undetermined',testOnly:true,
      researchDependency:{scope:researchScope,generation:1,validUntil:'2099-01-01T00:00:00Z',evidenceRefs:[{occurrenceId:'OCC-1',evidenceId:'EVIDENCE-1',contentHash:hash}]}}};
}
function scripted(steps: Array<unknown | ((request: ModelRequest)=>unknown)>, observe?: (request: ModelRequest)=>void): ModelProvider {
  let index=0;
  return {model:'case-scripted-test',version:'test/1',mode:'test',async complete(request: ModelRequest): Promise<unknown> {
    observe?.(request);if(index===0){index++;return call('initial-research','read_research_context');} const value=steps[index++-1];
    return typeof value==='function' ? (value as (request:ModelRequest)=>unknown)(request) : value;
  }};
}
function call(id: string,name: string,args: Record<string,string>={}): unknown {return {type:'tool_calls',calls:[{id,name,arguments:args}]};}
function proposal(request: ModelRequest): unknown {
  const evaluation=request.messages.findLast(m=>m.role==='tool' && m.name==='evaluate_options' && !m.isError)!.content as unknown as BusinessEvaluation;
  return call('prepare','prepare_proposal',{evaluationId:evaluation.id,optionId:evaluation.options.find(o=>o.kind==='wait')!.id,title:'Le fournisseur est confirmé en retard',summary:'Texte de test sans autorité.'});
}
function options(provider: ModelProvider): AgentOptions {
  const source=input();const c=source.caseContext!;
  return {provider,currentVersion:current,currentCaseRef:async()=>({...caseRef}),researchPort:{async lookup(){return {companyId:'CO-DEMO',scope:researchScope,generation:1,state:'reusable',checkedAt:'2026-10-22T06:30:00Z',validUntil:'2099-01-01T00:00:00Z',occurrenceId:c.evidenceRef.occurrenceId,observations:[{ref:c.evidenceRef,evidence:c.observation,qualification:'source_observation_only',testOnly:true,conditions:['CONTROLLED_TEST_ONLY']}],conditions:['CONTROLLED_TEST_ONLY'],reason:'Controlled test evidence',reused:true,externalCalls:0};},async refresh(){throw new Error('Not used');},async validate(deps){return deps.every(d=>d.generation===1);}}};
}

test('case model reads released observation and prepares a conditional current-coverage proposal',async()=>{
  const source=input(); const before=structuredClone(source);
  const result=await createAgentRunner(options(scripted([call('read','read_observation_context'),call('eval','evaluate_options',{targetOrderLineId:'OL-A'}),proposal])))(source);
  assert.equal(result.status,'proposal'); assert.deepEqual(result.proposal?.caseRef,caseRef);
  assert.ok(result.proposal!.conditions.includes('RELATION_UNVERIFIED'));
  const option=result.proposal!.evaluation.options.find(o=>o.id===result.proposal!.optionId)!;
  assert.equal(option.status,'conditional');
  assert.equal((result.proposal!.evaluation.facts.coverage as Array<{shortage:number}>)[0]!.shortage,0);
  assert.equal((result.proposal!.evaluation.facts.relationCondition as {code:string}).code,'RELATION_UNVERIFIED');
  assert.deepEqual(source,before);
  assert.ok(result.traces.some(t=>t.tool==='read_observation_context'));
});
test('absent relation or candidates returns needs_input without a provider call or causal proposal',async()=>{
  for(const none of [false,true]) {
    const source=input(); source.caseContext!.candidateOrderLineIds=[];
    if(none) {source.caseContext!.relation={status:'none',productId:null,supplierId:null,basis:'Aucun lien établi'};source.caseContext!.qualification='no_known_exposure';}
    let calls=0;
    const result=await createAgentRunner(options(scripted([],()=>{calls++;})))(source);
    assert.equal(result.status,'needs_input'); assert.equal(result.proposal,null);assert.equal(result.model,null);assert.equal(calls,0);
  }
});
test('case run requires currentCaseRef and matching received context before any inference',async()=>{
  let calls=0; const model=scripted([],()=>{calls++;});
  const missing=await createAgentRunner({provider:model,currentVersion:current})(input());
  assert.equal(missing.status,'needs_input');assert.equal(calls,0);
  for(const mutate of [
    (s: AgentRunnerInput): void=>{s.caseContext!.ref.caseRevision='OLD';},
    (s: AgentRunnerInput): void=>{s.caseContext!.businessRevision='OLD';},
    (s: AgentRunnerInput): void=>{s.caseContext!.policyVersion='OLD';},
    (s: AgentRunnerInput): void=>{delete s.caseContext;},
    (s: AgentRunnerInput): void=>{s.run.companyId='OTHER';},
  ]) {
    const source=input();mutate(source);
    const result=await createAgentRunner(options(model))(source);
    assert.notEqual(result.status,'proposal');assert.equal(calls,0);
  }
});
test('controlled case evidence needs explicit test flags, matching scope and exact dependency even with a direct model run',()=>{
  const source=input();source.run.mode='direct';
  assert.deepEqual(buildModelContext(source).manifest.researchScope,researchScope);
  for(const change of [
    (s:AgentRunnerInput):void=>{delete s.caseContext!.testOnly;},
    (s:AgentRunnerInput):void=>{delete s.run.researchScope;},
    (s:AgentRunnerInput):void=>{delete s.caseContext!.researchDependency;},
    (s:AgentRunnerInput):void=>{s.run.researchScope!.namespace='live';},
    (s:AgentRunnerInput):void=>{s.caseContext!.researchDependency!.scope={...researchScope,profileVersion:'FOREIGN'};},
    (s:AgentRunnerInput):void=>{s.caseContext!.researchDependency!.evidenceRefs[0]!.occurrenceId='OTHER';},
    (s:AgentRunnerInput):void=>{s.caseContext!.observation.mode='direct';},
  ]) {const candidate=structuredClone(source);change(candidate);assert.throws(()=>buildModelContext(candidate));}
});
test('public evidence hash, relation status, candidate identities and provenance are validated positively',()=>{
  for(const mutate of [
    (s:AgentRunnerInput):void=>{s.caseContext!.observation.content='changed without updated hash';},
    (s:AgentRunnerInput):void=>{s.caseContext!.evidenceRef.evidenceId='FOREIGN';},
    (s:AgentRunnerInput):void=>{s.caseContext!.relation.status='verified' as 'unverified';},
    (s:AgentRunnerInput):void=>{s.caseContext!.relation.supplierId='FOREIGN';},
    (s:AgentRunnerInput):void=>{s.caseContext!.candidateOrderLineIds=['OL-NOT-FOUND'];},
    (s:AgentRunnerInput):void=>{s.caseContext!.candidateOrderLineIds=['OL-A','OL-A'];},
    (s:AgentRunnerInput):void=>{s.caseContext!.relation.productId='SKU-ISO120';},
    (s:AgentRunnerInput):void=>{s.caseContext!.observation.url='file:///etc/passwd';},
    (s:AgentRunnerInput):void=>{s.caseContext!.impactKind='risk';},
    (s:AgentRunnerInput):void=>{s.caseContext!.riskAssumption={kind:'inbound_delay',purchaseOrderLineId:'POL-1',assumedExpectedDate:'2026-10-28',basis:'Declared assumption'};},
  ]) {
    const source=input();mutate(source);assert.throws(()=>buildModelContext(source));
  }
});
test('model cannot evaluate outside candidates or before reading the actual evidence',async()=>{
  const result=await createAgentRunner(options(scripted([
    call('early','evaluate_options',{targetOrderLineId:'OL-A'}),
    call('read','read_observation_context'),call('wrong','evaluate_options',{targetOrderLineId:'OL-B'}),
    {type:'needs_input',message:'Préciser le lien'},
  ])))(input());
  assert.equal(result.status,'needs_input');assert.equal(result.proposal,null);
  assert.match(JSON.stringify(result.traces),/OBSERVATION_NOT_READ/);assert.match(JSON.stringify(result.traces),/TARGET_NOT_IN_CASE/);
});
test('source-only case changes stop before provider, after provider, after tools and after proposal preparation',async()=>{
  for(const phase of ['intent','provider','tool','prepare'] as const) {
    let ref={...caseRef};
    const model=scripted([call('read','read_observation_context'),call('eval','evaluate_options',{targetOrderLineId:'OL-A'}),proposal],()=>{if(phase==='provider')ref={...caseRef,caseRevision:'CR-2'};});
    const result=await createAgentRunner({...options(model),currentCaseRef:async()=>({...ref}),writeTrace:async t=>{
      if((phase==='intent' && t.tool==='model_intent') || (phase==='tool' && t.tool==='evaluate_options') || (phase==='prepare' && t.tool==='prepare_proposal'))ref={...caseRef,caseRevision:'CR-2'};
    }})(input());
    assert.equal(result.status,'stale_context');assert.equal(result.proposal,null);
    if(phase==='intent')assert.equal(result.model,null);
  }
});
test('case callback shares the run budget and a lost response remains uncertain if the case changes',async()=>{
  const hung: ModelProvider={model:'hung-test',version:'test/1',mode:'test',async complete():Promise<unknown>{return await new Promise(()=>{});}};
  const blocked=await createAgentRunner({...options(hung),currentCaseRef:async()=>await new Promise(()=>{}),maxDurationMs:10})(input());
  assert.equal(blocked.status,'budget_exhausted');
  let ref={...caseRef};let calls=0;
  const failed: ModelProvider={model:'failed-test',version:'test/1',mode:'test',async complete():Promise<unknown>{calls++;ref={...caseRef,caseRevision:'CR-2'};throw new Error('lost response');}};
  const uncertain=await createAgentRunner({...options(failed),currentCaseRef:async()=>ref})(input());
  assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.proposal,null);assert.equal(calls,1);
});
test('case memories require the exact case reference and never flow to a question without a case',()=>{
  const source=input();const memory:AttributedMemory={id:'M-case',companyId:'CO-DEMO',actorId:'EMP-PAUL',proposalId:'P1',revision:'R0',policyVersion:'P1',content:'Conseil attribué',conditions:[],createdAt:'2026-10-22T05:00:00Z',caseRef:{...caseRef}};
  source.memories=[memory,{...memory,id:'M-old',caseRef:{...caseRef,caseRevision:'OLD'}},{...memory,id:'M-question',caseRef:undefined} as unknown as AttributedMemory];
  const context=buildModelContext(source);assert.deepEqual(context.manifest.memoryIds,[]);
  assert.deepEqual(recallMemories([memory],source.snapshot).accepted,[]);
});
test('whitelist keeps unknown construction fields out of the evidence tool and records real provenance',async()=>{
  const source=input();
  Object.assign(source.caseContext!,{oracle:'HIDDEN_ORACLE'});
  Object.assign(source.caseContext!.observation,{apiKey:'HIDDEN_KEY',futureEvents:'HIDDEN_FUTURE'});
  source.caseContext!.observation.provenance={provider:'keenable',endpoint:'https://api.keenable.ai/api/v1/search',method:'search_snippet',profileId:'sector-profile',indexedAt:null,truncated:true};
  source.caseContext!.observation.family='incident';
  let observed='';
  const result=await createAgentRunner(options(scripted([call('read','read_observation_context'),{type:'needs_input',message:'À vérifier'}],r=>{observed=JSON.stringify(r);} )))(source);
  assert.equal(result.status,'needs_input');assert.doesNotMatch(observed,/HIDDEN_ORACLE|HIDDEN_KEY|HIDDEN_FUTURE/);
  assert.match(observed,/search_snippet/);assert.match(observed,/"untrustedData":true/);
});
test('a declared inbound delay compares current and hypothetical coverage without changing durable facts',async()=>{
  const source=input();source.caseContext!.impactKind='risk';
  source.caseContext!.riskAssumption={kind:'inbound_delay',purchaseOrderLineId:'POL-1',assumedExpectedDate:'2026-10-28',basis:'Hypothèse à confirmer, pas un retard prouvé par cet article.'};
  const before=structuredClone(source.snapshot);
  const model=scripted([call('read','read_observation_context'),call('eval','evaluate_options',{targetOrderLineId:'OL-A'}),(request:ModelRequest):unknown=>{
    const evaluation=request.messages.findLast(m=>m.role==='tool'&&m.name==='evaluate_options')!.content as unknown as BusinessEvaluation;
    return call('prepare','prepare_proposal',{evaluationId:evaluation.id,optionId:evaluation.options.find(o=>o.kind==='emergency_purchase')!.id,title:'Hypothèse',summary:'Calcul conditionnel'});
  }]);
  const result=await createAgentRunner(options(model))(source);
  assert.equal(result.status,'proposal');
  const facts=result.proposal!.evaluation.facts;
  assert.equal((facts.actualCoverage as Array<{shortage:number}>)[0]!.shortage,0);
  assert.equal((facts.coverage as Array<{shortage:number}>)[0]!.shortage,8);
  assert.ok(result.proposal!.conditions.includes('HYPOTHETICAL_INBOUND_DELAY'));
  assert.match(result.proposal!.summary,/declared delay assumption/);
  assert.match(result.proposal!.title,/Needs verification/);
  assert.deepEqual(source.snapshot,before);
});
test('internal confirmation uses durable facts with informational external relation and no model confirmation tool',async()=>{
  const source=input();source.run.revision='R1';source.snapshot.revision='R1';source.snapshot.dataset.snapshot_revision='R1';
  source.snapshot.dataset.tables.purchase_order_lines!.find(row=>row.id==='POL-1')!.expected_date='2026-10-28';
  const context=source.caseContext!;context.businessRevision='R1';context.impactKind='risk';
  context.confirmation={kind:'inbound_date_confirmed',eventId:'EVENT-1',companyId:'CO-DEMO',caseId:caseRef.caseId,caseRevision:caseRef.caseRevision,
    purchaseOrderLineId:'POL-1',productId:'SKU-ISO100',previousExpectedDate:'2026-10-23',confirmedExpectedDate:'2026-10-28',actorId:'OPERATOR-1',confirmedAt:'2026-10-22T06:00:00Z',basis:'Synthetic operator confirmation',businessRevision:'R1',policyVersion:'P1',dataOrigin:'synthetic'};
  const before=structuredClone(source.snapshot);let tools:string[]=[];let system='';
  const model=scripted([call('read','read_observation_context'),call('eval','evaluate_options',{targetOrderLineId:'OL-A'}),(request:ModelRequest):unknown=>{
    const evaluation=request.messages.findLast(message=>message.role==='tool' && message.name==='evaluate_options')!.content as unknown as BusinessEvaluation;
    return call('prepare','prepare_proposal',{evaluationId:evaluation.id,optionId:evaluation.options.find(option=>option.kind==='emergency_purchase')!.id,title:'Test',summary:'Test'});
  }],request=>{tools=request.tools.map(tool=>tool.name);system=request.system;});
  const result=await createAgentRunner({...options(model),currentVersion:async()=>({companyId:'CO-DEMO',revision:'R1',policyVersion:'P1'})})(source);
  assert.equal(result.status,'proposal');assert.equal(result.proposal!.evaluation.facts.coverageBasis,'confirmed_internal_synthetic');
  assert.equal(result.proposal!.evaluation.options.find(option=>option.id===result.proposal!.optionId)!.status,'feasible');
  assert.deepEqual(result.proposal!.conditions,['EXTERNAL_RELATION_UNVERIFIED']);
  assert.match(result.proposal!.summary,/confirmed in the simulation by the operator/);
  assert.match(system,/English product output/);assert.ok(!tools.some(name=>/confirm|approve/.test(name)));
  assert.match(JSON.stringify(result.traces.find(trace=>trace.tool==='prepare_proposal')!.output),/"approvalBlocked":false/);
  assert.deepEqual(source.snapshot,before);
  context.confirmation.confirmedAt='2026-10-23T06:00:00Z';
  assert.throws(()=>buildModelContext(source,'2026-10-22T09:00:00Z'));
});
