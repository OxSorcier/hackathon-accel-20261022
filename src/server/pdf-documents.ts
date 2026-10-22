import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Actor, SqlPort } from '../contracts/index.js';
import { createModalPdfClient, ModalPdfError, type ModalPdfClient, type PdfExtraction } from './pdf-client.js';

export const PDF_PROFILE = Object.freeze({ id: 'rockwool-h1-2026', version: 'v1',
  url: 'https://www.rockwool.com/siteassets/investors/financial-reports/2026/q2-h1-2026-financial-report.pdf',
  title: 'Report on first half of 2026 for ROCKWOOL A/S', publishedAt: '2026-08-19' });
const extractorVersion = 'pypdf/6.21.2+accel.1';
const maximumBytes = 10 * 1024 * 1024;
const digest = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(200);
const actorSchema = z.object({ actorId: identifier, companyId: identifier, role: z.enum(['direction', 'achats', 'logistique', 'operator']) });
const provenanceSchema = z.object({ profileId: z.literal(PDF_PROFILE.id), profileVersion: z.literal(PDF_PROFILE.version),
  url: z.literal(PDF_PROFILE.url), title: z.literal(PDF_PROFILE.title), publishedAt: z.literal(PDF_PROFILE.publishedAt),
  collectedAt: z.iso.datetime({ offset: true }), dataOrigin: z.literal('public'), provider: z.literal('modal'),
  method: z.literal('native_pdf'), documentHash: sha256, byteLength: z.number().int().min(1).max(maximumBytes) }).strict();
const pageSchema = z.object({ number: z.number().int().min(1).max(40), text: z.string().max(60_000), textHash: sha256, characterCount: z.number().int().min(0).max(30_000) }).strict();
const extractionSchema = z.object({ schemaVersion: z.literal('pdf-extraction/v1'), status: z.enum(['complete', 'partial', 'empty']), documentHash: sha256,
  byteLength: z.number().int().min(1).max(maximumBytes), pageCount: z.number().int().min(1).max(40), pages: z.array(pageSchema).min(1).max(40),
  emptyPages: z.array(z.number().int().min(1).max(40)).max(40), characterCount: z.number().int().min(0).max(200_000), extractorVersion: z.literal(extractorVersion) }).strict();
const rowSchema = z.object({ company_id: identifier, document_hash: sha256, extractor_version: z.literal(extractorVersion),
  status: z.enum(['intent', 'done', 'uncertain', 'failed']), intent_token: z.uuid(), actor_id: identifier,
  created_at: z.date(), expires_at: z.date(), completed_at: z.date().nullable(), provenance: provenanceSchema,
  extraction: z.unknown(), error_code: z.string().regex(/^PDF_[A-Z_]{1,90}$/).nullable(), expired: z.boolean() });
type Row = z.infer<typeof rowSchema>;
type Transaction = <T>(work: (sql: SqlPort) => Promise<T>) => Promise<T>;
export interface PdfDocumentKey { companyId: string; documentHash: string; extractorVersion: string }
export interface StoredPdfDocument { key: PdfDocumentKey; provenance: z.infer<typeof provenanceSchema>; extraction: PdfExtraction; createdAt: string; completedAt: string }
interface Metrics { downloadCalls: number; modalCalls: number }
export type PdfDocumentResult = ({ status: 'done'; key: PdfDocumentKey; document: StoredPdfDocument; cacheHit: boolean }
  | { status: 'pending' | 'uncertain' | 'failed'; key: PdfDocumentKey; code: string | null; cacheHit: false }) & Metrics;
export interface PdfDocuments {
  acquire(actor: Actor, profileId: string, signal?: AbortSignal): Promise<PdfDocumentResult>;
  read(actor: Actor, documentHash: string): Promise<PdfDocumentResult | null>;
  list(actor: Actor): Promise<PdfDocumentResult[]>;
}
export interface PdfDocumentsOptions { fetch?: typeof fetch; client?: ModalPdfClient }
export class PdfDocumentsError extends Error {
  constructor(public readonly code: 'PDF_INVALID_ACTOR' | 'PDF_INVALID_PROFILE' | 'PDF_COMPANY_NOT_FOUND' | 'PDF_INVALID_HASH' | 'PDF_DOWNLOAD_FAILED' | 'PDF_STORAGE_UNCERTAIN' | 'PDF_STATE_INVALID') { super(code); this.name = 'PdfDocumentsError'; }
}
function authority(actor: Actor): void { if (!actorSchema.safeParse(actor).success) throw new PdfDocumentsError('PDF_INVALID_ACTOR'); }
function keyOf(row: Row): PdfDocumentKey { return { companyId: row.company_id, documentHash: row.document_hash, extractorVersion: row.extractor_version }; }
function parameters(key: PdfDocumentKey): string[] { return [key.companyId, key.documentHash, key.extractorVersion]; }
function parseRow(value: unknown, key: PdfDocumentKey): Row {
  const parsed = rowSchema.safeParse(value);
  if (!parsed.success) throw new PdfDocumentsError('PDF_STATE_INVALID');
  const row = parsed.data;
  if (row.company_id !== key.companyId || row.document_hash !== key.documentHash || row.extractor_version !== key.extractorVersion
    || row.provenance.documentHash !== key.documentHash || row.expires_at <= row.created_at
    || (row.status === 'intent' && (row.completed_at !== null || row.extraction !== null || row.error_code !== null))
    || (row.status === 'done' && (row.completed_at === null || row.extraction === null || row.error_code !== null))
    || (['failed', 'uncertain'].includes(row.status) && (row.completed_at === null || row.extraction !== null || row.error_code === null))) throw new PdfDocumentsError('PDF_STATE_INVALID');
  return row;
}
function checkedExtraction(value: unknown, key: PdfDocumentKey, byteLength: number, cached: boolean): PdfExtraction {
  const invalid = (): never => { if (cached) throw new PdfDocumentsError('PDF_STATE_INVALID'); throw new ModalPdfError('PDF_RESPONSE_INVALID'); };
  const parsed = extractionSchema.safeParse(value); if (!parsed.success) return invalid();
  const result = parsed.data;
  if (result.documentHash !== key.documentHash || result.byteLength !== byteLength || result.pages.length !== result.pageCount) return invalid();
  let characters = 0; const empty: number[] = [];
  for (const [index, page] of result.pages.entries()) {
    const count = Array.from(page.text).length;
    if (page.number !== index + 1 || count !== page.characterCount || count > 30_000 || page.text.includes('\u0000')
      || /[\uD800-\uDFFF]/u.test(page.text) || page.text !== page.text.normalize('NFC') || digest(page.text) !== page.textHash) return invalid();
    characters += count; if (!count) empty.push(page.number);
  }
  const status = empty.length === result.pages.length ? 'empty' : empty.length ? 'partial' : 'complete';
  if (characters !== result.characterCount || characters > 200_000 || result.status !== status || JSON.stringify(empty) !== JSON.stringify(result.emptyPages)
    || Buffer.byteLength(JSON.stringify(result), 'utf8') > 3_000_000) return invalid();
  return result;
}
function project(row: Row, metrics: Metrics, cacheHit = false): PdfDocumentResult {
  const key = keyOf(row);
  if (row.status !== 'done') return { status: row.status === 'intent' ? 'pending' : row.status, key, code: row.error_code, cacheHit: false, ...metrics };
  return { status: 'done', key, cacheHit, ...metrics, document: { key, provenance: row.provenance,
    extraction: checkedExtraction(row.extraction, key, row.provenance.byteLength, true), createdAt: row.created_at.toISOString(), completedAt: row.completed_at!.toISOString() } };
}
async function download(fetcher: typeof fetch, signal?: AbortSignal): Promise<Uint8Array> {
  const timeout = AbortSignal.timeout(20_000); const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    requestSignal.throwIfAborted();
    const response = await fetcher(PDF_PROFILE.url, { method: 'GET', redirect: 'error', signal: requestSignal, headers: { accept: 'application/pdf' } });
    const declared = response.headers.get('content-length');
    if (response.status !== 200 || response.redirected || (response.url && response.url !== PDF_PROFILE.url)
      || response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/pdf' || !response.body
      || (declared !== null && (!/^\d{1,12}$/.test(declared) || Number(declared) > maximumBytes))) {
      await response.body?.cancel(); throw new PdfDocumentsError('PDF_DOWNLOAD_FAILED');
    }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength; if (length > maximumBytes) { await reader.cancel(); throw new PdfDocumentsError('PDF_DOWNLOAD_FAILED'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    requestSignal.throwIfAborted();
    if (!length || (declared !== null && Number(declared) !== length)) throw new PdfDocumentsError('PDF_DOWNLOAD_FAILED');
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new PdfDocumentsError('PDF_DOWNLOAD_FAILED');
    return bytes;
  } catch { throw new PdfDocumentsError('PDF_DOWNLOAD_FAILED'); }
}
/** Actor is supplied by the authenticated server route, never by a model or PDF. */
export function createPdfDocuments(sql: SqlPort, transaction: Transaction, options: PdfDocumentsOptions = {}): PdfDocuments {
  const fetcher = options.fetch ?? globalThis.fetch; const client = options.client ?? createModalPdfClient();
  const stored = async <T>(work: () => Promise<T>): Promise<T> => {
    try { return await work(); } catch (error: unknown) { if (error instanceof PdfDocumentsError) throw error; throw new PdfDocumentsError('PDF_STORAGE_UNCERTAIN'); }
  };
  const ensureCompany = async (actor: Actor): Promise<void> => {
    authority(actor);
    const found = await stored(async () => await sql.query('SELECT company_id FROM companies WHERE company_id=$1', [actor.companyId]));
    if (!found.rows.length) throw new PdfDocumentsError('PDF_COMPANY_NOT_FOUND');
  };
  const locked = async (connection: SqlPort, key: PdfDocumentKey): Promise<Row | null> => {
    const lock = await connection.query('SELECT company_id FROM accel_pdf_documents WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3 FOR UPDATE', parameters(key));
    if (!lock.rows[0]) return null;
    // Evaluate time only after obtaining the lock, in a new statement snapshot.
    const selected = await connection.query('SELECT *,expires_at<=clock_timestamp() AS expired FROM accel_pdf_documents WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3', parameters(key));
    if (!selected.rows[0]) return null;
    let row = parseRow(selected.rows[0], key);
    if (row.status === 'intent' && row.expired) {
      await connection.query("UPDATE accel_pdf_documents SET status='uncertain',completed_at=clock_timestamp(),error_code='PDF_INTENT_EXPIRED' WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3 AND status='intent' AND expires_at<=clock_timestamp()", parameters(key));
      const settled = await connection.query('SELECT *,expires_at<=clock_timestamp() AS expired FROM accel_pdf_documents WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3', parameters(key));
      row = parseRow(settled.rows[0], key);
    }
    return row;
  };
  const failure = async (key: PdfDocumentKey, token: string, status: 'failed' | 'uncertain', code: string, metrics: Metrics): Promise<PdfDocumentResult> => {
    return await transaction(async connection => {
      let row = await locked(connection, key); if (!row) throw new PdfDocumentsError('PDF_STATE_INVALID');
      if (row.status === 'intent' && row.intent_token === token) {
        await connection.query("UPDATE accel_pdf_documents SET status=$5,completed_at=clock_timestamp(),error_code=$6 WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3 AND intent_token=$4 AND status='intent' AND expires_at>clock_timestamp()", [...parameters(key), token, status, code]);
        row = await locked(connection, key); if (!row) throw new PdfDocumentsError('PDF_STATE_INVALID');
      }
      return project(row, metrics);
    });
  };
  const read = async (actor: Actor, documentHash: string): Promise<PdfDocumentResult | null> => {
    if (!sha256.safeParse(documentHash).success) throw new PdfDocumentsError('PDF_INVALID_HASH');
    await ensureCompany(actor);
    return await stored(async () => await transaction(async connection => {
      const row = await locked(connection, { companyId: actor.companyId, documentHash, extractorVersion });
      return row ? project(row, { downloadCalls: 0, modalCalls: 0 }, row.status === 'done') : null;
    }));
  };
  return {
    async acquire(actor, profileId, signal): Promise<PdfDocumentResult> {
      if (profileId !== PDF_PROFILE.id) throw new PdfDocumentsError('PDF_INVALID_PROFILE');
      await ensureCompany(actor);
      const bytes = await download(fetcher, signal);
      const key = { companyId: actor.companyId, documentHash: digest(bytes), extractorVersion };
      const token = randomUUID(); const metrics: Metrics = { downloadCalls: 1, modalCalls: 0 };
      const provenance = { profileId: PDF_PROFILE.id, profileVersion: PDF_PROFILE.version, url: PDF_PROFILE.url, title: PDF_PROFILE.title,
        publishedAt: PDF_PROFILE.publishedAt, collectedAt: new Date().toISOString(), dataOrigin: 'public', provider: 'modal', method: 'native_pdf', documentHash: key.documentHash, byteLength: bytes.byteLength };
      const claim = await stored(async () => await transaction(async connection => {
        const inserted = await connection.query("INSERT INTO accel_pdf_documents(company_id,document_hash,extractor_version,status,intent_token,actor_id,provenance) VALUES($1,$2,$3,'intent',$4,$5,$6::jsonb) ON CONFLICT DO NOTHING RETURNING intent_token", [...parameters(key), token, actor.actorId, JSON.stringify(provenance)]);
        const row = await locked(connection, key); if (!row) throw new PdfDocumentsError('PDF_STATE_INVALID');
        return { row, owned: inserted.rowCount === 1 && row.status === 'intent' && row.intent_token === token };
      }));
      if (!claim.owned) return project(claim.row, metrics, claim.row.status === 'done');
      let extraction: PdfExtraction;
      try {
        // This counts adapter invocations, not billed compute or confirmed execution.
        metrics.modalCalls = 1;
        extraction = checkedExtraction(await client.extract(bytes, signal), key, bytes.byteLength, false);
        signal?.throwIfAborted();
      } catch (error: unknown) {
        const code = error instanceof ModalPdfError ? error.code : 'PDF_REQUEST_FAILED';
        const definite = new Set(['PDF_NOT_CONFIGURED', 'PDF_INVALID_ENDPOINT', 'PDF_AUTH_FAILED', 'PDF_EMPTY_INPUT', 'PDF_TOO_LARGE', 'PDF_CONTENT_LENGTH', 'PDF_LENGTH_MISMATCH', 'PDF_STREAM_ERROR', 'PDF_CONTENT_TYPE', 'PDF_INVALID', 'PDF_ENCRYPTED', 'PDF_NO_PAGES', 'PDF_PAGE_LIMIT', 'PDF_TEXT_LIMIT']);
        try { return await failure(key, token, definite.has(code) ? 'failed' : 'uncertain', code, metrics); }
        catch { return { status: 'uncertain', key, code: 'PDF_STORAGE_UNCERTAIN', cacheHit: false, ...metrics }; }
      }
      try {
        return await transaction(async connection => {
          const current = await locked(connection, key); if (!current) throw new PdfDocumentsError('PDF_STATE_INVALID');
          if (current.status === 'intent' && current.intent_token === token) {
            await connection.query("UPDATE accel_pdf_documents SET status='done',completed_at=clock_timestamp(),extraction=$5::jsonb WHERE company_id=$1 AND document_hash=$2 AND extractor_version=$3 AND intent_token=$4 AND status='intent' AND expires_at>clock_timestamp()", [...parameters(key), token, JSON.stringify(extraction)]);
          }
          const row = await locked(connection, key); if (!row) throw new PdfDocumentsError('PDF_STATE_INVALID');
          return project(row, metrics);
        });
      } catch {
        try { return await failure(key, token, 'uncertain', 'PDF_PERSISTENCE_UNCERTAIN', metrics); }
        catch { return { status: 'uncertain', key, code: 'PDF_STORAGE_UNCERTAIN', cacheHit: false, ...metrics }; }
      }
    },
    read,
    async list(actor): Promise<PdfDocumentResult[]> {
      await ensureCompany(actor);
      const keys = await stored(async () => await sql.query('SELECT document_hash FROM accel_pdf_documents WHERE company_id=$1 AND extractor_version=$2 ORDER BY created_at DESC,document_hash LIMIT 20', [actor.companyId, extractorVersion]));
      const results: PdfDocumentResult[] = [];
      for (const item of keys.rows) {
        if (!sha256.safeParse(item.document_hash).success) throw new PdfDocumentsError('PDF_STATE_INVALID');
        const row = await read(actor, item.document_hash as string); if (row) results.push(row);
      }
      return results;
    },
  };
}
