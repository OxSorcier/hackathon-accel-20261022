# Accel: what we sell and what we demonstrate

22 October 2026. Version 1. Product owner: Erwan. Existing follow-up: [ERW-133](https://linear.app/briques/issue/ERW-133). Status: alignment proposal, prepared copy and a locally checked synthetic portfolio. This extends [PRODUCT-VISION](https://drive.google.com/file/d/1OufYkYFbwSC7Onj-iPCqhVTZYBMaUKm_/view); it does not replace that owner document or certify the integrated application. Working product descriptor: Decision Desk. The company brand is still open.

## 1. The shared direction

**We sell operational intelligence that turns changes in an industry's ecosystem into company-specific decisions: protect commitments, qualify opportunities and deploy resources where they are useful.** Timber and building materials in France are the first market. Expansion to other industries needs its own data, rules and customer evidence.

The customer we want to demonstrate is a large materials business with multiple sites, many construction commitments, mainly French operations and European relationships. Its ERP/WMS, CRM and company policy determine what the agent investigates. The useful output is a calculated, revisable decision with sources and human authority.

There are two identities. Our company sells the product. The demonstration customer uses it. Our strategy, press copy, build documents and evaluation answers stay in the project. Only explicitly released customer facts belong in the product context.

## 2. Current alignment and gaps

| Area | Evidence refreshed on 22 October | Remaining gap and owner |
| --- | --- | --- |
| Company vision | PRODUCT-VISION and README contain risks, opportunities and mixed effects. Four builders' reading is recorded in RELAY-RECEIPT. | One current industrial customer profile and the associated commercial story must be received. Erwan and the existing product owner chat. |
| Real agent and persistence | OPENAI-REAL-QUESTION records a real model/tool/proposal/approval read back in Aiven. REAL-CASE-FLOW now records the source-led case, synthetic confirmation and approved €1,420 option. | This is a local application using real OpenAI and Aiven PostgreSQL. It is not an Aiven Runtime deployment or a real customer integration. Integrator. |
| Causal link | The public ROCKWOOL publication is read; the delay and internal confirmation are explicitly synthetic. Approval records a decision and leaves stock unchanged. | The article does not prove a commercial relationship or a current delivery delay. Automated verified exposure is not established. Data, business and integrator. |
| Industrial scale | The original fixture has 17 tables and 32 rows: three depots, two orders, two products and one CRM opportunity. A larger candidate is prepared below. | Industrial portfolio import, UI summary, selective tools and model journey remain untested. Integrator with builders. |
| ERP and CRM | Relational business data and synthetic CRM rows exist. | No ERP export import or ERP/CRM API connection has been demonstrated. Data and integrator. |
| Monitoring and knowledge | BOAMP and Keenable have bounded evidence. The existing sector research adds direct API/RSS candidates. Decision memory and source persistence exist. | Company-specific monitoring profiles and reuse of past research before another search are not demonstrated. Data, agent and integrator. |
| Story drift | PROMPT-REPRISE refers to a corrected industrial brief V2. The current brief-aside file still says Version 1 and centres on the small trading business. README and STATUS also contain older runtime claims. | Preserve history and publish English successors from this framing after owner reception. Existing document owners. |

The real source-led receipt preserves an earlier `needs_input` run where the model described an option without recording a proposal. The later successful run is additional evidence; the failed attempt remains useful. The €1,420 figure is a calculated emergency-purchase cost, not savings or recovered revenue.

There is also a semantic gap: the publication concerns future industrial capacity, while the emergency case concerns a simulated delivery tomorrow. Their combination proves parts of the harness, not that this particular news justifies that purchase. The final industrial story needs a relevant source and matching customer facts. The product owner has raised this with the integrator. Subsequent UI checks also exposed an analysis targeting B instead of affected A; the integrator is correcting it. Earlier run receipts do not certify that final version.

## 3. Who the customer and Paul are

**Proposed customer identity: Industrial Materials Group, explicitly synthetic.** The first operating scope is materials distribution, with timber and panel cutting/finishing proposed at two sites. This adds industrial services without pretending that the current engine already models manufacturing. BOMs, work orders, yield, quality holds and processing capacity remain missing.

| Element | Concrete proposal | Authority or limit |
| --- | --- | --- |
| Geography | Six sites: Lille, Centre, Sud, Nantes, Lyon and Brussels. Five in France and one in Belgium; supplier records also include Germany and Spain. | Proposed synthetic design. Not a real customer footprint. |
| Daily user | Paul, group operations director. He starts with commitments at risk, unresolved confirmations and available options across sites. | Persona hypothesis. No observed day-in-the-life interview or signed pilot. |
| Collaborators | Procurement planner confirms supply; site logistics checks capacity; account manager qualifies a customer need; finance owns spending policy. | Proposed responsibilities. They do not create implemented product roles. |
| Buyer and adoption | Operations sponsor, with finance and IT involved in budget, integration and access. Start with one recurring decision and one product family. | Willingness to pay, procurement cycle and integration effort are unknown. |
| Recurring task | Find commitments affected by a supplier change, compare an admissible transfer or purchase and preserve the other sites' promises. | Existing deterministic core supports the small case. Portfolio operation needs reception. |
| Success | Correct affected commitments, no double allocation, explainable options, reduced time to a valid decision against an observed baseline. | No productivity or financial gain has been measured. |

Structured proposal: `customer-profile.proposed.json`. Candidate company ID: `CO-DEMO-INDUSTRIAL-CANDIDATE`. It is a separate proposed session. Existing `CO-DEMO` and Paul sessions are untouched.

## 4. Decisions determine data and systems

| Paul's question and decision | Data and system master | Identity and server tool needed | Acceptance evidence |
| --- | --- | --- | --- |
| Which deliveries are exposed? | Confirmed sales lines, due dates, reservations, inbound dates and supplier/site relationships. ERP/WMS plus attributed confirmations. | Company + establishment + product + order line + purchase line; scoped exposure lookup and complete dependency calculation. | Correct impacted set, including no-impact and homonym cases; sources and missing relationships visible. |
| Can another depot help? | Exact product/unit, stock, reservations, quality status, transport quote, capacity and latest versions. ERP/WMS and logistics. | Server-owned availability and option calculation across all commitments sharing the resource. | No double allocation; protected orders remain covered; stale approval refused. |
| Is this project worth pursuing? | Public project, CRM stage and account owner, confirmed need, compatibility, delivery window, selling price and incremental costs. | Public project to CRM candidate; qualified need to a separate commercial evaluation. | A lead never becomes an order automatically. Missing demand or price blocks a firm offer. Current commercial calculation: NOT_RUN. |
| Is a material change applicable here? | Product attributes, lot origin, certificates, use, site and current authoritative source. ERP/product master plus specialist source. | Versioned applicability request and human confirmation. | No generic news-to-compliance conclusion. Applicability engine: NOT_RUN. |
| What did we already establish? | Sources, knowledge versions, past decisions and observed outcomes. Product store with attributed ERP/CRM copies. | Scoped knowledge retrieval before external search; freshness and invalidation. | Reuse in a fresh session, source correction, no cross-company leakage. Research-memory tests: NOT_RUN. |

Keep native IDs, company scope, source system, source record ID, observation/effective date, revision and verification status with every imported fact. A display name is insufficient to link a supplier, site, product or construction project. ERP/WMS remains the stock and order master when connected; CRM owns its commercial records. Aiven stores attributed copies, evidence, cases, proposals, decisions and memory. These responsibilities do not require a new platform.

## 5. A concrete portfolio, prepared now

`portfolio-10000.json` extends a copy of the existing fixture. It contains **10,000 sales order lines**, within **24,228 total rows**, including 2,502 orders, six sites, 200 products, 40 supplier records, 400 customer records, 24 construction programmes, 9,999 reservations and 81 CRM opportunity records. There are 2,086 orders attached to French sites and 416 to the Belgian site. Customer and supplier record counts do not imply that every record has active orders.

The original A/B decision kernel and identifiers are retained inside this separately attributed candidate. Added reservations have matching product, unit and site; aggregate reservations never exceed physical stock or line quantities. Timber uses m3, panels m2 and insulation palettes. There is no implicit unit conversion. One project may contain multiple orders. The legacy A/B order labels are preserved; they are not reinterpreted as a count of construction programmes.

DATA-CHECKS records successful ID, relationship, unit, quantity, reservation and date checks. A single local run of the current deterministic business engine produced all 10,000 baseline coverage rows, with A and B covered and no initially uncovered commitments. It took **2,496 ms** in one Node process. LOCAL-DOMAIN-SMOKE pins the exact source hashes, checked unchanged during that run. This is one smoke observation, with no percentile or throughput claim.

The same evaluation serialises to **6,542,867 bytes**. `releasedCommitments` currently returns the complete business collections. These observations identify the next scale constraint: the model must receive bounded evidence and summaries, while the server computes complete relevant dependencies. Truncating a list cannot be used to declare that an omitted commitment is safe.

This candidate is not imported into the application or Aiven. It is one current snapshot, with only the two inherited purchase lines, no transaction history, no manufacturing-capacity model and no commercial margin model. It is a useful first volume case, not a representative industrial workload or a completed large-scale acceptance test. Preparation metadata and receipts must stay outside the product context.

### Dataset choices checked

| Candidate | What was actually examined | Fit and adaptation cost |
| --- | --- | --- |
| Existing fixture plus deterministic relational generation | Current project schema and business engine; generated candidate and local checks above. | Recommended first tranche because it preserves the received decision kernel and adds no dependency. It still needs production/history and commercial cases. |
| WideWorldImporters | Microsoft sample README, MIT licence and StockItemHoldings table. SQL Server sample for a wholesaler. | Useful reference for purchases, sales and stock. The inspected holding table is keyed by stock item, so it does not supply our multi-site/reservation model as-is. SQL Server-to-PostgreSQL adaptation is additional work. No import or immutable revision pin received. [Sample](https://github.com/microsoft/sql-server-samples/blob/master/samples/databases/wide-world-importers/README.md), [table](https://raw.githubusercontent.com/microsoft/sql-server-samples/master/samples/databases/wide-world-importers/wwi-ssdt/wwi-ssdt/Warehouse/Tables/StockItemHoldings.sql), [licence](https://raw.githubusercontent.com/microsoft/sql-server-samples/master/license.txt). |
| Odoo Community 19.0 | Official demo-data documentation, CRM manifest and LGPLv3 licence. Manifest names real demo files. | Candidate when the purpose is to prove an ERP/CRM connector. A local demo instance, module-specific data and API readback are still required. No instance installed or endpoint tested. Branch 19.0 is examined, not a claim about the latest version. [Data](https://www.odoo.com/documentation/19.0/developer/tutorials/define_module_data.html), [CRM manifest](https://raw.githubusercontent.com/odoo/odoo/19.0/addons/crm/__manifest__.py), [licence](https://raw.githubusercontent.com/odoo/odoo/19.0/LICENSE). |
| Snowfakery | Official relational-generation documentation and BSD-3-Clause licence. Some raw implementation retrievals failed. | Optional generation tool if it later saves work. Relationships alone do not enforce stock conservation, delivery coverage or factory capacity. Runtime/code evaluation and pinned version unresolved. No installation or selection. [Project](https://github.com/SFDO-Tooling/Snowfakery), [licence](https://raw.githubusercontent.com/SFDO-Tooling/Snowfakery/main/LICENSE). |
| TPC-H through DuckDB | Current official extension documentation, generator and scale-factor interface. | Useful for SQL volume experiments; it does not establish construction reservations or industrial scheduling. Not selected as our business dataset. No extension installed and no TPC benchmark run. [Documentation](https://duckdb.org/docs/current/core_extensions/tpch). |

These are bounded feasibility readings. No external code was imported, and no complete audit of those repositories is claimed. Preserve applicable notices if source material is later copied. Freeze the chosen revision and review actual transformation code before adopting an external base.

## 6. Monitoring follows the customer's footprint

These are **proposed profiles**, version 1, not activated watches. Keep the current scheduler and the data owner's accepted source capabilities. A profile needs a business reason, public scope, source, language, cadence, freshness horizon, exclusion and alert condition.

| Profile | Public scope and sources | Proposed cadence and horizon | Trigger and internal link |
| --- | --- | --- | --- |
| Supply and capacity | French/European materials producers and named industrial sites; official publications, Keenable discovery/fetch. FR/EN, then DE if the dependency requires it. | Daily review, 90-day relevance window; faster only for a received operational need. | Site/product match plus an attributed supply relationship, or one precise confirmation task. Planned 2028 capacity is not stock for next week. |
| Timber regions | Regions of the six sites and supplier footprint; FNB and France Bois Forêt feeds, regional Fibois pages. FR. | Daily publication checks; distinguish publication date and statistical period. | Species/end-use/region match. A sector index is context, not a supplier quote. |
| Construction demand | BOAMP and later Sitadel, in the service areas and compatible product families. FR. | Daily for notices, monthly/release-driven for permits; 3-18 month project horizon. | Create a CRM qualification task. A notice, permit or project budget does not establish an order or quantity. |
| Supplier identity and events | Public establishment identifiers and corporate events; government company search and BODACC candidates from the existing research. FR. | Daily event review; identity refreshed on relevant change. | Match legal entity and establishment against attributed internal supplier records; reject homonyms. |
| Product and movement constraints | Applicable official FR/EU sources, product/lot origin and intended use. FR/EN. | Daily/weekly source checks according to publisher; horizon follows the actual effective dates. | Applicability task only when internal product/role/lot attributes support the link. Missing attributes remain explicit. |

Public requests contain public company names or sector/region terms only. Orders, stock quantities, customer contacts and private commercial relationships stay in authorised internal tools. Preserve no-impact, opportunity, risk, mixed effect and verification-needed outcomes. News sentiment does not choose the impact category.

The [existing sector research](https://drive.google.com/file/d/1yEqkGjp_KOsz2AJquDUOZZAN45EtYGJS/view) owns the API/RSS observations and access limits. This document reuses those dated observations; it does not claim fresh trials of every source or a working connector for every row.

## 7. Harness and scale acceptance

The server resolves actor, company, role and approved policy. Typed tools select relevant records and return references, totals, freshness and explicit partial status. The deterministic engine receives the complete dependency set needed to protect shared commitments, even when the model sees a summary. The product must distinguish a paged display from a complete exposure computation.

Use a manifest containing business, policy, evidence, case and knowledge revisions. Retrieve valid prior knowledge first; record the reason for new research. Corrected facts retain history and invalidate dependent plans. Decision, execution and observed business result remain separate. No arbitrary SQL or disk tool is added.

| Volume and purpose | Required measurement | Current evidence |
| --- | --- | --- |
| 10,000 order lines | Exact affected set, false matches, constraint validity, bounded model payload, end-to-end time/tokens and restart readback. | Candidate data checks and one local baseline calculation only. No Aiven import or portfolio model run. |
| 100,000 order lines | Repeat the same business cases with supplier/site skew, history, missing data and concurrent updates. p50/p95 and failure rate on stated hardware. | NOT_RUN. Generate only after the selective-tool contract is received. |
| 1,000,000 order lines | Capacity limit, memory, queries/indexes, queue delay, bounded payload, concurrent decisions and durable recovery. | NOT_RUN. Do not equate total rows with current order lines or label this a production workload. |

At each accepted tier, keep operator-only expected results out of model context. Include homonyms, no known exposure, stale source, changed reservation, concurrent approval, interrupted provider and restart. Compare with complete deterministic expected sets and, separately, an observed human task baseline. Report missing usage/cost as unknown. Promotion requires zero broken constraints in the controlled cases, no cross-company disclosure and no lost protected commitment; latency goals require an explicit product budget. A file count or a successful sample is not sufficient.

## 8. Press release draft

**Decision Desk connects market changes with the decisions materials businesses need to make**

Paris, 22 October 2026. Draft for review, not released. Decision Desk is the working name of an operational intelligence product being built for multi-site businesses that depend on stocks, suppliers and delivery commitments. Its first focus is timber and building materials in France.

An industrial announcement, a supplier disruption or a new construction project can matter differently to each business. Decision Desk is designed to connect those signals with the company's own products, sites, orders and constraints, so operations and purchasing teams can understand what to protect, what to investigate and which options are feasible.

The product brings sources, business calculations and human decisions into one workspace. An agent gathers relevant facts and prepares a proposal. Deterministic tools check quantities, reservations, dates and costs. The server checks the decision-maker's authority and current data before recording approval. When facts change, the proposal must be reviewed again.

The current prototype has completed a real model-and-tools journey using Aiven PostgreSQL. In a synthetic materials-company case, a public industrial publication was read, a separately attributed simulated delivery confirmation changed the business calculation, and a €1,420 emergency-purchase proposal was approved and read back. No purchase was placed and no inventory was moved. The publication did not establish a real supplier delay.

The next proof is a broader industrial portfolio, selective data access and a qualified commercial-opportunity journey. ERP and CRM integrations, deployment on Aiven Runtime and measurable customer productivity remain to be demonstrated.

The ambition is to help teams act on changes with evidence and a workable plan, while retaining the knowledge behind each decision. No financing, customer contract, measured savings or production deployment is announced in this draft. The earlier funding-release projection remains a separate positioning exercise.

## 9. Website copy, ready for the site owner

**Navigation:** Product · How it works · First market · Prototype evidence · Demo.

**Hero headline:** Turn market changes into decisions.

**Hero subheading:** Connect industry signals with your sites, suppliers, stock and customer commitments. Understand what is at risk, qualify new opportunities and review a plan your team can act on.

**Primary CTA:** Explore the demo. **Secondary CTA:** See the evidence. Route these to the verified demo URL and the evidence section when available. No signup or contact form is implied by this copy.

**Who it is for:** Operations and procurement teams managing materials across multiple sites and construction projects. Starting with timber and building materials in France, with European supply relationships.

**Protect commitments:** Investigate a supply change, find the affected deliveries and compare options without silently consuming stock promised elsewhere.

**Qualify opportunities:** Connect a public project or demand signal to the right commercial question. Check the actual need, compatible availability and delivery constraints before preparing an offer. This commercial journey is a product direction under development.

**How it works:** Receive a sourced signal. Establish its relevance to your company. Calculate the options. Review a versioned proposal. Record the decision and reassess when facts change.

**Your systems keep their authority:** The intended integration reads attributed ERP/WMS and CRM facts. The decision workspace preserves sources, calculations, proposals and history. The current prototype uses synthetic business data; no real ERP or CRM connector is claimed.

**Prototype evidence:** Real model/tool calls and decision readback have been exercised with Aiven PostgreSQL on a synthetic company. The industrial portfolio contains 10,000 prepared order lines and has passed a local deterministic baseline check. Portfolio import, full agent evaluation at that size, Aiven Runtime deployment and customer outcomes remain pending.

**Demo note:** Real public sources and synthetic commercial data are labelled separately. Approval records a decision. It does not place a purchase, send an offer or move stock.

This copy presents our company and its product. The demo presents the synthetic customer. Keep the received direction A for the application; Briques styling of this internal report is not a new public brand or a website design approval.

## 10. Three-minute demo and single slide

**One-sentence pitch:** Decision Desk connects industry changes with a materials company's own commitments to prepare calculated, revisable decisions.

The final recording starts with the customer portfolio and then follows one explainable case. Do not film the prepared portfolio as a functioning dashboard until it has been imported and its displayed counts have been read back. The current two-order runtime proof can be recorded as a clearly limited prototype clip; it does not satisfy the industrial-portfolio criterion.

Before recording, receive a source that matches the decision horizon and dependency: for example, a verified operational supply change for a current order, or a qualified project with compatible available resources. A long-term capacity announcement should produce a long-term sourcing/qualification decision. Keep the current emergency-delay scenario separate if its cause remains synthetic.

| Time | Screen and action | English narration |
| --- | --- | --- |
| 0:00-0:20 | Company overview with counts actually read from the accepted database. | “Paul runs operations across this materials business. He needs to protect many commitments while responding to changes in its industry. This customer and its commercial data are synthetic.” |
| 0:20-0:45 | Original publication, date, collection state and relevance question. | “Here is a real industrial publication. It starts an investigation. It does not prove that one of our deliveries is delayed.” |
| 0:45-1:20 | Selected commitments, source references and actual versus conditional coverage. | “The agent reads the relevant commitments and calls the business tools. This delay is a declared scenario. Stock already promised to another project remains protected.” |
| 1:20-1:55 | Operator releases an attributed internal synthetic confirmation; prior proposal becomes stale. Recalculate. | “A confirmed date in the simulation changes the decision basis. The old proposal can no longer be approved. The alternatives are calculated again from the current facts.” |
| 1:55-2:20 | Exact accepted proposal, human approval and durable readback. | “Paul reviews the feasible response and its cost. The server checks his authority and the current revision. The decision is stored; no real purchase or transfer is executed.” |
| 2:20-2:40 | Trace/data view and measured results from the same version. | “These references show the data, tools and revisions used. We report observed timing and usage. Customer time savings are not measured yet.” |
| 2:40-3:00 | One slide, next users and current limits. | “We start with French timber and materials teams. The same workspace is intended to qualify opportunities as well as risks. Our next proof is the industrial portfolio and a measured customer workflow.” |

The €1,420 example may appear only if the recorded version reproduces that calculated option. Do not present it as avoided loss. Show a separate opportunity only after actual demand, available capacity, price and commercial calculation are received; otherwise label it as the next product tranche.

**Single-slide copy:** Decision Desk. Turn market changes into decisions. User: multi-site materials operations teams. Flow: sourced signal → company exposure → calculated options → human decision → durable history. First market: French timber and building materials. Proof: real model/tools with Aiven PostgreSQL on a synthetic case. Next users: operations and purchasing contacts through Erwan's network, availability unconfirmed. Limits: industrial portfolio agent journey, ERP/CRM connectors and Runtime deployment pending. Keep one verified demo link on the slide.

**Data-layer submission text:** The prototype stores attributed business snapshots, public-source evidence, cases, runs, proposals, decisions and memory in PostgreSQL. A real OpenAI run calls typed server tools and deterministic business calculations. Business, policy and case revisions bind proposals to the facts reviewed. An operator can release a synthetic confirmation; the server invalidates older plans. Public sources do not establish private commercial links. A 10,000-line synthetic portfolio has been prepared and checked locally; its application/Aiven import and agent-scale evaluation are separate pending work.

The five received judging criteria map to the observable user decision, actual tool selection, a changed answer caused by data, measured validity/timing and a readable complete journey. The six received deliverables remain name, one-sentence pitch, three-minute MP4, data-layer text, evidence file and one-slide link. Modalities are attributed to the received brief; they have not been reverified for submission here.

## 11. Existing owners and concrete continuation

| Next action | Existing owner | Completion evidence |
| --- | --- | --- |
| Receive this delta into PRODUCT-VISION and reconcile the outdated brief/README descriptions, preserving dated history. | Product owner chat with Erwan; README changes through integrator. | Linked current English source and explicit reception of the customer activity and persona. |
| Receive the candidate data and a scoped portfolio-read contract; import into a separate synthetic session after validation. | Integrator, then data/business builders on their paths. | Exact import receipt and counts read back, no reset of existing sessions. |
| Replace all-row model results with bounded projections; keep complete server-side constraints. | Integrator with business/agent owner. | Correct affected set, bounded payload, no dropped commitments; source/policy revision checks preserved. |
| Add one accepted timber profile and test knowledge reuse and correction. | Data and agent, shared contracts through integrator. | Source receipt, scoped acquisition/reuse trace, changed-source invalidation and restart. |
| Show portfolio overview, one case and the current proposal in direction A. | Existing interface owner. | Same database/code version; Aside desktop and appropriate mobile checks, with data labels. |
| Run the accepted 10k chain, then decide whether to promote to 100k/1m. | Integrator and operator. | Business validity, complete retrieval, tokens/latency, concurrency and recovery; required independent final-code reviews. |
| Integrate site content, rehearse, then record the three-minute film from the received version. | Product/media owner with interface and integrator. | Verified links, exact captures, actual MP4 duration and readable single slide. Publication/submission keeps its separate authority. |

Coordination uses the existing product and integration chats. No new chat, ticket, scheduler, service, application code, shared contract, dependency, commit, push or deployment is created by this dossier. Data preparation and local calculation do not complete the industrial product objective. The integrated chain remains with the integrator.

## 12. Sources and reception limits

Read in this run: PROMPT-REPRISE-GLOBALE, START-HERE, PRODUCT-VISION, README, HANDOFF, OWNERSHIP, THREADS, CONTRACTS, BUILD-PLAN, STATUS, the current brief-aside, RELAY-RECEIPT, CHAIN-CHECKPOINT, MEMOIRE-RECHERCHE-TRACES, RECHERCHE-DATA-DELTA and SECTOR-DATA-STRATEGY. Historical business vocabulary and agentic contract were read from the frozen kit; earlier stock/monitoring/action studies were consulted as historical context, not freshly verified external research.

Current implementation readings: `src/agent/context.ts` (releasedCommitments and memory filtering), `src/domain/model.ts`, `src/domain/engine.ts`, `src/domain/contract.ts`, shared contract signatures and case repository map. Runtime receipts read: OPENAI-REAL-QUESTION and selected current fields of REAL-CASE-FLOW. Existing chats were checked to recover human intent, ownership and current progress. This is a targeted alignment review, not a complete code/security audit or a rerun of all product tests.

New primary-source feasibility readings are linked in section 5. Failed Odoo page and Snowfakery raw-file requests are not treated as implementation evidence. Local observations and output hashes are in DATA-CHECKS, LOCAL-DOMAIN-SMOKE and RECEPTION. The Linear field-note tool was advertised but returned “Tool get_agent_context not found”; the actual ERW-133 issue and its existing documentary links were read instead.

Methods applied: work-reconcile, capability discovery, stable project identity, demo-package and its English-language contract, erwan-ticket-delivery, Google Drive and the Briques report template. No product code was modified; the required two-review cycle for new application code is not claimed by this documentary/data preparation.
