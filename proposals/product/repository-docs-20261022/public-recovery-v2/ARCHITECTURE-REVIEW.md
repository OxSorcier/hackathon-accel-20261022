# Revue contrats et architecture du candidat public-recovery-v2

Statut : un défaut P2 confirmé. Revue indépendante en lecture seule du paquet figé. Aucun appel DB, fournisseur ou service externe, aucun changement du candidat, aucun commit/push.

## Version et périmètre

- Source exacte : `/Users/erwan/Projects/hackathon-accel-20261022/.local/public-recovery-v2/source`.
- Manifest : `../REVIEW-INPUT.json`, 24 fichiers. Les 24 SHA-256 correspondent avant et après les contrôles.
- Base de comparaison : `285cfb0d1bfd1c313c4b57ffba5f2515446acffd`. Diffs des sources serveur et UI obtenus avec `git show` en lecture seule sur cette base. Aucun reçu ni conclusion d'un autre reviewer consulté.
- Rôle : contrats et architecture, selon `erwan-internal-review/references/architecture-reviewer.md`. Pas de redélégation, pas de mémoire consultée.

## Finding confirmé

### [P2] Le contrôle sans DB ne valide pas les deux entrées nécessaires à la reprise complète

Fichier : `tools/recover-industrial.ts`, fonction `recoverIndustrial`, lignes 26-42 puis 74-78.

`--check` lit et valide uniquement `portfolio-10000.json` et `portfolio-policy.json`, puis retourne `validated_without_database`. Il ne lit ni ne valide `industrial-context.v2.json` ou `display-profile-v1/display-aliases.v1.json`. Ces deux entrées ne sont chargées que dans `--init`, après le commit de la société et de son reçu core (lignes 56-71). Un clone incomplet ou un contexte/alias incohérent passe donc le contrôle annoncé, puis laisse un import partiel lorsqu'on utilise une DB. L'absence de contexte empêche ensuite la lecture de l'espace industriel. Le traitement partiel est prévu comme réessayable ; le défaut est le faux feu vert du contrôle et la découverte tardive d'une erreur statiquement détectable.

Preuve exécutée, sans modifier le candidat : injection locale de `fs/promises.readFile` qui lève `SIMULATED_MISSING_RECOVERY_INPUT` pour les chemins contexte et alias, puis appel `recoverIndustrial(['--check'], {})`. Résultat : succès `validated_without_database`. Le journal des lectures d'entrée contient exactement les deux fichiers core/policy. Aucun accès DB n'était possible ou nécessaire à ce probe.

Correction attendue : précharger et valider les quatre entrées avant la première mutation, réutiliser ce même résultat dans `--check` et `--init`, contrôler les liens société/identités et les hashes core/contexte portés par le profil d'affichage. Ajouter un test sans DB qui refuse contexte absent, JSON invalide, contexte d'une autre société et alias dont les références/hashes diffèrent. Si le mode reste volontairement limité au core, son nom/statut doit annoncer précisément cette portée et un contrôle complet séparé est nécessaire pour l'objectif reçu.

## Couverture concrète

| Zone | Code effectivement examiné | Conclusion de lecture |
| --- | --- | --- |
| Reprise explicite | `tools/recover-industrial.ts`, `operator.syntheticSnapshot`, schémas dataset/policy, `migrate`, `config.createPool` | Schéma dédié obligatoire pour init/readback ; URI options retirées lorsque le schéma est explicite ; aucun reset ; core existant comparé à sa révision, son hash et son reçu. Défaut de préflight décrit ci-dessus. |
| Import contexte et alias | `IndustrialReadRepository.importContext/context/readWithin`, `parseIndustrialContext/currentIndustrialContext`, `importIndustrialDisplay/readIndustrialDisplay` | Rôle opérateur, scope société, versions, reçus idempotents et conflits contrôlés ; liens natifs et provenance validés ; alias rattachés aux sources core/contexte. |
| HTTP et acteur | `app.createApp`, `auth.resolveLoginActor/checkOrigin`, `store.actor/session` | Routes industrielles commandées avec session et Origin. L'identité société/acteur vient du serveur ; les rôles de décision et simulation sont revérifiés dans leurs services. Les anciennes routes de lecture de démonstration `/api/company`, `/api/decisions`, `/api/runs/:id` restent publiques selon le contrat existant ; cette revue ne les requalifie pas en données privées protégées. |
| Assemblage durable | `start.start`, `worker.createRunWorker`, `store.claimRun/finishRun/transaction` | Runtime industriel et finalizer raccordés ; publication sous fence et lease ; résultat fournisseur repris pour publication DB sans refaire l'appel fournisseur. Pas d'import automatique du portefeuille au démarrage. |
| Analyse et fraîcheur | `IndustrialRuntime.beforeClaim/question/validateRun/loadInput/reserve/finalize/basisCurrent/recalculate`, `IndustrialReadRepository.readWithin` | Versions métier/politique/contexte/qualification/événement et dépendances de recherche liées ; rapport recalculé côté serveur ; ancien ready v1 bloqué ; rapport automatique manquant traité comme échec. La comparaison temporelle des actions ignore les IDs techniques recalculés mais garde les actions et dépendances. |
| Décision et simulation | `IndustrialRuntime.decide`, `createIndustrialDemoExecutor.execute/effects/readIndustrialExecutionState`, `IndustrialReleaseRepository.release` | Verrou société, décision exacte, rôle/plafond, révision et ressources revalidés ; effet et reçu dans une transaction ; unicité approval/opération ; readback après résultat de commit incertain. Aucune preuve DB exécutée dans ce mandat. |
| SQL | Contraintes industrielles des migrations 009-012, requêtes des chemins ci-dessus | PK/uniques et FK société/rapport/approval/exécution observées. Migration et concurrence PostgreSQL non exécutées. |
| Veille et preuves | `industrial-feed`, `physical-model`, diff `physical-pages`, diff schéma `ui/industrial` | Dernière tentative réellement démarrée lue par veille et société ; cadence distincte de collecte ; présentation de fraîcheur historique ; allocation de portefeuille élargie sans élargir les propriétés d'un step. |
| PDF nouvellement raccordé | `pdf-routes`, `pdf-knowledge`, points de raccord start/runtime, test `pdf-runtime` | Acquisition explicite par rôle métier ; lecture modèle de cache seulement, company/profile/hash/page liés ; aucun appel Modal réalisé. Le stockage/téléchargement interne PDF n'a pas été intégralement réaudité. |
| Distribution | `.dockerignore`, `Dockerfile`, présence Git des quatre fichiers de données | Image en liste positive, sans `.preparation`, `operator`, propositions ou outil d'import ; CA distribuée comme certificat public ; quatre entrées de reprise présentes dans la base Git. Image non construite ici. |

## Contrôles réellement exécutés

Toutes les commandes ont reçu le workdir exact du paquet figé. Aucun fichier `.env` chargé.

1. Empreintes SHA-256 : 24/24 conformes avant et après.
2. `node --import tsx tools/recover-industrial.ts --check` : succès ; 10000 lignes d'engagement, six dépôts ; dataHash `8ec5df0ed8499f7ca43936b4fbb09b9d99448fbf86859f5f9a4f7830e2d59083`.
3. Probe d'entrées contexte/alias rendues illisibles : le même check passe, confirmation du P2.
4. `npm run typecheck` : exit 0. Limite : `tsconfig.json` inclut src/tests/config et n'inclut pas `tools/`; cela n'atteste pas un contrôle TypeScript statique de l'utilitaire de reprise.
5. `env -u TEST_DATABASE_URL npm exec vitest run tests/server/config.test.ts tests/server/industrial-command-http.test.ts tests/ui/industrial-api.test.ts tests/ui/physical-connected.test.tsx tests/server/industrial-agent-port.test.ts tests/server/pdf-knowledge.test.ts tests/domain/industrial.test.ts tests/data/industrial-relations.test.ts` : 8 fichiers, 138 tests réussis, 22,55 s. Contrôles synthétiques locaux, sans connexion DB.

Tests lus en détail : `tests/server/config.test.ts`, `tests/server/industrial-command-http.test.ts`, `tests/integration/industrial-runtime.test.ts`, `tests/integration/pdf-runtime.test.ts`. Les deux tests d'intégration parcourent init des données, HTTP injecté, fournisseur injecté, persistance et reconnexion mais sont conditionnés par `TEST_DATABASE_URL` ; ils n'ont pas été exécutés ici. Tests UI et industrial-execution également repérés pour leur couverture ; seule la sélection ci-dessus constitue une preuve exécutée.

## Limites et verdict

Pas d'autre défaut confirmé sur les chemins inspectés. Le P2 doit être corrigé ou la portée de `--check` réduite explicitement avant d'annoncer une validation complète du clone. Les contrôles sans DB sont positifs, mais `--init`, `--readback`, rollback/concurrence PostgreSQL, redémarrage avec données durables, TLS Aiven réel, fournisseur réel, Docker et navigateur restent NOT_RUN dans cette revue. Les protections sont implémentées et lues ; leur présence ne prouve pas leur effet sur Aiven ou en production.

## Revalidation du delta v2, 22 octobre 2026

Verdict courant : **P2 corrigé sur les bytes revalidés. Aucun finding ouvert dans le delta examiné.** Ce verdict remplace le statut initial, conservé ci-dessus pour l'historique. Les limites DB/Aiven et intégration restent identiques.

Le manifeste actualisé contient 25 fichiers. Empreintes vérifiées avant et après les probes : 25/25 conformes. Les autres fichiers du périmètre initial conservent leurs empreintes. Deux empreintes de ce delta :

- `tools/recover-industrial.ts` : `ec0b683933ff88b5349a3441176a3659801884fd18465a3a83fd4d532346a032`.
- `tests/server/recovery.test.ts` : `69a04f62dd0268019be7805657f754d5ef2579adfb19f8657ea6bd3b4958862b`.

Le correctif charge les quatre fichiers et vérifie leur SHA-256 exact avant `--check` ou création de pool (lignes 17-34). Il valide aussi le contexte contre le snapshot par `parseIndustrialContext` (lignes 41-42). `--init` réutilise ces objets sans seconde lecture de fichiers (lignes 80-82), ce qui retire le faux succès sur fichier absent ou modifié et évite une modification entre contrôle et import.

L'alias reste épinglé à un fichier exact ; sa validation sémantique demeure dans `importIndustrialDisplay`. Pour vérifier que cette stratégie est suffisante pour ce paquet fixe, j'ai fait exécuter indépendamment cette validation sur les bytes épinglés, avec un port SQL en mémoire fournissant le snapshot, le contexte et leurs vrais hashes : 64 labels validés, liens société et sources acceptés, zéro connexion DB. Ce probe prouve le contrat de cet alias exact, pas une importation persistante. Si les données ou pins changent ultérieurement, cette preuve est à refaire.

Contrôles exécutés sur le delta :

1. `tests/server/recovery.test.ts` et `tests/server/config.test.ts` : **19 tests réussis** dans deux fichiers, dont les cinq nouveaux cas de reprise. `TEST_DATABASE_URL` retirée de l'environnement ; `createPool` explicitement simulé et interdit dans les nouveaux tests.
2. Reproduction indépendante du défaut initial avec `readFile` rendant successivement contexte et alias illisibles : les deux appels `--check` sont maintenant rejetés avant DB. Les données réelles sont ensuite acceptées par `--check`.
3. Probe des 64 alias via `importIndustrialDisplay` sur port SQL en mémoire : succès, zéro accès réel à PostgreSQL.
4. `npm run typecheck` : exit 0. Le nouveau test importe `tools/recover-industrial`, donc l'utilitaire entre désormais dans le graphe vérifié par TypeScript ; la limite de couverture TypeScript signalée dans la revue initiale ne s'applique plus à cette version.
5. SHA-256 finaux : 25/25 identiques au manifeste.

Aucun autre reviewer, reçu ou conclusion externe consulté. Aucun fichier du candidat modifié. L'initialisation réelle, reprise après commit interrompu, isolation PostgreSQL effective, concurrence, redémarrage durable et Aiven demeurent **NOT_RUN**. La correction du précontrôle n'est pas une preuve de ces comportements.
