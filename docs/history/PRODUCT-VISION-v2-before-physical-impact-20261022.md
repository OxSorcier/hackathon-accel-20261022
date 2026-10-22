# AdaptOps: product vision and demo alignment

22 October 2026. Version 2. Product owner: Erwan. Status: received identity and product direction; full application journey under construction. Existing follow-up: [Accel, ERW-133](https://linear.app/briques/issue/ERW-133). Keywords: AdaptOps, adaptive operations, live signals, industry data, risks, opportunities, approved actions, ERP, CRM, company memory, timber, materials.

## Received identity and promise

**AdaptOps**

**Adapt as fast as your market changes.**

**We help businesses adapt as fast as their markets change, turning live signals into coordinated plans and executing approved actions.**

Erwan selected this name and signature in the existing naming chat, then requested this update and coordination with the current owners. Execution is part of the target product. This choice does not establish working connectors, completed business effects, domain ownership, trademark clearance or deployment.

We sell the ability to move from an industry change to a workable response. The agent already knows the company, gathers relevant signals, establishes their consequences and prepares a common plan across purchasing, operations and sales. Finance participates through costs, spending rules and approvals. The agent executes authorised approved actions and checks their results.

## First customer and business value

The first market is multi-site timber and building-materials businesses in France, with European supply relationships. Paul is the proposed operations leader, working with purchasing, logistics, sales and finance. The demo company and commercial records are explicitly synthetic. Customer interviews, willingness to pay, integration effort and productivity gains remain to be established. Other industries need their own data, rules and customer evidence.

Risk and opportunity belong in the same calculation. A new customer request may consume stock promised elsewhere. An alternative purchase may cost more than its commercial contribution. AdaptOps must check these interactions before recommending a plan.

## The complete target loop

1. **Know the company.** Retrieve authorised facts about activities, sites, products, suppliers, customers, projects, stock, reservations, purchases, demand, rules and valid prior research. Preserve native IDs, revisions and access rights.
2. **Follow its environment.** Collect relevant industry and regional news, projects, tenders, industrial events, capacity announcements and applicable requirements. Distinguish publication, event, effective and collection dates. Internal ERP/CRM changes also prompt reassessment.
3. **Establish impacts.** Link the event to the right entities and business dependencies. Distinguish supported risk, opportunity, mixed impact, no known exposure and verification needed. News sentiment alone does not establish business impact.
4. **Prepare one coordinated plan.** Compare purchasing, allocation, transport and commercial options. Check products, units, quantities, dates, compatible free capacity, protected commitments, incremental costs, selling price and spending authority. An unqualified lead remains distinct from confirmed demand.
5. **Execute approved actions.** Bind approval to current data, plan and permissions. Execute through received tools, preserve an action receipt and read back its effect. Approval, execution and observed business outcome have separate states. Simulation is labelled.
6. **Retain and reassess.** Reuse valid acquired knowledge, keep decisions and outcomes and revise affected work when facts change. Completed actions retain their historical receipts; a correction does not erase or silently replay them.

The harness organises company-scoped reads, calculations, permissions, revisions, tools, traces and durable state. The model retrieves permitted relevant facts instead of receiving an unrestricted company dump. Public queries use public subjects; private commercial records, secrets, build documents and operator-only future events stay outside public queries and product knowledge. Traces expose useful calls/results, not private reasoning.

## The experience to demonstrate

Paul opens an already prepared briefing:

> Here is what changed in your industry. Here is why it matters to your business, the commitments to protect, the opportunities to qualify and the coordinated plan I recommend. These actions are ready for your approval.

He opens a dossier, checks sources, corrects an assumption, compares options and approves actions within his authority. AdaptOps executes available authorised actions, reports their outcome and monitors the conditions. Questions deepen the work; the demo must not require Paul to restate the company or prompt every new event.

**Controlled industrial scenario to receive:** an incident affects an attributed supply dependency and constrains a nearby competitor. Potential additional demand becomes quantifiable only after an attributed CRM intake provides product, quantity, delivery window and commercial terms. The common plan protects current customers and checks whether compatible supply and capacity can serve that demand at an acceptable contribution.

A real source must match the event, dependency and decision horizon. Future capacity does not prove an immediate delivery delay. A historical incident is not a fresh disruption. A public announcement does not prove a private supplier relationship or confirmed customer demand. Controlled events and synthetic links remain explicit.

## UX/UI is an acceptance condition

The existing direction A remains the application reference. The chosen name does not approve a new visual identity or one of the separate slide variants. Application UI has one existing owner; Figma/slide work retains its own scope.

| Surface | User understanding | Required check |
| --- | --- | --- |
| Company briefing | What is known, what changed and what needs a decision. | Prepared/saved work before the secondary question box; actual company counts, data origin and freshness. |
| Impact dossier | Which public/internal facts establish relevance and what is uncertain. | Readable risk/opportunity/mixed labels; original sources and dates one step away. |
| Coordinated plan | What each team should do and which resources/actions depend on each other. | One calculated plan with quantities, costs, dates and protected commitments. |
| Action and result | What was approved, what ran and what effect was verified. | Prepared, approved, executing, executed, failed, uncertain and superseded states where supported; no invented success. |
| Revision and recovery | Why remaining work changed and what already happened. | Stale pending plans refused/recalculated; completed receipts/history retained after restart. |
| Demo readability | The business decision before technical evidence. | English copy, clear hierarchy, progressive disclosure, keyboard focus and desktop/narrow-layout checks in Aside. |

Observed on 3001: a question-first entry and a "Direct execution" badge on an approved proposal whose note says no purchase or stock movement occurred. UI has received both as targeted improvements. Run mode must not imply business execution. See the [UI checkpoint and real browser evidence](../proposals/ui/ADAPTOPS-DEMO-CHECKPOINT.json).

## Evidence checkpoint and concrete gaps

This is a dated coordination checkpoint. The integrator's [current verification status](STATUS.md) owns runtime evidence. Historical failures and candidate receipts stay intact. This documentary change does not rerun application tests or certify candidate code.

| Capability | Available evidence | Remaining delivery and proof | Existing owner |
| --- | --- | --- | --- |
| Known company and risk plan | Stable 3001: real model/tools, Aiven PostgreSQL, synthetic company, EUR 1,420 option approved/read back, state retained after restart. | Import/read back the enriched industrial candidate and bounded company projections in the same app. EUR 1,420 is an option cost, not savings. | Portfolio owner, business and integrator. |
| Relevant industry signal | Public ROCKWOOL source read through Keenable, with partial/indexed-copy limits; sector research exists. | Attributed event/entity/site/product/purchase relation and matching horizon; synthetic confirmation kept separate. | Data/watch, research and integrator. |
| Prepared automatic report | Evidence persistence, collection and generation handling exist. | Durable authorised observation-to-analysis trigger, deduplication, consumption limits, failures/recovery and stored report before a new question. | Integrator with data/watch and agent. |
| Opportunity and mixed plan | Existing 10k-line portfolio candidate. Original CRM leads lack all required quantity/date/price facts. | Receive the same owner's enriched v2; qualify demand and calculate compatible free resources, transport and contribution without breaking commitments. | Portfolio owner, business/agent and integrator. |
| Reusable research memory | Separate agent/data/UI/server candidates and local tests. | Final exact-code reception and real new-session, process-restart and source-v2 correction tests on Aiven. | Agent/data/UI and integrator. |
| Approved action execution | Approval is durably recorded; that status executes no purchase or inventory movement. | Received action contract, one labelled simulated ERP/CRM effect, rights/revision checks, idempotence, visible failure/uncertainty and durable readback. | Integrator with business/agent and UI. |
| Demo UI and release | Direction A and risk UI exist; targeted AdaptOps UI checkpoint received. | Prepared briefing, common plan/action states, visual reception and integrated browser run. Runtime deployment and recording need their own receipts. | UI, integrator and existing media owners. |

The existing data/report coordinator continues the already authorised ERP/CRM enrichment and import. Shared contracts, migrations, assembly and final reception remain with the integrator. No duplicate portfolio, application, registry or owner is created here.

## Stable acceptance criteria

A1-A8 retain their existing meanings and are refined for the received vision. A9 adds the explicit action-execution requirement.

| ID | Result | Required proof |
| --- | --- | --- |
| A1 | Attribute the event to the correct dependencies or keep it unverified. | Correct relation, homonym and absent-relation cases; no invented link. |
| A2 | Distinguish risk, opportunity, mixed effect and no known exposure. | Company facts support the classification, not source sentiment. |
| A3 | Calculate an opportunity while protecting current commitments. | Qualified demand, compatible free resources, dates, price and incremental costs; missing facts visible. |
| A4 | Produce the report from a relevant new observation. | Durable trigger, real model/tools, calculated plan, persistence/readback, deduplication and error evidence. |
| A5 | Make the complete journey understandable in A. | Prepared briefing, inspectable evidence, common plan, distinct approval/execution, English copy and browser checks. |
| A6 | Reuse valid knowledge and revise affected work. | New-session/restart recovery, corrected-source history and stale pending plan refusal/recalculation. |
| A7 | Use relevant sector/regional sources. | Native identity, meaningful dates, freshness/partial limits and bounded authorised collection. |
| A8 | Demonstrate value on the exact integrated version. | Complete journey, explicit baseline, measured validity/time/usage, Runtime and jury access if released, three-minute film and single slide. |
| A9 | Execute an approved action and verify the effect. | Current authority/plan, one labelled simulated durable effect, receipt/readback, no duplicate on repeat command and visible failed/uncertain outcomes. |

## Challenge, sources and continuation

The [three-minute demo brief](../proposals/product/alignment-20261022/DEMO-SCRIPT.md), with [offline HTML](../proposals/product/alignment-20261022/DEMO-SCRIPT.html), starts with the known company and prepared report, then a mixed-impact recommendation, approval, action result and changed-data revision. Footage can claim only what its exact received version does.

The challenge supplied by Erwan asks for an end-to-end product grounded in changing data, visible data flow, measurable evidence, a slide and clear live/recorded/synthetic labels. It requires application deployment on Aiven Runtime; a working Aiven database alone does not establish it. Advanced self-improvement is optional. Memory reuse does not establish model training or measured learning.

This version succeeds the [exact pre-AdaptOps vision](history/PRODUCT-VISION-v1.1-before-adaptops-20261022.md), with [historical HTML](history/PRODUCT-VISION-v1.1-before-adaptops-20261022.html). That snapshot preserves the initial inspection, A1-A8 and the hypothetical funding exercise. No funding, client contract, price, saving or unique market position is established.

- [Industrial customer, portfolio and historical story](../proposals/product/alignment-20261022/ALIGNMENT-AND-STORY.md). Its Decision Desk descriptor is superseded by AdaptOps; data/source identities remain intact.
- [Company research memory and traces](../proposals/product/MEMOIRE-RECHERCHE-TRACES.md).
- [Government/timber source research](../proposals/product/research-data-20261022/sector-sources/SECTOR-DATA-STRATEGY.md), with [offline HTML](../proposals/product/research-data-20261022/sector-sources/SECTOR-DATA-STRATEGY.html).
- [Data checkpoint](../proposals/data/ADAPTOPS-DATA-CHECKPOINT-v1.json), [UI checkpoint](../proposals/ui/ADAPTOPS-DEMO-CHECKPOINT.json) and [builder ownership](OWNERSHIP.md).
- [Integrator status](STATUS.md), the authority for current exact-version reception and tests.

Sources actually consulted: Erwan's received naming/action/UX instructions in chat 01a16316-d948-7672-b47f-395e6d411d33; previous vision and demo; current integrator/data/UI checkpoints; the challenge text supplied by Erwan. External research claims are not freshly reverified here. This update changes no application code, fixture, shared contract or deployment authority. The existing owners continue the product work.
