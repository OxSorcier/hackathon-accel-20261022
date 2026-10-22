import { createHash } from 'node:crypto';
import { z } from 'zod';

const maximumBytes = 10 * 1024 * 1024;
const maximumResponseBytes = 3_000_000;
const extractorVersion = 'pypdf/6.21.2+accel.1';
const pythonEdgeWhitespace = /^[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]|[\u0009-\u000D\u001C-\u0020\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]$/u;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const pageSchema = z.object({ number: z.number().int().min(1).max(40), text: z.string().max(60_000),
  textHash: sha256, characterCount: z.number().int().min(0).max(30_000) }).strict();
const extractionSchema = z.object({ schemaVersion: z.literal('pdf-extraction/v1'),
  status: z.enum(['complete', 'partial', 'empty']), documentHash: sha256,
  byteLength: z.number().int().min(1).max(maximumBytes), pageCount: z.number().int().min(1).max(40),
  pages: z.array(pageSchema).min(1).max(40), emptyPages: z.array(z.number().int().min(1).max(40)).max(40),
  characterCount: z.number().int().min(0).max(200_000), extractorVersion: z.literal(extractorVersion) }).strict();
export type PdfExtraction = z.infer<typeof extractionSchema>;
export type PdfPage = z.infer<typeof pageSchema>;
export type ModalPdfErrorCode = 'PDF_NOT_CONFIGURED' | 'PDF_INVALID_ENDPOINT' | 'PDF_AUTH_FAILED'
  | 'PDF_RATE_LIMITED' | 'PDF_SERVICE_UNAVAILABLE' | 'PDF_REQUEST_FAILED' | 'PDF_REQUEST_TIMEOUT'
  | 'PDF_REQUEST_ABORTED' | 'PDF_RESPONSE_INVALID' | 'PDF_RESPONSE_TOO_LARGE' | 'PDF_EMPTY_INPUT'
  | 'PDF_TOO_LARGE' | 'PDF_CONTENT_LENGTH' | 'PDF_LENGTH_MISMATCH' | 'PDF_STREAM_ERROR'
  | 'PDF_CONTENT_TYPE' | 'PDF_INVALID' | 'PDF_ENCRYPTED' | 'PDF_NO_PAGES' | 'PDF_PAGE_LIMIT'
  | 'PDF_TEXT_LIMIT' | 'PDF_EXTRACTION_FAILED';
export class ModalPdfError extends Error {
  constructor(public readonly code: ModalPdfErrorCode) { super(code); this.name = 'ModalPdfError'; }
}
export interface ModalPdfClient {
  extract(bytes: Uint8Array, signal?: AbortSignal): Promise<PdfExtraction>;
}
const remoteErrors: Readonly<Record<number, readonly ModalPdfErrorCode[]>> = {
  400: ['PDF_EMPTY_INPUT', 'PDF_CONTENT_LENGTH', 'PDF_LENGTH_MISMATCH', 'PDF_STREAM_ERROR'],
  413: ['PDF_TOO_LARGE'], 415: ['PDF_CONTENT_TYPE', 'PDF_INVALID'],
  422: ['PDF_INVALID', 'PDF_ENCRYPTED', 'PDF_NO_PAGES', 'PDF_PAGE_LIMIT', 'PDF_TEXT_LIMIT'],
};
const errorSchema = z.object({ error: z.object({ code: z.string().max(100), message: z.string().max(500) }).strict() }).strict();
function configured(env: NodeJS.ProcessEnv): { url: string; key: string; secret: string } {
  const raw = env.MODAL_PDF_URL; const key = env.MODAL_PDF_PROXY_KEY; const secret = env.MODAL_PDF_PROXY_SECRET;
  if (!raw || !key || !secret || ![key, secret].every(value => value.length <= 512 && /^[\x21-\x7e]+$/.test(value))) throw new ModalPdfError('PDF_NOT_CONFIGURED');
  let url: URL;
  try { url = new URL(raw); } catch { throw new ModalPdfError('PDF_INVALID_ENDPOINT'); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !/^oxsorcier--accel-pdf-reader-extract-document(?:\.[a-z0-9-]+)?\.modal\.run$/.test(url.hostname)) throw new ModalPdfError('PDF_INVALID_ENDPOINT');
  return { url: url.href, key, secret };
}
async function readJson(response: Response, limit: number): Promise<unknown> {
  if (response.redirected || response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json' || !response.body) {
    await response.body?.cancel(); throw new ModalPdfError('PDF_RESPONSE_INVALID');
  }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new ModalPdfError('PDF_RESPONSE_TOO_LARGE'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown; }
  catch { throw new ModalPdfError('PDF_RESPONSE_INVALID'); }
}
function verified(value: unknown, bytes: Uint8Array): PdfExtraction {
  const parsed = extractionSchema.safeParse(value);
  if (!parsed.success) throw new ModalPdfError('PDF_RESPONSE_INVALID');
  const result = parsed.data;
  const hash = (input: Uint8Array | string): string => createHash('sha256').update(input).digest('hex');
  if (result.documentHash !== hash(bytes) || result.byteLength !== bytes.byteLength || result.pageCount !== result.pages.length) throw new ModalPdfError('PDF_RESPONSE_INVALID');
  const emptyPages: number[] = []; let characters = 0;
  for (const [index, page] of result.pages.entries()) {
    const count = Array.from(page.text).length;
    if (page.number !== index + 1 || count !== page.characterCount || count > 30_000 || page.text !== page.text.normalize('NFC')
      || pythonEdgeWhitespace.test(page.text) || page.text.includes('\u0000') || /[\uD800-\uDFFF]/u.test(page.text)
      || page.textHash !== hash(page.text)) throw new ModalPdfError('PDF_RESPONSE_INVALID');
    characters += count; if (!count) emptyPages.push(page.number);
  }
  const status = emptyPages.length === result.pages.length ? 'empty' : emptyPages.length ? 'partial' : 'complete';
  if (characters !== result.characterCount || characters > 200_000 || status !== result.status
    || JSON.stringify(emptyPages) !== JSON.stringify(result.emptyPages)) throw new ModalPdfError('PDF_RESPONSE_INVALID');
  return result;
}
/** Stateless bytes-only adapter. The caller owns authority, public downloads and persistence. */
export function createModalPdfClient(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = globalThis.fetch): ModalPdfClient {
  return { async extract(input, signal): Promise<PdfExtraction> {
    if (!input.byteLength) throw new ModalPdfError('PDF_EMPTY_INPUT');
    if (input.byteLength > maximumBytes) throw new ModalPdfError('PDF_TOO_LARGE');
    const config = configured(env); const bytes = new Uint8Array(input);
    const deadline = AbortSignal.timeout(75_000);
    const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      requestSignal.throwIfAborted();
      const response = await fetcher(config.url, { method: 'POST', redirect: 'error', signal: requestSignal,
        headers: { 'content-type': 'application/pdf', 'Modal-Key': config.key, 'Modal-Secret': config.secret }, body: bytes });
      if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw new ModalPdfError('PDF_AUTH_FAILED'); }
      if (response.status === 429) { await response.body?.cancel(); throw new ModalPdfError('PDF_RATE_LIMITED'); }
      if (response.status >= 500) { await response.body?.cancel(); throw new ModalPdfError('PDF_SERVICE_UNAVAILABLE'); }
      if (response.status !== 200) {
        const parsed = errorSchema.safeParse(await readJson(response, 4096));
        const code = parsed.success ? remoteErrors[response.status]?.find(value => value === parsed.data.error.code) : undefined;
        throw new ModalPdfError(code ?? 'PDF_RESPONSE_INVALID');
      }
      const payload = await readJson(response, maximumResponseBytes);
      requestSignal.throwIfAborted();
      return verified(payload, bytes);
    } catch (error: unknown) {
      if (signal?.aborted) throw new ModalPdfError('PDF_REQUEST_ABORTED');
      if (deadline.aborted) throw new ModalPdfError('PDF_REQUEST_TIMEOUT');
      if (error instanceof ModalPdfError) throw error;
      throw new ModalPdfError('PDF_REQUEST_FAILED');
    }
  } };
}
