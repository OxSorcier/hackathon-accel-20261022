# Accel decision desk

A local decision desk for Paul, owner of a building-material distributor. It reads delivery commitments, calculates coverage and options, and stores a proposal for a human decision. The company dataset is explicitly synthetic. Public BOAMP notices are opportunities to qualify, with no established link to the fictional suppliers.

Start with [START-HERE.md](START-HERE.md), the [handoff](docs/HANDOFF.md), and the current [verification status](docs/STATUS.md). Shared types are C1 in `src/contracts/index.ts`.

## Implemented locally

React 19 and Vite 8 build the decision desk. One Fastify 5 process serves the built client, authenticated mutations and background workers. PostgreSQL stores company revisions, sessions, runs, proposals, decisions, attributed memory, watch schedules, occurrences and source evidence. Startup applies migrations under a PostgreSQL advisory transaction lock. It never seeds or resets company data.

The business engine checks SKU, units, reservations, confirmed inbound, dates, replacement margin, quantities and costs. Proposals do not move inventory. Approval recalculates the selected option against the current snapshot and checks the server-resolved actor's role and spending ceiling. A changed business revision makes a pending proposal stale. Approval records a human decision and memory; no inventory movement, order placement or external communication is executed.

The single model adapter uses Anthropic Messages, validated client tools, bounded turns/calls/time and no automatic retry. There is no default model name or credential. Without configuration, a question returns `needs_input`, model null, no proposal and no fabricated inference. Provider protocol tests inject HTTP responses and are not real inference evidence.

BOAMP collection is limited to the fixed official API endpoint and two predefined public topics. Error, empty, partial and not-run remain distinct. Source URLs, content hashes and collection timestamps are persisted. A partial collection is not exhaustive. Manual watch runs have stable operation keys; automatic occurrences use durable schedule keys. They are serialized per watch and remain distinct occurrences.

## Local start

Requires Node 24 within the package engine range, npm, and accessible PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. Configure `DATABASE_URL`, `APP_ORIGIN`, and independent random login tokens of at least 32 characters. Keep this file private. `DEMO_LOGIN_TOKEN` resolves Paul on the server. `OPERATOR_LOGIN_TOKEN` resolves a separate operator, who cannot approve business proposals.
3. For remote PostgreSQL use verified TLS. Supply the trusted CA with `DATABASE_CA_FILE` when needed. URI SSL parameters are removed before applying explicit verified TLS. A failed certificate check remains a failure.
4. Run `npm run operator -- seed CO-DEMO` once to import `fixtures/company/`. Repeating it refuses to overwrite the session.
5. Run `npm run build`, then `npm start`. Open `http://127.0.0.1:3000` for the default local origin. Enter the demo token in the session form to enable questions and decisions.

For development, `npm run dev` starts the API/workers and `npm run dev:ui` starts Vite with an API proxy. Set `APP_ORIGIN` to the exact UI origin for mutations. The production server serves only `dist/client`, never the repository root.

For the authorized Anthropic provider, configure `MODEL_API_KEY` and explicit `MODEL_NAME` in the server environment and restart. A configured adapter is not proof of an API call. Account and managed-service ownership remains in [docs/ACCES-CREDITS.md](docs/ACCES-CREDITS.md).

## Verification

`npm run typecheck` checks application and test TypeScript. `npm run build` compiles the server and browser bundle. `npm test` runs the suites. Set `TEST_DATABASE_URL` for server integration and `DATA_WATCH_TEST_DATABASE_URL` for watch storage; otherwise these PostgreSQL tests are explicitly skipped. Use an isolated test database with schema-creation permission. Tests create and remove only their disposable schemas.

Tests cover deterministic R0/S1/S2/S3 and separate C branches, missing facts, SKU/units, authority, idempotence, lease/fence, concurrent wakeups, partial/error collection, state readback after reconnection and stale decisions. Scripted provider/HTTP tests prove injected protocol cases only. Local PostgreSQL tests do not prove Aiven. The integration receipt names the actual browsers and dimensions.

## Operator and repeatability

Create separate sessions with `npm run operator -- seed CO-DEMO-S3` and `npm run operator -- seed CO-DEMO-C`. Select the company with server-side `DEMO_COMPANY_ID`. A new session is the explicit reset; restarting preserves state.

Release one current snapshot with `npm run operator -- replace COMPANY_ID SNAPSHOT_JSON EXPECTED_REVISION`. The file contains one released state, never its future schedule. The server creates a revision and invalidates pending proposals. The HTTP equivalent is `POST /api/operator/snapshot` with an operator session, expected revision and snapshot. Operator scenarios and oracles remain outside the runtime and model. Never reuse a branch after applying another branch's effects.

## Boundaries and remaining evidence

Local runtime, deterministic calculations, direct BOAMP collection, PostgreSQL read/write and browser rendering have been exercised. Exact hashes, reviews, commands and blockers are in [docs/STATUS.md](docs/STATUS.md) and `proposals/integration/`. A real model/tool/proposal journey, managed PostgreSQL/Aiven, deployment and jury rehearsal require their own observed receipts. The watch pipeline collects public sources; it does not assert a commercial delay or automatically create a business proposal from a notice.

No commit, push, deployment or public publication is implied by local tests. [Private remote](https://github.com/OxSorcier/hackathon-accel-20261022), connected locally without commit/push. Private preparation is ignored by Git. The container uses a positive file list, excluding preparation, operator scenarios, fixtures, receipts, secrets and tests. Seed its target database explicitly from an authorized host; the image cannot seed on startup.

## Official references consulted

[Fastify server](https://fastify.dev/docs/latest/Reference/Server/), [Vite](https://vite.dev/guide/), [node-postgres TLS](https://node-postgres.com/features/ssl), [Anthropic client tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview). Versions and lockfile are pinned. Documentation supports implementation choices, not a running managed-service claim.
