# Physical Impact: repository field guide

22 October 2026. Updated public-recovery checkpoint. Documentation checkpoint for contributors and agents. This guide connects the existing sources; [PRODUCT-VISION.md](PRODUCT-VISION.md) owns the product direction, [STATUS.md](STATUS.md) owns integration status and [OWNERSHIP.md](OWNERSHIP.md) owns writing scopes. A newer exact-version receipt can advance one capability without validating the others. The [public source checkpoint](PUBLICATION.md), [maintained rationale](DECISIONS.md) and [portable recovery procedure](RECOVERY.md) supersede the earlier empty/private and import-pending notes. [Offline reading copy](REPOSITORY-GUIDE.html).

## 1. Why this product exists

Paul runs operations for a materials distributor. A supplier or market change matters when it changes his ability to deliver existing orders or serve qualified new demand. A cheap transfer can protect one customer while consuming another customer's reserved stock. Physical Impact combines industry evidence, company records and policy to prepare a response that purchasing, logistics and sales can review together.

The target loop is: know the company, monitor its environment, establish risk and opportunity, calculate a common plan, obtain human approval, execute available authorised actions and retain their result. The current brand is Physical Impact. AdaptOps and Accel decision desk are earlier names retained in IDs, files and receipts. Rivebois Matériaux is the synthetic customer. Renaming a display label does not change native IDs or revisions.

The [received vision](PRODUCT-VISION.md) defines acceptance criteria A1 to A9. Customer adoption, time saved and realised profit have not been measured. The important engineering result is that company data changes admissibility: in the accepted small risk case, a EUR 120 transfer leaves B short, while a EUR 1,420 purchase covers A and preserves B. That comparison is about protecting commitments, not saving EUR 1,300. See the [recorded comparison and its baseline](../proposals/product/submission-20261022/EVIDENCE-IT-WORKS.md).

## 2. Read the right version

| Surface | What the evidence establishes | What remains separate |
| --- | --- | --- |
| Accepted risk preview, port 3001 | Real OpenAI/tools, public collection through Keenable, synthetic internal confirmation, admissible proposal, UI approval and Aiven readback after restart. [Flow receipt](../proposals/integration/FLOW-CODE-RECEIVED.json), [UI result](../proposals/integration/FINAL-UI-FLOW.json), [restart](../proposals/integration/FINAL-PREVIEW-RESTART.json). | Frozen source is `.local/preview-stable-v2`, not the changing checkout. Approval did not buy goods or move stock. |
| Industrial read candidate, port 3003 | Aiven import and authenticated workspace for `CO-DEMO-INDUSTRIAL-CANDIDATE`, 10,000 order lines and Rivebois display bindings. [Current read receipt](../proposals/integration/INDUSTRIAL-READ-CANDIDATE.json). | The initial read-only checkpoint has been superseded by the received V6 wiring for analysis, decisions, simulation and questions. [V6 build](../proposals/integration/CONNECTED-RUNTIME-v6-BUILD.json) pins that candidate. Local receipts do not prove public deployment. |
| Physical Impact frontend Demo mode | `/demo` or `?demo=1` selects `createPhysicalDemoApi`, a prepared interactive scenario with scripted answers and browser storage. [Selection](../src/ui/App.tsx), [adapter](../src/ui/physical-demo.ts), [checks](../tests/ui/physical-demo.test.ts). | It makes no external calls. Browser persistence and simulated receipts do not prove OpenAI, Aiven or ERP execution. This guide inspects the implementation; it does not certify its browser journey. |
| Research memory, separate R1/R2 reception | Two real runs retrieved three reusable observations, including after restart. A controlled source correction invalidated a plan; identical content retained the current generation. [Integrator reception](../proposals/integration/RECEIVED-RESEARCH-R1-R2.json). | R2 uses an injected provider. The first R1 process metrics and some original R2 reconciliation details are unavailable. This does not validate the industrial journey. |
| PDF extraction, separate module | Real public PDF extraction through Modal, cache reuse and Aiven readback. [Module receipt](../proposals/modal/AIVEN-DOCUMENTS-LIVE.json). | The full application, agent/page tools, UI and restart require their own reception. |
| Local checkout and GitHub | The repository is public at [OxSorcier/hackathon-accel-20261022](https://github.com/OxSorcier/hackathon-accel-20261022). Read the current publication manifest and record the full commit SHA. | Source publication is separate from CI, public application deployment and real business effects. |

These URLs identify recorded local candidates, not a promise that their processes remain online. Recheck the matching source receipt before testing or recording. Keep earlier failures and successful frozen versions intact. [STATUS.md](STATUS.md) may lag a newer received R1/R2 or import receipt; read their dates and scopes together instead of replacing the status owner.

## 3. Where the data lives

| Data | Source of truth in this repository | Origin and use |
| --- | --- | --- |
| Small company and policy | [dataset.json](../fixtures/company/dataset.json), [company-policy.json](../fixtures/company/company-policy.json). | Synthetic seed for an explicit small demo company. Startup does not import it automatically. |
| Enriched company core | [portfolio-10000.json](../proposals/product/alignment-20261022/v2/portfolio-10000.json), [portfolio-policy.json](../proposals/product/alignment-20261022/v2/portfolio-policy.json), [CORE-READY.json](../proposals/product/alignment-20261022/v2/CORE-READY.json). | Synthetic ERP/CRM-shaped records. [Aiven import and independent readback](../proposals/integration/INDUSTRIAL-CORE-AIVEN.json) establish their durable imported version. These are not a real ERP connection. |
| Industrial relationships and commercial facts | [industrial-context.v2.json](../proposals/product/alignment-20261022/v2/industrial-context.v2.json), [exact amended DTO receipt](../proposals/product/alignment-20261022/v2/INDUSTRIAL-READY-v2.json), [context import](../proposals/integration/INDUSTRIAL-CONTEXT-AIVEN.json). | Attributed synthetic supplier-site dependencies, transport capacity, qualified demand and separate context/qualification revisions. |
| Customer display names | [Display profile and source manifest](../proposals/product/alignment-20261022/v2/display-profile-v1/SOURCE-MANIFEST.json), [Aiven display import](../proposals/integration/INDUSTRIAL-DISPLAY-AIVEN.json). | Rivebois and readable labels bind to existing IDs. Labels grant no permission and create no capacity. |
| Public observations | [Collectors](../src/watch/collector.ts), [Keenable adapter](../src/watch/keenable.ts), [watch repository](../src/data/watch-repository.ts), [research repository](../src/data/research-repository.ts). | Real or explicitly replayed public evidence, identified by native observation, URL, timestamps and content hash. Collection time does not establish publication freshness. |
| Runs, proposals, decisions and memories | [PgStore](../src/server/store.ts), [research service](../src/server/research-service.ts), [migrations](../migrations/001_core.sql). | PostgreSQL owns durable company-scoped state. The model accesses released tools and current attributed memory. |
| Extracted documents | [PDF storage](../src/server/pdf-documents.ts), [Modal client](../src/server/pdf-client.ts), [bounded knowledge adapter](../src/server/pdf-knowledge.ts). | Extracted text pages and an extractor-version cache, with page/hash provenance. Raw PDF bytes are not durably archived in SQL. Extraction and knowledge release are separate operations. |
| Builder references and test expectations | `.preparation/`, `operator/`, review receipts and proposals. | Construction/evaluation material. Receipts, expected answers and unreleased future events stay outside product model context, static files and runtime image. Only an explicitly imported business input becomes company data. |

The [industrial data dossier](../proposals/product/alignment-20261022/v2/DATA-RECEIPT.md) explains the source records, business relationships and historical checks. Its import-pending wording is historical; the newer import receipts above establish what was subsequently received.

### Imported core counts

The [Aiven core receipt](../proposals/integration/INDUSTRIAL-CORE-AIVEN.json) records 6 depots, 40 suppliers, 200 products, 400 customers, 2,502 orders, 10,000 order lines, 764 inventory rows, 9,999 reservation rows, 8 purchase orders with 8 purchase lines, 13 inbound allocations, 3 transport quotes, 5 emergency quotes, 81 CRM records, 24 construction programmes and 202 product/supply links. A CRM row is not automatically qualified demand. One explicitly qualified synthetic demand drives the candidate commercial scenario.

Inventory quantity, reserved stock, confirmed inbound supply and a transport quote are different resources. Check SKU, unit, dates, remaining capacity and all protected commitments before allocation. Unconfirmed purchases do not cover an order. A public tender is a lead; it proves no customer order, quantity, commercial dependency or fire at the fictional supplier.

The controlled industrial incident, inbound-delay confirmation and competitor confirmation are separate operator releases. The CRM demand predates the incident. A fire headline cannot publish those private confirmations or generate customer demand. Keep the initial operator scenario out of bootstrap and model input until a received server path releases the relevant fact.

### Identity and revision rules

Keep `companyId`, business revision, policy version, industrial-context revision, qualification revision, event revision and evidence hashes distinct. A run or plan records the basis it used. Recheck the current basis at decision time; a remembered recommendation grants no authority. Money in industrial contracts uses named `Cents` fields; small-flow fields named `Eur` use euros. Preserve the field unit and currency. Business dates use the company's calendar and timezone.

## 4. How the application works, and why

The actual stack is React/Vite, Fastify, strict TypeScript and PostgreSQL. The provider adapters make bounded HTTP calls to OpenAI or Anthropic; an AI SDK package is not installed in the current [package manifest](../package.json).

| Stage | Implementation to read | Reason for this boundary |
| --- | --- | --- |
| Authenticate and validate | [auth.ts](../src/server/auth.ts), [app.ts](../src/server/app.ts), [validation.ts](../src/server/validation.ts), [contracts](CONTRACTS.md). | The server resolves company, actor and role. A model-supplied ID cannot authorise a read or decision. |
| Acquire and retain evidence | [watch service](../src/server/watch-service.ts), [watch engine](../src/watch/engine.ts), [research service](../src/server/research-service.ts). | Durable occurrences, source versions and bounded collection support deduplication and later reuse. Public queries contain public subjects. |
| Build the permitted context | [context.ts](../src/agent/context.ts), [research context](../src/agent/research-context.ts), [industrial projection](../src/agent/industrial-context.ts). | Start with a manifest and released tools. The full industrial snapshot stays server-side; bounded results identify truncation. |
| Choose tools and calculate | [runner.ts](../src/agent/runner.ts), [specialized runner](../src/agent/specialized-runner.ts), [engine.ts](../src/domain/engine.ts), [industrial calculation](../src/domain/industrial.ts). | The model chooses an investigation and expresses a proposal. Deterministic code checks quantities, dates, reservations, common capacity and economics. |
| Store and revalidate | [worker](../src/server/worker.ts), [store](../src/server/store.ts), [industrial read boundary](../src/server/industrial-read.ts). | Leases/fencing, transactions, idempotency keys and version checks bound concurrent work and stale decisions. A timed-out provider attempt can remain uncertain. |
| Show evidence and request a decision | [HTTP UI adapter](../src/ui/api.ts), [industrial UI adapter](../src/ui/industrial-api.ts), [decision workspace](../src/ui/IndustrialDesk.tsx). | Present sources, options, unknowns and distinct approval/execution states. The explicit browser Demo adapter has separate provenance. |

In the accepted small path: public observation plus a separate released business confirmation -> model/tool investigation -> deterministic evaluation -> non-executing proposal -> human approval with server checks -> durable readback. The industrial target adds a prepared mixed-impact report and a separately approved simulated effect. [PRODUCT-VISION.md](PRODUCT-VISION.md) and its current acceptance table distinguish that target from the smaller received flow.

The model has no arbitrary filesystem or SQL tool. Useful tool requests, outputs, usage and attribution can be traced without exposing private reasoning or secrets. A restart resumes durable state; it is not permission to seed, reset, repeat a provider request or replay an uncertain action.

## 5. Run and verify without disturbing another demo

Use [RECOVERY.md](RECOVERY.md) for exact public commands. The no-key presentation and tracked `tools/recover-industrial.ts` initializer replace private `.local` dependencies. The initializer validates core/policy/context/display and explicitly imports a baseline into a dedicated PostgreSQL schema; it releases no event and calls no provider. Never point tests or initialization at a demo state you need to preserve.

The public checkpoint in [PUBLICATION.md](PUBLICATION.md) records the source scope and checks. Historical risk-flow, industrial and PDF receptions prove their exact candidates and environments. A build is not deployment; a skipped SQL suite is not integration success; injected protocol tests are not real inference. Restart must retain state rather than reset it. Review [DECISIONS.md](DECISIONS.md) for the reasons and conditions for changing these policies.

## 6. Continue in the existing owner scope

1. Read the [README](../README.md), [current vision](PRODUCT-VISION.md), this guide and the [handoff](HANDOFF.md). Explain Paul's task and the role of each data origin before proposing changes.
2. Read [OWNERSHIP.md](OWNERSHIP.md), [THREADS.json](THREADS.json) and your task mandate: [integration](tasks/INTEGRATION.md), [data/watch](tasks/DATA-WATCH.md), [business/agent](tasks/DOMAIN-AGENT.md) or [UI](tasks/UI.md). Use the native owner ID; historical thread titles/statuses can lag.
3. Read [CONTRACTS.md](CONTRACTS.md) before changing a shared interface. Check active writers and exact READY hashes before assembly. Keep another owner's changes intact.
4. Reconcile [STATUS.md](STATUS.md) with the newest relevant exact-version receipts. State which surface, data, code and environment you are discussing.
5. Make only the authorised change. Follow [AGENTS.md](../AGENTS.md), including two independent reviews after code, appropriate local/Aiven checks and Aside first for UI. Commit, push, deployment and visibility changes require their applicable explicit authority.
6. Leave evidence in the existing owner destination. A proposal file alone does not update product runtime or acknowledge another chat. Preserve pending criteria and negative evidence.

An agent has enough context to start when it can answer: who uses this, why data changes the result, which data is synthetic/public/replayed, where current durable state lives, which exact journey has been verified, which files it owns and what remains to prove. Reading the documentation does not require it to pronounce the full product complete. The first independent public read found product/data comprehension but incomplete rationale and recovery. This revision addresses those findings; the next independent attempt is recorded separately, against its actual published commit.

## 7. Sources and documentation scope

Sources: the tracked product direction, contracts, data files, source modules and exact-version integration receipts linked above. The initial private/empty GitHub state and private runtime paths are historical. The current public publication and independent recovery receipts belong to their stated commit and environment. This document does not rerun historical provider/Aiven receptions.

This is repository documentation, not a production acceptance or a second research registry. Historical kits, previous names and negative evidence remain preserved. Companion HTML contains the same content for offline reading; links into the repository require the companion files.
