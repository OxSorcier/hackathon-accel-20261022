# AdaptOps: the company behind the demonstration

22 October 2026. Version 2. Prepared for Erwan Gallo. Status: synthetic data and candidate DTO checked locally; application import and the complete mixed-impact journey remain with the existing integrator. This is a successor to the [original alignment dossier](../ALIGNMENT-AND-STORY.md), preserving its data and receipts.

## 1. What is ready

| Layer | Verified here | Remaining proof |
| --- | --- | --- |
| Company data | One enriched version of the existing portfolio: six sites, 24 programmes, 200 products, 400 customers and 10,000 order lines. | Explicit isolated Aiven import, counts and restart readback. |
| ERP dependencies | Eight purchase lines, 13 inbound allocations, protected reservations, supplier sites and five attributed supply dependencies. | Server intake validation and use by the integrated industrial calculation. |
| CRM opportunity | One existing lead qualified with customer, project, exact SKU, unit, quantity, date, price and owner. The other 79 generated leads remain unqualified. | Product calculation, offer preparation, approval and labelled simulated execution. |
| Industry signals | Existing sector research is retained. One BOAMP record was freshly read as a sector lead. | Received sources and durable observation-to-report trigger in the application. |
| Harness | Current deterministic engine covers all 10,000 initial commitments in one local run. Candidate industrial context matches the published DTO. | Bounded model retrieval, mixed plan, action receipts and integrated recovery tests. |
| Scale | Coherent volume data and one exact-source deterministic observation. | Model cost/latency, concurrency, correction and restart acceptance on the imported version. |

The existing stable risk demonstration has separate model, Aiven and approval receipts. Those receipts do not establish that this larger portfolio, commercial calculation or simulated action is already integrated. The [integrator's status](../../../../docs/STATUS.md) remains the runtime authority.

## 2. The product we are showing

**AdaptOps. Adapt as fast as your market changes.**

**We help businesses adapt as fast as their markets change, turning live signals into coordinated plans and executing approved actions.**

The agent knows the company before the signal arrives. It follows relevant industry and regional information, establishes company-specific effects and prepares one plan across purchasing, operations and sales. Paul reviews its evidence and trade-offs, approves available actions and sees their recorded result. Valid knowledge and completed actions survive a new session; changed facts require reassessment.

The [received product vision](../../../../docs/PRODUCT-VISION.md) and the [existing demo brief](../DEMO-SCRIPT.md) own that target journey. This data package supplies its company facts. It does not replace either document or claim that the full product is finished.

## 3. A concrete company, with explicit limits

Industrial Materials Group is a synthetic multi-site timber and building-materials distributor. Lille, Centre, Sud, Nantes and Lyon are in France; Brussels is in Belgium. Nantes and Lyon have light-finishing roles. Production scheduling, finishing capacity, bills of materials and a manufacturing ERP are not modelled.

Paul leads operations, Claire owns purchasing and Alex coordinates logistics. Their native employee IDs and fixture ceilings remain unchanged. Fictional provenance identifies who supplied a business fact; authentication and approval rights must still come from the server.

The portfolio contains 2,502 orders and 10,000 lines, 764 stock records and 9,999 reservation records. Twelve prior reservations remain as released history after their commitments were explicitly moved to confirmed inbound allocations. All initial commitments remain covered exactly once. Two planned, unconfirmed timber purchases do not count as confirmed coverage.

This is synthetic ERP/CRM-shaped data. No real ERP or CRM API connector, customer confirmation, legal company identity or production-system access is established.

## 4. One demonstration flow

The controlled scenario declares a fire at the fictional Alpha supply site. The current master data already links that site to five purchase lines, 13 order lines and four destination sites. That establishes exposure in the synthetic company; it does not establish that every exposed delivery is late.

A separate operator confirmation moves only POL-1 from 23 October to 20 November. The fire alert alone cannot make that mutation. A competitor is present in the current master data with an Alpha dependency. A third, separately attributed fictional confirmation declares its inability to supply 20 ISO100 pallets by 29 October. The amended candidate DTO can receive that fact; its existence in a preparation file does not release it or establish a real market event.

The existing CRM lead CRM-IND-000 independently contains a qualified request for 20 pallets of SKU-ISO100 at Lille by 29 October, with a proposed selling price of EUR 190 per pallet. It is not inferred from the fire or the BOAMP notice. A draft offer is not an accepted customer order.

The intended report considers the current delivery risk and this qualified demand together, protects all existing commitments and compares received supply and transport options. The current deterministic engine has not yet implemented that commercial assessment. The business/agent owner and integrator own the calculation and its application reception.

## 5. Quantities and economics that can be checked

Lyon's current ISO100 stock is 3,852 pallets, with 3,752 already reserved and 100 free. Separate received synthetic delivery quotes describe eight pallets arriving at Lille on 23 October and 20 pallets arriving there on 29 October. These are date-specific capacities, not interchangeable promises.

| Arithmetic checkpoint | Amount | Meaning |
| --- | --- | --- |
| Free stock after allocating 8 plus 20 | 72 pallets | Conditional on current stock, exact units, dates and all-commitment checks. |
| Qualified demand revenue | EUR 3,800 | 20 times EUR 190; no sale has occurred. |
| Attributed stock valuation | EUR 2,400 | 20 times EUR 120; existing inventory value, not a new cash payment. |
| Opportunity delivery and handling | EUR 300 | EUR 260 plus EUR 40, already included in the corresponding base transport quote. |
| Contribution before overhead | EUR 1,100 | Revenue less the received valuation and quoted logistics; not net profit. |
| Separate risk delivery quote | EUR 180 | Does not reduce the commercial contribution twice. |
| Combined incremental logistics | EUR 480 | EUR 180 plus EUR 300 if both quoted movements are selected. |

These are independently checked arithmetic facts in a builder receipt, not a product recommendation, hidden scoring oracle or observed business effect. The product must calculate its own feasible common plan. It may select another valid option. The same stock or emergency quote cannot be allocated twice.

Five emergency alternatives retain their canonical C1 resource IDs. URG-1 is one eight-pallet offer. The earlier provisional alias adds no capacity. Alternative stock is at distinct synthetic sites with attributed current availability; upstream multi-tier independence is not established.

## 6. Current facts and operator events stay separate

The frozen current inputs are [portfolio-10000.json](portfolio-10000.json), [portfolio-policy.json](portfolio-policy.json) and [industrial-context.v2.json](industrial-context.v2.json). Their exact hashes are in [CORE-READY.json](CORE-READY.json) and [INDUSTRIAL-READY-v2.json](INDUSTRIAL-READY-v2.json). Business revision, industrial-context revision and demand-qualification revision are distinct.

[operator-event.v2.json](operator-event.v2.json) contains a candidate IndustrialEvent, one interruption confirmation and one competitor confirmation. It is test-only, has no fabricated public evidence and supplies no server release authority. Only an authenticated operator path may release it, after the facts' logical receipt times. Earlier proposed samples and the first DTO adaptation are preserved separately as historical versions.

Neither operator preparation, expected outcomes nor builder receipts belong in the product model's current context, HTTP static output or runtime bootstrap. The complete company snapshot stays on the server. The model should retrieve bounded relevant facts and calculated results.

## 7. Public information has its own evidence

The freshly read [BOAMP notice 26-101741](https://www.boamp.fr/pages/avis/?q=idweb%3A26-101741) concerns energy renovation of the Marc Bloch school in Savigny-le-Temple. It was published on 20 October, with a deadline shown by the API as 13 November 2026 at 12:00 UTC. The original procedure field omits a timezone; that discrepancy is retained. Relevant lot descriptions include insulation. The full consultation documents were not read.

This notice is a sector lead. It establishes no relationship to CLI-A, a confirmed quantity, SKU compatibility, the fictional fire or an awarded order. The [public-source receipt](../opportunity/PUBLIC-SOURCE.json) preserves the exact query, retrieval date and raw hash.

The existing research owner separately read historical ARIA and ROCKWOOL incident sources. Those incidents are not fresh October disruptions and are not evidence for this fictional company. Their source-level qualifications remain in the [industrial incident research](../../research-data-20261022/sector-sources/INDUSTRIAL-INCIDENTS-20261022.json). No real article is repurposed as proof of the controlled fire.

## 8. Checks and next delivery

The enriched core passed 30,206 consistency assertions covering IDs, foreign keys, units, reservations, confirmed inbound quantities and dates, complete initial coverage and CRM qualification. A separate set of 65 context checks reconciled quotes, dependencies and arithmetic. The DTO adaptation has 49 initial checks and 20 additional checks for the amended fields; exact JSON literals also passed TypeScript checking against the integrator's candidate contract v2.

One local deterministic evaluation covered all 10,000 order lines in approximately 3.826 seconds. Its serialized result was 6,542,573 bytes. Domain and shared-contract hashes were identical before and after that run. This is a single observation, with no warmup, concurrency, percentiles or model call. It makes bounded model projection a practical integration requirement; it does not establish scalable agent performance.

The existing integrator received the frozen core and industrial-context receipts. It owns the isolated Aiven import, shared validation, event release, model/report assembly, action commands and final reception. The existing business/agent owner owns the deterministic industrial calculation and bounded projection. Data/watch owns entity resolution and the durable analysis trigger. UI owns the prepared briefing, common plan and distinct approval/execution states. Existing QA owns operator expectations and integrated tests.

The immediate completion proof is one exact-version journey: imported company, released event, prepared report, calculated risk and opportunity, current approval, one labelled simulated effect, readback, repeat-command idempotence and recovery after changed data or restart. A document or successful import alone closes only its own delivery.

## 9. Copy and consulted sources

The new [press release draft](PRESS-RELEASE.md) and [website copy](WEBSITE-COPY.md) use AdaptOps and the received promise. They succeed the historical Decision Desk extracts and are not published. The brief and vision remain with their existing owner.

Sources actually read: the received vision, project ownership and contracts; the integrator's candidate industrial contract with SHA-256 in INDUSTRIAL-READY-v2; the existing v1 portfolio and policy; the current domain implementation invoked by the smoke test; the freshly fetched BOAMP API record; the research owner's incident-source receipt; and the direct human coordination mandate in chat 01a162cf-0150-7091-8394-f5dbca7b53a9, message 01a1633d-e3b7-7a03-baee-5c43eb1bc679. Native data and evidence receipts accompany this document. No commit, public publication, deployment or real commercial action was performed by this chat.
