import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { ResearchContext, ResearchDependency } from '../contracts/research.js';
import { sameEvidenceRef } from './research-context.js';
import { evaluateOptions, parseSnapshot, policyFromContract } from '../domain/index.js';
import type { Actor, AgentRun, CaseAnalysisInput, CaseConfirmationInput, CaseInput, CaseRef, CaseRelation, CaseRevisionInput, CompanySnapshot, DecisionCase, EvidenceRef, InternalConfirmation, ReleasedCaseContext, RiskAssumption, SqlPort, SourceEvidence } from '../contracts/index.js';
import { validateCollectionResult } from '../data/validation.js';
import { AppError } from './errors.js';
import { assertGenericScope } from './industrial-boundary.js';

const identity = z.string().min(1).max(160).regex(/^[a-zA-Z0-9:_.-]+$/);
const operationKey = z.string().min(8).max(128).regex(/^[a-zA-Z0-9:_-]+$/);
export const caseRefSchema: z.ZodType<CaseRef> = z.object({ caseId: identity, caseRevision: identity }).strict();
const evidenceRefSchema: z.ZodType<EvidenceRef> = z.object({ occurrenceId: identity, evidenceId: identity, contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const relationSchema: z.ZodType<CaseRelation> = z.object({ status: z.enum(['unverified', 'none']), productId: identity.nullable(), supplierId: identity.nullable(), basis: z.string().trim().min(1).max(2000) }).strict().refine(value => value.status !== 'none' || (value.productId === null && value.supplierId === null), { message: 'An absent relation cannot carry a candidate entity' });
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const riskAssumptionSchema: z.ZodType<RiskAssumption> = z.object({ kind: z.literal('inbound_delay'), purchaseOrderLineId: identity, assumedExpectedDate: calendarDate.nullable(), basis: z.string().trim().min(1).max(2000) }).strict();
export const caseInputSchema: z.ZodType<CaseInput> = z.object({ evidenceRef: evidenceRefSchema, relation: relationSchema, operationKey, riskAssumption: riskAssumptionSchema.optional() }).strict();
export const caseRevisionSchema: z.ZodType<CaseRevisionInput> = z.object({ evidenceRef: evidenceRefSchema, relation: relationSchema, operationKey, expectedCaseRevision: identity, riskAssumption: riskAssumptionSchema.optional() }).strict();
export const caseAnalysisSchema: z.ZodType<CaseAnalysisInput> = z.object({ expectedCaseRevision: identity, question: z.string().trim().min(1).max(3000), operationKey }).strict();
export const caseConfirmationSchema: z.ZodType<CaseConfirmationInput> = z.object({ expectedRevision: identity, expectedCaseRevision: identity, purchaseOrderLineId: identity, confirmedExpectedDate: calendarDate, basis: z.string().trim().min(1).max(2000), operationKey }).strict();
const confirmationSchema: z.ZodType<InternalConfirmation> = z.object({ kind: z.literal('inbound_date_confirmed'), eventId: identity, companyId: identity, caseId: identity, caseRevision: identity, purchaseOrderLineId: identity, productId: identity, previousExpectedDate: calendarDate.nullable(), confirmedExpectedDate: calendarDate, actorId: identity, confirmedAt: z.string().datetime({ offset: true }), basis: z.string().min(1).max(2000), businessRevision: identity, policyVersion: identity, dataOrigin: z.literal('synthetic'), exposureOrderLineIds: z.array(identity).max(10000).refine(value => new Set(value).size === value.length).optional() }).strict();

export function sameCaseRef(left: CaseRef | undefined, right: CaseRef | undefined): boolean {
  return left?.caseId === right?.caseId && left?.caseRevision === right?.caseRevision;
}
export function referenceOf(value: DecisionCase): CaseRef { return { caseId: value.id, caseRevision: value.caseRevision }; }
export async function readCase(client: SqlPort, companyId: string, id: string, lock = false): Promise<DecisionCase> {
  const result = await client.query<{ payload: DecisionCase }>(`SELECT payload FROM decision_cases WHERE company_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`, [companyId, id]);
  if (!result.rows[0]) throw new AppError('NOT_FOUND', 'Case not found', 404);
  return result.rows[0].payload;
}
export async function assertCurrentCase(client: SqlPort, companyId: string, ref: CaseRef, snapshot: CompanySnapshot, lock = true): Promise<DecisionCase> {
  const current = await readCase(client, companyId, ref.caseId, lock);
  if (!sameCaseRef(referenceOf(current), ref) || current.businessRevision !== snapshot.revision || current.policyVersion !== snapshot.policyVersion) throw new AppError('STALE_CONTEXT', 'The case or business context changed. Reevaluate before deciding.', 409);
  return current;
}
export function releaseCase(value: DecisionCase): ReleasedCaseContext {
  return { ref: referenceOf(value), evidenceRef: structuredClone(value.evidenceRef), observation: structuredClone(value.observation), relation: structuredClone(value.relation), candidateOrderLineIds: [...value.candidateOrderLineIds], businessRevision: value.businessRevision, policyVersion: value.policyVersion, qualification: value.qualification, impactKind: value.impactKind, ...(value.riskAssumption ? { riskAssumption: structuredClone(value.riskAssumption) } : {}), ...(value.confirmation ? { confirmation: structuredClone(value.confirmation) } : {}), ...(value.testOnly ? { testOnly: true } : {}), ...(value.researchDependency ? { researchDependency: structuredClone(value.researchDependency) } : {}) };
}
export async function hasCurrentConfirmation(client: SqlPort, dossier: DecisionCase, snapshot: CompanySnapshot): Promise<boolean> {
  const parsed = confirmationSchema.safeParse(dossier.confirmation); if (!parsed.success || dossier.riskAssumption || dossier.relation.status !== 'unverified') return false;
  const value = parsed.data;
  if (value.companyId !== snapshot.companyId || value.caseId !== dossier.id || value.caseRevision !== dossier.caseRevision || value.businessRevision !== snapshot.revision || value.policyVersion !== snapshot.policyVersion || value.productId !== dossier.relation.productId) return false;
  const line = snapshot.dataset.tables.purchase_order_lines?.find(item => item.id === value.purchaseOrderLineId && item.product_id === value.productId && item.expected_date === value.confirmedExpectedDate);
  if (!line || !snapshot.dataset.tables.purchase_orders?.some(item => item.id === line.purchase_order_id && item.status === 'confirmed')) return false;
  const result = await client.query<{ payload: unknown; revision: string; actor_id: string }>("SELECT payload,revision,actor_id FROM business_events WHERE id=$1 AND company_id=$2 AND kind='inbound_confirmation'", [value.eventId, snapshot.companyId]);
  const row = result.rows[0]; const event = confirmationSchema.safeParse(row?.payload);
  return Boolean(row && event.success && row.revision === snapshot.revision && row.actor_id === value.actorId && JSON.stringify(event.data) === JSON.stringify(value));
}
interface CaseStore extends SqlPort {
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
  snapshot(companyId: string, client?: PoolClient, lock?: boolean): Promise<CompanySnapshot>;
  replaceSnapshotWithin(client: PoolClient, actor: Actor, expectedRevision: string, next: CompanySnapshot): Promise<CompanySnapshot>;
  researchCurrent?(companyId: string, dependencies: ResearchDependency[], client: SqlPort, requireFresh: boolean): Promise<boolean>;
}
function authorise(actor: Actor): void {
  if (!['direction', 'achats'].includes(actor.role)) throw new AppError('FORBIDDEN', 'An authorised business session is required', 403);
}
function candidates(snapshot: CompanySnapshot, relation: CaseRelation, purchaseOrderLineId?: string, previousExpectedDate?: string | null): string[] {
  if (relation.productId && !snapshot.dataset.tables.products?.some(value => value.id === relation.productId)) throw new AppError('UNKNOWN_PRODUCT', 'Candidate product not found in the company harness');
  if (relation.supplierId && !snapshot.dataset.tables.suppliers?.some(value => value.id === relation.supplierId)) throw new AppError('UNKNOWN_SUPPLIER', 'Candidate supplier not found in the company harness');
  if (relation.status === 'none' || !relation.productId) return [];
  const orders = new Set(snapshot.dataset.tables.orders?.filter(value => value.status === 'confirmed').map(value => value.id));
  const targets = (snapshot.dataset.tables.order_lines ?? []).filter(value => value.product_id === relation.productId && orders.has(value.order_id)).map(value => identity.parse(value.id)).sort();
  if (!purchaseOrderLineId || targets.length === 0) return targets;
  const related = new Set(snapshot.dataset.tables.inbound_allocations?.filter(value => value.purchase_order_line_id === purchaseOrderLineId).map(value => value.order_line_id));
  const current = parseSnapshot(snapshot.dataset);
  const versions = [current];
  // An attributed confirmation retains the actual previous date for exposure analysis.
  // Never advance an inbound date to an invented deadline: that can move its beneficiaries.
  if (previousExpectedDate !== undefined) {
    const previous = structuredClone(current);
    const inbound = previous.inbound.find(value => value.id === purchaseOrderLineId);
    if (inbound) { inbound.expected_date = previousExpectedDate; versions.push(previous); }
  }
  for (const version of versions) {
    const coverage = evaluateOptions(version, policyFromContract(snapshot), targets[0]!).baseline;
    for (const value of coverage) if (value.allocations.some(allocation => allocation.sourceId === purchaseOrderLineId && allocation.quantity > 0)) related.add(value.orderLineId);
  }
  return targets.filter(value => related.has(value));
}
function confirmationTargets(snapshot: CompanySnapshot, relation: CaseRelation, confirmation: InternalConfirmation): string[] {
  const calculated = candidates(snapshot, relation, confirmation.purchaseOrderLineId, confirmation.previousExpectedDate);
  const allowed = new Set(candidates(snapshot, relation));
  const unit = snapshot.dataset.tables.purchase_order_lines?.find(value => value.id === confirmation.purchaseOrderLineId)?.unit;
  return [...new Set([...calculated, ...(confirmation.exposureOrderLineIds ?? [])])].filter(id => allowed.has(id) && snapshot.dataset.tables.order_lines?.some(value => value.id === id && value.unit === unit)).sort();
}
function validateAssumption(snapshot: CompanySnapshot, relation: CaseRelation, assumption: RiskAssumption | undefined): void {
  if (!assumption) return;
  const line = snapshot.dataset.tables.purchase_order_lines?.find(value => value.id === assumption.purchaseOrderLineId);
  if (relation.status !== 'unverified' || !relation.productId || !line || line.product_id !== relation.productId) throw new AppError('INVALID_ASSUMPTION', 'The assumption must target a purchase line for the candidate product.');
  if (relation.supplierId && !snapshot.dataset.tables.purchase_orders?.some(value => value.id === line.purchase_order_id && value.supplier_id === relation.supplierId)) throw new AppError('INVALID_ASSUMPTION', 'The candidate supplier and purchase line do not match.');
  if (assumption.assumedExpectedDate !== null && (typeof line.expected_date !== 'string' || assumption.assumedExpectedDate <= line.expected_date)) throw new AppError('INVALID_ASSUMPTION', 'A delay assumption requires a later date than the current inbound date, or an unknown date.');
}
async function evidence(client: SqlPort, companyId: string, ref: EvidenceRef, mode: 'direct' | 'test' = 'direct'): Promise<SourceEvidence> {
  const row = await client.query<{ result: unknown }>("SELECT result FROM accel_watch_occurrences WHERE company_id=$1 AND id=$2 AND status='completed'", [companyId, ref.occurrenceId]);
  if (!row.rows[0]) throw new AppError('EVIDENCE_NOT_RECEIVED', 'No completed occurrence was found in this company', 404);
  const matches = validateCollectionResult(row.rows[0].result).sources.flatMap(source => source.evidence).filter(item => item.id === ref.evidenceId);
  if (matches.length !== 1 || matches[0]!.contentHash !== ref.contentHash || matches[0]!.mode !== mode) throw new AppError('EVIDENCE_NOT_RECEIVED', 'The exact evidence is missing, ambiguous or has the wrong execution mode');
  return structuredClone(matches[0]!);
}
async function saveVersion(client: SqlPort, current: DecisionCase): Promise<void> {
  await client.query('UPDATE decision_cases SET payload=$2 WHERE id=$1 AND company_id=$3', [current.id, current, current.companyId]);
  await client.query('INSERT INTO case_versions(company_id,case_id,case_revision,payload) VALUES($1,$2,$3,$4)', [current.companyId, current.id, current.caseRevision, current]);
  await client.query("UPDATE proposals SET payload=jsonb_set(payload,'{status}','\"stale\"') WHERE company_id=$1 AND payload->'caseRef'->>'caseId'=$2 AND payload->>'status'='pending'", [current.companyId, current.id]);
}
export class CaseRepository {
  constructor(private readonly store: CaseStore) {}
  async list(companyId: string): Promise<DecisionCase[]> { return (await this.store.query<{ payload: DecisionCase }>('SELECT payload FROM decision_cases WHERE company_id=$1 ORDER BY payload->>\'createdAt\' DESC LIMIT 100', [companyId])).rows.map(row => row.payload); }
  async history(companyId: string, id: string): Promise<{ current: DecisionCase; versions: DecisionCase[] }> {
    return await this.store.transaction(async client => {
      await this.store.snapshot(companyId, client, true);
      const current = await readCase(client, companyId, id, true);
      const versions = (await client.query<{ payload: DecisionCase }>('SELECT payload FROM case_versions WHERE company_id=$1 AND case_id=$2 ORDER BY payload->>\'createdAt\' DESC', [companyId, id])).rows.map(row => row.payload);
      return { current, versions };
    });
  }
  private async command<T>(actor: Actor, key: string, input: unknown, action: (client: PoolClient, snapshot: CompanySnapshot) => Promise<T>, operatorOnly = false): Promise<T> {
    if (operatorOnly) { if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator session required.', 403); } else authorise(actor);
    const hash = createHash('sha256').update(JSON.stringify({ actorId: actor.actorId, input })).digest('hex');
    return await this.store.transaction(async client => {
      const snapshot = await this.store.snapshot(actor.companyId, client, true);
      await assertGenericScope(client, actor.companyId);
      const receipt = await client.query<{ command_hash: string; result: T }>('SELECT command_hash,result FROM case_commands WHERE company_id=$1 AND operation_key=$2', [actor.companyId, key]);
      if (receipt.rows[0]) {
        if (receipt.rows[0].command_hash !== hash) throw new AppError('OPERATION_CONFLICT', 'This key identifies another case command.', 409);
        return receipt.rows[0].result;
      }
      const result = await action(client, snapshot);
      await client.query('INSERT INTO case_commands(company_id,operation_key,command_hash,result) VALUES($1,$2,$3,$4)', [actor.companyId, key, hash, result]);
      return result;
    });
  }
  async create(actor: Actor, received: CaseInput): Promise<DecisionCase> {
    const input = caseInputSchema.parse(received);
    return await this.command(actor, input.operationKey, { operation: 'create', input }, async (client, snapshot) => {
      const observation = await evidence(client, actor.companyId, input.evidenceRef);
      validateAssumption(snapshot, input.relation, input.riskAssumption);
      const value: DecisionCase = { id: `case:${randomUUID()}`, companyId: actor.companyId, caseRevision: `C-${randomUUID()}`, previousRevision: null, evidenceRef: input.evidenceRef, observation, relation: input.relation, candidateOrderLineIds: candidates(snapshot, input.relation, input.riskAssumption?.purchaseOrderLineId), businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, qualification: input.relation.status === 'none' ? 'no_known_exposure' : 'to_verify', impactKind: input.riskAssumption ? 'risk' : 'undetermined', ...(input.riskAssumption ? { riskAssumption: input.riskAssumption } : {}), actorId: actor.actorId, createdAt: new Date().toISOString() };
      await client.query('INSERT INTO decision_cases(id,company_id,payload) VALUES($1,$2,$3)', [value.id, value.companyId, value]);
      await saveVersion(client, value); return value;
    });
  }
  async createControlled(actor: Actor, received: CaseInput, context: ResearchContext): Promise<DecisionCase> {
    const input = caseInputSchema.parse(received);
    return await this.command(actor, input.operationKey, { operation: 'create-controlled', input, scope: context.scope, generation: context.generation }, async (client, snapshot) => {
      const receivedProof = context.observations.find(value => sameEvidenceRef(value.ref, input.evidenceRef));
      if (context.companyId !== actor.companyId || context.scope.namespace !== 'controlled' || context.state !== 'reusable' || !receivedProof?.testOnly || receivedProof.evidence.mode !== 'test') throw new AppError('EVIDENCE_NOT_RECEIVED', 'A current explicitly controlled test observation is required.');
      const dependency: ResearchDependency = { scope: structuredClone(context.scope), generation: context.generation, validUntil: context.validUntil, evidenceRefs: context.observations.map(value => structuredClone(value.ref)) };
      if (!this.store.researchCurrent || !await this.store.researchCurrent(actor.companyId, [dependency], client, true)) throw new AppError('STALE_CONTEXT', 'Controlled research changed or expired.', 409);
      const observation = await evidence(client, actor.companyId, input.evidenceRef, 'test');
      validateAssumption(snapshot, input.relation, input.riskAssumption);
      const value: DecisionCase = { id: `case:${randomUUID()}`, companyId: actor.companyId, caseRevision: `C-${randomUUID()}`, previousRevision: null, evidenceRef: input.evidenceRef, observation, relation: input.relation, candidateOrderLineIds: candidates(snapshot, input.relation, input.riskAssumption?.purchaseOrderLineId), businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, qualification: input.relation.status === 'none' ? 'no_known_exposure' : 'to_verify', impactKind: input.riskAssumption ? 'risk' : 'undetermined', ...(input.riskAssumption ? { riskAssumption: input.riskAssumption } : {}), actorId: actor.actorId, createdAt: new Date().toISOString(), testOnly: true, researchDependency: dependency };
      await client.query('INSERT INTO decision_cases(id,company_id,payload) VALUES($1,$2,$3)', [value.id, value.companyId, value]);
      await saveVersion(client, value); return value;
    }, true);
  }
  async revise(actor: Actor, id: string, received: CaseRevisionInput): Promise<DecisionCase> {
    const input = caseRevisionSchema.parse(received);
    return await this.command(actor, input.operationKey, { operation: 'revise', id, input }, async (client, snapshot) => {
      const current = await readCase(client, actor.companyId, id, true);
      if (current.caseRevision !== input.expectedCaseRevision) throw new AppError('STALE_CONTEXT', 'The case version changed', 409);
      if (current.testOnly) throw new AppError('CONTROLLED_CASE', 'A controlled test case requires a new explicitly controlled source reception.', 409);
      validateAssumption(snapshot, input.relation, input.riskAssumption);
      const updated: DecisionCase = { ...current, caseRevision: `C-${randomUUID()}`, previousRevision: current.caseRevision, evidenceRef: input.evidenceRef, observation: await evidence(client, actor.companyId, input.evidenceRef), relation: input.relation, candidateOrderLineIds: candidates(snapshot, input.relation, input.riskAssumption?.purchaseOrderLineId), businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, qualification: input.relation.status === 'none' ? 'no_known_exposure' : 'to_verify', impactKind: input.riskAssumption ? 'risk' : 'undetermined', riskAssumption: input.riskAssumption, confirmation: undefined, actorId: actor.actorId, createdAt: new Date().toISOString() };
      await saveVersion(client, updated); return updated;
    });
  }
  async analyze(actor: Actor, id: string, received: CaseAnalysisInput): Promise<AgentRun> {
    const input = caseAnalysisSchema.parse(received);
    return await this.command(actor, input.operationKey, { operation: 'analyze', id, input }, async (client, snapshot) => {
      const collision = await client.query('SELECT id FROM runs WHERE company_id=$1 AND operation_key=$2', [actor.companyId, input.operationKey]);
      if (collision.rowCount) throw new AppError('OPERATION_CONFLICT', 'This key already identifies another run command.', 409);
      let current = await readCase(client, actor.companyId, id, true);
      if (current.researchDependency && (!this.store.researchCurrent || !await this.store.researchCurrent(actor.companyId, [current.researchDependency], client, true))) throw new AppError('STALE_CONTEXT', 'The case research changed or expired. Receive a current source version first.', 409);
      if (current.caseRevision !== input.expectedCaseRevision) throw new AppError('STALE_CONTEXT', 'The case version changed', 409);
      const confirmed = current.confirmation !== undefined && await hasCurrentConfirmation(client, current, snapshot);
      const currentTargets = confirmed ? confirmationTargets(snapshot, current.relation, current.confirmation!) : candidates(snapshot, current.relation, current.riskAssumption?.purchaseOrderLineId);
      if (current.businessRevision !== snapshot.revision || current.policyVersion !== snapshot.policyVersion || (current.confirmation !== undefined && !confirmed) || JSON.stringify(currentTargets) !== JSON.stringify(current.candidateOrderLineIds)) {
        validateAssumption(snapshot, current.relation, current.riskAssumption);
        current = { ...current, caseRevision: `C-${randomUUID()}`, previousRevision: current.caseRevision, candidateOrderLineIds: candidates(snapshot, current.relation, current.riskAssumption?.purchaseOrderLineId), businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, confirmation: undefined, impactKind: current.riskAssumption ? 'risk' : 'undetermined', actorId: actor.actorId, createdAt: new Date().toISOString() };
        await saveVersion(client, current);
      }
      const run: AgentRun = { id: randomUUID(), companyId: actor.companyId, actorId: actor.actorId, operationKey: input.operationKey, question: input.question, status: 'queued', revision: snapshot.revision, policyVersion: snapshot.policyVersion, mode: 'direct', model: null, proposalId: null, message: null, traces: [], createdAt: new Date().toISOString(), completedAt: null, caseRef: referenceOf(current) };
      if (current.researchDependency) run.researchScope = structuredClone(current.researchDependency.scope);
      await client.query('INSERT INTO runs(id,company_id,operation_key,actor,payload) VALUES($1,$2,$3,$4,$5)', [run.id, actor.companyId, run.operationKey, actor, run]);
      return run;
    });
  }
  async confirm(actor: Actor, id: string, received: CaseConfirmationInput): Promise<DecisionCase> {
    const input = caseConfirmationSchema.parse(received);
    return await this.command(actor, input.operationKey, { operation: 'confirm-inbound', id, input }, async (client, snapshot) => {
      const current = await readCase(client, actor.companyId, id, true);
      if (current.caseRevision !== input.expectedCaseRevision || snapshot.revision !== input.expectedRevision) throw new AppError('STALE_CONTEXT', 'The case or business revision changed.', 409);
      if (current.researchDependency && (!this.store.researchCurrent || !await this.store.researchCurrent(actor.companyId, [current.researchDependency], client, true))) throw new AppError('STALE_CONTEXT', 'The research source changed or expired.', 409);
      const line = snapshot.dataset.tables.purchase_order_lines?.find(value => value.id === input.purchaseOrderLineId);
      if (current.relation.status !== 'unverified' || !line || line.product_id !== current.relation.productId || !snapshot.dataset.tables.purchase_orders?.some(value => value.id === line.purchase_order_id && value.status === 'confirmed')) throw new AppError('INVALID_CONFIRMATION', 'A current, already confirmed purchase of the candidate product is required.');
      if (current.relation.supplierId && !snapshot.dataset.tables.purchase_orders?.some(value => value.id === line.purchase_order_id && value.supplier_id === current.relation.supplierId)) throw new AppError('INVALID_CONFIRMATION', 'The candidate supplier does not match this purchase.');
      const inherited = current.confirmation?.purchaseOrderLineId === input.purchaseOrderLineId && await hasCurrentConfirmation(client, current, snapshot) ? confirmationTargets(snapshot, current.relation, current.confirmation) : [];
      const beforeTargets = candidates(snapshot, current.relation, input.purchaseOrderLineId);
      const next = structuredClone(snapshot); next.dataset.tables.purchase_order_lines!.find(value => value.id === line.id)!.expected_date = input.confirmedExpectedDate;
      const updated = await this.store.replaceSnapshotWithin(client, actor, snapshot.revision, next);
      const caseRevision = `C-${randomUUID()}`;
      const confirmation: InternalConfirmation = { kind: 'inbound_date_confirmed', eventId: randomUUID(), companyId: actor.companyId, caseId: id, caseRevision, purchaseOrderLineId: input.purchaseOrderLineId, productId: String(line.product_id), previousExpectedDate: typeof line.expected_date === 'string' ? line.expected_date : null, confirmedExpectedDate: input.confirmedExpectedDate, actorId: actor.actorId, confirmedAt: new Date().toISOString(), basis: input.basis, businessRevision: updated.revision, policyVersion: updated.policyVersion, dataOrigin: 'synthetic', exposureOrderLineIds: [...new Set([...beforeTargets, ...inherited, ...candidates(updated, current.relation, input.purchaseOrderLineId)])].sort() };
      await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [confirmation.eventId, actor.companyId, updated.revision, actor.actorId, 'inbound_confirmation', confirmation]);
      const value: DecisionCase = { ...current, caseRevision, previousRevision: current.caseRevision, riskAssumption: undefined, confirmation, impactKind: 'risk', candidateOrderLineIds: confirmationTargets(updated, current.relation, confirmation), businessRevision: updated.revision, policyVersion: updated.policyVersion, actorId: actor.actorId, createdAt: new Date().toISOString() };
      await saveVersion(client, value); return value;
    }, true);
  }
}
