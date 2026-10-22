import { z } from "zod";
import type { IndustrialWorkspace } from "../contracts/industrial-api.js";
import type { IndustrialApproval, IndustrialDemoExecution } from "../contracts/industrial.js";
import { sameIndustrialValue } from "./industrial.js";
import { UiError, type RunView, type UiApi, type WorkspaceView } from "./types.js";

export interface DemoStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const storageKey = "physical-impact:demo:v1";
const savedSchema = z.object({ version: z.literal(1), decision: z.enum(["approved", "rejected"]).nullable(), executed: z.boolean() }).strict().refine(value => !value.executed || value.decision === "approved");
type Saved = z.infer<typeof savedSchema>;
const questionSchema = z.object({ question: z.string().trim().min(1).max(3000), idempotencyKey: z.string().min(8).max(128), reportId: z.string().optional() }).strict();

export function resetPhysicalDemo(): void {
  try { window.localStorage.removeItem(storageKey); } catch { throw new UiError("DEMO_STORAGE", "Allow site storage to restart the demo."); }
  window.location.reload();
}

/** This adapter is selected only by the explicit /demo route or demo=1. It makes no external calls. */
export function createPhysicalDemoApi(storage?: DemoStorage): UiApi {
  let persistence = storage;
  if (!persistence && typeof window !== "undefined") { try { persistence = window.localStorage; } catch { /* In-memory demo remains usable when browser storage is disabled. */ } }
  let saved: Saved = { version: 1, decision: null, executed: false };
  function refreshSaved(): void {
    if (!persistence) return;
    let raw: string | null;
    try { raw = persistence.getItem(storageKey); } catch { throw new UiError("DEMO_STORAGE", "Your saved demo state could not be read. Allow site storage and retry."); }
    let parsed: unknown;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    const checked = savedSchema.safeParse(parsed);
    saved = checked.success ? checked.data : { version: 1, decision: null, executed: false };
  }
  refreshSaved();
  async function mutate<T>(action: () => T): Promise<T> {
    const perform = async (): Promise<T> => { refreshSaved(); return action(); };
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.locks) return await navigator.locks.request(storageKey, perform);
    return await perform();
  }
  const runs = new Map<string, RunView>();
  const questionKeys = new Map<string, { question: string; reportId?: string; run: RunView }>();
  const commands = new Map<string, { descriptor: string; receipt: IndustrialApproval | IndustrialDemoExecution }>();
  function persist(next: Saved): void { if (persistence) { try { persistence.setItem(storageKey, JSON.stringify(next)); } catch { throw new UiError("DEMO_STORAGE", "Your browser could not save this demo decision. Allow site storage and retry."); } } saved = next; }
  const at = "2026-10-22T12:00:00.000Z";
  const basis = { companyId: "CO-PHYSICAL-DEMO", businessRevision: "DEMO-R1", policyVersion: "P1", contextRevision: "IC1", qualificationRevision: "Q1", eventId: "EV-ARVEN", eventRevision: "EVR1", researchDependencies: [] };
  const provenance = { system: "SCENARIO" as const, nativeId: "DEMO-ARVEN", version: "1", receivedAt: at, actorId: "DEMO-OPERATOR" };
  function approval(): IndustrialApproval { return { id: "DEMO-APPROVAL-001", companyId: basis.companyId, planId: "PLAN-RESILIENCE", planVersion: "PV1", planHash: "demo-plan-v1", basis: structuredClone(basis), actorId: "EMP-PAUL", decision: saved.decision ?? "approved", decidedAt: at }; }
  function execution(): IndustrialDemoExecution { return { id: "DEMO-EXECUTION-001", companyId: basis.companyId, planId: "PLAN-RESILIENCE", planVersion: "PV1", planHash: "demo-plan-v1", approvalId: "DEMO-APPROVAL-001", operationKey: "demo-execution-001", actorId: "EMP-PAUL", commandHash: "demo-command-v1", status: "applied", beforeRevision: "DEMO-R1", afterRevision: "DEMO-R2", records: [
    { kind: "purchase_order", id: "PO-2026-0418", status: "planned" }, { kind: "transfer_order", id: "TR-2026-0082", status: "planned" }, { kind: "origin_stock_reservation", id: "RS-2026-0216", status: "reserved" }, { kind: "planned_allocation", id: "AL-2026-0931", status: "planned" }, { kind: "crm_offer", id: "OF-2026-0174", status: "draft" },
  ], completedAt: at, code: null, simulation: true }; }
  function industrial(): IndustrialWorkspace {
    refreshSaved();
    return {
      company: { id: basis.companyId, name: "Rivebois Matériaux", businessRevision: saved.executed ? "DEMO-R2" : "DEMO-R1", policyVersion: "P1", dataOrigin: "synthetic", importedAt: at, counts: { sites: 6, products: 200, suppliers: 40, customers: 400, programmes: 24, orders: 2502, order_lines: 10000 } },
      context: { revision: "IC1", qualificationRevision: "Q1", activity: "Multi-site timber, insulation and building materials distribution", countries: ["France", "Belgium"], regions: ["Hauts-de-France", "Centre-Val de Loire", "PACA", "Pays de la Loire", "Auvergne-Rhône-Alpes", "Brussels"], receivedAt: at, counts: { supplierSites: 8, supplierDependencies: 40, competitors: 3, qualifiedDemands: 1 } },
      actor: { actorId: "EMP-PAUL", companyId: basis.companyId, role: "direction", approvalCeilingEur: 2000 },
      events: [{ id: "released-arven", companyId: basis.companyId, revision: "EVR1", contextRevision: "IC1", qualificationRevision: "Q1", businessRevision: "DEMO-R1", policyVersion: "P1", event: { eventId: basis.eventId, version: "1", kind: "industrial_fire", occurredAt: "2026-10-22T11:42:00.000Z", supplierId: "SUP-1", supplierSiteId: "Arven Isolation · Hauts-de-France", competitorIds: ["Varenne Négoce"], productIds: ["SKU-ISO100"], status: "declared_synthetic_scenario", testOnly: true, provenance, publicSourceEvidenceRefs: [] }, confirmations: [{ confirmationId: "CONF-ARVEN", eventId: basis.eventId, supplierId: "SUP-1", supplierSiteId: "Arven Isolation · Hauts-de-France", purchaseOrderLineId: "PO-2026-0384", previousExpectedDate: "2026-10-22", confirmedExpectedDate: "2026-10-28", confirmedAt: at, confirmationStatus: "synthetic_confirmed", provenance }], competitorConfirmations: [{ confirmationId: "CONF-VARENNE", eventId: basis.eventId, competitorId: "Varenne Négoce", supplierSiteId: "Arven Isolation · Hauts-de-France", productId: "SKU-ISO100", unit: "pallets", quantity: 20, requestedDeliveryDate: "2026-11-01", cannotFulfilBefore: "2026-11-10", relatedOpportunityId: "CRM-AULNE", confirmedAt: at, confirmationStatus: "synthetic_confirmed", provenance }], releasedByActorId: "DEMO-OPERATOR", releasedAt: at, researchDependencies: [] }],
      analyses: [{ id: "INTENT-ARVEN", basis: structuredClone(basis), analysisPolicyVersion: "DEMO-1", servicePrincipalId: "PHYSICAL-DEMO", status: "done", blockedReason: null, runId: "RUN-ARVEN", budget: { maxProviderCalls: 0, maxToolCalls: 0, maxDurationMs: 0, maxRunsPerEvent: 1 }, createdAt: at }],
      reports: [{ freshness: saved.executed ? "stale" : "current", report: { id: "REPORT-ARVEN", companyId: basis.companyId, runId: "RUN-ARVEN", basis: structuredClone(basis), status: "prepared", title: "Secure tomorrow’s delivery. Capture the new demand.", summary: "An incident at Arven Isolation delays our inbound insulation to 28 October. Protect Programme Cèdre with an alternative supply, then use available Centre stock to serve the qualified Aulne request.", assessment: { id: "ASSESSMENT-ARVEN", basis: structuredClone(basis), evaluatedAt: at, testOnly: true, impact: "mixed", affectedOrderLineIds: ["OL-CEDRE"], qualifiedDemandIds: ["CRM-AULNE"], coverage: { totalCommitments: 2, protectedCommitments: 2, worsenedOrderLineIds: [], remainingShortageOrderLineIds: [] }, plans: [{ id: "PLAN-RESILIENCE", version: "PV1", basis: structuredClone(basis), evaluationId: "ASSESSMENT-ARVEN", demandId: "CRM-AULNE", targetOrderLineIds: ["OL-CEDRE"], status: "feasible", steps: [
        { id: "BUY-CEDRE", kind: "purchase", canonicalResourceId: "ALT-MERIAL", quoteId: "QUOTE-108", supplierId: "SUP-2", supplierSiteId: "Mérial · Independent stock", productId: "SKU-ISO100", unit: "pallets", quantity: 8, destinationDepotId: "DEP-LILLE", arrivalDate: "2026-10-23", materialCents: 142000, freightCents: 0, dependsOn: [] },
        { id: "TRANSFER-AULNE", kind: "transfer", canonicalResourceId: "CENTRE-FREE-STOCK", quoteId: "QUOTE-TRANSPORT-82", quoteSource: "industrial_delivery", productId: "SKU-ISO100", unit: "pallets", quantity: 20, fromDepotId: "DEP-CENTRE", destinationDepotId: "DEP-LILLE", dispatchDate: "2026-10-23", arrivalDate: "2026-10-25", freightCents: 18000, handlingCents: 0, dependsOn: [] },
        { id: "OFFER-AULNE", kind: "prepare_offer", opportunityId: "CRM-AULNE", productId: "SKU-ISO100", unit: "pallets", quantity: 20, destinationDepotId: "DEP-LILLE", needDate: "2026-11-01", saleUnitPriceCents: 19000, dependsOn: ["TRANSFER-AULNE"] },
      ], allocations: [{ canonicalResourceId: "ALT-MERIAL", targetKind: "commitment", targetId: "OL-CEDRE", productId: "SKU-ISO100", unit: "pallets", quantity: 8, availableDate: "2026-10-23", supplyStepId: "BUY-CEDRE" }, { canonicalResourceId: "CENTRE-FREE-STOCK", targetKind: "crm_demand", targetId: "CRM-AULNE", productId: "SKU-ISO100", unit: "pallets", quantity: 20, availableDate: "2026-10-25", supplyStepId: "TRANSFER-AULNE" }], economics: { currency: "EUR", grossNewSpendCents: 160000, riskMitigationSpendCents: 142000, opportunityRevenueCents: 380000, opportunityMaterialValuationCents: 200000, opportunityFreightCents: 18000, opportunityHandlingCents: 0, opportunityContributionCents: 162000, missing: [] }, constraints: ["Programme Aulne: preserve the existing 8-pallet reservation due 5 November.", "Commercial offer remains a draft until customer acceptance."], unknowns: [] }], constraints: [], unknowns: [], calculationHash: "DEMO-CALCULATION-1" }, recommendedPlanId: "PLAN-RESILIENCE", createdAt: at }, planStates: [{ planId: "PLAN-RESILIENCE", planVersion: "PV1", planHash: "demo-plan-v1", status: saved.decision ?? "pending", approval: saved.decision ? approval() : null, execution: saved.executed ? execution() : null, permissions: { canApprove: !saved.decision, canReject: !saved.decision, canSimulate: saved.decision === "approved" && !saved.executed, blockedReason: null } }] }],
      capabilities: { automaticAnalysis: true, simulationOnly: true, publicEvidenceIsSeparate: true, decisionsConnected: true, simulationConnected: true, questionsConnected: true },
    };
  }
  function workspace(): WorkspaceView { refreshSaved(); return {
    company: { id: basis.companyId, name: "Rivebois Matériaux", revision: saved.executed ? "DEMO-R2" : "DEMO-R1", policyVersion: "P1", asOf: at, dataOrigin: "synthetic", actor: { id: "EMP-PAUL", name: "Paul Martin", role: "direction" }, canDecide: true }, proposals: [], runs: [...runs.values()], cases: [],
    memory: [{ id: "MEM-PROTECT", text: "Protect existing customer commitments before allocating stock to new demand.", author: "Paul Martin", createdAt: at, conditions: "Company purchasing policy" }],
    watches: [
      { id: "WATCH-SUPPLY", topic: "Supplier operations & material availability", cadenceMinutes: 15, status: "active", lastCheckedAt: at, nextCheckAt: "2026-10-22T12:15:00.000Z", message: "8 supplier sites monitored", sources: [{ id: "NEWS-ARVEN", title: "Arven Isolation: production interrupted in Hauts-de-France", kind: "synthetic", status: "success", collectedAt: at, note: "Demo bulletin. Internal delivery confirmation is recorded separately.", mode: "test" }, { id: "NEWS-CAPACITY", title: "Insulation market: alternative capacity available in Belgium", kind: "synthetic", status: "success", collectedAt: at, mode: "test", note: "Demo sector bulletin. No allocation is implied." }] },
      { id: "WATCH-CRM", topic: "Customer demand & project deadlines", cadenceMinutes: 15, status: "active", lastCheckedAt: at, sources: [{ id: "CRM-AULNE-UPDATE", title: "Ateliers du Parc: 20 pallets requested for Programme Aulne", kind: "synthetic", status: "success", collectedAt: at, mode: "test", note: "Qualified CRM demand in the demo account." }] },
      { id: "WATCH-OPS", topic: "Sites & logistics", cadenceMinutes: 15, status: "active", lastCheckedAt: at, sources: [{ id: "ERP-CENTRE", title: "Centre-Val de Loire: 20 unreserved pallets available", kind: "synthetic", status: "success", collectedAt: at, mode: "test", note: "Available demo stock, existing reservations excluded." }] },
    ], catalog: { products: [{ id: "SKU-ISO100", label: "Insulation reference 100" }], suppliers: [{ id: "SUP-1", label: "Arven Isolation" }, { id: "SUP-2", label: "Mérial Approvisionnements" }, { id: "SUP-3", label: "Belrive Matériaux" }], commitments: [{ id: "OL-CEDRE", label: "Programme Cèdre · Bâtirives Construction · 8 pallets · 23 Oct" }, { id: "OL-AULNE", label: "Programme Aulne · Ateliers du Parc · 8 pallets reserved · 5 Nov" }, { id: "CRM-AULNE", label: "Programme Aulne · Ateliers du Parc · 20 pallets · 1 Nov" }], inbound: [{ id: "PO-2026-0384", label: "Arven Isolation · Lille · revised arrival 28 Oct", productId: "SKU-ISO100", supplierId: "SUP-1", expectedDate: "2026-10-28" }] },
  }; }
  async function ask(input: Parameters<NonNullable<UiApi["askIndustrialQuestion"]>>[0]): Promise<RunView> {
    refreshSaved();
    const checked = questionSchema.safeParse(input); if (!checked.success) throw new UiError("INVALID_QUESTION", "Enter a question of 1 to 3,000 characters.");
    const value = checked.data; if (value.reportId && value.reportId !== "REPORT-ARVEN") throw new UiError("REPORT_NOT_FOUND", "This report is not part of the demo account.");
    const previous = questionKeys.get(value.idempotencyKey); if (previous) { if (previous.question !== value.question || previous.reportId !== value.reportId) throw new UiError("CONFLICT", "This operation key belongs to a different question."); return structuredClone(previous.run); }
    const q = value.question.toLowerCase();
    let message = "The Arven incident delays the expected insulation delivery to 28 October. Programme Cèdre needs 8 pallets on 23 October. The coordinated response buys independent stock from Mérial for €1,420, then transfers 20 available pallets from Centre for the qualified Aulne request. Existing Aulne reservations stay protected. Review the plan before approving.";
    if (/cout|coût|cost|margin|marge|revenue|budget/.test(q)) message = "The coordinated plan requires €1,600 in new spending: €1,420 for alternative supply and €180 freight. The 20-pallet Aulne offer has €3,800 potential revenue, €2,000 stock valuation and €180 freight, giving €1,620 contribution. This is a draft opportunity, not a booked sale.";
    else if (/pourquoi|why|source|preuve|evidence/.test(q)) message = "The alert combines two separate demo records: an Arven incident bulletin and an internal purchasing confirmation moving PO-2026-0384 from 22 to 28 October. The ERP links this inbound to Programme Cèdre. The bulletin alone does not prove a customer impact; the company records establish the exposure.";
    else if (/execute|exécut|fait|done|approuv|approv|statut|status/.test(q)) message = saved.executed ? "The demo execution is saved. Purchase PO-2026-0418, transfer TR-2026-0082, reservation RS-2026-0216 and allocation AL-2026-0931 are recorded. Offer OF-2026-0174 remains a draft. The simulation has not contacted suppliers or customers." : saved.decision === "approved" ? "Paul approved the coordinated plan. It is ready for the separate demo execution step. Approval alone has not created orders or moved stock." : saved.decision === "rejected" ? "The plan was rejected. No purchase, transfer or draft offer was created." : "The response is ready for your review. No decision has been saved yet. Open Actions, review the plan, then approve it to unlock the execution step.";
    const run: RunView = { id: `DEMO-QUESTION-${runs.size + 1}`, question: value.question, status: "proposal", createdAt: new Date().toISOString(), message, tools: [{ id: "DEMO-CONTEXT", name: "Company context", status: "recorded", summary: "ERP, purchasing confirmations and CRM demand from the prepared demo account." }], executionMode: "test", model: "Scripted demo", industrialReportId: "REPORT-ARVEN", industrialScope: { contextRevision: "IC1", qualificationRevision: "Q1", reportId: value.reportId ?? null } };
    runs.set(run.id, run); questionKeys.set(value.idempotencyKey, { question: value.question, reportId: value.reportId, run }); return structuredClone(run);
  }
  return {
    readWorkspace: async (): Promise<WorkspaceView> => structuredClone(workspace()), readIndustrial: async (): Promise<IndustrialWorkspace> => structuredClone(industrial()),
    readIndustrialReport: async (id): Promise<IndustrialWorkspace["reports"][number]> => { const report = industrial().reports.find(value => value.report.id === id); if (!report) throw new UiError("NOT_FOUND", "Report unavailable."); return structuredClone(report); },
    askQuestion: ask, askIndustrialQuestion: ask,
    readIndustrialRun: async (id): Promise<RunView> => { const run = runs.get(id); if (!run) throw new UiError("NOT_FOUND", "Question unavailable."); return structuredClone(run); },
    decideIndustrialPlan: async (planId, input): Promise<IndustrialApproval> => await mutate(() => {
      const descriptor = JSON.stringify([planId, input.decision, input.expectedBasis, input.expectedPlanVersion, input.expectedPlanHash]); const prior = commands.get(input.operationKey);
      if (prior) { if (prior.descriptor !== descriptor || !("decision" in prior.receipt)) throw new UiError("CONFLICT", "Operation key already used."); return structuredClone(prior.receipt); }
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(input.operationKey) || !["approve", "reject"].includes(input.decision) || planId !== "PLAN-RESILIENCE" || input.expectedPlanVersion !== "PV1" || input.expectedPlanHash !== "demo-plan-v1" || !sameIndustrialValue(input.expectedBasis, basis)) throw new UiError("STALE_CONTEXT", "Reload the current demo plan before deciding.");
      if (saved.executed || saved.decision) throw new UiError("CONFLICT", "This plan already has a saved decision.");
      persist({ ...saved, decision: input.decision === "approve" ? "approved" : "rejected" }); const receipt = approval(); commands.set(input.operationKey, { descriptor, receipt }); return structuredClone(receipt);
    }),
    simulateIndustrialApproval: async (approvalId, input): Promise<IndustrialDemoExecution> => await mutate(() => {
      const descriptor = JSON.stringify([approvalId, input.expectedBusinessRevision, input.expectedPlanVersion, input.expectedPlanHash]); const prior = commands.get(input.operationKey);
      if (prior) { if (prior.descriptor !== descriptor || !("simulation" in prior.receipt)) throw new UiError("CONFLICT", "Operation key already used."); return structuredClone(prior.receipt); }
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(input.operationKey) || approvalId !== "DEMO-APPROVAL-001" || input.expectedBusinessRevision !== "DEMO-R1" || input.expectedPlanVersion !== "PV1" || input.expectedPlanHash !== "demo-plan-v1" || saved.decision !== "approved") throw new UiError("STALE_CONTEXT", "Approve the current demo plan before executing.");
      if (!saved.executed) persist({ ...saved, executed: true }); const receipt = { ...execution(), operationKey: input.operationKey }; commands.set(input.operationKey, { descriptor, receipt }); return structuredClone(receipt);
    }),
    createWatch: async (): Promise<never> => { throw new UiError("DEMO_SCOPE", "The prepared demo watches are already active."); },
    decide: async (): Promise<never> => { throw new UiError("DEMO_SCOPE", "Review the coordinated plan in Actions."); },
  };
}
