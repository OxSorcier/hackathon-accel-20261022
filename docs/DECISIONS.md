# Why Physical Impact has this shape

Maintained rationale, 22 October 2026. This records the reasons we can defend from the present product and code. It is not a reconstructed transcript of the original deliberations, a benchmark or a customer validation. Historical receipts keep their dates and scope. Read the [data map](REPOSITORY-GUIDE.md), [recovery procedure](RECOVERY.md) and [current public checkpoint](PUBLICATION.md) alongside this document.

## 1. One operational decision, with risk and opportunity

Paul runs operations for a fictional French materials distributor. News alone does not tell him which commitment changes or which action protects the whole company. The useful output is a prepared, reviewable plan with quantities, dates, cost, affected commitments and evidence. Timber and construction materials give a concrete first domain: stock has a location, an exact SKU/unit, reservations and delivery deadlines. [Product direction](PRODUCT-VISION.md) and [business engine](../src/domain/engine.ts) encode this boundary.

We combine risk and opportunity because both can consume the same scarce stock, delivery capacity and purchasing budget. Independent recommendations can each look feasible while their combination is impossible. The industrial engine evaluates the common plan and its effects on all commitments. It enumerates a bounded set of strategies and uses deterministic ordering; it is not a general optimiser or proof of global optimality. Extending the domain requires explicit units, qualification rules and tests. See [industrial calculation](../src/domain/industrial.ts).

## 2. Synthetic company, separately attributed public evidence

The fixture lets another person inspect the complete operational state without exposing a customer's commercial records. The small case isolates the reservation mistake: transferring eight pallets for A can break B, while the EUR 1,420 purchase covers both. The 10,000-line portfolio adds cross-site scale and a qualified commercial demand. Its size exercises data handling; it does not establish model accuracy at scale or production performance.

Public news is untrusted evidence. It cannot establish that a fictional supplier actually suffered a delay, create a qualified lead or authorise an operational change. Therefore the controlled fire, inbound confirmation and competitor inability are separately attributed synthetic operator releases. The CRM demand predates the event. Source identity, collection time and hashes support later verification. See [data dossier](../proposals/product/alignment-20261022/v2/DATA-RECEIPT.md), [release boundary](../src/server/industrial-release.ts) and [source policy](../src/watch/source-policy.ts).

The browser presentation scenario has its own fictional numbers and localStorage history. It is useful for showing the intended product journey without credentials. It is a separate adapter, with no proof of API, model or SQL execution. Its EUR 1,620 contribution must not replace the canonical portfolio's EUR 1,100 calculation. Read [recovery modes](RECOVERY.md).

## 3. Model for investigation, code for admissibility

The model can choose typed tools, investigate evidence and express a proposal. Exact SKU, units, stock, reservations, dates, spend and permissions require reproducible checks. The deterministic engine performs these checks and the server repeats the current-version checks at decision time. A good explanation cannot make an inadmissible plan approvable. [Runner](../src/agent/runner.ts), [industrial runner](../src/agent/specialized-runner.ts), [decision boundary](../src/server/industrial-runtime.ts).

The model sees a positive list of released facts and bounded tool results. It cannot read arbitrary files or SQL, and it never receives builder dossiers, future scenario events or operator oracles as background context. This prevents accidental knowledge of the answer and limits cross-company disclosure. A source document remains data, even when it contains instructions. Broader tool access would require a new authority contract and adversarial tests.

The configured limits of six provider turns, twelve tool calls and sixty seconds are prototype ceilings for latency, cost and runaway loops. They are explicit engineering defaults, not measured optimal values. Partial results, exhausted budgets and uncertain external outcomes remain visible. Raising a ceiling requires representative latency/cost measurements and failure tests. [Runner bounds](../src/agent/runner.ts), [industrial runtime policy](../src/server/industrial-runtime.ts).

## 4. React, Vite, Fastify and explicit HTTP adapters

React provides the interactive workspace; Vite builds the client; Fastify supplies the API, validation/authentication boundaries and injectable HTTP tests. TypeScript contracts connect these pieces to the deterministic domain. Plain CSS matches the received design without adding a second styling system. This separation permits a browser-only presentation and a connected API adapter with distinct provenance. [Package versions](../package.json), [server entry](../src/server/start.ts), [UI entry](../src/ui/App.tsx).

The maintained choice is a small client/server application for this prototype. No recorded comparison proves it faster or cheaper than Next.js, and no framework comparison is claimed. The tradeoff is a separate API/Vite development process, explicit origin configuration and SPA route handling. Reconsider when server rendering, deployment constraints or a larger team justify the migration cost. The actual OpenAI provider uses HTTP tool calling; no installed AI SDK should be inferred from a sponsor name.

## 5. PostgreSQL snapshots, relational identity and durable work

PostgreSQL stores coherent versioned company snapshots as JSONB, alongside relational identities, immutable histories, jobs, source versions, decisions and idempotency receipts. A snapshot makes the fixture and business revision easy to reproduce. Transactions, company locks, leases and fencing protect publication and decisions across concurrent workers. No SQL transaction is held over a model/web call. [Migrations](../migrations/), [store](../src/server/store.ts), [worker](../src/server/worker.ts).

Aiven is the managed PostgreSQL used in the recorded receptions. PostgreSQL semantics, rather than a private desktop path, are the recovery dependency. A local disposable database is sufficient for development. JSONB is convenient for the bounded prototype but makes ad hoc reporting, indexing, data migration and very large ERP synchronisation harder. A production integration would need measured query workloads, normalised import boundaries and migration/version policy. This repository does not claim those are complete.

Restart reads saved state; it must not silently reset, reseed or repeat an uncertain external effect. An idempotency key identifies a logical command, separately from a run, attempt or provider call. Once an external call may have happened, a lost acknowledgement is not permission to retry it as new. The public initializer refuses to overwrite an evolved company. [Recovery utility](../tools/recover-industrial.ts).

## 6. Source cache, watch profiles and PDF extraction

Source reuse keeps provenance stable and avoids repeating the same paid or slow collection during every question. The current twenty-four-hour TTL is a conservative prototype freshness policy, not an empirically validated news SLA. A stale observation stays historical and cannot silently become fresh. An urgent operational use case would need source-specific freshness and failure policies. The ten current public subjects are codified in [source-policy.ts](../src/watch/source-policy.ts); the older two-topic contract is historical.

BOAMP supplies identifiable public procurement records; Keenable supplies bounded public-content retrieval. These can surface evidence or leads. Neither proves a commercial relationship, qualified demand or regulatory compliance. Query subjects are public; commercial facts and secrets stay server-side. Coverage of a public corpus is different from access to private company systems.

Modal hosts the separately tested PDF extractor and keeps extraction outside the API process. Native text extraction with pypdf supports page-level excerpts and caching. The maintained tradeoff is an authenticated external dependency and additional failure/latency boundaries; there is no comparative benchmark against local extraction. The implemented bounds are 10 MiB, 40 pages and 200,000 extracted characters; model reading is further bounded to two pages of 6,000 characters each. These are resource ceilings, not an assurance that every PDF fits. Scanned images require OCR that this path does not provide. SQL retains extracted pages and hashes, not a durable archive of the original PDF bytes. [PDF boundaries](../src/server/pdf-documents.ts), [module evidence](../proposals/modal/AIVEN-DOCUMENTS-LIVE.json).

## 7. Human approval and explicitly simulated execution

Approval is a server-owned business decision against exact versions, role and spend ceiling. It does not place a real order. The industrial simulation creates durable, labelled internal effects and a new business revision. It keeps proposed, approved, scheduled, applied-in-simulation and draft states separate. There is no production ERP/CRM connector behind these states. [Execution](../src/server/industrial-execution.ts), [runtime](../src/server/industrial-runtime.ts).

The same reason governs proof: code present, tests passed, model used, source collected, SQL readback, browser acceptance and production effect are different facts. The [public checkpoint](PUBLICATION.md) names the source candidate. Historical local directories identify earlier runs and are not prerequisites for a public contributor. Open questions include customer efficacy, optimal budgets/TTL, production identity, real connectors, scanned PDF support and generalisation beyond the controlled domain.
