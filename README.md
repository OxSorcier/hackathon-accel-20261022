# Physical Impact

**Physical Impact turns market signals and company data into coordinated action for operations teams.**

[Website](https://physical-impact.com) · [Product one-pager](proposals/product/submission-20261022/ONE-PAGER.md) · [Evidence it works](proposals/product/submission-20261022/EVIDENCE-IT-WORKS.pdf) · [Data layer](proposals/product/submission-20261022/DATA-LAYER.md)

Built for Accel AI Innovate Paris, 22 October 2026. Earlier project documents and source identifiers may use the working names AdaptOps or Accel decision desk.

**New contributor or agent:** start with the [repository field guide](docs/REPOSITORY-GUIDE.md), also available as [offline HTML](docs/REPOSITORY-GUIDE.html). It connects the product rationale, data sources, architecture, exact-version evidence and existing owner scopes. Continue with [START-HERE.md](START-HERE.md) before writing code.

This public source snapshot is under active development. See the [publication scope](docs/PUBLICATION.md) for included material and the distinction between source publication, tested candidates and application deployment.

## Why this exists

Operations teams monitor suppliers, industry news and regional events, but the useful question is company-specific: **what changes for our commitments, what can we do, and who needs to act?**

Physical Impact connects external evidence with inventory, purchases, customer orders, commercial opportunities and business policy. The product direction is a prepared decision workspace: qualify risk and opportunity, calculate a coordinated plan, obtain human approval, execute eligible actions and retain the result. The first market is French timber, raw-materials and construction supply chains.

## Demonstrated journey

1. Inspect a dated public source and a separately attributed synthetic internal confirmation.
2. Ask the agent to analyse the company's exposure. It selects typed tools and requests business calculations.
3. Compare options against quantities, dates, reservations, confirmed supply and policy.
4. Approve an admissible proposal through the interface. The server checks actor, role and current revisions.
5. Read the decision back from Aiven and recover the same history after process restart.

The accepted risk flow is a real model/tools/proposal/approval path. Approval does not place a purchase or move inventory. The richer industrial report, commercial opportunity and simulated-action journey retain separate integration checks.

## Evidence: company data changes the decision

The same controlled case contains two commitments of eight pallets each. A naive rule chooses the cheapest recorded option covering urgent order A while ignoring other orders. It selects a transfer that consumes stock reserved for B.

| Recorded output | Naive local rule | Data-aware plan |
| --- | --- | --- |
| Option | Stock transfer | Emergency purchase |
| Recorded cost | EUR 120 | EUR 1,420 |
| A covered under the plan | 8 of 8 pallets | 8 of 8 pallets |
| B covered under the plan | 0 of 8 pallets | 8 of 8 pallets |
| Remaining shortage | 8 pallets | 0 pallets |

This is one analytical comparison from recorded options, not a no-data LLM ablation or a cost-saving claim. The corrected UI flow made five model calls and retained 16 trace events. Its approved state and history survived restart. Company and internal confirmation are synthetic; no public-source commercial relationship is established.

Read the [evidence document](proposals/product/submission-20261022/EVIDENCE-IT-WORKS.md) and [machine-readable measurements and source hashes](proposals/product/submission-20261022/EVIDENCE-DATA.json).

## What has been verified

| Layer | Received evidence | Limit |
| --- | --- | --- |
| Connected risk flow | Real OpenAI/tool calls, Keenable content, deterministic plan, UI approval and Aiven readback/restart | Local application, synthetic company, no business action executed |
| Industrial data | 10,000 order lines, 2,502 orders, 6 depots, 200 products and 400 customers imported and independently read back on Aiven | Import is not an agent-at-scale or full industrial journey benchmark |
| Research memory | Two real model runs retrieved the same three canonical source observations; the restarted process made no new research HTTP attempt | Separate R1 reception, with first-process transport counters unavailable |
| PDF processing | Real 17-page public report, 40,113 characters; Modal extraction stored on Aiven and reused across two acquisitions with one extraction | Isolated module reception; full agent/UI PDF journey remains separate |
| Public website | Physical Impact presentation site published over HTTPS | Website availability does not prove the connected backend is publicly deployed |

The integrator's [verification status](docs/STATUS.md) and exact receipts own subsequent runtime reception. Historical documents remain dated evidence. This README describes the package prepared on 22 October 2026, not an assertion that every ongoing branch has shipped.

## Data and agent architecture

Public evidence and authorised operational records enter a versioned company context. The model chooses bounded, validated tools; the deterministic business engine evaluates feasibility. A server-owned decision checks current data and authority before storing approval. Runs, evidence, proposals and decisions remain durable in PostgreSQL.

| Technology | Actual role |
| --- | --- |
| OpenAI | Real tool-calling provider in the received risk flow; the recorded configured model alias is gpt-5.4-mini |
| Keenable | Bounded public-content retrieval with source identity, date and content hash |
| Aiven PostgreSQL | Durable business snapshots, evidence, runs, decisions and separately tested document cache |
| Modal | Authenticated extraction of a real public PDF; separately verified module |
| React 19, Vite 8, Fastify 5, TypeScript | Interface, server, typed contracts and deterministic calculations |

The model cannot execute arbitrary SQL, read arbitrary files or gain authority from an identifier it supplies. Business secrets stay server-side. Builder documents, operator oracles and future test events are outside the product model context and runtime image. Public content is untrusted evidence, not permission to act.

## Local start

Requires Node 24 within the package engine range, npm and an accessible PostgreSQL database. Dependency versions are pinned in the lockfile.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. Configure `DATABASE_URL`, `APP_ORIGIN` and independent random login tokens of at least 32 characters. `DEMO_LOGIN_TOKEN` resolves Paul on the server; `OPERATOR_LOGIN_TOKEN` resolves a separate operator who cannot approve business proposals.
3. For remote PostgreSQL, use verified TLS. Supply a trusted CA with `DATABASE_CA_FILE` when required. A failed certificate check remains a failure.
4. Run `npm run operator -- seed CO-DEMO` once to import the small synthetic fixture. Repeating refuses to overwrite it. This is not the 10,000-line industrial import.
5. Run `npm run build`, then `npm start`. The default local origin is `http://127.0.0.1:3000`. Use the demo token to start the session.

For model calls configure `MODEL_PROVIDER=openai` (or explicitly `anthropic`), `MODEL_API_KEY` and an explicit `MODEL_NAME` in the server environment. Without usable provider configuration, missing input remains explicit rather than producing a fabricated proposal. No credential is included in this repository.

For development, `npm run dev` starts API/workers and `npm run dev:ui` starts Vite with an API proxy. Set `APP_ORIGIN` to the exact UI origin for mutations. Production serves only `dist/client`. Startup applies migrations and never seeds or resets company data.

## Verification and repeatability

Run `npm run typecheck`, `npm run build` and `npm test`. Set `TEST_DATABASE_URL` for server integration and `DATA_WATCH_TEST_DATABASE_URL` for watch storage; otherwise PostgreSQL suites are skipped. Use an isolated database with disposable-schema permissions.

The frozen accepted risk-flow source has a receipt for 173 passing tests, typecheck, build and independent exact-code reviews. This count belongs to that frozen version; it is not CI for the uncommitted working tree. Provider protocol tests with injected responses remain distinct from real inference receipts.

Tests cover calculations, stale revisions, roles, idempotence, concurrency, collection failures and durable readback. Restart preserves state. Use a distinct explicitly seeded session for a new scenario; never silently reset or replay uncertain effects. Detailed operator commands and acceptance work remain in [the build handoff](docs/HANDOFF.md) and [current status](docs/STATUS.md).

## Repository map

- `src/agent/`: bounded model/tool loops and company context.
- `src/domain/`: deterministic business calculations.
- `src/data/` and `src/watch/`: public collection, relationships and durable analysis intents.
- `src/server/`, `src/contracts/` and `migrations/`: authenticated API, storage and interfaces.
- `src/ui/`: decision workspace.
- `fixtures/`: explicitly synthetic initial company data.
- `tests/`: unit, boundary and integration checks.
- `proposals/product/submission-20261022/`: one-pager, field copy and evidence package.
- `operator/` and `.preparation/`: builder/operator-only material excluded from product context and runtime image.

## First users and remaining scope

The proposed first-user route is targeted outreach to operations and procurement leaders around one recurring supply or stock decision, then expansion across sites. No signed pilot, paying customer or measured customer time saving is claimed.

The connected accepted preview runs locally with Aiven PostgreSQL. Aiven Runtime application deployment is not established by database use. This repository publishes the project source; the [publication scope](docs/PUBLICATION.md) identifies its limits. The demo URL, MP4 recording and jury submission retain their own completion and access checks. A public landing page is already available at [physical-impact.com](https://physical-impact.com).

Sources: [corrected UI flow](proposals/integration/FINAL-UI-FLOW.json), [restart](proposals/integration/FINAL-PREVIEW-RESTART.json), [final QA](proposals/integration/FINAL-3001-QA.json), [industrial import](proposals/integration/INDUSTRIAL-CORE-AIVEN.json) and [PDF/cache result](proposals/modal/AIVEN-DOCUMENTS-LIVE.json).
