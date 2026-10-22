import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Actor, ApiResponse } from '../contracts/index.js';
import type { PdfExtraction } from './pdf-client.js';
import { PDF_PROFILE, PdfDocumentsError, type PdfDocumentResult, type PdfDocuments, type StoredPdfDocument } from './pdf-documents.js';
import { AppError } from './errors.js';

type Done = Extract<PdfDocumentResult, { status: 'done' }>;
export type PdfDocumentSummary = Exclude<PdfDocumentResult, Done> | (Omit<Done, 'document'> & {
  document: Omit<StoredPdfDocument, 'extraction'> & { extraction: Omit<PdfExtraction, 'pages'> };
});
export interface PdfDocumentListing { profile: typeof PDF_PROFILE; documents: PdfDocumentSummary[] }
export interface PdfRouteOptions { documents: PdfDocuments; actorFor(request: FastifyRequest): Promise<Actor> }
const emptyQuery = z.object({}).strict();
const hashParams = z.object({ documentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
function ok<T>(data: T): ApiResponse<T> { return { data, error: null }; }
function summary(result: PdfDocumentResult): PdfDocumentSummary {
  if (result.status !== 'done') return result;
  const { pages: _pages, ...metadata } = result.document.extraction;
  return { ...result, document: { ...result.document, extraction: metadata } };
}
async function safe<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error: unknown) {
    if (!(error instanceof PdfDocumentsError)) throw error;
    const status = error.code === 'PDF_INVALID_ACTOR' ? 401 : error.code === 'PDF_COMPANY_NOT_FOUND' ? 404
      : ['PDF_INVALID_HASH', 'PDF_INVALID_PROFILE'].includes(error.code) ? 400 : error.code === 'PDF_DOWNLOAD_FAILED' ? 502 : 503;
    throw new AppError(error.code, 'The PDF request could not be completed. Check its recorded status before trying again.', status);
  }
}
/** Install the application's shared Origin and error hooks first; actorFor resolves its authenticated session. */
export async function registerPdfRoutes(app: FastifyInstance, options: PdfRouteOptions): Promise<void> {
  const authorized = async (request: FastifyRequest, acquire = false): Promise<Actor> => {
    const actor = await options.actorFor(request);
    const allowed = acquire ? ['direction', 'achats'] : ['direction', 'achats', 'logistique'];
    if (!allowed.includes(actor.role)) throw new AppError('FORBIDDEN', 'Use a business session authorised for this PDF action.', 403);
    return actor;
  };
  await app.register(async scope => {
    scope.get('/api/pdf-documents', async request => {
      const actor = await authorized(request); emptyQuery.parse(request.query);
      const rows = await safe(async () => await options.documents.list(actor));
      return ok<PdfDocumentListing>({ profile: PDF_PROFILE, documents: rows.map(summary) });
    });
    scope.get('/api/pdf-documents/:documentHash', async request => {
      const actor = await authorized(request); emptyQuery.parse(request.query);
      const { documentHash } = hashParams.parse(request.params);
      const result = await safe(async () => await options.documents.read(actor, documentHash));
      if (!result) throw new AppError('PDF_NOT_FOUND', 'No PDF document is available in this company for that reference.', 404);
      return ok(result);
    });
    scope.post('/api/pdf-documents/:profileId/acquire', async (request, reply) => {
      const controller = new AbortController();
      const disconnected = (): void => { if (!reply.raw.writableEnded) controller.abort(); };
      reply.raw.once('close', disconnected);
      try {
        if (reply.raw.destroyed || request.raw.aborted || request.raw.socket.destroyed) controller.abort();
        if (request.url.split('?', 1)[0] !== `/api/pdf-documents/${PDF_PROFILE.id}/acquire`) {
          throw new AppError('INVALID_INPUT', 'Use the canonical PDF URL.', 400);
        }
        const actor = await authorized(request, true); emptyQuery.parse(request.query);
        const { profileId } = z.object({ profileId: z.literal(PDF_PROFILE.id) }).strict().parse(request.params);
        z.object({}).strict().optional().parse(request.body);
        if (controller.signal.aborted) throw new AppError('PDF_REQUEST_ABORTED', 'The PDF request was interrupted.', 409);
        const result = await safe(async () => await options.documents.acquire(actor, profileId, controller.signal));
        return await reply.code(result.status === 'pending' ? 202 : 200).send(ok(result));
      } finally { reply.raw.removeListener('close', disconnected); }
    });
  });
}
