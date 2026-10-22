import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../src/contracts/index.js';
import type { PdfDocumentResult, PdfDocuments } from '../../src/server/pdf-documents.js';
import { PDF_PROFILE } from '../../src/server/pdf-documents.js';
import { createPdfKnowledgePort } from '../../src/server/pdf-knowledge.js';

const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
const hash = 'a'.repeat(64);
const actor = (): Actor => ({ actorId: 'ACTOR-1', companyId: 'CO-1', role: 'direction', approvalCeilingEur: 1000 });
function done(texts: string[] = ['First page', 'Second page']): Extract<PdfDocumentResult, { status: 'done' }> {
  const key = { companyId: 'CO-1', documentHash: hash, extractorVersion: 'pypdf/6.21.2+accel.1' };
  const pages = texts.map((text, i) => ({ number: i + 1, text, textHash: digest(text), characterCount: Array.from(text).length }));
  const emptyPages = pages.filter(p => !p.characterCount).map(p => p.number);
  return { status: 'done', key, cacheHit: true, downloadCalls: 0, modalCalls: 0, document: { key: { ...key },
    provenance: { profileId: PDF_PROFILE.id, profileVersion: PDF_PROFILE.version, url: PDF_PROFILE.url, title: PDF_PROFILE.title, publishedAt: PDF_PROFILE.publishedAt, collectedAt: '2026-10-22T10:00:00Z', dataOrigin: 'public', provider: 'modal', method: 'native_pdf', documentHash: hash, byteLength: 100 },
    createdAt: '2026-10-22T10:00:00Z', completedAt: '2026-10-22T10:00:01Z',
    extraction: { schemaVersion: 'pdf-extraction/v1', status: emptyPages.length === pages.length ? 'empty' : emptyPages.length ? 'partial' : 'complete', documentHash: hash, byteLength: 100, pageCount: pages.length, pages, emptyPages, characterCount: pages.reduce((n, p) => n + p.characterCount, 0), extractorVersion: 'pypdf/6.21.2+accel.1' } } };
}
function service(result: PdfDocumentResult | null = done(), rows?: PdfDocumentResult[], failure = false): { documents: PdfDocuments; calls: Actor[]; acquisitions: () => number } {
  const calls: Actor[] = []; let acquisitions = 0;
  const documents: PdfDocuments = {
    async list(value): Promise<PdfDocumentResult[]> { calls.push(value); if (failure) throw new Error('private-database-error-detail'); return rows ?? (result ? [result] : []); },
    async read(value, requested): Promise<PdfDocumentResult | null> { calls.push(value); expect(requested).toBe(hash); if (failure) throw new Error('private-database-error-detail'); return result; },
    async acquire(): Promise<PdfDocumentResult> { acquisitions += 1; throw new Error('Acquisition must not be called.'); },
  };
  return { documents, calls, acquisitions: () => acquisitions };
}
describe('cached PDF knowledge port', () => {
  it('binds a validated immutable server actor and fixed profile', async () => {
    const s = service(); const input = actor(); const port = createPdfKnowledgePort(s.documents, input, PDF_PROFILE.id);
    input.companyId = 'CO-OTHER'; input.role = 'operator';
    await port.list(); await port.read(hash, [1]);
    expect(s.calls.every(a => a.companyId === 'CO-1' && a.role === 'direction')).toBe(true);
    expect(() => createPdfKnowledgePort(s.documents, actor(), 'arbitrary-profile')).toThrow('PDF_INVALID_PROFILE');
    expect(() => createPdfKnowledgePort(s.documents, { ...actor(), companyId: '' }, PDF_PROFILE.id)).toThrow('PDF_INVALID_ACTOR');
    expect(() => createPdfKnowledgePort(s.documents, { ...actor(), role: 'operator' }, PDF_PROFILE.id)).toThrow('PDF_FORBIDDEN');
    expect(s.acquisitions()).toBe(0);
  });
  it('lists at most 20 descriptors without page bodies or internal acquisition metadata', async () => {
    const rows = Array.from({ length: 21 }, () => done()); const s = service(done(), rows);
    const list = await createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id).list();
    expect(list).toHaveLength(20); expect(list[0]).toMatchObject({ companyId: 'CO-1', profileId: PDF_PROFILE.id, pageCount: 2, dataOrigin: 'public' });
    expect(JSON.stringify(list)).not.toContain('First page'); expect(list[0]).not.toHaveProperty('pages'); expect(list[0]).not.toHaveProperty('modalCalls');
  });
  it('returns selected physical pages with bounded Unicode excerpts and distinct full-page/excerpt references', async () => {
    const texts = ['😀'.repeat(6001), 'é'.repeat(6000)]; const row = done(texts); const s = service(row);
    const result = await createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id).read(hash, [2, 1]);
    expect(result).toMatchObject({ outcome: 'available', externalCalls: 0, document: { documentHash: hash }, pages: [{ ref: { pageNumber: 2 }, truncated: false }, { ref: { pageNumber: 1 }, truncated: true }] });
    expect(result.pages.reduce((n, p) => n + Array.from(p.text).length, 0)).toBe(12000);
    expect(result.pages[1]).toMatchObject({ text: '😀'.repeat(6000), excerptHash: digest('😀'.repeat(6000)), fullPageCharacterCount: 6001, citationUrl: `${PDF_PROFILE.url}#page=1`, ref: { documentHash: hash, extractorVersion: row.key.extractorVersion, pageTextHash: digest(texts[0]!) } });
    expect(result.conditions).toContain('SOURCE_OBSERVATION_ONLY'); expect(s.acquisitions()).toBe(0);
  });
  it('validates hash and one or two distinct physical page numbers before storage access', async () => {
    const s = service(); const port = createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id);
    await expect(port.read('invalid', [1])).rejects.toMatchObject({ code: 'PDF_INVALID_HASH', statusCode: 400 });
    for (const pages of [[], [0], [-1], [1.5], [1, 1], [1, 2, 3], [41], [Number.NaN]]) await expect(port.read(hash, pages)).rejects.toMatchObject({ code: 'PDF_INVALID_PAGES', statusCode: 400 });
    expect(s.calls).toEqual([]);
    await expect(port.read(hash, [3])).rejects.toMatchObject({ code: 'PDF_INVALID_PAGES', statusCode: 400 });
  });
  it('returns no text for absent or unfinished cache states and never starts extraction', async () => {
    for (const status of [null, 'pending', 'uncertain', 'failed'] as const) {
      const row: PdfDocumentResult | null = status === null ? null : { status, key: done().key, code: status === 'pending' ? null : 'PDF_REQUEST_FAILED', cacheHit: false, downloadCalls: 0, modalCalls: 0 };
      const s = service(row); const port = createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id);
      expect(await port.list()).toEqual([]);
      expect(await port.read(hash, [1])).toMatchObject({ outcome: 'not_available', document: null, pages: [], externalCalls: 0 });
      expect(s.acquisitions()).toBe(0);
    }
  });
  it('sanitizes storage errors without retrying or leaking raw details', async () => {
    const s = service(done(), undefined, true); const port = createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id);
    await expect(port.list()).rejects.toMatchObject({ code: 'PDF_STORAGE_UNAVAILABLE', message: 'PDF_STORAGE_UNAVAILABLE', statusCode: 503 });
    const result = await port.read(hash, [1]);
    expect(result).toMatchObject({ outcome: 'not_available', reason: 'PDF_STORAGE_UNAVAILABLE', pages: [], externalCalls: 0 });
    expect(JSON.stringify(result)).not.toContain('private-database-error-detail'); expect(s.calls).toHaveLength(2); expect(s.acquisitions()).toBe(0);
  });
  it('releases no foreign company, profile, version, hash or public URL from a misbound cache', async () => {
    const variants = [
      (row: ReturnType<typeof done>): void => { row.key.companyId = 'CO-OTHER'; },
      (row: ReturnType<typeof done>): void => { row.document.key.companyId = 'CO-OTHER'; },
      (row: ReturnType<typeof done>): void => { row.document.provenance.url = 'https://unreceived.test/report.pdf' as typeof PDF_PROFILE.url; },
      (row: ReturnType<typeof done>): void => { row.document.provenance.profileVersion = 'other' as typeof PDF_PROFILE.version; },
      (row: ReturnType<typeof done>): void => { row.document.extraction.documentHash = 'b'.repeat(64); },
      (row: ReturnType<typeof done>): void => { row.key.extractorVersion = 'unreceived-version'; },
    ];
    for (const change of variants) {
      const row = done(); change(row); const s = service(row); const port = createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id);
      expect(await port.read(hash, [1])).toMatchObject({ outcome: 'not_available', reason: 'PDF_STATE_INVALID', document: null, pages: [] });
      await expect(port.list()).rejects.toMatchObject({ code: 'PDF_STATE_INVALID' });
    }
  });
  it('rejects corrupted selected page identities, hashes and Unicode counts without partial output', async () => {
    for (const change of [
      (row: ReturnType<typeof done>): void => { row.document.extraction.pages[1]!.number = 1; },
      (row: ReturnType<typeof done>): void => { row.document.extraction.pages[1]!.textHash = 'b'.repeat(64); },
      (row: ReturnType<typeof done>): void => { row.document.extraction.pages[1]!.characterCount += 1; },
    ]) {
      const row = done(); change(row); const s = service(row);
      expect(await createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id).read(hash, [1, 2])).toMatchObject({ outcome: 'not_available', reason: 'PDF_STATE_INVALID', pages: [] });
    }
  });
  it('keeps empty native-text pages explicit without inventing OCR text', async () => {
    const s = service(done([''])); const result = await createPdfKnowledgePort(s.documents, actor(), PDF_PROFILE.id).read(hash, [1]);
    expect(result).toMatchObject({ outcome: 'available', document: { extractionStatus: 'empty' }, pages: [{ text: '', fullPageCharacterCount: 0, truncated: false }] });
    expect(result.conditions).toContain('PDF_SELECTED_PAGE_EMPTY'); expect(s.acquisitions()).toBe(0);
  });
});
