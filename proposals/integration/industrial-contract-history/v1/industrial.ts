import type { CompanySnapshot, EvidenceRef } from './index.js';
import type { ResearchDependency } from './research.js';

/** Synthetic native business records are data, never authentication or approval. */
export interface IndustrialProvenance {
  system: 'ERP_DEMO' | 'CRM_DEMO' | 'SCENARIO';
  nativeId: string; version: string; receivedAt: string; actorId: string;
}
export interface IndustrialSite {
  supplierSiteId: string; supplierId: string; name: string; country: string;
  region: string; productIds: string[]; provenance: IndustrialProvenance;
}
export interface IndustrialDependency {
  id: string; supplierId: string; supplierSiteId: string; productId: string;
  purchaseOrderLineIds: string[]; orderLineIds: string[];
  status: 'confirmed_in_synthetic_master'; provenance: IndustrialProvenance;
}
export interface IndustrialCompetitor {
  id: string; name: string; productIds: string[]; regions: string[];
  supplierSiteIds: string[]; provenance: IndustrialProvenance;
}
export interface QualifiedIndustrialDemand {
  opportunityId: string; customerId: string; projectId: string; productId: string;
  unit: string; quantity: number; needDate: string; destinationDepotId: string;
  saleUnitPriceCents: number; customerMaximumUnitPriceCents: number | null;
  confirmedAt: string; ownerActorId: string; confirmationStatus: 'synthetic_confirmed';
  currency: 'EUR'; provenance: IndustrialProvenance;
}
export interface IndustrialStockValuation {
  stockId: string; productId: string; unit: string; unitCostCents: number;
  currency: 'EUR'; provenance: IndustrialProvenance;
}
export interface IndustrialDeliveryQuote {
  quoteId: string; sourceStockId: string; fromDepotId: string; destinationDepotId: string;
  productId: string; unit: string; availableQuantity: number;
  freightCents: number; handlingCents: number; dispatchDate: string; arrivalDate: string;
  validUntil: string; confirmationStatus: 'synthetic_confirmed'; provenance: IndustrialProvenance;
}
export interface IndustrialAlternative {
  /** This must name the existing C1 emergency resource. Aliases never add capacity. */
  canonicalResourceId: string; quoteId: string; supplierId: string; supplierSiteId: string;
  affectedSiteRelation: 'independent' | 'unknown' | 'affected'; productId: string; unit: string;
  availableQuantity: number; unitCostCents: number; freightCents: number;
  arrivalDate: string; validUntil: string; confirmationStatus: 'synthetic_confirmed';
  provenance: IndustrialProvenance;
}
export interface IndustrialContext {
  schema: 'adaptops-industrial/1'; companyId: string; revision: string;
  qualificationRevision: string; dataOrigin: 'synthetic'; receivedAt: string;
  companyProfile: { activity: string; countries: string[]; regions: string[]; provenance: IndustrialProvenance };
  projectOwners: { projectId: string; customerId: string; siteId: string; ownerActorId: string; provenance: IndustrialProvenance }[];
  supplierSites: IndustrialSite[]; supplierDependencies: IndustrialDependency[];
  competitors: IndustrialCompetitor[]; commercialDemand: QualifiedIndustrialDemand[];
  stockValuations: IndustrialStockValuation[]; deliveryQuotes: IndustrialDeliveryQuote[];
  independentAlternatives: IndustrialAlternative[];
}

/** Only an authenticated operator release makes this controlled scenario available. */
export interface IndustrialEvent {
  eventId: string; version: string; kind: 'industrial_fire'; occurredAt: string;
  supplierId: string; supplierSiteId: string; competitorIds: string[]; productIds: string[];
  status: 'declared_synthetic_scenario'; testOnly: true; provenance: IndustrialProvenance;
  publicSourceEvidenceRefs: EvidenceRef[];
}
export interface IndustrialInterruption {
  eventId: string; supplierId: string; supplierSiteId: string; purchaseOrderLineId: string;
  previousExpectedDate: string | null; confirmedExpectedDate: string; confirmedAt: string;
  confirmationStatus: 'synthetic_confirmed'; provenance: IndustrialProvenance;
}
export interface ReleasedIndustrialEvent {
  id: string; companyId: string; revision: string; contextRevision: string;
  qualificationRevision: string; businessRevision: string; policyVersion: string;
  event: IndustrialEvent; confirmations: IndustrialInterruption[];
  releasedByActorId: string; releasedAt: string; researchDependencies: ResearchDependency[];
}
export interface IndustrialBasis {
  companyId: string; businessRevision: string; policyVersion: string;
  contextRevision: string; qualificationRevision: string; eventId: string; eventRevision: string;
  researchDependencies: ResearchDependency[];
}
export interface IndustrialAllocation {
  canonicalResourceId: string; targetKind: 'commitment' | 'crm_demand'; targetId: string;
  productId: string; unit: string; quantity: number; availableDate: string;
}
export type IndustrialPlanStep =
  | { id: string; kind: 'purchase'; canonicalResourceId: string; quoteId: string; supplierId: string;
      supplierSiteId: string; productId: string; unit: string; quantity: number; destinationDepotId: string;
      arrivalDate: string; materialCents: number; freightCents: number; dependsOn: string[] }
  | { id: string; kind: 'transfer'; canonicalResourceId: string; quoteId: string;
      quoteSource: 'c1_transport' | 'industrial_delivery'; productId: string; unit: string; quantity: number;
      fromDepotId: string; destinationDepotId: string; dispatchDate: string; arrivalDate: string;
      freightCents: number; handlingCents: number; dependsOn: string[] }
  | { id: string; kind: 'prepare_offer'; opportunityId: string; productId: string; unit: string;
      quantity: number; destinationDepotId: string; needDate: string; saleUnitPriceCents: number;
      dependsOn: string[] };
export interface IndustrialEconomics {
  currency: 'EUR'; grossNewSpendCents: number; riskMitigationSpendCents: number;
  opportunityRevenueCents: number | null; opportunityMaterialValuationCents: number | null;
  opportunityFreightCents: number | null; opportunityHandlingCents: number | null;
  opportunityContributionCents: number | null; missing: string[];
}
export interface CoordinatedIndustrialPlan {
  id: string; version: string; basis: IndustrialBasis; evaluationId: string;
  demandId: string; targetOrderLineIds: string[]; steps: IndustrialPlanStep[];
  allocations: IndustrialAllocation[]; economics: IndustrialEconomics;
  constraints: string[]; unknowns: string[]; status: 'feasible' | 'conditional' | 'rejected';
}
export interface IndustrialAssessment {
  id: string; basis: IndustrialBasis; evaluatedAt: string; testOnly: true;
  impact: 'risk' | 'opportunity' | 'mixed' | 'no_known_exposure' | 'needs_input';
  affectedOrderLineIds: string[]; qualifiedDemandIds: string[];
  coverage: { totalCommitments: number; protectedCommitments: number; worsenedOrderLineIds: string[]; remainingShortageOrderLineIds: string[] };
  plans: CoordinatedIndustrialPlan[]; constraints: string[]; unknowns: string[];
  /** Hash/reference covers the full server computation; model projections remain bounded. */
  calculationHash: string;
}
export interface IndustrialEvaluationInput {
  snapshot: CompanySnapshot; context: IndustrialContext; releasedEvent: ReleasedIndustrialEvent;
  demandId: string; evaluatedAt: string;
}
export interface IndustrialReport {
  id: string; companyId: string; runId: string; basis: IndustrialBasis;
  status: 'prepared' | 'needs_input' | 'stale'; title: string; summary: string;
  assessment: IndustrialAssessment; recommendedPlanId: string | null; createdAt: string;
}
export interface IndustrialAnalysisIntent {
  id: string; basis: IndustrialBasis; analysisPolicyVersion: string; servicePrincipalId: string;
  status: 'ready' | 'queued' | 'running' | 'done' | 'stale' | 'uncertain'; runId: string | null;
  budget: { maxProviderCalls: number; maxToolCalls: number; maxDurationMs: number; maxRunsPerEvent: number };
  createdAt: string;
}
export interface IndustrialApproval {
  id: string; companyId: string; planId: string; planVersion: string; planHash: string;
  basis: IndustrialBasis; actorId: string; decision: 'approved' | 'rejected'; decidedAt: string;
}
export interface IndustrialDemoExecution {
  id: string; companyId: string; planId: string; planVersion: string; planHash: string;
  approvalId: string; operationKey: string; actorId: string; commandHash: string;
  status: 'applied' | 'failed' | 'uncertain'; beforeRevision: string; afterRevision: string | null;
  records: { kind: 'purchase_order' | 'transfer_order' | 'stock_allocation' | 'crm_offer'; id: string; status: string }[];
  completedAt: string | null; code: string | null; simulation: true;
}
