import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import { z } from 'zod';
import { CONTRACT_VERSION, type Actor, type ApiResponse, type BusinessEngine, type DecisionsView, type Watch, type WatchInput, type WatchOccurrence } from '../contracts/index.js';
import { checkOrigin, resolveLoginActor } from './auth.js';
import type { AppConfig } from './config.js';
import { AppError, PgStore } from './store.js';
import { decisionSchema, questionSchema, snapshotSchema, watchSchema } from './validation.js';
import { PUBLIC_TOPICS, getWatchCapabilities, isPublicTopic } from '../watch/collector.js';
import { validateWatchInput } from '../data/validation.js';
import { CaseRepository, caseAnalysisSchema, caseConfirmationSchema, caseInputSchema, caseRevisionSchema } from './cases.js';
import type { ResearchService } from './research-service.js';
import { parseControlledEvidence } from './research-service.js';
import type { IndustrialReadService } from './industrial-read.js';

export interface WatchService {
  create(actor: Actor, input: WatchInput): Promise<Watch>;
  list(companyId: string): Promise<Watch[]>;
  occurrences(companyId: string): Promise<WatchOccurrence[]>;
  trigger(actor: Actor, watchId: string, operationKey: string): Promise<WatchOccurrence>;
}
export interface AppOptions { store: PgStore; config: AppConfig; evaluate: BusinessEngine; watches?: WatchService; research?: ResearchService; industrial?: IndustrialReadService; staticRoot?: string }
function ok<T>(data: T): ApiResponse<T> { return { data, error: null }; }
export async function createApp(options: AppOptions): Promise<FastifyInstance> {
  const { store, config, evaluate } = options;
  const cases = new CaseRepository(store);
  const app = Fastify({ logger: false, bodyLimit: 65536, requestTimeout: 15000 });
  await app.register(cookie);
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer').header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !checkOrigin(request.headers.origin, config.origin)) throw new AppError('ORIGIN', 'Origin not allowed', 403);
  });
  const actorFor = async (request: FastifyRequest): Promise<Actor> => {
    const actor = await store.actor(request.cookies.accel_session);
    if (!actor || actor.companyId !== config.companyId) throw new AppError('AUTH_REQUIRED', 'Sign in with an authorised session before this action.', 401);
    return actor;
  };
  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AppError) return await reply.code(error.statusCode).send({ data: null, error: { code: error.code, message: error.message } });
    if (error instanceof z.ZodError || (typeof error === 'object' && error !== null && 'validation' in error)) return await reply.code(400).send({ data: null, error: { code: 'INVALID_INPUT', message: 'Invalid input. Check the fields and formats.' } });
    // Never serialize a native SQL/provider error or its connection details.
    return await reply.code(503).send({ data: null, error: { code: 'UNAVAILABLE', message: 'Service unavailable. No successful result can be confirmed.' } });
  });
  app.get('/api/health', async () => ok({ status: 'alive', version: '0.1.0', contractVersion: CONTRACT_VERSION }));
  app.get('/api/industrial', async request => {
    const actor = await actorFor(request);
    if (!options.industrial) throw new AppError('INDUSTRIAL_UNAVAILABLE', 'Industrial briefing is not connected.', 503);
    z.object({}).strict().parse(request.query);
    return ok(await options.industrial.workspace(actor));
  });
  app.get('/api/industrial/reports/:id', async request => {
    const actor = await actorFor(request);
    if (!options.industrial) throw new AppError('INDUSTRIAL_UNAVAILABLE', 'Industrial briefing is not connected.', 503);
    const { id } = z.object({ id: z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/) }).strict().parse(request.params);
    z.object({}).strict().parse(request.query);
    return ok(await options.industrial.report(actor, id));
  });
  app.post('/api/industrial/questions', async (request, reply) => {
    const actor = await actorFor(request);
    if (actor.role === 'operator' || actor.role === 'analysis_only') throw new AppError('FORBIDDEN', 'Use an authorised business session.', 403);
    if (!options.industrial?.question) throw new AppError('INDUSTRIAL_CONVERSATION_UNAVAILABLE', 'The bounded industrial conversation is not connected yet.', 503);
    const input = questionSchema.extend({ reportId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/).optional() }).strict().parse(request.body);
    return await reply.code(202).send(ok(await options.industrial.question(actor, input)));
  });
  app.get('/api/ready', async () => { await store.query('SELECT 1'); return ok({ database: 'connected' }); });
  app.post('/api/session', async (request, reply) => {
    const input = z.object({ token: z.string().min(1).max(512) }).strict().parse(request.body);
    const actor = resolveLoginActor(input.token, config);
    if (!actor) throw new AppError('AUTH_REQUIRED', 'Access not recognised', 401);
    const token = await store.session(actor);
    reply.setCookie('accel_session', token, { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'strict', maxAge: 14400 });
    return ok({ actor });
  });
  app.get('/api/session', async request => ok({ actor: await store.actor(request.cookies.accel_session) }));
  app.delete('/api/session', async (request, reply) => {
    if (request.cookies.accel_session) {
      const { hashToken } = await import('./auth.js');
      await store.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(request.cookies.accel_session)]);
    }
    reply.clearCookie('accel_session', { path: '/' }); return ok({ closed: true });
  });
  app.get('/api/company', async request => ok({ snapshot: await store.snapshot(config.companyId), actor: await store.actor(request.cookies.accel_session), contractVersion: CONTRACT_VERSION }));
  app.get('/api/decisions', async () => {
    const [proposals, runs, watches, occurrences] = await Promise.all([store.proposals(config.companyId), store.runs(config.companyId), options.watches?.list(config.companyId) ?? Promise.resolve([]), options.watches?.occurrences(config.companyId) ?? Promise.resolve([])]);
    const snapshot = await store.snapshot(config.companyId);
    const data: DecisionsView = { proposals: proposals.map(proposal => proposal.status === 'pending' && (proposal.revision !== snapshot.revision || proposal.policyVersion !== snapshot.policyVersion) ? { ...proposal, status: 'stale' } : proposal), runs, watches, occurrences, cases: await cases.list(config.companyId) };
    return ok(data);
  });
  app.get('/api/runs/:id', async request => { const { id } = z.object({ id: z.uuid() }).parse(request.params); return ok(await store.run(config.companyId, id)); });
  app.post('/api/questions', async (request, reply) => {
    const actor = await actorFor(request);
    if (options.industrial && await options.industrial.isIndustrial(actor.companyId)) throw new AppError('INDUSTRIAL_ANALYSIS_REQUIRED', 'Use the prepared industrial briefing. Unbounded C1 analysis is disabled for this company.', 409);
    if (actor.role === 'operator') throw new AppError('FORBIDDEN', 'Use a business session', 403);
    const input = questionSchema.parse(request.body);
    return await reply.code(202).send(ok(await store.queueQuestion(actor, input)));
  });
  app.get('/api/research/:profileId', async request => {
    const actor = await actorFor(request);
    if (!options.research) throw new AppError('RESEARCH_UNAVAILABLE', 'Research retrieval is not connected.', 503);
    const { profileId } = z.object({ profileId: z.string().min(1).max(160) }).strict().parse(request.params);
    const query = z.object({ namespace: z.enum(['live', 'controlled']).default('live') }).strict().parse(request.query);
    return ok(await options.research.lookup(actor, options.research.resolve(profileId, query.namespace)));
  });
  app.post('/api/research/:profileId/analyze', async (request, reply) => {
    const actor = await actorFor(request);
    if (options.industrial && await options.industrial.isIndustrial(actor.companyId)) throw new AppError('INDUSTRIAL_ANALYSIS_REQUIRED', 'Use the prepared industrial briefing for this company.', 409);
    if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'Use a business session authorized to analyze research.', 403);
    if (!options.research) throw new AppError('RESEARCH_UNAVAILABLE', 'Research retrieval is not connected.', 503);
    const { profileId } = z.object({ profileId: z.string().min(1).max(160) }).strict().parse(request.params);
    const input = questionSchema.extend({ namespace: z.enum(['live', 'controlled']).default('live') }).parse(request.body);
    return await reply.code(202).send(ok(await store.queueQuestion(actor, { question: input.question, operationKey: input.operationKey }, options.research.resolve(profileId, input.namespace))));
  });
  app.post('/api/operator/research/:profileId/evidence', async request => {
    const actor = await actorFor(request);
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator session required.', 403);
    if (!options.research) throw new AppError('RESEARCH_UNAVAILABLE', 'Research retrieval is not connected.', 503);
    const { profileId } = z.object({ profileId: z.string().min(1).max(160) }).strict().parse(request.params);
    const input = z.object({ evidence: z.unknown(), operationKey: z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/) }).strict().parse(request.body);
    const scope = options.research.resolve(profileId, 'controlled');
    return ok(await options.research.repository.ingestControlled(actor, scope, parseControlledEvidence(scope, input.evidence), input.operationKey));
  });
  app.post('/api/operator/research/:profileId/cases', async request => {
    const actor = await actorFor(request);
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator session required.', 403);
    if (!options.research) throw new AppError('RESEARCH_UNAVAILABLE', 'Research retrieval is not connected.', 503);
    const { profileId } = z.object({ profileId: z.string().min(1).max(160) }).strict().parse(request.params);
    const scope = options.research.resolve(profileId, 'controlled');
    return ok(await cases.createControlled(actor, caseInputSchema.parse(request.body), await options.research.lookup(actor, scope)));
  });
  app.post('/api/proposals/:id/decision', async request => {
    const actor = await actorFor(request);
    if (options.industrial && await options.industrial.isIndustrial(actor.companyId)) throw new AppError('INDUSTRIAL_DECISION_REQUIRED', 'Use the exact coordinated industrial plan decision.', 409);
    const { id } = z.object({ id: z.string().min(1).max(128) }).parse(request.params);
    return ok(await store.decide(actor, id, decisionSchema.parse(request.body), evaluate));
  });
  app.get('/api/cases', async () => ok(await cases.list(config.companyId)));
  app.get('/api/cases/:id', async request => { const { id } = z.object({ id: z.string().min(1).max(160) }).parse(request.params); return ok(await cases.history(config.companyId, id)); });
  app.post('/api/cases', async request => ok(await cases.create(await actorFor(request), caseInputSchema.parse(request.body))));
  app.post('/api/cases/:id/revise', async request => {
    const actor = await actorFor(request); const { id } = z.object({ id: z.string().min(1).max(160) }).parse(request.params);
    return ok(await cases.revise(actor, id, caseRevisionSchema.parse(request.body)));
  });
  app.post('/api/cases/:id/analyze', async (request, reply) => {
    const actor = await actorFor(request); const { id } = z.object({ id: z.string().min(1).max(160) }).parse(request.params);
    if (options.industrial && await options.industrial.isIndustrial(actor.companyId)) throw new AppError('INDUSTRIAL_ANALYSIS_REQUIRED', 'Use the bounded industrial conversation and prepared briefing.', 409);
    return await reply.code(202).send(ok(await cases.analyze(actor, id, caseAnalysisSchema.parse(request.body))));
  });
  app.post('/api/operator/cases/:id/confirm-inbound', async request => {
    const actor = await actorFor(request); const { id } = z.object({ id: z.string().min(1).max(160) }).parse(request.params);
    return ok(await cases.confirm(actor, id, caseConfirmationSchema.parse(request.body)));
  });
  app.post('/api/watches', async request => {
    const actor = await actorFor(request);
    if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'This role cannot create a watch', 403);
    const input = watchSchema.parse(request.body);
    if (input.publicTopic === 'Production d’isolants en France et perturbations publiques') input.publicTopic = PUBLIC_TOPICS[0];
    if (!isPublicTopic(input.publicTopic)) throw new AppError('PUBLIC_TOPIC_REQUIRED', `Available public topics: ${PUBLIC_TOPICS.join(' ; ')}. No other text was sent.`, 400);
    try { validateWatchInput(input); } catch { throw new AppError('PUBLIC_SOURCE_REQUIRED', 'This source or topic/source combination is not allowed. Check the public capabilities.', 400); }
    if (!options.watches) throw new AppError('NOT_READY', 'Watch module not ready', 503);
    return ok(await options.watches.create(actor, input));
  });
  app.get('/api/watch-capabilities', async () => ok(getWatchCapabilities()));
  app.post('/api/watches/:id/run', async request => {
    const actor = await actorFor(request);
    if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'This role cannot run a watch', 403);
    const { id } = z.object({ id: z.string().min(1).max(128) }).parse(request.params);
    const { operationKey } = z.object({ operationKey: z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/) }).strict().parse(request.body);
    if (!options.watches) throw new AppError('NOT_READY', 'Watch module not ready', 503);
    return ok(await options.watches.trigger(actor, id, operationKey));
  });
  app.post('/api/operator/snapshot', async request => {
    const actor = await actorFor(request);
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator session required', 403);
    const input = z.object({ expectedRevision: z.string(), snapshot: snapshotSchema }).strict().parse(request.body);
    return ok(await store.replaceSnapshot(actor, input.expectedRevision, input.snapshot));
  });
  if (options.staticRoot) {
    await app.register(staticFiles, { root: options.staticRoot, wildcard: false, index: ['index.html'] });
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url === '/' || /^\/(decisions|runs)(\/[^.?]*)?$/.test(request.url)) return await reply.sendFile('index.html');
      return await reply.code(404).send({ data: null, error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    });
  }
  return app;
}
