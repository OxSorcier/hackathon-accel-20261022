import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { PgStore } from '../../src/server/store.js';
import type { Actor, AgentRun } from '../../src/contracts/index.js';

describe('origin protection on every mutating route', () => {
  it.each(['/api/questions', '/%61pi/questions', '/api/%71uestions'])('rejects missing and foreign origins at %s before queueing', async path => {
    const pool = new Pool(); const store = new PgStore(pool);
    const actor: Actor = { companyId: 'ORIGIN-TEST', actorId: 'TEST-ACTOR', role: 'direction', approvalCeilingEur: 2000 };
    vi.spyOn(store, 'actor').mockResolvedValue(actor);
    const queued: AgentRun = { id: randomUUID(), companyId: actor.companyId, actorId: actor.actorId, operationKey: 'origin-test', question: 'Test', status: 'queued', revision: 'R0', policyVersion: 'P1', mode: 'test', model: null, proposalId: null, message: null, traces: [], createdAt: new Date().toISOString(), completedAt: null };
    const queue = vi.spyOn(store, 'queueQuestion').mockResolvedValue(queued);
    const config = { origin: 'http://127.0.0.1:3000', host: '127.0.0.1', port: 3000, companyId: actor.companyId, demoToken: 'test-only', operatorToken: 'test-operator-only', secureCookies: false };
    const app = await createApp({ store, config, evaluate: () => { throw new Error('No business calculation allowed'); } });
    try {
      for (const origin of [undefined, 'https://foreign.example']) {
        const response = await app.inject({ method: 'POST', url: path, payload: { question: 'Test', operationKey: 'origin-test' }, ...(origin ? { headers: { origin } } : {}) });
        expect(response.statusCode).toBe(403); expect(response.json().error.code).toBe('ORIGIN');
      }
      expect(queue).not.toHaveBeenCalled();
      expect((await app.inject({ method: 'POST', url: path, payload: { question: 'Test', operationKey: 'origin-test' }, headers: { origin: config.origin } })).statusCode).toBe(202);
      expect(queue).toHaveBeenCalledTimes(1);
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
    } finally { await app.close(); await pool.end(); }
  });
  it('also protects a mutating route outside the api prefix', async () => {
    const pool = new Pool(); const store = new PgStore(pool);
    const app = await createApp({ store, config: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1', port: 3000, companyId: 'ORIGIN-TEST', demoToken: '', operatorToken: '', secureCookies: false }, evaluate: () => { throw new Error('No calculation'); } });
    let writes = 0;
    app.post('/mutation-probe', async () => { writes += 1; return { saved: true }; });
    try {
      expect((await app.inject({ method: 'POST', url: '/mutation-probe' })).statusCode).toBe(403); expect(writes).toBe(0);
      expect((await app.inject({ method: 'POST', url: '/mutation-probe', headers: { origin: 'http://127.0.0.1:3000' } })).statusCode).toBe(200); expect(writes).toBe(1);
    } finally { await app.close(); await pool.end(); }
  });
});
