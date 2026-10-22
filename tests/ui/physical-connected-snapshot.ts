import type { IndustrialWorkspace } from "../../src/contracts/industrial-api.js";

/** Recorded authenticated HTTP response. UI-only readback fixture, not a live integration proof. */
export const receivedWorkspace: IndustrialWorkspace = {
  "company": {
    "id": "CO-DEMO-INDUSTRIAL-CANDIDATE",
    "name": "Rivebois Matériaux",
    "businessRevision": "R-INDUSTRIAL-CANDIDATE-2",
    "policyVersion": "P1",
    "dataOrigin": "synthetic",
    "importedAt": "2026-10-22T11:19:43.982Z",
    "counts": {
      "depots": 6,
      "orders": 2502,
      "company": 1,
      "products": 200,
      "customers": 400,
      "employees": 3,
      "inventory": 764,
      "suppliers": 40,
      "order_lines": 10000,
      "reservations": 9999,
      "watch_drafts": 1,
      "purchase_orders": 8,
      "emergency_quotes": 5,
      "transport_quotes": 3,
      "crm_opportunities": 81,
      "inbound_allocations": 13,
      "product_supply_links": 202,
      "purchase_order_lines": 8,
      "construction_projects": 24
    }
  },
  "context": {
    "revision": "IC-INDUSTRIAL-2-2",
    "qualificationRevision": "Q-INDUSTRIAL-2-1",
    "activity": "Multi-site distributor of insulation, timber and panels, with light finishing at two sites.",
    "countries": [
      "FR",
      "BE"
    ],
    "regions": [
      "Hauts-de-France",
      "Centre-Val de Loire",
      "Provence-Alpes-Cote d Azur",
      "Pays de la Loire",
      "Auvergne-Rhone-Alpes",
      "Brussels"
    ],
    "receivedAt": "2026-10-22T06:50:00.000Z",
    "counts": {
      "supplierSites": 4,
      "supplierDependencies": 5,
      "competitors": 1,
      "qualifiedDemands": 1
    }
  },
  "actor": {
    "role": "direction",
    "actorId": "EMP-PAUL",
    "companyId": "CO-DEMO-INDUSTRIAL-CANDIDATE",
    "approvalCeilingEur": 2000
  },
  "events": [],
  "reports": [],
  "analyses": [],
  "capabilities": {
    "automaticAnalysis": false,
    "simulationOnly": true,
    "publicEvidenceIsSeparate": true,
    "decisionsConnected": false,
    "simulationConnected": false
  },
  "display": {
    "companyId": "CO-DEMO-INDUSTRIAL-CANDIDATE",
    "version": 1,
    "baseCoreSha256": "88305b739661df5cdb7f1686ad461afa05f7f1d5206bbaec7055eada3f6333af",
    "baseContextSha256": "95a9aeb940ad51f576779e161e633f47e39d78678355b86b01bfd3386ed3235e",
    "labels": [
      {
        "entityType": "company",
        "nativeId": "CO-DEMO-INDUSTRIAL-CANDIDATE",
        "displayName": "Rivebois Matériaux",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-LILLE",
        "displayName": "Rivebois Lille",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-CENTRE",
        "displayName": "Rivebois Centre-Val de Loire",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-SUD",
        "displayName": "Rivebois Provence-Alpes-Côte d’Azur",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-NANTES",
        "displayName": "Rivebois Nantes",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-LYON",
        "displayName": "Rivebois Lyon",
        "synthetic": true
      },
      {
        "entityType": "depot",
        "nativeId": "DEP-BRUSSELS",
        "displayName": "Rivebois Brussels",
        "synthetic": true
      },
      {
        "entityType": "supplier",
        "nativeId": "SUP-1",
        "displayName": "Arven Isolation",
        "synthetic": true
      },
      {
        "entityType": "supplier",
        "nativeId": "SUP-2",
        "displayName": "Mérial Approvisionnements",
        "synthetic": true
      },
      {
        "entityType": "supplier",
        "nativeId": "SUP-3",
        "displayName": "Relais Matériaux",
        "synthetic": true
      },
      {
        "entityType": "supplier",
        "nativeId": "SUP-IND-003",
        "displayName": "Belrive Matériaux",
        "synthetic": true
      },
      {
        "entityType": "supplier_site",
        "nativeId": "PLANT-ALPHA-FR",
        "displayName": "Arven Isolation · Hauts-de-France",
        "synthetic": true
      },
      {
        "entityType": "supplier_site",
        "nativeId": "PLANT-BETA-FR",
        "displayName": "Mérial Approvisionnements · Centre-Val de Loire",
        "synthetic": true
      },
      {
        "entityType": "supplier_site",
        "nativeId": "PLANT-EMERGENCY-FR",
        "displayName": "Relais Matériaux · Hauts-de-France",
        "synthetic": true
      },
      {
        "entityType": "supplier_site",
        "nativeId": "PLANT-GAMMA-BE",
        "displayName": "Belrive Matériaux · Wallonia",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-00",
        "displayName": "Programme Cèdre",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CLI-A",
        "displayName": "Bâtirives Construction",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-01",
        "displayName": "Programme Aulne",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CLI-B",
        "displayName": "Ateliers du Parc",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-02",
        "displayName": "Programme Orme",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-002",
        "displayName": "Cédralis Bâtiment",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-03",
        "displayName": "Programme Frêne",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-003",
        "displayName": "Rives & Charpentes",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-04",
        "displayName": "Programme Bouleau",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-004",
        "displayName": "Valcote Construction",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-05",
        "displayName": "Programme Hêtre",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-005",
        "displayName": "Ateliers de la Senne",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-06",
        "displayName": "Programme Érable",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-006",
        "displayName": "Orme Construction",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-07",
        "displayName": "Programme Chêne",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-007",
        "displayName": "Maisons des Coteaux",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-08",
        "displayName": "Programme Tilleul",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-008",
        "displayName": "Terres & Bâtis",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-09",
        "displayName": "Programme Mélèze",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-009",
        "displayName": "Ateliers de l’Estuaire",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-10",
        "displayName": "Programme Charme",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-010",
        "displayName": "Bâtisseurs du Levant",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-11",
        "displayName": "Programme Pin",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-011",
        "displayName": "Senne Construction",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-12",
        "displayName": "Programme Sapin",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-012",
        "displayName": "Cèdres & Structures",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-13",
        "displayName": "Programme If",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-013",
        "displayName": "Bâtiment des Terrasses",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-14",
        "displayName": "Programme Noyer",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-014",
        "displayName": "Rives Habitat",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-15",
        "displayName": "Programme Peuplier",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-015",
        "displayName": "Ateliers des Plaines",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-16",
        "displayName": "Programme Acacia",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-016",
        "displayName": "Valmont Bâtiment",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-17",
        "displayName": "Programme Saule",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-017",
        "displayName": "Canal & Structures",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-18",
        "displayName": "Programme Douglas",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-018",
        "displayName": "Bâtisseurs du Verger",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-19",
        "displayName": "Programme Cyprès",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-019",
        "displayName": "Coteaux Construction",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-20",
        "displayName": "Programme Châtaignier",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-020",
        "displayName": "Ardoise & Bâtis",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-21",
        "displayName": "Programme Épicéa",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-021",
        "displayName": "Maisons de l’Orée",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-22",
        "displayName": "Programme Merisier",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-022",
        "displayName": "Ateliers des Deux Rives",
        "synthetic": true
      },
      {
        "entityType": "project",
        "nativeId": "PROJECT-IND-23",
        "displayName": "Programme Séquoia",
        "synthetic": true
      },
      {
        "entityType": "customer",
        "nativeId": "CUS-IND-023",
        "displayName": "Riveclaire Construction",
        "synthetic": true
      },
      {
        "entityType": "competitor",
        "nativeId": "COMP-IND-001",
        "displayName": "Varenne Négoce",
        "synthetic": true
      }
    ],
    "companyProfileDisplay": {
      "activity": "Multi-site timber and building materials",
      "summary": "Rivebois Matériaux distributes insulation, timber and panels across France and Belgium. Purchasing, stock allocation, inter-site logistics and commercial programmes are coordinated across six sites.",
      "operations": "Paul Martin leads operations, with Claire Bernard in purchasing and Alex Petit in logistics. Nantes and Lyon also have light-finishing roles. AdaptOps starts with the company’s authorised records and valid prior knowledge; each market signal is assessed against those facts.",
      "disclosure": "Fictional demo company. Synthetic ERP / CRM data."
    }
  }
};
