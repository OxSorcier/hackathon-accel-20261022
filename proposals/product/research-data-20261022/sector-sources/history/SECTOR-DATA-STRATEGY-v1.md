# From sector signals to operating decisions

22 October 2026. Version 1. Internal research supplement to PRODUCT-VISION and the existing data research dossier. Product owner: Erwan. Research owner for this supplement: chat 01a162bd-6384-7031-82c3-fdb5efba174e. Tracking: [ERW-133](https://linear.app/briques/issue/ERW-133). Status: source research and bounded access trials completed; product recommendations proposed; independent research review not run.

**The company vision is a decision system for businesses whose revenue depends on physical supply, stock and delivery commitments. France's timber and construction ecosystem is the first sector in which to prove it.** Public APIs, trade publications and monitored websites can supply complementary signals. Their value comes from linking a verified change to a specific company dependency and a feasible response.

## 1. What this research adds

The [existing data dossier](../RECHERCHE-DATA-DELTA.md) covers Keenable, original publisher evidence and regulatory candidates. The [company memory dossier](../../MEMOIRE-RECHERCHE-TRACES.md) covers reuse, revisions and traces. This supplement extends those sources with direct government APIs, timber feeds, commercial supply signals and the conditions required to turn them into decisions. It does not create a second knowledge registry, scheduler or product architecture.

Four useful access paths were directly observed: public company search, official BODACC records, the FNB RSS feed and the France Bois Forêt observatory RSS feed. Sitadel's public metadata also returned downloadable data references. These are research trials, not installed product connectors. The [access evidence](PUBLIC-ACCESS-PROBES.json) records request URLs, UTC times, response structure, hashes and limits. No account, subscription, scheduled collector or paid service was created.

## 2. Government data: which question each source can answer

| Source | Useful information and company connection | Access actually checked | Decision limit |
| --- | --- | --- | --- |
| [Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) | Candidate legal entity, SIREN, establishments and activity. Match a publisher's company or industrial location to the supplier master. | Public GET returned HTTP 200 and one result for a generic sawmill query. Documentation and the official [access explanation](https://annuaire-entreprises.data.gouv.fr/donnees/api-entreprises) were read. | A name match is a candidate. Confirm entity and establishment. This open search service is not the complete Sirene dataset and excludes some records. It does not establish a customer or supplier relationship. |
| [BODACC](https://www.bodacc.fr/explore/dataset/annonces-commerciales/api) | Published corporate events. Match the notice to an existing counterparty by identifier; retain event type and later notices. | Official DILA dataset endpoint returned HTTP 200, one record and structured notice fields. The trial was unfiltered and does not measure timber relevance. | A legal publication does not establish current delivery failure, insolvency probability or a sales opportunity. Dates and the exact legal event matter. Do not create a general negative supplier score from a title. |
| [BOAMP](https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-des-marches-publics-boamp) | Public projects, lots, buyers, deadlines and awards. Match geography and product categories, then inspect the consultation documents. | Official API documentation read. The existing product owner already records a real bounded collection; no duplicate run here. | A notice is a market signal. Neither a contract award nor a project budget is this company's order, accessible revenue or material quantity. Avoid double counting notice versions and lots. |
| [Sitadel open data](https://www.data.gouv.fr/datasets/liste-des-permis-de-construire-et-autres-autorisations-durbanisme) | Building permits and their lifecycle. Detect a regional project pipeline, including private construction. | data.gouv metadata returned HTTP 200, stable dataset ID, licence and CSV references through DiDo. The descriptive ministry page was in maintenance. | Monthly publication and revisions differ from a live construction feed. No full CSV was imported or schema validated here. An authorisation does not prove a start date, wood specification or purchasing decision. |
| [Vigicrues](https://www.vigicrues.gouv.fr/categorie/4) | River vigilance near a site or route. Select the relevant river section rather than alerting an entire region. | Official RSS documentation read; the vigilance feed is distinct from website-update news. No live feed trial here. | Flood vigilance alone does not prove a warehouse flooded or a road closed. Route and operator confirmation are needed before changing transport assumptions. |
| [DRAAF phytosanitary information](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/lutte-contre-le-nematode-du-pin-la-foire-aux-questions-a3881.html) | Restrictions affecting sensitive wood movements. Link origin, species, treatment, material state and destination to the affected lot. | The official FAQ, updated 20 July 2026, was read. It distinguishes zones and treatment conditions. | This is an applicability candidate. The current orders, current boundary and lot documents must be received before determining whether a shipment is restricted. The FAQ is not an executable universal compliance rule. |

There is no single government API covering every signal. Use the producer and dataset that answer the decision question. The Sitadel catalogue returned dataset ID `689c42fa521ccf80ce954f83`, licence `fr-lo` and data-file references last modified on 29 September 2026. Catalogue-page timestamps were sometimes later than the CSV timestamps. A refreshed catalogue page is not proof of fresher business data. The [SDES publication calendar](https://www.statistiques.developpement-durable.gouv.fr/agenda-des-parutions) is useful for planning checks; the advertised next publication is not data already received.

## 3. Timber sources that can be connected

| Publisher | Signal and practical collection route | Evidence received | Access or interpretation limit |
| --- | --- | --- | --- |
| [Fédération Nationale du Bois](https://www.fnbois.com/) | Sector publications and trade announcements. Prefer the advertised [RSS feed](https://www.fnbois.com/feed/). | Homepage and feed HTTP 200; valid RSS containing 10 items. Feed discovered from the page, not inferred from a platform name. | Public posts and member-only content are separate. Feed access does not grant blanket republication or extranet rights. A federation's position is attributed advocacy where relevant. |
| [France Bois Forêt observatory](https://observatoire.franceboisforet.com/) | Prices, conjoncture, imports and market segments. Advertised [RSS](https://observatoire.franceboisforet.com/feed/) followed by original page and linked report when useful. | Homepage and feed HTTP 200; 10 items. The October IsiBois page and its linked PDF were opened. | Publication date and measurement period are different. The October release describes imports through June. Broad market movements do not establish current availability or a quote for a specific SKU. |
| [Fibois Grand Est](https://fibois-grandest.com/actualite/) | Regional industrial news, forest conditions and construction ecosystem. Monitor selected listing pages if no suitable feed is available. | Public listing and a forest-health article read. Homepage HTTP 200. No RSS link advertised in the inspected homepage HTML. | That observation does not prove no feed exists. The article points to older underlying health information. Preserve both dates and follow the original authority for operational restrictions. |
| [ONF](https://www.onf.fr/produits-services/+/1fd7::lettre-conjoncture-bois-onf.html) | Supply-side context by species and market, plus the [wood sale portal](https://ventesdebois.onf.fr/vel/). | Official publication page, archive links and sale guidance read. The sale application itself yielded no usable catalogue content through the text reader. | Live lot availability and catalogue automation remain untested. A standing-tree sale is not interchangeable with delivered, graded structural timber. Processing, yield and lead time are required. |
| [Boursabois, described by the FNB](https://www.fnbois.com/boursabois-la-bourse-en-ligne-des-bois-prend-son-envol/) | Offers and buyer needs could support alternative sourcing or demand qualification. | The federation's platform description was read. | Current listings, API availability, access terms and reliable fulfilment were not tested. Treat this as an access/partnership candidate rather than a ready connector. |
| [Fordaq](https://bois.fordaq.com/) | Sector news and timber marketplace listings. Public discovery may identify sources or candidate alternatives. | Public homepage read. It distinguishes public browsing from fuller account and premium access. | No API, licensed feed or automated commercial-data access established. Its terms page did not yield readable evidence. No account or offer was created. |
| [Le Bois International](https://www.leboisinternational.com/) | Specialist reporting is a candidate for industry coverage. | Search identified the publisher. Web retrieval failed; Aside returned `ERR_CERT_DATE_INVALID`. | Original article and terms were not received. Do not bypass the certificate warning or promise a working scraper. Keep this source unresolved until normal access or licensed delivery is available. |
| [INIES](https://www.inies.fr/le-webservice/demander-un-acces/) | Environmental declarations may help qualify a product against project requirements. | Official webservice access page read. It describes an application and approval process, conditions and a licence document. | This is not a freely activated API. Access and intended use need acceptance. An FDES does not by itself establish structural equivalence, customer acceptance or all regulatory conformity. |

The observatory's [July conjoncture report](https://observatoire.franceboisforet.com/wp-content/uploads/2014/06/Conjonture-filiere_juillet-2026-v2_web.pdf) distinguishes species and end uses and explicitly combines different statistical periods. This supports storing product segment and observation period, rather than attaching a single universal trend to “wood”. Its underlying figures were not independently reconciled in this supplement.

## 4. What else the company should capture

**Demand before the order.** Permits, tender notices, awards and industrial expansion announcements can identify projects to qualify. Connect each project to its stage, buyers or contractors, likely product family and service area. A later cancellation or postponement must revise the candidate. A headline budget is never automatically convertible into sales.

**Supply before the shortage.** Industrial capacity announcements, maintenance, incidents, corporate events, lot offers and transport restrictions can identify changes to investigate. Store the affected establishment and its products. New capacity planned for 2028 cannot cover a delivery next week. An industrial fire may damage only stored goods or may leave production unaffected, as the existing research's negative example shows.

**Margin before a bad purchase.** Track price basis, species, grade, dimensions, moisture, treatment, currency, delivery terms and observation period. A forest price index is context, not a delivered purchase quote. Compare validated supplier quotes with transport, processing, holding cost and approved safety constraints before proposing an order.

**Usable stock before apparent stock.** A lot can exist and still be unavailable because it is reserved, held for quality, unsuitable for the customer's use, missing required documentation or affected by movement restrictions. Model these limits explicitly. Avoid double subtraction where a system already includes holds in available-to-promise quantities.

**Shared dependencies before an apparent alternative.** Two distributors may buy from the same mill, use the same transport corridor or depend on the same species and treatment capacity. A second legal supplier is not necessarily independent supply. Tier-two relationships require attributed evidence or confirmation; the web does not reveal a complete supply chain by itself.

**Positive changes as well as threats.** A new project, reopened route, resumed plant, available compatible lot, confirmed incremental demand or improved quote can produce an opportunity. The same event can threaten one commitment and create another candidate. Nature of impact, confidence of evidence and eligibility for approval must stay separate.

## 5. From collection to a calculated proposal

| Step | Evidence and calculation required | Concrete output |
| --- | --- | --- |
| Discover and read | Known API/RSS/page first; search for useful gaps. Record original URL, publisher, source ID, publication/event/collection dates, statistical period, hash and partial-access state. | A versioned observation whose contents can be checked. |
| Resolve the company link | Legal entity, industrial site, geography, supplier relationship and product mapping. Internal master data or attributed confirmation has authority over a guessed name match. | An exposed dependency, no known exposure, or a precise missing fact. |
| Establish impact | Compare baseline commitments and supply with an explicit event or scenario. Keep actual confirmed data intact. Respect units, dates, quality, reservations and safety stock. | A dated shortage, delay, eligible capacity or opportunity candidate, with the change from baseline. |
| Calculate alternatives | Use the existing deterministic business engine. Protect every commitment; check compatibility, budgets, logistics and current revision. Commercial opportunities also need a qualified need and price. | Feasible transfer, purchase, rescheduling or draft commercial response, with costs and conditions; otherwise a targeted request for the missing input. |
| Decide and remember | Show source, company link, calculation and uncertainty in the existing decision workspace. Server verifies authority and version. Store decision and later outcome separately. | A revisable proposal and durable human decision. An approval alone does not prove execution. |

A missing fact must lead to a concrete next action, such as confirming one purchase arrival date or obtaining one treatment certificate. It should identify the affected decision, responsible role and what will be recalculated when the answer arrives. It must not become an indefinite pile of unassigned “to verify” dossiers. When adequate facts are available, continue through the calculation and proposal.

### An industrial-scale illustration

This example explains the target behaviour. All company quantities, prices and demand below are invented for illustration and are separate from the application's existing synthetic fixture.

A regional signal identifies a possible new wood construction project. The company has 3,000 m³ of compatible on-hand timber across its sites. Of this, 2,400 m³ is already committed, 150 m³ must remain as safety stock and 50 m³ is on quality hold. These are disjoint quantities in this illustration. Free capacity is therefore 400 m³. The public project alone supports a qualification task, not a sales commitment.

If the commercial team subsequently confirms a compatible request for 300 m³ within the delivery window, the engine can assess it. At a confirmed selling price of €500/m³, attributed material cost of €420/m³ and €1,800 incremental transport, the illustrative contribution is €22,200 before other incremental costs and overhead. The calculation also leaves 100 m³ of free capacity. No existing commitment is moved to make the opportunity look profitable. If compatibility, transport capacity or the actual request is missing, this quote remains unapprovable with the missing item named.

For a disruption, run the same discipline in the opposite direction: identify the dependent incoming shipment, recalculate the affected deadlines under the attributed delay, and compare feasible alternatives. A public incident does not silently confirm that internal delay.

## 6. A practical collection system

Prefer, in order, a source's suitable API, an advertised feed or export, targeted page monitoring, then web discovery for gaps. Keenable already has its own bounded trials and product owner. A direct feed complements it and can reduce repeated searches for known publishers. No new service is needed merely to state this routing.

Each source profile should define scope, relevant entities/products/regions, endpoint, access basis, expected publication rhythm, polling budget, extraction fields, freshness rule and failure policy. Polling intervals are product choices to validate, not publisher guarantees. Daily or weekly checks may fit slow sector publications; urgent operational sources need their own received update expectations. Reuse the existing durable scheduler rather than starting a second cron system.

On an unchanged response, avoid unnecessary extraction. On a material update, version the evidence and revisit only dependent cases. Deduplicate syndicated copies of the same announcement; multiple copies are not independent confirmations. Ignore navigation and cosmetic page changes. An unavailable or truncated page is a collection limit, not evidence that nothing happened. Source withdrawal or correction must trigger a review of dependent knowledge and proposals.

For targeted scraping, first receive the publisher's normal access conditions and relevant permissions. Honour rate limits, robots restrictions and access controls; do not bypass a login, paywall, CAPTCHA or certificate error. The robots files of three tested trade sites were read; they do not constitute a commercial reuse licence. Prefer links, necessary factual extraction and limited retained evidence over republishing complete articles. The [CNIL recommendations](https://www.cnil.fr/sites/cnil/files/2024-06/recommandations_reutilisateurs_donnees_publiees_sur_internet.pdf), pages 26-27, favour suitable APIs and bounded collection when personal data is involved. Publication on the open web does not remove those obligations.

Keep company data out of public search queries. Read permitted company memory before making another external call. Retain the reason for refreshing, the old and new evidence and the cases affected. Search, page reading, entity matching and business calculation have distinct traces; none requires preserving private model reasoning.

## 7. The company opportunity and competitive reality

**Proposed positioning: turn changes in an industry's ecosystem into defensible operating and commercial decisions, using the company's actual commitments and constraints.** The first buyer hypothesis is a procurement, operations or commercial leader in a multi-site timber or building-products business. Validate which role owns the painful decision and budget before claiming a single buyer across all industries.

This field already has substantial competitors. [Prewave](https://www.prewave.com/) advertises supplier monitoring, internal ERP context and quantified disruption impact. [Everstream](https://www.everstream.ai/solutions/risk-optimized-planning/) advertises risk-aware scenarios and inventory replanning. These publisher descriptions establish overlap in positioning, not independently measured performance or a feature benchmark. “We connect news to business impact” is therefore insufficient as a uniqueness claim.

The differentiation to test is the depth of a first vertical: regional French sources, species and product constraints, usable stock, protection of existing commitments, and both supply protection and qualified sales opportunities in one decision flow. Durable company memory and observed decision outcomes could strengthen the product as usage grows. Neither a proprietary data advantage, customer demand, product-market fit, revenue gain nor an investment case has yet been demonstrated.

Measure value on a concrete workflow: time from a relevant source to an admissible proposal; relevance and false-positive rate; freshness; missing-data requests resolved; decisions accepted; execution and outcome when observed. Compare with an explicit human baseline. Article count, source count and tokens are activity measures, not business value.

## 8. Delivery sequence and ownership

First receive the ongoing integrated chain with a real source, an explicit company link or scenario, deterministic impact, a visible proposal and durable readback. The integrator owns shared contracts and assembly. Data owns collection and source persistence; business/agent owns calculations and bounded tool use; UI owns the decision flow. This research does not pause that delivery or substitute for it.

Next candidate source tranche: one direct timber feed and company-identity resolution, then one qualified demand source and one supply constraint chosen against a real user decision. Do not add every catalogue entry simultaneously. Sitadel import, BODACC filtering, live ONF lots and licensed specialist sources each need a separate bounded acceptance trial before being described as product capabilities.

The broader company can expand to other stock-dependent industries by retaining provenance, company linkage, calculations and authority while adding each sector's rules. Food, for example, needs different lot and shelf-life constraints. No cross-industry operational coverage is claimed by the timber demonstrator.

## 9. Coverage, contradictions and remaining proof

| Research question | Proof read or executed | Conclusion and remaining limit |
| --- | --- | --- |
| Can government sources be connected? | Two live public APIs and Sitadel metadata; official documentation. | Technically credible access. Bulk completeness, relevant filters, product import and sustained availability untested here. |
| Can timber sites be followed without an API? | Two advertised RSS feeds read and parsed; public listings and reports. | Yes for these bounded sources. Scraper maintenance and commercial reuse still require source-specific reception. |
| Is there meaningful information beyond bad news? | Project/offer sources, sector segmentation, capacity and demand questions. | Yes as candidate inputs. Actionability depends on internal facts; no real sales conversion demonstrated. |
| What can break the vision? | Monthly data, mismatched timestamps, historical statistics, inaccessible pages, unknown commercial links and licensed access. | Preserve these conditions in the product; more sources do not resolve missing internal exposure. |
| Is the positioning unique? | Current Prewave and Everstream product pages. | Broad overlap exists. The proposed vertical differentiation needs user and product evidence. |
| Is the full app journey received? | Integrator reports a first real model/business/proposal/approval path; sector-source path still being assembled. | This report does not certify that path. The current runtime receipt and exact code reviews remain with the integrator. |

The initial native network probes failed under the sandbox; host-authorised retries succeeded. Both states are preserved. The failing publisher hostnames used during discovery were corrected where an identifiable official host was found; they are not treated as valid sources. INSEE's full explanatory page was blocked by the web reader; open company search was instead directly tested and its official access explanation read. Some legal and specialist pages were inaccessible; no claim relies on their unseen text.

Independent research review: NOT_RUN because this mandate authorises coordination with the existing builders, not delegation of this research to a new reviewer. Recommendations remain proposed. No product code, shared contract, private configuration, fixture, Git commit, deployment or external commercial action was changed by this supplement. The report is an internal research deliverable, not the public company narrative.

## Continuity and evidence

- [Product vision](../../../../docs/PRODUCT-VISION.md), [current integration state](../../../../docs/STATUS.md), [existing data research](../RECHERCHE-DATA-DELTA.md), [company memory and traces](../../MEMOIRE-RECHERCHE-TRACES.md).
- [Successful bounded public access trials](PUBLIC-ACCESS-PROBES.json) and [initial sandbox network limit](SANDBOX-NETWORK-LIMIT.json). API trial success does not establish product ingestion.
- [Source and decisive-claim register](SOURCE-COVERAGE.json). Source coverage is bounded by the questions above, not an exhaustive catalogue of timber data or regulation.
- Documentary rendering, archive identities, tracker reference and coordination receipts are recorded in RECEPTION.json. Those receipts establish delivery, not runtime use.
