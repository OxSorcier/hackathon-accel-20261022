import { randomBytes } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Actor } from '../../src/contracts/index.js';
import type { PdfDocumentResult, PdfDocuments } from '../../src/server/pdf-documents.js';
import { PDF_PROFILE, PdfDocumentsError } from '../../src/server/pdf-documents.js';
import { registerPdfRoutes } from '../../src/server/pdf-routes.js';
import { checkOrigin } from '../../src/server/auth.js';
import { AppError } from '../../src/server/errors.js';

const origin = 'http://pdf-route.test'; const documentHash = 'a'.repeat(64);
const pending: PdfDocumentResult = { status: 'pending', key: { companyId: 'CO-SESSION', documentHash, extractorVersion: 'pypdf/6.21.2+accel.1' }, code: null, cacheHit: false, downloadCalls: 1, modalCalls: 0 };
const opened: FastifyInstance[] = [];
afterEach(async () => { for (const app of opened.splice(0)) await app.close(); });
async function setup(options: { role?: Actor['role']; failure?: boolean; result?: PdfDocumentResult; actorGate?: Promise<void>; actorEntered?: () => void; onDisconnected?: () => void } = {}): Promise<{ app: FastifyInstance; cookie: string; calls: Actor[] }> {
  const app = Fastify({ logger: false }); opened.push(app); const cookie = `test_session=${randomBytes(24).toString('hex')}`; const calls: Actor[] = [];
  const actor: Actor = { actorId: 'SERVER-ACTOR', companyId: 'CO-SESSION', role: options.role ?? 'direction', approvalCeilingEur: 0 };
  app.addHook('onRequest', async request => {
    if (options.onDisconnected) request.raw.socket.once('close', options.onDisconnected);
    if (request.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !checkOrigin(request.headers.origin, origin)) throw new AppError('ORIGIN', 'Origin not allowed', 403);
  });
  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AppError) return await reply.code(error.statusCode).send({ data: null, error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError) return await reply.code(400).send({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid input.' } });
    return await reply.code(503).send({ data: null, error: { code: 'UNAVAILABLE', message: 'Unavailable.' } });
  });
  const received = options.result ?? pending;
  const documents: PdfDocuments = {
    async list(value): Promise<PdfDocumentResult[]> { calls.push(value); if (options.failure) throw new PdfDocumentsError('PDF_STORAGE_UNCERTAIN'); return [received]; },
    async read(value, hash): Promise<PdfDocumentResult | null> { calls.push(value); return hash === documentHash ? received : null; },
    async acquire(value, profile): Promise<PdfDocumentResult> { calls.push(value); expect(profile).toBe(PDF_PROFILE.id); return received; },
  };
  await registerPdfRoutes(app, { documents, actorFor: async request => {
    if (request.headers.cookie !== cookie) throw new AppError('AUTH_REQUIRED', 'Sign in first.', 401);
    options.actorEntered?.(); if (options.actorGate) await options.actorGate;
    return actor;
  } });
  await app.ready(); return { app, cookie, calls };
}
describe('PDF HTTP routes, injected document service and server actor resolver', () => {
  it('requires an authenticated session on every endpoint before reaching document storage', async () => {
    const { app, calls } = await setup();
    for (const [method, url] of [['GET', '/api/pdf-documents'], ['GET', `/api/pdf-documents/${documentHash}`], ['POST', `/api/pdf-documents/${PDF_PROFILE.id}/acquire`]] as const) {
      const result = await app.inject({ method, url, headers: { origin }, ...(method === 'POST' ? { payload: {} } : {}) });
      expect(result.statusCode).toBe(401);
    }
    expect(calls).toEqual([]);
  });
  it('uses the real shared Origin check and refuses browser company/role/URL overrides', async () => {
    const { app, cookie, calls } = await setup();
    expect((await app.inject({ method: 'POST', url: `/api/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie, origin: 'https://other.test' }, payload: {} })).statusCode).toBe(403);
    for (const payload of [{ companyId: 'CO-OTHER' }, { role: 'direction' }, { url: 'http://127.0.0.1/' }]) {
      expect((await app.inject({ method: 'POST', url: `/api/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie, origin }, payload })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: `/api/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie, origin, 'content-type': 'application/json' }, payload: 'null' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/pdf-documents?companyId=CO-OTHER', headers: { cookie } })).statusCode).toBe(400);
    expect(calls).toEqual([]);
  });
  it('passes only the server-resolved actor to list/read/acquire and retains pending as an explicit state', async () => {
    const { app, cookie, calls } = await setup();
    const listing = await app.inject({ method: 'GET', url: '/api/pdf-documents', headers: { cookie } });
    expect(listing.statusCode).toBe(200); expect(listing.json()).toMatchObject({ data: { profile: PDF_PROFILE, documents: [{ status: 'pending', key: { companyId: 'CO-SESSION' } }] }, error: null });
    const read = await app.inject({ method: 'GET', url: `/api/pdf-documents/${documentHash}`, headers: { cookie } });
    expect(read.statusCode).toBe(200); expect(read.json()).toMatchObject({ data: { status: 'pending' }, error: null });
    const acquired = await app.inject({ method: 'POST', url: `/api/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie, origin }, payload: {} });
    expect(acquired.statusCode).toBe(202); expect(acquired.json()).toMatchObject({ data: { status: 'pending' }, error: null });
    expect(calls).toHaveLength(3); expect(calls.every(actor => actor.companyId === 'CO-SESSION' && actor.actorId === 'SERVER-ACTOR')).toBe(true);
  });
  it('allows logistics reads, limits acquisitions to direction/purchasing, and refuses operators on these normal routes', async () => {
    for (const role of ['direction', 'achats', 'logistique', 'operator'] as const) {
      const { app, cookie } = await setup({ role });
      expect((await app.inject({ method: 'GET', url: '/api/pdf-documents', headers: { cookie } })).statusCode).toBe(role === 'operator' ? 403 : 200);
      expect((await app.inject({ method: 'POST', url: `/api/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie, origin }, payload: {} })).statusCode).toBe(['direction', 'achats'].includes(role) ? 202 : 403);
    }
  });
  it('validates exact hashes, fixed profile and empty query before service access, and keeps company misses opaque', async () => {
    const { app, cookie, calls } = await setup();
    for (const url of ['/api/pdf-documents/not-a-hash', `/api/pdf-documents/${documentHash}?role=direction`]) expect((await app.inject({ method: 'GET', url, headers: { cookie } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/pdf-documents/unreceived/acquire', headers: { cookie, origin }, payload: {} })).statusCode).toBe(400);
    expect(calls).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `/api/pdf-documents/${'b'.repeat(64)}`, headers: { cookie } })).statusCode).toBe(404);
  });
  it('sanitizes storage errors and lists metadata without releasing full page bodies', async () => {
    const failed = await setup({ failure: true });
    const error = await failed.app.inject({ method: 'GET', url: '/api/pdf-documents', headers: { cookie: failed.cookie } });
    expect(error.statusCode).toBe(503); expect(error.json()).toMatchObject({ data: null, error: { code: 'PDF_STORAGE_UNCERTAIN' } });
    const complete: PdfDocumentResult = { status: 'done', key: pending.key, cacheHit: true, downloadCalls: 0, modalCalls: 0, document: {
      key: pending.key, provenance: { profileId: PDF_PROFILE.id, profileVersion: PDF_PROFILE.version, url: PDF_PROFILE.url, title: PDF_PROFILE.title, publishedAt: PDF_PROFILE.publishedAt, collectedAt: '2026-10-22T10:00:00Z', dataOrigin: 'public', provider: 'modal', method: 'native_pdf', documentHash, byteLength: 100 }, createdAt: '2026-10-22T10:00:00Z', completedAt: '2026-10-22T10:00:01Z',
      extraction: { schemaVersion: 'pdf-extraction/v1', status: 'complete', documentHash, byteLength: 100, pageCount: 1, pages: [{ number: 1, text: 'Page text is returned only on document read.', textHash: 'c'.repeat(64), characterCount: 42 }], emptyPages: [], characterCount: 42, extractorVersion: 'pypdf/6.21.2+accel.1' } } };
    const { app, cookie } = await setup({ result: complete });
    const list = await app.inject({ method: 'GET', url: '/api/pdf-documents', headers: { cookie } });
    expect(list.body).not.toContain('Page text is returned only'); expect(list.json()).toMatchObject({ data: { documents: [{ document: { extraction: { pageCount: 1 } } }] } });
    const read = await app.inject({ method: 'GET', url: `/api/pdf-documents/${documentHash}`, headers: { cookie } });
    expect(read.body).toContain('Page text is returned only');
  });
  it('refuses an encoded route alias that bypasses the shared raw-prefix Origin hook', async () => {
    const { app, cookie, calls } = await setup();
    const encoded = await app.inject({ method: 'POST', url: `/%61pi/pdf-documents/${PDF_PROFILE.id}/acquire`, headers: { cookie }, payload: {} });
    expect(encoded.statusCode).toBe(400); expect(calls).toEqual([]);
  });
  it('does not start an acquisition after the HTTP client disconnects during session lookup', async () => {
    let enter: (() => void) | undefined; let release: (() => void) | undefined; let closed: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { enter = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const disconnected = new Promise<void>(resolve => { closed = resolve; });
    const { app, cookie, calls } = await setup({ actorGate: gate, actorEntered: () => enter!(), onDisconnected: () => closed!() });
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const request = httpRequest(new URL(`/api/pdf-documents/${PDF_PROFILE.id}/acquire`, address), { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' } });
    request.on('error', () => { /* Expected local cancellation, no provider call. */ });
    try {
      request.end('{}'); await entered; request.destroy(); await disconnected; release!();
      await new Promise<void>(resolve => { setImmediate(resolve); });
      expect(calls).toEqual([]);
    } finally { release!(); request.destroy(); }
  });
});
