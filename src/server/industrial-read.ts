import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Actor, AgentRun, CompanySnapshot } from '../contracts/index.js';
import type { IndustrialAnalysisIntent, IndustrialApproval, IndustrialBasis, IndustrialContext, IndustrialDemoExecution, IndustrialReport, ReleasedIndustrialEvent } from '../contracts/industrial.js';
import type { IndustrialQuestionInput, IndustrialReportView, IndustrialWorkspace } from '../contracts/industrial-api.js';
import { currentIndustrialContext, parseIndustrialContext } from '../data/industrial-relations.js';
import { createIndustrialAnalysisTrigger } from '../data/analysis-trigger.js';
import { AppError, PgStore } from './store.js';
import { hasIndustrialScope } from './industrial-boundary.js';
import { DataWatchError } from '../data/validation.js';

export function industrialHash(value: unknown): string {
  const canonical = (item: unknown): string => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(canonical).join(',')}]`;
    if (typeof item === 'object' && item !== null) return `{${Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
    throw new AppError('INVALID_INDUSTRIAL_STATE', 'The industrial state is invalid.', 503);
  };
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export interface IndustrialReadService {
  isIndustrial(companyId: string): Promise<boolean>;
  workspace(actor: Actor): Promise<IndustrialWorkspace>;
  report(actor: Actor, id: string): Promise<IndustrialReportView>;
  question?(actor: Actor, input: IndustrialQuestionInput): Promise<AgentRun>;
}
export interface IndustrialReadOptions {
  decorate?(client: PoolClient, actor: Actor, snapshot: CompanySnapshot, context: IndustrialContext, view: IndustrialWorkspace): Promise<IndustrialWorkspace>;
}
export class IndustrialReadRepository implements IndustrialReadService {
  constructor(private readonly store: PgStore, private readonly options: IndustrialReadOptions = {}) {}
  private readonly intentReader = createIndustrialAnalysisTrigger({ servicePrincipalId: 'SERVICE-INDUSTRIAL-ANALYSIS',
    resolvePrincipal: async () => null, validateBasis: async () => false });
  async isIndustrial(companyId: string): Promise<boolean> {
    return await hasIndustrialScope(this.store, companyId);
  }
  async context(client: PoolClient, snapshot: CompanySnapshot): Promise<IndustrialContext> {
    return currentIndustrialContext(await this.storedContext(client, snapshot.companyId), snapshot, new Date().toISOString());
  }
  private async storedContext(client: PoolClient, companyId: string): Promise<IndustrialContext> {
    const result = await client.query<{ payload: IndustrialContext }>('SELECT v.payload FROM accel_industrial_context_heads h JOIN accel_industrial_context_versions v USING(company_id,revision) WHERE h.company_id=$1', [companyId]);
    if (!result.rows[0]) throw new AppError('INDUSTRIAL_CONTEXT_NOT_RECEIVED', 'The company context has not been imported.', 404);
    return result.rows[0].payload;
  }
  async importContext(actor: Actor, value: unknown, expectedRevision: string, operationKey: string, sourceManifestHash: string): Promise<IndustrialContext> {
    if (actor.role !== 'operator') throw new AppError('FORBIDDEN', 'Operator authority required for an explicit import.', 403);
    if (!/^[a-f0-9]{64}$/.test(sourceManifestHash) || !/^[a-zA-Z0-9:_-]{8,128}$/.test(operationKey)) throw new AppError('INVALID_INPUT', 'Invalid import identity.');
    return await this.store.transaction(async client => {
      const snapshot = await this.store.snapshot(actor.companyId, client, true);
      const commandHash = industrialHash({ context: value, expectedRevision, sourceManifestHash, actorId: actor.actorId });
      const prior = await client.query<{ command_hash: string; payload: IndustrialContext }>('SELECT command_hash,payload FROM accel_industrial_context_versions WHERE company_id=$1 AND operation_key=$2', [actor.companyId, operationKey]);
      if (prior.rows[0]) {
        if (prior.rows[0].command_hash !== commandHash) throw new AppError('OPERATION_CONFLICT', 'Import key already identifies different data.', 409);
        return prior.rows[0].payload;
      }
      const parsed = parseIndustrialContext(value, snapshot);
      if (snapshot.revision !== expectedRevision) throw new AppError('STALE_CONTEXT', 'The company changed before import.', 409);
      currentIndustrialContext(parsed, snapshot, new Date().toISOString());
      const running = await client.query("SELECT id FROM runs WHERE company_id=$1 AND payload->>'status'='running' AND lease_until>clock_timestamp() AND NOT (payload ? 'industrialScope') AND NOT (payload ? 'pdfProfileId') LIMIT 1", [actor.companyId]);
      if (running.rowCount) throw new AppError('ANALYSIS_IN_PROGRESS', 'Wait for the current generic analysis to finish before importing industrial context.', 409);
      await client.query(`UPDATE runs SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{status}',
        CASE WHEN payload->>'status'='running' THEN '"uncertain"'::jsonb ELSE '"stale_context"'::jsonb END),'{message}',
        CASE WHEN payload->>'status'='running' THEN '"Industrial context imported after lease expiry. Provider outcome unknown; reconcile the saved attempt."'::jsonb ELSE '"Industrial context imported. Use a bounded industrial analysis."'::jsonb END),'{completedAt}',to_jsonb(clock_timestamp()::text)),fence=fence+1,lease_until=NULL
        WHERE company_id=$1 AND payload->>'status' IN ('queued','running') AND NOT (payload ? 'industrialScope') AND NOT (payload ? 'pdfProfileId')`, [actor.companyId]);
      await client.query("UPDATE proposals SET payload=jsonb_set(payload,'{status}','\"stale\"') WHERE company_id=$1 AND payload->>'status'='pending'", [actor.companyId]);
      await client.query('INSERT INTO accel_industrial_context_versions(company_id,revision,payload,source_manifest_hash,actor_id,operation_key,command_hash) VALUES($1,$2,$3,$4,$5,$6,$7)', [actor.companyId, parsed.revision, parsed, sourceManifestHash, actor.actorId, operationKey, commandHash]);
      await client.query('INSERT INTO accel_industrial_context_heads(company_id,revision) VALUES($1,$2) ON CONFLICT(company_id) DO UPDATE SET revision=excluded.revision', [actor.companyId, parsed.revision]);
      await client.query('INSERT INTO accel_industrial_principals(company_id,id,role,active) VALUES($1,$2,$3,true) ON CONFLICT DO NOTHING', [actor.companyId, 'SERVICE-INDUSTRIAL-ANALYSIS', 'analysis_only']);
      return parsed;
    });
  }
  async workspace(actor: Actor): Promise<IndustrialWorkspace> {
    return await this.store.transaction(async client => await this.readWithin(client, actor));
  }
  async report(actor: Actor, id: string): Promise<IndustrialReportView> {
    if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(id)) throw new AppError('INVALID_INPUT', 'Invalid report identity.');
    return await this.store.transaction(async client => {
      const view = await this.readWithin(client, actor, id);
      if (!view.reports[0]) throw new AppError('NOT_FOUND', 'Report not found.', 404);
      return view.reports[0];
    });
  }
  private async readWithin(client: PoolClient, actor: Actor, reportId?: string): Promise<IndustrialWorkspace> {
    const snapshot = await this.store.snapshot(actor.companyId, client, true);
    const asOf = new Date().toISOString();
    let context = await this.storedContext(client, actor.companyId); let contextCurrent = true;
    try { context = currentIndustrialContext(context, snapshot, asOf); }
    catch (error) { if (!(error instanceof DataWatchError)) throw error; contextCurrent = false; }
    const timeZone = snapshot.dataset.tables.company?.[0]?.timezone;
    let businessDay: string | null = null;
    if (typeof timeZone === 'string') {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf));
        const part = (type: string): string => parts.find(value => value.type === type)?.value ?? '';
        businessDay = `${part('year')}-${part('month')}-${part('day')}`;
      } catch { /* An unknown business calendar cannot establish resource freshness. */ }
    }
    const releases = (await client.query<{ payload: ReleasedIndustrialEvent }>('SELECT r.payload FROM accel_industrial_event_heads h JOIN accel_industrial_releases r ON r.company_id=h.company_id AND r.id=h.release_id WHERE h.company_id=$1 ORDER BY r.created_at DESC,r.id LIMIT 20', [actor.companyId])).rows.map(row => row.payload);
    const reports = (await client.query<{ payload: IndustrialReport }>(`SELECT payload FROM accel_industrial_reports WHERE company_id=$1${reportId ? ' AND id=$2' : ''} ORDER BY created_at DESC,id LIMIT 50`, reportId ? [actor.companyId, reportId] : [actor.companyId])).rows.map(row => row.payload);
    const reportIds = reports.map(value => value.id);
    const basisReleases = (await client.query<{ payload: ReleasedIndustrialEvent }>('SELECT r.payload FROM accel_industrial_event_heads h JOIN accel_industrial_releases r ON r.company_id=h.company_id AND r.id=h.release_id WHERE h.company_id=$1 AND h.event_id=ANY($2::text[])', [actor.companyId, reports.map(value => value.basis.eventId)])).rows.map(row => row.payload);
    const approvals = (await client.query<{ payload: IndustrialApproval }>('SELECT payload FROM accel_industrial_approvals WHERE company_id=$1 AND report_id=ANY($2::text[]) ORDER BY created_at DESC,id', [actor.companyId, reportIds])).rows.map(row => row.payload);
    const executions = (await client.query<{ payload: IndustrialDemoExecution }>('SELECT e.payload FROM accel_industrial_executions e JOIN accel_industrial_approvals a ON a.company_id=e.company_id AND a.id=e.approval_id WHERE e.company_id=$1 AND a.report_id=ANY($2::text[]) ORDER BY e.created_at DESC,e.id', [actor.companyId, reportIds])).rows.map(row => row.payload);
    const imported = await client.query<{ created_at: Date }>("SELECT created_at FROM business_events WHERE company_id=$1 AND kind='industrial_core_import' ORDER BY created_at LIMIT 1", [actor.companyId]);
    if (!imported.rows[0]) throw new AppError('INDUSTRIAL_IMPORT_NOT_RECEIVED', 'The explicit core import receipt is missing.', 503);
    const reportViews: IndustrialReportView[] = [];
    for (const report of reports) {
      const basisCurrent = (basis: IndustrialBasis): boolean => basis.companyId === snapshot.companyId && basis.businessRevision === snapshot.revision && basis.policyVersion === snapshot.policyVersion && basis.contextRevision === context.revision && basis.qualificationRevision === context.qualificationRevision && basisReleases.some(release => release.event.eventId === basis.eventId && release.revision === basis.eventRevision);
      const quotesCurrent = report.assessment.plans.every(plan => plan.steps.every(step => {
        if (step.kind === 'purchase') return context.independentAlternatives.some(quote => quote.quoteId === step.quoteId && quote.canonicalResourceId === step.canonicalResourceId);
        if (step.kind === 'transfer' && step.quoteSource === 'industrial_delivery') return context.deliveryQuotes.some(quote => quote.quoteId === step.quoteId);
        if (step.kind === 'transfer') return businessDay !== null && (snapshot.dataset.tables.transport_quotes?.some(quote => quote.id === step.quoteId && quote.quote_status === 'synthetic_confirmed' && quote.valid_on === businessDay) ?? false);
        return true;
      }));
      const current = contextCurrent && quotesCurrent && basisCurrent(report.basis) && (report.basis.researchDependencies.length === 0 || await this.store.researchCurrent(actor.companyId, report.basis.researchDependencies, client, true));
      reportViews.push({ report, freshness: current ? 'current' : 'stale', planStates: report.assessment.plans.map(plan => {
        const approval = approvals.find(value => value.planId === plan.id && value.planHash === industrialHash(plan)) ?? null;
        const execution = approval ? executions.find(value => value.approvalId === approval.id) ?? null : null;
        return { planId: plan.id, planVersion: plan.version, planHash: industrialHash(plan), status: approval ? approval.decision : current ? 'pending' : 'stale', approval, execution, permissions: { canApprove: false, canReject: false, canSimulate: false, blockedReason: current ? 'Industrial actions are not connected yet.' : 'The report context changed. Wait for a current analysis.' } };
      }) });
    }
    const name = snapshot.dataset.tables.company?.[0]?.name;
    const intentRows = await client.query<{ id: string }>('SELECT id FROM accel_industrial_analysis_intents WHERE company_id=$1 ORDER BY created_at DESC,id LIMIT 50', [actor.companyId]);
    const analyses: IndustrialAnalysisIntent[] = [];
    for (const row of intentRows.rows) {
      const value = await this.intentReader.get(client, actor.companyId, row.id);
      if (!value) throw new AppError('INVALID_INDUSTRIAL_STATE', 'An analysis record is missing.', 503);
      analyses.push(value);
    }
    const view: IndustrialWorkspace = {
      company: { id: snapshot.companyId, name: typeof name === 'string' ? name : snapshot.companyId, businessRevision: snapshot.revision, policyVersion: snapshot.policyVersion, dataOrigin: 'synthetic', importedAt: imported.rows[0].created_at.toISOString(), counts: Object.fromEntries(Object.entries(snapshot.dataset.tables).map(([key, rows]) => [key, rows.length])) },
      context: { revision: context.revision, qualificationRevision: context.qualificationRevision, activity: context.companyProfile.activity, countries: context.companyProfile.countries, regions: context.companyProfile.regions, receivedAt: context.receivedAt, counts: { supplierSites: context.supplierSites.length, supplierDependencies: context.supplierDependencies.length, competitors: context.competitors.length, qualifiedDemands: context.commercialDemand.length } },
      actor, events: releases, reports: reportViews, analyses,
      capabilities: { automaticAnalysis: false, simulationOnly: true, publicEvidenceIsSeparate: true, decisionsConnected: false, simulationConnected: false },
    };
    return this.options.decorate ? await this.options.decorate(client, actor, snapshot, context, view) : view;
  }
}
