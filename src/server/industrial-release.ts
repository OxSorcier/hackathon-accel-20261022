import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Actor, CompanySnapshot } from '../contracts/index.js';
import type { IndustrialAnalysisIntent, IndustrialBasis, IndustrialContext, IndustrialEvaluationInput, ReleasedIndustrialEvent } from '../contracts/industrial.js';
import type { ResearchDependency } from '../contracts/research.js';
import { evaluateIndustrialPlan } from '../domain/industrial.js';
import { readIndustrialExecutionState } from './industrial-execution.js';
import { AppError, PgStore } from './store.js';
import { industrialHash } from './industrial-read.js';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9:_.-]+$/);
const date = z.iso.datetime({ offset: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
const provenance = z.object({ system: z.literal('SCENARIO'), nativeId: id, version: id, receivedAt: date, actorId: id }).strict();
const payloadSchema = z.object({
  event: z.object({ eventId: id, version: id, kind: z.literal('industrial_fire'), occurredAt: date, supplierId: id, supplierSiteId: id, competitorIds: z.array(id).max(20), productIds: z.array(id).max(20), status: z.literal('declared_synthetic_scenario'), testOnly: z.literal(true), provenance, publicSourceEvidenceRefs: z.array(z.never()).max(0) }).strict(),
  confirmations: z.array(z.object({ confirmationId: id, eventId: id, supplierId: id, supplierSiteId: id, purchaseOrderLineId: id, previousExpectedDate: day.nullable(), confirmedExpectedDate: day, confirmedAt: date, confirmationStatus: z.literal('synthetic_confirmed'), provenance }).strict()).max(20),
  competitorConfirmations: z.array(z.object({ confirmationId: id, eventId: id, competitorId: id, supplierSiteId: id, productId: id, unit: id, quantity: z.number().int().positive().safe(), requestedDeliveryDate: day, cannotFulfilBefore: day, relatedOpportunityId: id, confirmedAt: date, confirmationStatus: z.literal('synthetic_confirmed'), provenance }).strict()).max(20),
}).strict();

export interface IndustrialReleaseOptions {
  store: PgStore;
  context(client: PoolClient, snapshot: CompanySnapshot): Promise<IndustrialContext>;
  dependencies(client: PoolClient, actor: Actor): Promise<ResearchDependency[]>;
  enqueue(client: PoolClient, basis: IndustrialBasis): Promise<IndustrialAnalysisIntent>;
}
export interface IndustrialReleaseResult { release: ReleasedIndustrialEvent; analysis: IndustrialAnalysisIntent }

export function basisOfIndustrialRelease(value: ReleasedIndustrialEvent): IndustrialBasis {
  return { companyId: value.companyId, businessRevision: value.businessRevision, policyVersion: value.policyVersion, contextRevision: value.contextRevision, qualificationRevision: value.qualificationRevision, eventId: value.event.eventId, eventRevision: value.revision, researchDependencies: structuredClone(value.researchDependencies) };
}

/** Explicit controlled event and independent confirmations are never loaded at startup. */
export class IndustrialReleaseRepository {
  constructor(private readonly options: IndustrialReleaseOptions) {}
  async release(actor: Actor, value: unknown, expectedRevision: string, operationKey: string): Promise<IndustrialReleaseResult> {
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Explicit operator release required.', 403);
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(operationKey)) throw new AppError('INVALID_INPUT', 'Invalid release identity.');
    const payload = payloadSchema.parse(value); const commandHash = industrialHash({ actorId: actor.actorId, expectedRevision, payload });
    return await this.options.store.transaction(async client => {
      const snapshot = await this.options.store.snapshot(actor.companyId, client, true);
      const prior = (await client.query<{ command_hash: string; payload: ReleasedIndustrialEvent }>('SELECT command_hash,payload FROM accel_industrial_releases WHERE company_id=$1 AND operation_key=$2', [actor.companyId, operationKey])).rows[0];
      if (prior) {
        if (prior.command_hash !== commandHash) throw new AppError('OPERATION_CONFLICT', 'Release key identifies different facts.', 409);
        return { release: prior.payload, analysis: await this.options.enqueue(client, basisOfIndustrialRelease(prior.payload)) };
      }
      if (snapshot.revision !== expectedRevision) throw new AppError('STALE_CONTEXT', 'Business context changed before release.', 409);
      const context = await this.options.context(client, snapshot);
      const changed = structuredClone(snapshot);
      const seen = new Set<string>();
      for (const confirmation of payload.confirmations) {
        if (confirmation.eventId !== payload.event.eventId || confirmation.supplierId !== payload.event.supplierId || confirmation.supplierSiteId !== payload.event.supplierSiteId || seen.has(confirmation.purchaseOrderLineId)) throw new AppError('INVALID_CONFIRMATION', 'Confirmation scope is inconsistent.');
        seen.add(confirmation.purchaseOrderLineId);
        const line = changed.dataset.tables.purchase_order_lines?.find(item => item.id === confirmation.purchaseOrderLineId);
        if (!line || line.expected_date !== confirmation.previousExpectedDate || !payload.event.productIds.includes(String(line.product_id))) throw new AppError('INVALID_CONFIRMATION', 'The previous native inbound fact changed.', 409);
        if (!changed.dataset.tables.purchase_orders?.some(order => order.id === line.purchase_order_id && order.supplier_id === confirmation.supplierId && order.status === 'confirmed')) throw new AppError('INVALID_CONFIRMATION', 'The native purchase order is not confirmed.');
        if (!context.supplierDependencies.some(dependency => dependency.supplierId === confirmation.supplierId && dependency.supplierSiteId === confirmation.supplierSiteId && dependency.purchaseOrderLineIds.includes(confirmation.purchaseOrderLineId))) throw new AppError('INVALID_CONFIRMATION', 'The received supplier dependency does not cover this line.');
        line.expected_date = confirmation.confirmedExpectedDate;
      }
      const next = await this.options.store.replaceSnapshotWithin(client, actor, expectedRevision, changed);
      const at = new Date().toISOString();
      const release: ReleasedIndustrialEvent = { ...payload, id: `industrial-release:${randomUUID()}`, companyId: actor.companyId, revision: `IR-${randomUUID()}`, businessRevision: next.revision, policyVersion: next.policyVersion, contextRevision: context.revision, qualificationRevision: context.qualificationRevision, releasedByActorId: actor.actorId, releasedAt: at, researchDependencies: await this.options.dependencies(client, actor) };
      const demand = context.commercialDemand[0];
      if (!demand) throw new AppError('NEEDS_INPUT', 'A received qualified demand is required for this controlled case.', 409);
      const input: IndustrialEvaluationInput = { snapshot: next, context, releasedEvent: release, executionState: await readIndustrialExecutionState(client, actor.companyId, next.revision), demandId: demand.opportunityId, evaluatedAt: at };
      evaluateIndustrialPlan(input);
      await client.query('INSERT INTO accel_industrial_releases(id,company_id,event_id,revision,payload,operation_key,command_hash) VALUES($1,$2,$3,$4,$5,$6,$7)', [release.id, actor.companyId, release.event.eventId, release.revision, release, operationKey, commandHash]);
      await client.query('INSERT INTO accel_industrial_event_heads(company_id,event_id,release_id) VALUES($1,$2,$3) ON CONFLICT(company_id,event_id) DO UPDATE SET release_id=excluded.release_id', [actor.companyId, release.event.eventId, release.id]);
      for (const confirmation of [...payload.confirmations, ...payload.competitorConfirmations]) await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [`${release.id}:${confirmation.confirmationId}`, actor.companyId, next.revision, actor.actorId, 'industrial_independent_confirmation', confirmation]);
      await client.query('INSERT INTO business_events(id,company_id,revision,actor_id,kind,payload) VALUES($1,$2,$3,$4,$5,$6)', [release.id, actor.companyId, next.revision, actor.actorId, 'industrial_controlled_release', { eventId: release.event.eventId, releaseId: release.id, previousRevision: snapshot.revision, testOnly: true }]);
      return { release, analysis: await this.options.enqueue(client, basisOfIndustrialRelease(release)) };
    });
  }
}
