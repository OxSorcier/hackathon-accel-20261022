# Resume from the public repository

22 October 2026. This procedure uses only tracked files, Node 24, npm and, for connected mode, your own PostgreSQL database. No `.local` directory, original author's account, private chat or installed Codex skill is required. Start with the [product/data guide](REPOSITORY-GUIDE.md), [rationale](DECISIONS.md), [public checkpoint](PUBLICATION.md) and [contribution contract](../CONTRIBUTING.md).

## 1. Pin the source and install

Clone `https://github.com/OxSorcier/hackathon-accel-20261022.git`, enter the directory and record `git rev-parse HEAD`. For an exact rerun use the full commit SHA of the version being discussed. Use Node 24 within the package engine range and run `npm ci`. Keep the lockfile. None of these commands deploys the application.

Run `npm run typecheck`, `npm run build`, `npm test -- --exclude '**/proposals/**'` and `node --import tsx tools/recover-industrial.ts --check`. The last command validates the public portfolio against pinned hashes and business schemas without opening a database or calling a provider. Expected counts include 10,000 order lines, 2,502 orders, 6 depots, 40 suppliers, 200 products and 400 customers. PostgreSQL-dependent tests skip unless the explicit test connection variables are set. A skipped suite is not a passing integration test.

## 2. No-key presentation mode

Run `npm run dev:ui` and open the exact local address Vite prints with `/?demo=1` appended, for example `http://127.0.0.1:5173/?demo=1`. Use the explicit demo controls to inspect the prepared scenario. This adapter uses synthetic browser state and localStorage. It calls no model, SQL or external collection service. It is the simplest way to inspect the product without credentials. Clearing site data resets only this browser presentation.

The default root is the connected industrial workspace and can report API/data unavailable when the API is absent. That is expected in presentation-only mode. Use the query parameter explicitly; do not infer backend success from a populated presentation screen. Prefer `/?demo=1` over assuming every production server has a `/demo` SPA fallback.

## 3. Connected industrial baseline

Supply a disposable PostgreSQL database you control. One option, when Docker is already available, is `docker run --name physical-impact-recovery -e POSTGRES_PASSWORD=local-recovery-only -e POSTGRES_DB=physical_impact -p 127.0.0.1:55432:5432 -d postgres:17.6`. The password here is a public local example, never a shared or production credential. Wait for PostgreSQL readiness. No hosted account or paid service is required for this baseline. Stop/remove only your own container when finished.

Copy `.env.example` to `.env`. Set `DATABASE_URL=postgresql://postgres:local-recovery-only@127.0.0.1:55432/physical_impact` for that local container, or your own connection. Set `DATABASE_SCHEMA=physical_recovery_first` and `DEMO_COMPANY_ID=CO-DEMO-INDUSTRIAL-CANDIDATE`. Keep `APP_ORIGIN=http://127.0.0.1:3000`, `HOST=127.0.0.1`, `PORT=3000`. Generate two different tokens with `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`, placing them in `DEMO_LOGIN_TOKEN` and `OPERATOR_LOGIN_TOKEN`. Do not commit `.env`.

For remote PostgreSQL, use verified TLS and your provider's trusted CA via `DATABASE_CA_FILE` when required. The committed certificate is a public project CA, not access to the original database and not a universal CA. Never disable certificate verification to get a passing result.

Run `node --env-file=.env --import tsx tools/recover-industrial.ts --init`. This explicitly creates only the named `physical_recovery_...` schema, runs the tracked migrations, inserts the synthetic portfolio plus an attributed import receipt, then imports the versioned industrial context and display aliases through their validating server repositories. It releases no future event and calls no provider. The result should say `read_back`, identify the schema/company, contain the counts above and initially show zero reports and events.

Run the same command again before changing the company. It should read the same baseline rather than duplicate it. A partial initialization can be retried. If business state has evolved, `--init` refuses to reset it. Use `node --env-file=.env --import tsx tools/recover-industrial.ts --readback` for the current state, or choose another fresh recovery schema for another trial. The schema name is required and constrained; the utility never defaults to a shared `public` schema.

Run `npm run build`, then `npm start`. Open `http://127.0.0.1:3000` and sign in with your demo token as Paul. The industrial baseline should show the company and imported counts. No report exists yet because no event was released. Restart the process and repeat `--readback`: company identity, revisions and counts should persist. Startup migrates and resumes durable state; it never imports the scenario on its own.

## 4. Event, real analysis and approval

Real inference requires your own explicitly configured `MODEL_PROVIDER`, `MODEL_API_KEY` and `MODEL_NAME`. Keenable requires its own `KEENABLE_API_KEY`; PDF acquisition requires the separately configured Modal endpoint/token listed in `.env.example`. Those optional services can have costs. The no-key baseline and tests do not prove their availability. Missing configuration must remain an explicit failure or unavailable state. Do not substitute a simulated answer for a real run.

The controlled industrial event is tracked at [operator-event.v2.json](../proposals/product/alignment-20261022/v2/operator-event.v2.json). It is operator-only scenario material, never background input to the product model. To release it intentionally, use an operator session created by `POST /api/session` with your operator token, then `POST /api/operator/industrial/releases` with the same-origin header and JSON `{payload: <the complete event JSON>, expectedRevision: <the revision from --readback>, operationKey: "public-recovery-event-0001"}`. Preserve the session cookie and use actual JSON values, not the angle-bracket placeholders. The request schema and response are in [app.ts](../src/server/app.ts) and [industrial-release.ts](../src/server/industrial-release.ts).

Release changes the synthetic confirmed inbound date and enqueues the bounded analysis. A running configured worker can then make external model/source calls. Poll `GET /api/industrial` and the returned run ID at `GET /api/runs/:id`; inspect status, actual calls, evidence and report. Six turns, twelve tools and sixty seconds bound a run. No-key runs cannot establish this real path. Public evidence remains separate from the synthetic confirmation and qualified CRM demand.

With a prepared current report, sign in as Paul, compare the plans and approve an admissible plan. The API rechecks authority, plan hash/version, basis and budget. Approval records a decision. The separate simulation control records explicitly simulated effects; it does not order from a supplier or update a real ERP. The canonical controlled common-plan test expects EUR 1,720 new spend and EUR 1,100 opportunity contribution. The browser-only scenario has different figures and must not be used as the oracle for this dataset.

For a provider-free protocol reproduction with SQL, set `TEST_DATABASE_URL` to your disposable test database and run `npx vitest run tests/integration/industrial-runtime.test.ts --exclude '**/proposals/**'`. This suite imports the same files, releases the controlled event, injects an explicitly labelled model/HTTP protocol, calculates the common plan, approves, simulates and rereads from a new database connection. It uses disposable schemas. It proves protocol and persistence, not real inference or source retrieval. `DATA_WATCH_TEST_DATABASE_URL` similarly enables the separate watch-storage suites. Do not point either variable at a schema you need to preserve.

## 5. First contribution and diagnosis

Choose a bounded task and state the source SHA, intended behaviour, affected files and proof required before changing code. [CONTRIBUTING.md](../CONTRIBUTING.md) contains a portable review procedure. The build-era chat registry and private `.local` paths in historical receipts are provenance, not an external contributor coordination dependency. Use the existing repository for the work; do not create a parallel project registry.

If installation fails, check Node version and use `npm ci` with the committed lockfile. If the root is empty/unavailable, distinguish presentation mode from the connected API and confirm the company/schema settings. For 401/403, inspect session role, distinct tokens and exact `APP_ORIGIN`; Vite development uses its printed origin, with the API on port 3000. For import errors, check schema prefix, database access, source hashes and whether the company already evolved. For stale context or quote dates, preserve the dated 22 October fixture and its refusal: do not falsify the system clock or silently refresh business facts to force approval. Create a reviewed new fixture/version for another date. For unavailable providers, check configuration without logging secrets. For uncertain outcomes, inspect persisted attempts before retrying.

Stop conditions for a reproducible contribution: you can explain Paul and his decision; distinguish every data origin; run the relevant local checks; locate the exact business/API path; make a scoped change with independent reviews; and leave evidence of what passed, skipped or remains `NOT_RUN`. A full autonomous production business operation is outside this prototype.
