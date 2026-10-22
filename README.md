# Physical Impact

**Physical Impact turns market signals and company data into coordinated action for operations teams.**

[Website](https://physical-impact.com) · [Product one-pager](proposals/product/submission-20261022/ONE-PAGER.md) · [Evidence it works](proposals/product/submission-20261022/EVIDENCE-IT-WORKS.md) · [Data layer](proposals/product/submission-20261022/DATA-LAYER.md)

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

The accepted risk flow is a real model/tools/proposal/approval path. Approval does not place a purchase or move inventory. The received industrial V6 server separately connects report preparation, decisions, simulated effects and questions; its later frontend and public deployment keep their own reception checks.

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

## Run or resume independently

Use the [public recovery procedure](docs/RECOVERY.md). It gives a no-key browser presentation, a tracked initializer for the 10,000-line industrial core/context/display, a dedicated PostgreSQL schema, restart/readback checks and the optional real-provider path. The small `operator seed` fixture and the browser-only scenario are separate datasets, not shortcuts to the industrial import.

Start with `npm ci`, `npm run typecheck`, `npm run build`, `npm test -- --exclude '**/proposals/**'` and `node --import tsx tools/recover-industrial.ts --check`. For a credential-free product preview run `npm run dev:ui`, then open Vite's printed URL with `/?demo=1`. PostgreSQL suites skip without explicit test connections. Injected test providers do not prove real inference.

Read [why these choices](docs/DECISIONS.md) for the product/data boundary, common-plan calculation, stack, JSONB tradeoffs, source TTL, model budgets, PDF extraction and simulated execution. These are maintained reasons with explicit limits, not invented comparative benchmarks. [CONTRIBUTING.md](CONTRIBUTING.md) supplies the review contract without private desktop skills.

The [public source checkpoint](docs/PUBLICATION.md) identifies the assembled code and checks. Earlier 173-test risk-flow receipts belong to their historical frozen source, not to every later commit. The current public source includes the received V6 industrial server wiring, PDF boundary and allocation UI; ongoing later owner work is outside that checkpoint.

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
