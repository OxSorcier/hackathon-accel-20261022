# Research memory: data-owner delta

2026-10-22. Proposal received from the product framing in `proposals/product/MEMOIRE-RECHERCHE-TRACES.md`. Integration owns the shared contract, migration, API and final R1/R2 reception. This is the next slice after the exact Keenable receipt. No new registry, migration, import or automatic promotion of research into facts is introduced here.

## Existing foundation to reuse

`accel_watch_evidence` preserves `(company_id, source_id, content_hash)`, evidence JSON and first/last seen timestamps. `accel_watch_occurrences` preserves the received result and its public-topic watch. An identical collection updates the observation date without adding a source-content version. A changed content hash preserves the earlier evidence row. Current cases carry an occurrence/evidence/hash reference and version history; integration already owns invalidation of pending proposals when a case is revised. Decision memories remain decision memories.

This foundation does not yet prove retrieval before research, qualified knowledge, freshness decisions or automatic revision of dependent cases. The process-local pending publication retry in the current watch engine also does not preserve an uncommitted result across a process crash.

## Minimal shared extension proposed to integration

1. A server-authorized read by company, stable topic/profile, source identity and optional received entity references. Join existing definitions, occurrences and evidence. Return immutable source versions with publication, collection, first/last observation, profile and original URL. A page identity is not a company identity. Expose a bounded port, never arbitrary SQL or filesystem access to the model.
2. A versioned qualified research record owned by the server, referencing existing evidence tuples rather than copying them into another source store. Suggested fields: company, topic/entity references, question, evidence references, qualified statements, hypotheses/unknowns, verification status, conditions, freshness policy/review date, previous version and dependent case references. Human or server validation decides which statements are qualified. Model output and logs alone are not facts.
3. A lookup tool invoked before external research. Record a decision to reuse, complement or refresh, the knowledge and evidence versions consulted, the reason, and actual external-call count. A valid empty/error result remains retrievable with its limits.
4. Changed source content or stale freshness marks dependent knowledge as requiring review; it does not silently replace a conclusion. Requalification creates a new version. Integration revises affected cases and makes their pending proposals stale using the existing case mechanism. Already approved simulation decisions retain their historical references; no retroactive execution is implied.

Legal metadata retains jurisdiction, publication, entry into force, application, deadline and applicability as separate fields. An unknown date or company role stays unknown. Profiles and retained URLs are discovery policies, not universal legal coverage.

## Controlled acceptance scenario

Use `RESEARCH-MEMORY-CONTROLLED-SCENARIO.json`. It is test input only, never a public observation or fixture loaded at product startup. The existing PostgreSQL evidence tables accept its valid source identity in explicit `mode: test`; no third-party website is modified.

R1: ingest and qualify v1 in company A; end the session and recreate database clients/server context. Start a new run without the previous answer in its prompt. The lookup tool must retrieve the qualified record and exact evidence hash before any external call. Confirm conditions, publication and freshness. Assert actual calls avoided against a declared baseline. Company B gets no company-A record. A homonym must not inherit its entity link.

R2: ingest v2 with the same source identity and a different body/hash. Retrieve again, retain v1, create a linked qualification revision, revise the dependent case and reject or re-evaluate its old pending proposal. Re-ingesting v2 must create no extra source-content or qualified version. Also test missing publication, stale freshness, source error and uncertain applicability. No time/cost gain is claimed without a measured baseline.

Status: proposal and controlled scenario supplied by the data owner. Shared extension, lookup tool, integrated R1/R2 and Aiven execution: NOT_RUN. The current Keenable code freeze remains separate.
