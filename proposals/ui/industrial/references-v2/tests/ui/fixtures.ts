import type { CompanyView, DecisionCase, DecisionsView, Proposal } from "../../src/contracts/index.js";
import type { WatchCapabilitiesView } from "../../src/ui/types";

export function uiCapabilitiesFixture(): WatchCapabilitiesView {
  const boamp = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records"; const keenable = "https://api.keenable.ai/v1/search";
  return { publicTopics: ["isolants France perturbations production", "marchés publics matériaux France", "actualités sectorielles matériaux et bois France"], sourceUrls: [boamp, keenable], minimumCadenceMinutes: 5, maximumCadenceMinutes: 10080, profiles: [
    { id: "insulation", label: "Insulation production and disruptions", publicTopic: "isolants France perturbations production", family: "incident", sourceUrls: [boamp, keenable] },
    { id: "public-contracts", label: "Public procurement for materials", publicTopic: "marchés publics matériaux France", family: "public_contract", sourceUrls: [boamp, keenable] },
    { id: "sector-news", label: "Materials and timber news", publicTopic: "actualités sectorielles matériaux et bois France", family: "sector", sourceUrls: [keenable] },
  ] };
}

/** Synthetic HTTP and visual fixture, including a simulated direct-source receipt. */
export function uiCaseFixture(): { company: CompanyView; decisions: DecisionsView; current: DecisionCase } {
  const fixture = uiContractFixture();
  const createdAt = "2026-10-22T08:00:00.000Z";
  const observation = { id: "evidence-ui", title: "Insulation sector notice (UI fixture)", content: "Synthetic source excerpt. A public sector notice does not establish a link to our supplier or confirm a delay.", url: "https://example.org/ui-source", publishedAt: createdAt, collectedAt: createdAt, contentHash: "a".repeat(64), dataOrigin: "public" as const, mode: "direct" as const, provenance: { provider: "boamp" as const, endpoint: "https://example.org/ui-source", method: "api_record" as const, profileId: "ui-test", indexedAt: null, truncated: false } };
  const current: DecisionCase = { id: "case:ui-test", companyId: "CO-DEMO", caseRevision: "C-ui-1", previousRevision: null, evidenceRef: { occurrenceId: "occurrence-ui", evidenceId: observation.id, contentHash: observation.contentHash }, observation, relation: { status: "unverified", productId: "SKU-ISO100", supplierId: "SUP-1", basis: "Possible material overlap. The supplier relationship is unverified." }, candidateOrderLineIds: ["OL-A", "OL-B"], businessRevision: "R0", policyVersion: "P1", qualification: "to_verify", actorId: "EMP-PAUL", createdAt, impactKind: "risk", riskAssumption: { kind: "inbound_delay", purchaseOrderLineId: "POL-1", assumedExpectedDate: "2026-10-28", basis: "Explicit synthetic delay assumption for the UI test." } };
  fixture.company.snapshot.dataset.tables.suppliers = [{ id: "SUP-1", name: "Supplier 1 (synthetic)" }];
  fixture.company.snapshot.dataset.tables.purchase_orders = [{ id: "PO-1", supplier_id: "SUP-1", status: "confirmed" }];
  fixture.company.snapshot.dataset.tables.purchase_order_lines = [{ id: "POL-1", purchase_order_id: "PO-1", product_id: "SKU-ISO100", expected_date: "2026-10-22", quantity: 8, unit: "pallets" }];
  fixture.company.snapshot.dataset.tables.order_lines = [{ id: "OL-A", order_id: "ORD-A", quantity: 8, unit: "pallets", need_date: "2026-10-23" }, { id: "OL-B", order_id: "ORD-B", quantity: 8, unit: "pallets", need_date: "2026-11-05" }];
  fixture.decisions.cases = [current];
  fixture.decisions.watches = [{ id: "watch-ui", companyId: "CO-DEMO", actorId: "EMP-PAUL", publicTopic: "Insulation sector (UI fixture)", sourceUrls: [observation.url], cadenceMinutes: 60, enabled: true, nextRunAt: createdAt, createdAt }];
  fixture.decisions.occurrences = [{ id: "occurrence-ui", watchId: "watch-ui", companyId: "CO-DEMO", operationKey: "occurrence-ui", status: "completed", scheduledAt: createdAt, startedAt: createdAt, completedAt: createdAt, fence: 1, leaseUntil: null, error: null, result: { status: "success", startedAt: createdAt, completedAt: createdAt, sources: [{ url: observation.url, status: "success", evidence: [observation], error: null }] } }];
  fixture.decisions.proposals[0]!.caseRef = { caseId: current.id, caseRevision: current.caseRevision };
  fixture.decisions.proposals[0]!.conditions = ["RELATION_UNVERIFIED"];
  fixture.decisions.proposals[0]!.evaluation.facts.actualCoverage = structuredClone(fixture.decisions.proposals[0]!.evaluation.facts.coverage!);
  fixture.decisions.proposals[0]!.evaluation.facts.coverageBasis = "declared_hypothetical_inbound_delay";
  fixture.decisions.proposals[0]!.evaluation.facts.caseRef = { caseId: current.id, caseRevision: current.caseRevision };
  fixture.decisions.runs[0]!.caseRef = { caseId: current.id, caseRevision: current.caseRevision };
  return { ...fixture, current };
}

/** Synthetic UI boundary data. No model, collector, database or business-engine proof. */
export function uiContractFixture(): { company: CompanyView; decisions: DecisionsView } {
  const timestamp = "2026-10-22T08:00:00.000Z";
  const proposal: Proposal = {
    id: "proposal-ui-test", companyId: "CO-DEMO", runId: "run-ui-test", revision: "R0", policyVersion: "P1", optionId: "emergency", status: "pending", createdAt: timestamp,
    title: "Site A delivery: review our options", summary: "Synthetic comparison for interface testing. These fixture calculations and confirmations are not product results.", conditions: [],
    evaluation: { id: "evaluation-ui-test", companyId: "CO-DEMO", revision: "R0", policyVersion: "P1", evaluatedAt: timestamp, constraints: ["SERVER_DECISION_REQUIRED"], unknowns: [],
      facts: { coverage: [{ orderLineId: "OL-A", orderId: "ORD-A", productId: "SKU-ISO100", unit: "pallets", needDate: "2026-10-23", quantity: 8, covered: 0, shortage: 8, unknowns: [] }, { orderLineId: "OL-B", orderId: "ORD-B", productId: "SKU-ISO100", unit: "pallets", needDate: "2026-11-05", quantity: 8, covered: 8, shortage: 0, unknowns: [] }] },
      options: [
        { id: "transfer", kind: "transfer", label: "Reallocate 8 pallets from Centre", status: "conditional", costEur: 120, conditions: ["UNCONFIRMED_INBOUND:POL-2"], reasons: ["UNCOVERED:OL-B:8"], effects: { fromDepotId: "DEP-CENTRE", toDepotId: "DEP-LILLE", quantity: 8, unit: "pallets", productId: "SKU-ISO100", arrivalDate: "2026-10-23" } },
        { id: "emergency", kind: "emergency_purchase", label: "Prepare an emergency purchase", status: "feasible", costEur: 1420, conditions: [], reasons: [], effects: { toDepotId: "DEP-LILLE", quantity: 8, unit: "pallets", productId: "SKU-ISO100", arrivalDate: "2026-10-23" } },
      ],
    },
  };
  return {
    company: { contractVersion: "C1", actor: { actorId: "EMP-PAUL", companyId: "CO-DEMO", role: "direction", approvalCeilingEur: 2000 }, snapshot: {
      companyId: "CO-DEMO", revision: "R0", policyVersion: "P1", dataOrigin: "synthetic", updatedAt: timestamp,
      dataset: { schema: "accel-demo-fixtures/1", company_id: "CO-DEMO", data_origin: "synthetic", snapshot_revision: "R0", as_of: timestamp, tables: {
        company: [{ id: "CO-DEMO", name: "Démo Négoce" }], employees: [{ id: "EMP-PAUL", name: "Paul Martin" }], products: [{ id: "SKU-ISO100", label: "Isolant référence 100" }],
        depots: [{ id: "DEP-LILLE", label: "Lille" }, { id: "DEP-CENTRE", label: "Centre" }], orders: [{ id: "ORD-A", site: "Chantier A" }, { id: "ORD-B", site: "Chantier B" }],
      } },
      policy: { company_id: "CO-DEMO", data_origin: "synthetic", rules: [], role_approval_note: "Fixture UI uniquement", agent_context_excludes: [], public_search_inputs: "Termes publics" },
    } },
    decisions: { proposals: [proposal], runs: [{ id: "run-ui-test", companyId: "CO-DEMO", actorId: "EMP-PAUL", operationKey: "ui-test-operation", question: "How can we preserve commitments for A and B?", status: "proposal", revision: "R0", policyVersion: "P1", mode: "test", model: null, proposalId: proposal.id, message: "UI fixture. No model call.", traces: [{ id: "trace-ui-test", tool: "evaluate_options", input: { callId: "call-ui-test" }, output: { callId: "call-ui-test", isError: false, result: { options: [] } }, startedAt: timestamp, completedAt: timestamp }], createdAt: timestamp, completedAt: timestamp }], watches: [], occurrences: [] },
  };
}
