# Accel decision desk

**We help businesses adapt as fast as their markets change, turning live signals into coordinated plans and executing approved actions.**

We are building operational intelligence for businesses that depend on physical inventory and supply chains. The goal is to connect industry news, regional events and public information with a company's sites, suppliers, available stock and customer commitments, then help its team decide what to do.

Our first application is the French construction-materials and timber industry. The broader direction includes other stock-dependent sectors, with their own data, integrations and business rules. Transfer to another industry is a product direction, not a capability demonstrated by the current prototype.

## The problem

Operations and purchasing teams need to understand how changes outside their company affect their own business. A factory interruption may expose deliveries, increase demand for an alternative product, do both, or have no relevant impact. A new regional construction project may be a lead worth qualifying. None of those signals establishes the company's exposure or a confirmed customer order by itself.

The useful questions are concrete: which commitments are affected, what can we actually supply, what would each response cost, and what needs verification before we act?

## Two sides of the same decision workspace

The target product supports both:

- **Protecting commitments:** qualify a disruption, identify potentially affected orders and compare admissible supply options.
- **Capturing opportunities:** qualify a demand signal, check compatible uncommitted stock and delivery capacity, identify relevant customers, and prepare an offer for human review.

The same event can create both kinds of case. The intended workflow is: public signal, verified business relationship, company-specific impact, calculated options, human decision, recorded outcome and reassessment when facts change.

## An industrial example

Illustrative scenario: an insulation manufacturing site is affected by a fire. A multi-site materials company supplying major construction projects needs to investigate its outstanding purchases and customer commitments. It may also hold alternative products that could serve additional demand, subject to compatibility, availability, transport and customer requirements.

The product should help the team see both sides without allocating the same stock twice. An article about a fire is evidence of the reported incident, not confirmation that a particular order is delayed or that another customer wants to buy.

This is the broader product scenario. The current deterministic demonstrator uses a smaller, explicitly synthetic company with three depots and two construction orders, plus a separate third-order test branch. It does not model the scale of a major industrial portfolio yet.

## Current scope and evidence

The local implementation provides a decision-workspace foundation: company context, coverage calculations, versioned proposals, human-decision controls, durable records and a bounded public-source collector.

The tested risk flow connects real public content retrieved through Keenable to OpenAI tool calls, a calculated proposal, approval and readback on Aiven PostgreSQL. Company data and internal supplier confirmation are explicitly synthetic. Broad matching of news to company exposure, commercial-opportunity calculations and durable research reuse remain outside this demonstrated slice. The corrected English UI risk flow and exact data modules are received. The approved state survived restart onto the final local preview on port 3001. Aiven Runtime deployment is NOT_RUN.

The [product direction and alignment assessment](docs/PRODUCT-VISION.md) records the intended behavior and the gaps in the inspected version. The integrator owns the current [verification status](docs/STATUS.md). The sections below describe the local implementation and its operating boundaries.

## Technology usage

In the exercised risk case, the agent prepared a EUR 1,420 emergency-purchase option that covered urgent order A while preserving order B. The server checked the approval and saved the decision to Aiven, where it was read back. Each technology contributes to that result:

| Technology | Role in Paul's decision | Verified use |
| --- | --- | --- |
| **Keenable API** | Retrieve public sources that Paul can inspect before investigating his company's exposure. | Real public content retrieved, stored and used in the risk case. Collection is bounded and partial; the priority source URL was supplied, so this does not prove discovery or search-ranking quality. |
| **OpenAI API** | Choose company-data and calculation tools, then prepare a costed proposal for human review. | Real gpt-5.4-mini calls used the application's tools to prepare a proposal that was approved and read back. The TypeScript business engine checks feasibility; the server controls approval. |
| **Aiven for PostgreSQL** | Keep evidence, company revisions, proposals, decisions and attributed memory available for later inspection. | Real product connection with verified TLS, migrations, persistence and readback after reconnection. |
| **React/Vite, Fastify and TypeScript** | Present the source, commitments, options and decision in one workspace, with background monitoring on the server. | Client and server run locally. Corrected risk flow tested in Aside, with approval through the interface and Aiven readback; final preview serves the received build on port 3001. |

**Deployment status:** the application server and interface run locally; PostgreSQL runs on Aiven. **Aiven Runtime is the required application-hosting target and has not been deployed.** The corrected interface approval and restart readback are received; the coordinator is completing the final preview capture.

The case uses a synthetic company and an explicitly synthetic internal confirmation. The public source establishes no commercial supplier relationship or actual delivery delay. Approval records the decision; it does not execute a purchase or move inventory. Evidence: [corrected source and case](proposals/integration/FINAL-SOURCE-CASE.json), [final approved restart readback](proposals/integration/FINAL-PREVIEW-RESTART.json), [exact flow code](proposals/integration/FLOW-CODE-RECEIVED.json), [Aiven storage receipt](proposals/integration/AIVEN-PRODUCT-SMOKE.json) and [current verification status](docs/STATUS.md).

## Implemented locally

React 19 and Vite 8 build the decision desk. One Fastify 5 process serves the built client, authenticated mutations and background workers. PostgreSQL stores company revisions, sessions, runs, proposals, decisions, attributed memory, watch schedules, occurrences and source evidence. Startup applies migrations under a PostgreSQL advisory transaction lock. It never seeds or resets company data.

The business engine checks SKU, units, reservations, confirmed inbound, dates, replacement margin, quantities and costs. Proposals do not move inventory. Approval recalculates the selected option against the current snapshot and checks the server-resolved actor's role and spending ceiling. A changed business revision makes a pending proposal stale. Approval records a human decision and memory; no inventory movement, order placement or external communication is executed.

A single active model adapter uses OpenAI Chat Completions or Anthropic Messages, validated client tools, bounded turns/calls/time and no automatic retry. There is no default model name or credential. Without configuration, a question returns `needs_input`, model null, no proposal and no fabricated inference. Provider protocol tests inject HTTP responses and are not real inference evidence.

Public collection uses fixed BOAMP and Keenable endpoints with server-approved public profiles. The initial BOAMP adapter covers two predefined topics; Keenable adds bounded industry, regional, manufacturer, project and regulatory profiles. Error, empty, partial and not-run remain distinct. Source URLs, content hashes and collection timestamps are persisted. A partial collection is not exhaustive. Manual watch runs have stable operation keys; automatic occurrences use durable schedule keys. They are serialized per watch and remain distinct occurrences.

## Current local preview

The received English risk-flow preview is [http://127.0.0.1:3001](http://127.0.0.1:3001), served from the frozen `.local/preview-stable-v2` build against Aiven company `CO-PARCOURS-PAUL-V2`. The earlier `.local/preview-stable-v1` and local trials remain preserved. The main checkout contains subsequent research work and is not automatically the code served by this preview. See the exact version and readback receipts in [verification status](docs/STATUS.md).

## Local start

Requires Node 24 within the package engine range, npm, and accessible PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. Configure `DATABASE_URL`, `APP_ORIGIN`, and independent random login tokens of at least 32 characters. Keep this file private. `DEMO_LOGIN_TOKEN` resolves Paul on the server. `OPERATOR_LOGIN_TOKEN` resolves a separate operator, who cannot approve business proposals.
3. For remote PostgreSQL use verified TLS. Supply the trusted CA with `DATABASE_CA_FILE` when needed. URI SSL parameters are removed before applying explicit verified TLS. A failed certificate check remains a failure.
4. Run `npm run operator -- seed CO-DEMO` once to import `fixtures/company/`. Repeating it refuses to overwrite the session.
5. Run `npm run build`, then `npm start`. Open `http://127.0.0.1:3000` for the default local origin. Enter the demo token in the session form to enable questions and decisions.

For development, `npm run dev` starts the API/workers and `npm run dev:ui` starts Vite with an API proxy. Set `APP_ORIGIN` to the exact UI origin for mutations. The production server serves only `dist/client`, never the repository root.

For the selected provider, configure `MODEL_PROVIDER=openai` (or explicitly `anthropic`), `MODEL_API_KEY` and explicit `MODEL_NAME` in the server environment and restart. A configured adapter is not proof of an API call. Account and managed-service ownership remains in [docs/ACCES-CREDITS.md](docs/ACCES-CREDITS.md).

## Verification

`npm run typecheck` checks application and test TypeScript. `npm run build` compiles the server and browser bundle. `npm test` runs the suites. Set `TEST_DATABASE_URL` for server integration and `DATA_WATCH_TEST_DATABASE_URL` for watch storage; otherwise these PostgreSQL tests are explicitly skipped. Use an isolated test database with schema-creation permission. Tests create and remove only their disposable schemas.

Tests cover deterministic R0/S1/S2/S3 and separate C branches, missing facts, SKU/units, authority, idempotence, lease/fence, concurrent wakeups, partial/error collection, state readback after reconnection and stale decisions. Scripted provider/HTTP tests prove injected protocol cases only. Local PostgreSQL tests do not prove Aiven. The integration receipt names the actual browsers and dimensions.

## Operator and repeatability

Create separate sessions with `npm run operator -- seed CO-DEMO-S3` and `npm run operator -- seed CO-DEMO-C`. Select the company with server-side `DEMO_COMPANY_ID`. A new session is the explicit reset; restarting preserves state.

Release one current snapshot with `npm run operator -- replace COMPANY_ID SNAPSHOT_JSON EXPECTED_REVISION`. The file contains one released state, never its future schedule. The server creates a revision and invalidates pending proposals. The HTTP equivalent is `POST /api/operator/snapshot` with an operator session, expected revision and snapshot. Operator scenarios and oracles remain outside the runtime and model. Never reuse a branch after applying another branch's effects.

## Boundaries and remaining evidence

Local runtime, deterministic calculations, direct BOAMP collection, Keenable content retrieval, real OpenAI tool calls and proposal approval/readback on Aiven PostgreSQL have been exercised. Exact hashes, reviews, commands and blockers are in [docs/STATUS.md](docs/STATUS.md) and `proposals/integration/`. The received risk-flow build passes 173 local tests, including PostgreSQL suites, TypeScript and build checks. Its approval and unchanged state after restart are verified. Aiven Runtime deployment and jury rehearsal remain pending; durable research-memory reception, industrial context, relevant automated impact qualification and opportunities are active subsequent slices. The public source does not establish a commercial delay; the exercised risk case uses a separate, explicitly synthetic internal confirmation.

No commit, push, deployment or public publication is implied by local tests. [Private remote](https://github.com/OxSorcier/hackathon-accel-20261022), connected locally without commit/push. The container uses a positive file list, excluding internal documents, operator scenarios, fixtures, receipts, secrets and tests. Seed its target database explicitly from an authorized host; the image cannot seed on startup.

## Official references consulted

[Fastify server](https://fastify.dev/docs/latest/Reference/Server/), [Vite](https://vite.dev/guide/), [node-postgres TLS](https://node-postgres.com/features/ssl), [Anthropic client tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat). Versions and lockfile are pinned. Documentation supports implementation choices, not a running managed-service claim.
