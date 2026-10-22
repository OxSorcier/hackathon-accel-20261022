export interface PdfDocumentDescriptor {
  companyId: string; profileId: string; profileVersion: string; documentHash: string;
  extractorVersion: string; title: string; url: string; publishedAt: string;
  collectedAt: string; pageCount: number; characterCount: number;
  extractionStatus: 'complete' | 'partial' | 'empty'; dataOrigin: 'public';
}
export interface PdfPageReference {
  documentHash: string; extractorVersion: string; pageNumber: number; pageTextHash: string;
}
export interface PdfPageExcerpt {
  ref: PdfPageReference; text: string; excerptHash: string; truncated: boolean;
  fullPageCharacterCount: number; citationUrl: string;
}
export interface PdfReadResult {
  outcome: 'available' | 'not_available'; document: PdfDocumentDescriptor | null;
  pages: PdfPageExcerpt[]; conditions: string[]; reason: string;
  externalCalls: 0;
}
/** Cached, company-bound reads only. Acquisition remains a separate authorised HTTP action. */
export interface PdfKnowledgePort {
  list(): Promise<PdfDocumentDescriptor[]>;
  read(documentHash: string, pageNumbers: number[]): Promise<PdfReadResult>;
}
export interface PdfRunResult {
  outcome: 'available' | 'not_available'; documents: PdfDocumentDescriptor[];
  pages: PdfPageExcerpt[]; conditions: string[];
}
