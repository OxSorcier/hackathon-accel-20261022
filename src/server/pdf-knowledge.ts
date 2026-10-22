import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Actor } from '../contracts/index.js';
import type { PdfDocumentDescriptor, PdfKnowledgePort, PdfPageExcerpt, PdfReadResult } from '../contracts/pdf.js';
import { PDF_PROFILE, type PdfDocumentResult, type PdfDocuments } from './pdf-documents.js';
import { AppError } from './errors.js';

type Done = Extract<PdfDocumentResult, { status: 'done' }>;
const identifier = z.string().min(1).max(200);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const actorSchema = z.object({ actorId: identifier, companyId: identifier, role: z.enum(['direction', 'achats', 'logistique', 'operator']), approvalCeilingEur: z.number().finite().min(0) }).strict();
const pageNumbersSchema = z.array(z.number().int().min(1).max(40)).min(1).max(2).refine(value => new Set(value).size === value.length);
const descriptorSchema = z.object({ companyId: identifier, profileId: z.literal(PDF_PROFILE.id), profileVersion: z.literal(PDF_PROFILE.version), documentHash: sha256,
  extractorVersion: z.literal('pypdf/6.21.2+accel.1'), title: z.literal(PDF_PROFILE.title), url: z.literal(PDF_PROFILE.url), publishedAt: z.literal(PDF_PROFILE.publishedAt),
  collectedAt: z.iso.datetime({ offset: true }), pageCount: z.number().int().min(1).max(40), characterCount: z.number().int().min(0).max(200_000),
  extractionStatus: z.enum(['complete', 'partial', 'empty']), dataOrigin: z.literal('public') }).strict();
const conditions = ['PUBLIC_SOURCE_UNTRUSTED', 'SOURCE_OBSERVATION_ONLY', 'NO_SUPPLIER_RELATION_CONFIRMED', 'NATIVE_TEXT_ONLY'];
function error(code: string, status = 503): AppError { return new AppError(code, code, status); }
function digest(text: string): string { return createHash('sha256').update(text).digest('hex'); }
function unavailable(reason: string): PdfReadResult {
  return { outcome: 'not_available', document: null, pages: [], conditions: [...conditions], reason, externalCalls: 0 };
}
function descriptor(row: Done, actor: Actor): PdfDocumentDescriptor {
  const { key, document } = row; const source = document.provenance; const extraction = document.extraction;
  if (key.companyId !== actor.companyId || document.key.companyId !== actor.companyId
    || key.documentHash !== document.key.documentHash || key.documentHash !== source.documentHash || key.documentHash !== extraction.documentHash
    || key.extractorVersion !== document.key.extractorVersion || key.extractorVersion !== extraction.extractorVersion
    || extraction.pages.length !== extraction.pageCount || source.provider !== 'modal' || source.method !== 'native_pdf') throw error('PDF_STATE_INVALID');
  const value = descriptorSchema.safeParse({ companyId: key.companyId, profileId: source.profileId, profileVersion: source.profileVersion,
    documentHash: key.documentHash, extractorVersion: key.extractorVersion, title: source.title, url: source.url, publishedAt: source.publishedAt,
    collectedAt: source.collectedAt, pageCount: extraction.pageCount, characterCount: extraction.characterCount, extractionStatus: extraction.status, dataOrigin: source.dataOrigin });
  if (!value.success) throw error('PDF_STATE_INVALID');
  return value.data;
}
function excerpt(row: Done, number: number): PdfPageExcerpt {
  const page = row.document.extraction.pages[number - 1];
  if (!page || page.number !== number || typeof page.text !== 'string' || page.text.includes('\u0000') || /[\uD800-\uDFFF]/u.test(page.text)
    || page.text !== page.text.normalize('NFC') || !sha256.safeParse(page.textHash).success || digest(page.text) !== page.textHash) throw error('PDF_STATE_INVALID');
  const characters = Array.from(page.text);
  if (characters.length !== page.characterCount || characters.length > 30_000) throw error('PDF_STATE_INVALID');
  const text = characters.slice(0, 6000).join('');
  return { ref: { documentHash: row.key.documentHash, extractorVersion: row.key.extractorVersion, pageNumber: number, pageTextHash: page.textHash },
    text, excerptHash: digest(text), truncated: characters.length > 6000, fullPageCharacterCount: characters.length, citationUrl: `${PDF_PROFILE.url}#page=${number}` };
}
/** Server-bound cached reads only. No acquisition or public network operation is available through this port. */
export function createPdfKnowledgePort(documents: PdfDocuments, actor: Actor, profileId: string): PdfKnowledgePort {
  if (profileId !== PDF_PROFILE.id) throw error('PDF_INVALID_PROFILE', 400);
  const parsed = actorSchema.safeParse(actor);
  if (!parsed.success) throw error('PDF_INVALID_ACTOR', 401);
  if (parsed.data.role === 'operator') throw error('PDF_FORBIDDEN', 403);
  const boundActor: Actor = Object.freeze(parsed.data);
  return {
    async list(): Promise<PdfDocumentDescriptor[]> {
      let rows: PdfDocumentResult[];
      try { rows = await documents.list(boundActor); } catch { throw error('PDF_STORAGE_UNAVAILABLE'); }
      try { return rows.slice(0, 20).filter((row): row is Done => row.status === 'done').map(row => descriptor(row, boundActor)); }
      catch { throw error('PDF_STATE_INVALID'); }
    },
    async read(documentHash, pageNumbers): Promise<PdfReadResult> {
      if (!sha256.safeParse(documentHash).success) throw error('PDF_INVALID_HASH', 400);
      const selected = pageNumbersSchema.safeParse(pageNumbers);
      if (!selected.success) throw error('PDF_INVALID_PAGES', 400);
      let row: PdfDocumentResult | null;
      try { row = await documents.read(boundActor, documentHash); } catch { return unavailable('PDF_STORAGE_UNAVAILABLE'); }
      if (!row) return unavailable('PDF_CACHE_MISSING');
      if (row.key.companyId !== boundActor.companyId || row.key.documentHash !== documentHash) return unavailable('PDF_STATE_INVALID');
      if (row.status !== 'done') return unavailable(`PDF_CACHE_${row.status.toUpperCase()}`);
      let document: PdfDocumentDescriptor;
      try { document = descriptor(row, boundActor); } catch { return unavailable('PDF_STATE_INVALID'); }
      if (selected.data.some(number => number > document.pageCount)) throw error('PDF_INVALID_PAGES', 400);
      try {
        const pages = selected.data.map(number => excerpt(row, number));
        return { outcome: 'available', document, pages, conditions: [...conditions, ...(pages.some(page => !page.text) ? ['PDF_SELECTED_PAGE_EMPTY'] : [])], reason: 'PDF_CACHE_READ', externalCalls: 0 };
      } catch { return unavailable('PDF_STATE_INVALID'); }
    },
  };
}
