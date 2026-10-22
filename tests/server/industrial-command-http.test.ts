import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/contracts/index.js';
import type { IndustrialBasis, IndustrialApproval } from '../../src/contracts/industrial.js';
import { createApp } from '../../src/server/app.js';
import type { PgStore } from '../../src/server/store.js';

describe('industrial HTTP command identity boundary', () => {
  it('accepts a native scheduled observation ref unchanged and refuses an invalid ref before the command', async () => {
    const actor: Actor = { companyId:'CO-HTTP',actorId:'EMP-PAUL',role:'direction',approvalCeilingEur:2000 };
    const store={async actor(token:string|undefined):Promise<Actor|null>{return token==='test-session'?actor:null;}} as unknown as PgStore;
    const basis: IndustrialBasis={companyId:actor.companyId,businessRevision:'R-1',policyVersion:'P1',contextRevision:'IC-1',qualificationRevision:'Q-1',eventId:'EV-1',eventRevision:'IR-1',researchDependencies:[{scope:{profileId:'public-contracts',profileVersion:'v1',namespace:'live'},generation:1,validUntil:'2026-10-23T13:06:45.319Z',evidenceRefs:[{occurrenceId:'scheduled:watch:abcdef:20261022125136.706000',evidenceId:'boamp:26-101462',contentHash:'a'.repeat(64)}]}]};
    let commands=0;
    const app=await createApp({store,config:{companyId:actor.companyId,host:'127.0.0.1',port:3000,origin:'http://127.0.0.1:3000',secureCookies:false,demoToken:'x'.repeat(32),operatorToken:'y'.repeat(32)},evaluate:()=>{throw new Error('Not used');},industrial:{async isIndustrial():Promise<boolean>{return true;},async workspace(){throw new Error('Not used');},async report(){throw new Error('Not used');},async decide(received,id,input):Promise<IndustrialApproval>{commands++;expect(received).toEqual(actor);expect(input.expectedBasis).toEqual(basis);return{id:'APPROVAL-HTTP',companyId:actor.companyId,planId:id,planVersion:input.expectedPlanVersion,planHash:input.expectedPlanHash,basis:input.expectedBasis,actorId:actor.actorId,decision:'approved',decidedAt:'2026-10-22T13:00:00Z'};}}});
    try{
      const payload={decision:'approve',expectedBasis:basis,expectedPlanVersion:'v1',expectedPlanHash:'b'.repeat(64),operationKey:'decision-http-0001'},headers={origin:'http://127.0.0.1:3000',cookie:'accel_session=test-session'};
      expect((await app.inject({method:'POST',url:'/api/industrial/plans/industrial-plan%3Aabc/decision',headers,payload})).statusCode).toBe(200);expect(commands).toBe(1);
      const bad=structuredClone(payload);bad.expectedBasis.researchDependencies[0]!.evidenceRefs[0]!.occurrenceId='invalid/ref';expect((await app.inject({method:'POST',url:'/api/industrial/plans/industrial-plan%3Aabc/decision',headers,payload:bad})).statusCode).toBe(400);expect(commands).toBe(1);
      expect((await app.inject({method:'POST',url:'/api/industrial/plans/industrial-plan%3Aabc/decision',headers:{origin:headers.origin},payload})).statusCode).toBe(401);expect(commands).toBe(1);
    }finally{await app.close();}
  });
});
