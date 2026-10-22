# Responsabilités du build

Un seul checkout au départ. Les chemins possédés sont disjoints ; l'intégrateur gère les fichiers communs. Ne pas utiliser de worktrees avant une base Git appropriée et les autorisations de commit reçues.

| Rôle | Écriture autorisée | Livraison à l'intégrateur |
| --- | --- | --- |
| Intégration et Aiven | src/contracts/, src/server/, src/main.ts, migrations/, package.json, lockfile, tsconfig*, vite.config.*, index.html, Dockerfile, compose*, configuration de test, README.md, .gitignore, .dockerignore, .env.example, docs/CONTRACTS.md, docs/BUILD-PLAN.md, docs/STATUS.md, tests/integration/, tests/server/, proposals/integration/ | Démarrage unique, API/session, stockage, commandes, contrats et version intégrée |
| Données et veille | src/data/, src/watch/, tests/data/, tests/watch/, proposals/data/ | Collecteur, stockage via contrat, occurrences, leases et preuves ; propositions SQL dans proposals/data/ |
| Métier et agents | src/domain/, src/agent/, tests/domain/, tests/agent/, proposals/agent/ | Calculs, contexte, boucle fournisseur, propositions et mémoire |
| Interface | src/ui/, tests/ui/, proposals/ui/ | Direction A, parcours connecté aux API reçues, erreurs/attentes et vérification navigateur |

L'intégrateur crée les répertoires communs et publie le premier contrat. Les constructeurs lisent ce contrat avant un import partagé. Une extension est proposée dans son dossier proposals/ puis intégrée par le propriétaire. Pas de modification parallèle du lockfile, des migrations ou d'un contrat partagé.

docs/tasks/ contient les mandats. Chaque constructeur conserve un reçu dans son propre dossier proposals/, avec fichiers, modèle réalisateur, contrôles réellement exécutés, limites, prochaine action et empreinte de sa version. Ne pas écrire docs/STATUS.md depuis quatre chats.

La préparation reste figée dans .preparation/. fixtures/company/ est une copie initiale attribuée, lue par les constructeurs ; l'intégrateur possède son import explicite dans une session de démonstration. operator/ sert seulement aux essais ; ses données ne sont pas lues par l'agent produit.

## Réception des modules

Chaque constructeur publie dans proposals/<role>/READY.json la liste exacte de ses fichiers avec SHA-256, le modèle réalisateur, les commandes et leurs résultats réels, ainsi que les limites. Il cesse ensuite les écritures de ce périmètre pendant l’assemblage. Une correction émet un nouveau reçu et invalide les contrôles de l’ancienne empreinte. L’intégrateur vérifie les empreintes avant et après ses tests ; une modification concurrente suspend seulement la réception concernée.

L’intégrateur possède les commandes opérateur, le reset explicite, les essais S3/C et la vérification de leurs droits. Le coordinateur possède docs/THREADS.json pendant le lancement ; après enregistrement des quatre chats, l’intégrateur reprend ses mises à jour. Les changements de mandat ou d’AGENTS.md sont réconciliés avec le coordinateur avant modification.

## Received PDF client sub-scope, 22 October 2026

The existing access/PDF owner chat `01a16283-2006-7bd3-b07f-2ceaf2535784` may write only the new files `src/server/pdf-client.ts` and `tests/server/pdf-client.test.ts`, plus its existing `services/modal-pdf/` and `proposals/modal/` scope. This bounded exception implements Erwan's received Modal PDF mandate. It includes an authenticated bytes-to-Modal client, strict DTO and hash validation, tests and two independent exact-code reviews. The integrator retains public downloads, shared contracts, dependencies, routes, migrations, persistence, cache, UI and final runtime reception. Existing files and the risk-flow candidate remain frozen under their respective receipts. No commit, push or publication is authorized by this sub-scope.

## Received research acceptance sub-scope, 22 October 2026

The existing business/agent owner chat `01a162bd-ee93-7cc2-a93f-659950f41d93` may prepare and execute the delegated R1 protocol in `.local/research-reception/` and record `proposals/agent/R1-*.json`, after the integrator's exact candidate checkpoint. It uses a separate schema on the existing Aiven database and port 3002, preserves native IDs of explicitly copied acquired public evidence, and never modifies the stable 3001 schema or the integrator's server/contract sources. Access values remain only in process memory. No seed/import repeats after initial setup. The integrator retains server corrections, reviews, R2 and the final reception.

## Received PDF document-storage sub-scope, 22 October 2026

The same existing PDF owner may also write the new `src/server/pdf-documents.ts` and `tests/integration/pdf-documents.test.ts`, with proposed SQL only under `proposals/modal/`. This unit handles one received public PDF profile, bounded downloads, company-scoped byte/extractor-version cache, page provenance, durable extraction intent and uncertainty, and concurrent idempotence. Shared migrations, routes, authentication, model/UI contracts and final reception remain with the integrator. No existing shared file or dependency may be changed by this sub-scope.

## Received AdaptOps v2 QA/operator sub-scope, 22 October 2026

The existing coordinator chat `01a15f24-8d9c-7fd2-8a00-1b039732248f` owns only new `operator/adaptops-v2-qa/` expectations/oracles and `.local/qa-adaptops-v2/` results/captures for the received industrial report and simulated-execution mandate. These operator files must remain outside HTTP/static output, images, model input and runtime bootstrap. The coordinator may test only an integrator-received candidate and exact dataset manifest. It does not modify existing operator commands, product sources, contracts, imports or the stable 3001 data. Earlier risk-flow receipts remain separate.

## Received PDF HTTP route sub-scope, 22 October 2026

The existing access/PDF owner may write only new `src/server/pdf-routes.ts` and `tests/server/pdf-routes.test.ts`, alongside its already received PDF units. `registerPdfRoutes` receives the integrator's authenticated `actorFor` and company-scoped document service. The integrator retains app/start hooks, canonical migrations, agent/UI contracts and assembly. Inputs and errors are validated; acquisition is limited to the received public profile and authorised business roles. No new Modal call is needed until the integrated candidate checkpoint.

## Received industrial v2 module sub-scopes, 22 October 2026

The existing business/agent owner owns new `src/domain/industrial.ts`, `src/agent/industrial-context.ts` and matching `tests/domain/industrial*.ts` and `tests/agent/industrial*.ts`. It implements deterministic joint risk/opportunity evaluation against the full snapshot and a bounded model projection. The existing data/watch owner owns new `src/data/industrial-relations.ts`, `src/data/analysis-trigger.ts` and `tests/data/industrial*.ts`, with SQL proposals under `proposals/data/`. It validates the attributed synthetic context and controls durable analysis intent storage. The canonical additive contract is `src/contracts/industrial.ts`; its candidate/reception state is in `proposals/integration/INDUSTRIAL-CONTRACT.json`. The portfolio owner adapts its existing sidecar, without changing shared types. The integrator retains contracts, SQL migrations, explicit import, release authority, worker assembly, report/approval storage and simulated execution. No second worker or scheduler, real ERP action, commit or deployment is authorised.

## Received PDF knowledge adapter sub-scope, 22 October 2026

The existing PDF owner may write new `src/server/pdf-knowledge.ts` and `tests/server/pdf-knowledge.test.ts`. The shared contract `src/contracts/pdf.ts` is integrator-owned. The adapter releases only cached company/profile-bound descriptors and bounded page excerpts with exact document/page hashes. It cannot acquire, download or extract. Agent runner, shared types, routes registration and UI remain with their respective owners. The existing PDF files remain frozen.

## Received industrial execution persistence sub-scope, 22 October 2026

The existing data/watch owner may write only the new `src/server/industrial-execution.ts`, `tests/integration/industrial-execution.test.ts` and proposals under `proposals/data/industrial-execution/`. The unit applies one explicitly approved simulated plan atomically to the canonical C1 snapshot and industrial ledger, with idempotent durable receipts and native ERP/CRM records. The integrator provides current basis and full deterministic recalculation through a transaction-bound callback, retains shared contracts, migrations, report/approval commands, routes and runtime assembly. The unit uses the existing `PgStore` and company lock; it adds no worker, provider, dependency, actual ERP call or service. Existing data/research units stay frozen. Proposed SQL changes remain in proposals for the integrator to receive.

## Received industrial agent port sub-scope, 22 October 2026

The existing business/agent owner may write only new `src/server/industrial-agent-port.ts` and `tests/server/industrial-agent-port.test.ts`, plus its own proposals. The unit binds the received industrial agent tools to deterministic calculation, a private evaluation cache and report preparation. The integrator provides transaction-bound current input, overview, basis validation and durable usage callbacks, retaining all SQL publication, authority, releases, worker assembly, routes and approvals. Preparing a report has no durable business effect. No additional worker, provider or dependency is authorised.
