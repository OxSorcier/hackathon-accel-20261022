# AdaptOps demo: Rivebois Matériaux

22 October 2026. Display proposal 1. Status: integrator's bounded format received and native-ID bindings checked; runtime import and UI reception pending. All organisation and project names below are invented aliases for the existing synthetic company. AdaptOps remains the product name.

## 1. The company Paul opens

**Rivebois Matériaux**

**Fictional demo company. Synthetic ERP / CRM data.**

Rivebois Matériaux distributes insulation, timber and panels across France and Belgium. Purchasing, stock allocation, inter-site logistics and commercial programmes are coordinated across six sites. Paul Martin leads operations, Claire Bernard owns purchasing and Alex Petit coordinates logistics. Nantes and Lyon also have light-finishing roles.

The existing core contains six sites, 200 products, 40 suppliers, 400 customers, 24 programmes, 2,502 orders and 10,000 order lines. Its import and independent Aiven readback are recorded in [the integrator's receipt](../../../../../proposals/integration/INDUSTRIAL-CORE-AIVEN.json). These counts describe the received baseline; the UI must read current persisted counts from the authenticated workspace.

This company is already present in the application data. No new portfolio, stock model or import is proposed. Manufacturing schedules, bills of materials and finishing-capacity quantities remain outside the current dataset.

## 2. Names that make the company readable

| Existing identity | Proposed visible name | Existing scope retained |
| --- | --- | --- |
| DEP-LILLE | Rivebois Lille | Distribution, Hauts-de-France. |
| DEP-CENTRE | Rivebois Centre-Val de Loire | Distribution; exact city not supplied. |
| DEP-SUD | Rivebois Provence-Alpes-Côte d’Azur | Distribution; exact city not supplied. |
| DEP-NANTES | Rivebois Nantes | Finishing and distribution, Pays de la Loire. |
| DEP-LYON | Rivebois Lyon | Finishing and distribution, Auvergne-Rhône-Alpes. |
| DEP-BRUSSELS | Rivebois Brussels | Distribution, Belgium. |

The geographical labels describe the existing records. They do not locate a real Rivebois establishment. Supplier sites known only by region remain regional; no street address or new municipality is invented.

## 3. Partners, customers and programmes

| Existing identity | Proposed visible name | Presentation use |
| --- | --- | --- |
| SUP-1 | Arven Isolation | Existing insulation supplier. Its site is labelled Arven Isolation · Hauts-de-France. |
| SUP-2 | Mérial Approvisionnements | Existing alternative supply partner. |
| SUP-3 | Relais Matériaux | Existing emergency-stock partner. |
| SUP-IND-003 | Belrive Matériaux | Existing Belgian stock partner; site remains in Wallonia. |
| COMP-IND-001 | Varenne Négoce | Existing fictional competitor record. No event is inferred from its label. |
| CLI-A / PROJECT-IND-00 | Bâtirives Construction / Programme Cèdre | Primary order and independently qualified CRM request. |
| CLI-B / PROJECT-IND-01 | Ateliers du Parc / Programme Aulne | Existing protected customer commitment. |

For ORD-A, the proposed primary heading is **Programme Cèdre · Bâtirives Construction**, with **Order reference ORD-A** in secondary text. Details and commands retain the native IDs. Products and employees keep their received labels in this bounded intake; no dimensions, composition, substitution rights or new employee identity are introduced.

The [received-format intake](display-aliases.v1.json) contains 64 aliases: one company, six company sites, four suppliers and four supplier sites, 24 programmes and their 24 customers, and one competitor. Every scenario commitment has a named customer, programme and fulfilment site. Other records retain their received labels; this proposal does not pretend to rename all 400 customers or all 40 suppliers. The earlier [70-label proposal](display-profile.proposed.json), including product and employee suggestions excluded from the received format, is preserved as preparation only.

## 4. Receive one display layer

The proposal is scoped to the imported company ID and carries the exact frozen dataset/context hashes as provenance. A display revision remains distinct from business, qualification and policy revisions. A label cannot authorize an old plan, alter access or change a source relationship.

The integrator received a bounded format: companyId, version, baseCoreSha256, baseContextSha256, labels and an optional companyProfileDisplay. Its seven entity types are company, depot, supplier, supplier_site, customer, project and competitor. [READY.json](READY.json) pins the sole intake file. The integrator owns validation, explicit presentation import and central server projection. The same received labels should reach the UI and permitted model context. The UI must not introduce a parallel alias registry or choose identity from a display name. Existing IDs, quantities, dates, prices, reservations, permissions, source receipts and business versions are preserved.

Keep **Fictional demo company** and **Synthetic ERP / CRM data** visible on the company overview and industrial workspace. Retain disclosure in report details and exports. Real public-source publishers, titles, URLs and dates keep their original names. A fictional alias cannot be used to turn a real article into proof about this company.

The live feed remains a separate owner delivery. Collection timestamps, live/recorded/scenario status, relevance and impact must come from received evidence and calculations. This display profile supplies no news event, future fact, expected recommendation or fabricated live activity.

## 5. Checks and next action

Thirteen input checks passed: unique type/ID bindings, existence of every entity, synthetic disclosures, coverage of the 13 scenario commitments and qualified demand, coverage of the existing supplier dependencies, absence of future event IDs, unchanged core/context hashes, and the exact received fields and seven entity types. See [DISPLAY-CHECKS.json](DISPLAY-CHECKS.json).

Current state: proposed and locally checked. Server mapping, integrated UI rendering and observed model use remain NOT_RUN for this display delta. No application code, shared contract, import or existing frozen input was changed by this author.

Next: the existing integrator receives the exact proposal and exposes one read-only presentation layer; the existing UI owner renders it on the company and report surfaces, then checks readable primary names, native secondary references and synthetic labels on the received candidate.

Sources actually read: the frozen v2 core and IndustrialContext; CORE-READY and INDUSTRIAL-READY-v2; the integrator's Aiven import/readback receipt; current ownership and industrial HTTP-contract notes; and Erwan's direct request in chat 01a16361-0550-7f93-b117-5ae28117b00a, message 01a16363-3406-7801-b051-40422a242c3c. The common readable-name contract is applied: presentation changes, native identity remains. No real-company relationship, trademark uniqueness or public release is claimed.
