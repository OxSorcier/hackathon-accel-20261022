import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Actor, SqlPort } from '../../src/contracts/index.js';
import { PgStore } from '../../src/server/store.js';
import { ModalPdfError, type PdfExtraction } from '../../src/server/pdf-client.js';
import { createPdfDocuments, PDF_PROFILE } from '../../src/server/pdf-documents.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const input = new TextEncoder().encode('%PDF-1.7\nControlled adapter fixture A');
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
function result(bytes: Uint8Array = input): PdfExtraction {
  return { schemaVersion: 'pdf-extraction/v1', status: 'complete', documentHash: hash(bytes), byteLength: bytes.byteLength,
    pageCount: 1, pages: [{ number: 1, text: 'Prix 🧱', textHash: hash('Prix 🧱'), characterCount: 6 }], emptyPages: [], characterCount: 6, extractorVersion: 'pypdf/6.21.2+accel.1' };
}
function response(bytes: Uint8Array = input): Response { return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/pdf' } }); }
describe.skipIf(!databaseUrl)('PDF document cache on isolated PostgreSQL, injected source and Modal only', () => {
  const schema = `pdf_documents_${randomBytes(8).toString('hex')}`;
  const actor: Actor = { actorId: 'PDF-READER-A', companyId: 'CO-PDF-A', role: 'direction', approvalCeilingEur: 2000 };
  const secondActor: Actor = { ...actor, companyId: 'CO-PDF-B' };
  let pool: Pool; let store: PgStore;
  const transaction = async <T>(work: (sql: SqlPort) => Promise<T>): Promise<T> => await store.transaction(work);
  beforeAll(async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`); await admin.end();
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` }); store = new PgStore(pool);
    await pool.query(await readFile('migrations/001_core.sql', 'utf8'));
    await pool.query(await readFile('proposals/modal/PDF-DOCUMENTS.sql', 'utf8'));
    await pool.query("INSERT INTO companies(company_id,snapshot) VALUES ('CO-PDF-A','{}'),('CO-PDF-B','{}')");
  });
  beforeEach(async () => { await pool.query('TRUNCATE accel_pdf_documents'); });
  afterAll(async () => {
    if (pool) await pool.end();
    const admin = new Pool({ connectionString: databaseUrl }); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end();
  });
  it('persists physical pages and provenance, recovers with a new repository, and scopes cache by company', async () => {
    let downloads = 0; let modalCalls = 0;
    const options = { fetch: (async (url, init) => { downloads += 1; expect(String(url)).toBe(PDF_PROFILE.url); expect(init?.redirect).toBe('error'); expect(new Headers(init?.headers).has('authorization')).toBe(false); return response(); }) as typeof fetch,
      client: { async extract(bytes: Uint8Array): Promise<PdfExtraction> { modalCalls += 1; return result(bytes); } } };
    const first = await createPdfDocuments(store, transaction, options).acquire(actor, PDF_PROFILE.id);
    expect(first.status).toBe('done'); if (first.status !== 'done') throw new Error('Expected persisted document');
    expect(first.document.extraction.pages[0]).toMatchObject({ number: 1, text: 'Prix 🧱', characterCount: 6 });
    expect(first.document.provenance).toMatchObject({ dataOrigin: 'public', provider: 'modal', url: PDF_PROFILE.url, profileId: PDF_PROFILE.id });
    const restarted = createPdfDocuments(store, transaction, options);
    const cached = await restarted.acquire(actor, PDF_PROFILE.id);
    expect(cached.status).toBe('done'); expect(cached.cacheHit).toBe(true); expect(modalCalls).toBe(1); expect(downloads).toBe(2);
    if (cached.status === 'done') expect(cached.document).toEqual(first.document);
    const readback = await restarted.read(actor, hash(input)); expect(readback?.status).toBe('done'); expect(downloads).toBe(2);
    expect(await restarted.read(secondActor, hash(input))).toBeNull();
    await restarted.acquire(secondActor, PDF_PROFILE.id); expect(modalCalls).toBe(2);
  });
  it('claims identical bytes concurrently without a second Modal call or a network transaction lock', async () => {
    let enter: (() => void) | undefined; let release: (() => void) | undefined; let modalCalls = 0; let openTransactions = 0;
    const entered = new Promise<void>(resolve => { enter = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
    const counted = async <T>(work: (sql: SqlPort) => Promise<T>): Promise<T> => { openTransactions += 1; try { return await transaction(work); } finally { openTransactions -= 1; } };
    const docs = createPdfDocuments(store, counted, { fetch: async () => { expect(openTransactions).toBe(0); return response(); },
      client: { async extract(bytes): Promise<PdfExtraction> { expect(openTransactions).toBe(0); modalCalls += 1; enter!(); await released; return result(bytes); } } });
    const first = docs.acquire(actor, PDF_PROFILE.id); await entered;
    const second = await docs.acquire(actor, PDF_PROFILE.id); expect(second.status).toBe('pending'); expect(modalCalls).toBe(1);
    release!(); expect((await first).status).toBe('done');
    expect((await docs.list(actor))).toHaveLength(1);
  });
  it('keeps interrupted intent uncertain after expiry and refuses a late publication', async () => {
    let enter: (() => void) | undefined; let release: (() => void) | undefined; let calls = 0;
    const entered = new Promise<void>(resolve => { enter = resolve; }); const released = new Promise<void>(resolve => { release = resolve; });
    const docs = createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> { calls += 1; enter!(); await released; return result(); } } });
    const first = docs.acquire(actor, PDF_PROFILE.id); await entered;
    await pool.query("UPDATE accel_pdf_documents SET created_at=clock_timestamp()-interval '3 minutes',expires_at=clock_timestamp()-interval '1 second'");
    expect((await docs.acquire(actor, PDF_PROFILE.id)).status).toBe('uncertain');
    release!(); expect((await first).status).toBe('uncertain');
    expect((await createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> { calls += 1; return result(); } } }).acquire(actor, PDF_PROFILE.id)).status).toBe('uncertain');
    expect(calls).toBe(1);
  });
  it('does not call Modal after an uncertain claim commit, and preserves a committed publication after lost acknowledgement', async () => {
    let modalCalls = 0; let commits = 0;
    const options = { fetch: (async () => response()) as typeof fetch, client: { async extract(): Promise<PdfExtraction> { modalCalls += 1; return result(); } } };
    const lostClaim = async <T>(work: (sql: SqlPort) => Promise<T>): Promise<T> => { const value = await transaction(work); throw new Error('synthetic lost claim acknowledgement'); return value; };
    await expect(createPdfDocuments(store, lostClaim, options).acquire(actor, PDF_PROFILE.id)).rejects.toThrow('PDF_STORAGE_UNCERTAIN'); expect(modalCalls).toBe(0);
    await pool.query("UPDATE accel_pdf_documents SET created_at=clock_timestamp()-interval '3 minutes',expires_at=clock_timestamp()-interval '1 second'");
    expect((await createPdfDocuments(store, transaction, options).acquire(actor, PDF_PROFILE.id)).status).toBe('uncertain'); expect(modalCalls).toBe(0);
    await pool.query('TRUNCATE accel_pdf_documents');
    const lostPublication = async <T>(work: (sql: SqlPort) => Promise<T>): Promise<T> => { commits += 1; const value = await transaction(work); if (commits === 2) throw new Error('synthetic lost publication acknowledgement'); return value; };
    const recovered = await createPdfDocuments(store, lostPublication, options).acquire(actor, PDF_PROFILE.id);
    expect(recovered.status).toBe('done'); expect(modalCalls).toBe(1);
    expect((await createPdfDocuments(store, transaction, options).acquire(actor, PDF_PROFILE.id)).status).toBe('done'); expect(modalCalls).toBe(1);
  });
  it('records ambiguous transport as uncertain and deterministic refusal as failed, without retry', async () => {
    for (const [code, status] of [['PDF_REQUEST_FAILED', 'uncertain'], ['PDF_REQUEST_TIMEOUT', 'uncertain'], ['PDF_RESPONSE_INVALID', 'uncertain'], ['PDF_RATE_LIMITED', 'uncertain'], ['PDF_ENCRYPTED', 'failed']] as const) {
      await pool.query('TRUNCATE accel_pdf_documents'); let calls = 0;
      const docs = createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> { calls += 1; throw new ModalPdfError(code); } } });
      expect((await docs.acquire(actor, PDF_PROFILE.id)).status).toBe(status);
      expect((await docs.acquire(actor, PDF_PROFILE.id)).status).toBe(status); expect(calls).toBe(1);
    }
  });
  it('refuses a different fence and a malformed extraction instead of returning an in-memory success', async () => {
    const docs = createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> { await pool.query("UPDATE accel_pdf_documents SET intent_token='11111111-1111-4111-8111-111111111111'"); return result(); } } });
    expect((await docs.acquire(actor, PDF_PROFILE.id)).status).toBe('pending');
    await pool.query('TRUNCATE accel_pdf_documents');
    const invalid = createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> { return { ...result(), documentHash: '0'.repeat(64) }; } } });
    expect((await invalid.acquire(actor, PDF_PROFILE.id)).status).toBe('uncertain');
  });
  it('does not trust malformed persisted payloads or acquire unapproved sources/unknown companies', async () => {
    let calls = 0; const docs = createPdfDocuments(store, transaction, { fetch: async () => { calls += 1; return response(); }, client: { async extract(): Promise<PdfExtraction> { return result(); } } });
    await expect(docs.acquire(actor, 'unreceived-profile')).rejects.toThrow('PDF_INVALID_PROFILE');
    await expect(docs.acquire({ ...actor, companyId: 'CO-NOT-RECEIVED' }, PDF_PROFILE.id)).rejects.toThrow('PDF_COMPANY_NOT_FOUND'); expect(calls).toBe(0);
    await docs.acquire(actor, PDF_PROFILE.id);
    await pool.query("UPDATE accel_pdf_documents SET extraction=jsonb_set(extraction,'{pages,0,textHash}',to_jsonb(repeat('0',64)))");
    await expect(docs.read(actor, hash(input))).rejects.toThrow('PDF_STATE_INVALID');
  });
  it('bounds public download bytes and rejects redirects, MIME errors, wrong lengths and broken streams before creating intent', async () => {
    let cancelled = false;
    const over = new ReadableStream<Uint8Array>({ pull(controller): void { controller.enqueue(new Uint8Array(6 * 1024 * 1024)); }, cancel(): void { cancelled = true; } });
    const broken = new ReadableStream<Uint8Array>({ start(controller): void { controller.error(new Error('synthetic source detail')); } });
    const bad = [new Response('redirect', { status: 302, headers: { location: 'http://127.0.0.1/' } }), new Response(input),
      new Response(input, { headers: { 'content-type': 'application/pdf', 'content-length': '2' } }),
      new Response(over, { headers: { 'content-type': 'application/pdf' } }), new Response(broken, { headers: { 'content-type': 'application/pdf' } })];
    for (const item of bad) await expect(createPdfDocuments(store, transaction, { fetch: async () => item, client: { async extract(): Promise<PdfExtraction> { throw new Error('Modal must not run'); } } }).acquire(actor, PDF_PROFILE.id)).rejects.toThrow('PDF_DOWNLOAD_FAILED');
    expect(cancelled).toBe(true); expect((await pool.query('SELECT count(*)::int AS count FROM accel_pdf_documents')).rows[0]?.count).toBe(0);
  });
  it('checks expiry at publication even when no competing reader has settled the intent', async () => {
    const docs = createPdfDocuments(store, transaction, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> {
      await pool.query("UPDATE accel_pdf_documents SET created_at=clock_timestamp()-interval '3 minutes',expires_at=clock_timestamp()-interval '1 second'"); return result();
    } } });
    expect((await docs.acquire(actor, PDF_PROFILE.id)).status).toBe('uncertain');
    expect((await pool.query('SELECT extraction,status FROM accel_pdf_documents')).rows[0]).toEqual({ extraction: null, status: 'uncertain' });
  });
  it('keeps old bytes retrievable when the same public source changes, and preserves empty text explicitly', async () => {
    const other = new TextEncoder().encode('%PDF-1.7\nControlled adapter fixture B'); let bytes = input; let calls = 0;
    const docs = createPdfDocuments(store, transaction, { fetch: async () => response(bytes), client: { async extract(data): Promise<PdfExtraction> {
      calls += 1; const value = result(data);
      if (calls === 2) { value.status = 'empty'; value.pages = [{ number: 1, text: '', textHash: hash(''), characterCount: 0 }]; value.emptyPages = [1]; value.characterCount = 0; }
      return value;
    } } });
    await docs.acquire(actor, PDF_PROFILE.id); bytes = other;
    const second = await docs.acquire(actor, PDF_PROFILE.id); expect(second.status).toBe('done');
    if (second.status === 'done') expect(second.document.extraction.status).toBe('empty');
    expect((await docs.acquire(actor, PDF_PROFILE.id)).cacheHit).toBe(true); expect(calls).toBe(2);
    expect((await docs.read(actor, hash(input)))?.status).toBe('done');
    const { list } = docs; expect(await list(actor)).toHaveLength(2);
  });
  it('refuses a caller cancellation at download EOF without creating intent or invoking Modal', async () => {
    const controller = new AbortController(); let calls = 0;
    const stream = new ReadableStream<Uint8Array>({ start(reader): void { reader.enqueue(input); }, pull(reader): void { controller.abort('untrusted source detail'); reader.close(); } });
    const docs = createPdfDocuments(store, transaction, { fetch: async () => new Response(stream, { headers: { 'content-type': 'application/pdf' } }), client: { async extract(): Promise<PdfExtraction> { calls += 1; return result(); } } });
    await expect(docs.acquire(actor, PDF_PROFILE.id, controller.signal)).rejects.toThrow('PDF_DOWNLOAD_FAILED'); expect(calls).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM accel_pdf_documents')).rows[0]?.count).toBe(0);
  });
  it('rechecks the deadline after a concurrent row lock is released, before publishing', async () => {
    let blocker: PoolClient | undefined; let publicationPid = 0; let transactions = 0; let entered: (() => void) | undefined;
    const publicationStarted = new Promise<void>(resolve => { entered = resolve; });
    const tracked = async <T>(work: (sql: SqlPort) => Promise<T>): Promise<T> => await transaction(async sql => {
      transactions += 1;
      if (transactions === 2) { publicationPid = Number((await sql.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid); entered!(); }
      return await work(sql);
    });
    const docs = createPdfDocuments(store, tracked, { fetch: async () => response(), client: { async extract(): Promise<PdfExtraction> {
      await pool.query("UPDATE accel_pdf_documents SET expires_at=clock_timestamp()+interval '1 second'");
      blocker = await pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT 1 FROM accel_pdf_documents FOR UPDATE');
      return result();
    } } });
    const acquisition = docs.acquire(actor, PDF_PROFILE.id);
    try {
      await publicationStarted;
      let blocked = false;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const activity = await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [publicationPid]);
        if (activity.rows[0]?.wait_event_type === 'Lock') { blocked = true; break; }
      }
      expect(blocked).toBe(true);
      await pool.query('SELECT pg_sleep(GREATEST(EXTRACT(EPOCH FROM expires_at-clock_timestamp()),0)+0.05) FROM accel_pdf_documents');
      expect((await pool.query('SELECT expires_at<clock_timestamp() AS expired FROM accel_pdf_documents')).rows[0]?.expired).toBe(true);
      await blocker!.query('COMMIT'); blocker!.release(); blocker = undefined;
      expect((await acquisition).status).toBe('uncertain');
      expect((await pool.query('SELECT extraction,status FROM accel_pdf_documents')).rows[0]).toEqual({ extraction: null, status: 'uncertain' });
    } finally { if (blocker) { await blocker.query('ROLLBACK'); blocker.release(); } await acquisition; }
  });
});
