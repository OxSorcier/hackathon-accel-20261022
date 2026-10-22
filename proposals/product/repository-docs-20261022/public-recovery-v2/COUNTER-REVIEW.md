# Contre-revue public recovery v2

Date : 22 octobre 2026.
Rôle : reviewer des contre-exemples, lecture seule, contexte neuf. Aucune redélégation, aucune lecture des autres revues, aucun accès DB, réseau ou fournisseur. Aucun fichier candidat modifié.
Modèle réalisateur demandé dans le manifeste : gpt-6.1-sol. Modèle servi non attesté. L'identité servie du reviewer n'est pas attestée par les outils de cette revue.

## Version examinée

Paquet exact : `/Users/erwan/Projects/hackathon-accel-20261022/.local/public-recovery-v2/source`.
Manifeste : `../REVIEW-INPUT.json`, base `285cfb0d1bfd1c313c4b57ffba5f2515446acffd`.
Les 24 empreintes SHA-256 correspondent avant et après les contrôles. Comparaison réalisée par `git show BASE:chemin` avec les fichiers du paquet, et non par `git diff` du checkout parent.

## Findings retenus

Aucun défaut fonctionnel reproductible retenu dans le delta examiné. Ce verdict de lecture ne constitue pas un PASS PostgreSQL, Aiven, navigateur ou production.

## Lecture et garanties examinées

Lecture du code changé : `tools/recover-industrial.ts`, `src/server/config.ts`, `start.ts`, `app.ts`, `industrial-runtime.ts`, `industrial-feed.ts`, `industrial-read.ts`, `validation.ts`, `src/ui/physical-model.ts`, `physical-pages.tsx`, `industrial.ts`, `.dockerignore` et `Dockerfile`. Tous les chemins sont relatifs au paquet.

Chemins de support suivis : `src/server/operator.ts`, `migrate.ts`, `store.ts`, `auth.ts`, `worker.ts`, `industrial-boundary.ts`, `industrial-display.ts`, `industrial-execution.ts`, `industrial-agent-port.ts`, `pdf-routes.ts`, `src/data/industrial-relations.ts`, `src/domain/industrial.ts`, `engine.ts`, et les configurations TypeScript/Vitest.

Tests lus : `tests/integration/industrial-runtime.test.ts`, `industrial-feed.test.ts`, `pdf-runtime.test.ts`, `tests/server/config.test.ts`, `industrial-command-http.test.ts`, `industrial-agent-port.test.ts`, `tests/ui/industrial-api.test.ts`, `physical-connected.test.tsx`, `tests/domain/industrial.test.ts`, `industrial-fixture.ts`. Les snapshots/previews du manifeste ont été vérifiés par empreinte ; leurs entrées TypeScript ont aussi été lues. Pas de validation visuelle du HTML.

L'utilitaire ne s'exécute pas à l'import ni au démarrage. `--check` retourne avant toute création de pool. L'initialisation exige un préfixe de schéma dédié et des caractères bornés. Le pool retire les options URI concurrentes lorsqu'un schéma est explicitement choisi. Le noyau et son reçu sont dans la même transaction, sous verrou ; une société déjà modifiée est refusée sans remplacement. Contexte et alias utilisent leurs commandes idempotentes distinctes. Les migrations lues ne réinitialisent pas la démo. Les répertoires `.preparation/`, `operator/`, `proposals/` et les fichiers de secrets sont exclus du contexte Docker par sa liste positive et ne sont pas copiés dans l’image. Le module `src/server/operator.ts` reste du code compilé, sans exécution automatique ni données opérateur copiées.

L'authentification des commandes reste résolue côté serveur. Les décisions vérifient rôle, identité et hash du plan, budget, base courante et recalcul. L'exécution simulée conserve la transaction, le reçu et la reprise du résultat incertain. Les lectures historiques gardent les décisions sans réactiver une base périmée. La politique d'analyse v2 invalide les intentions prêtes de l'ancienne politique et refuse de publier un job automatique sans rapport structuré.

## Contrôles exécutés

Tous les processus de test ont utilisé le `workdir` exact du paquet et `TEST_DATABASE_URL`/`DATABASE_URL` retirées.

- `node --import tsx tools/recover-industrial.ts --check` : PASS, `validated_without_database`, 10 000 lignes, 6 dépôts ; dataHash `8ec5df0ed8499f7ca43936b4fbb09b9d99448fbf86859f5f9a4f7830e2d59083`.
- `npm run typecheck` : PASS. Le tsconfig courant couvre src/tests, pas tools ; l'utilitaire a été exercé par Node/tsx et les probes ci-dessous.
- Vitest, config + boundary HTTP industrielle + API UI + UI physique + 3 suites d'intégration liées : 99 PASS et 4 SKIPPED, dans 4 fichiers PASS et 3 fichiers SKIPPED. Les 4 SKIPPED exigent PostgreSQL.
- Vitest complémentaire, domaine industriel + relations + port agent + runner industriel + routes PDF + auth + origin : 55 PASS, 2 FAIL, dans 5 fichiers PASS et 2 FAIL. Échecs détaillés ci-dessous.
- Probes en mémoire : modes absents/inconnus, argument supplémentaire, octets portefeuille modifiés, schéma hors préfixe et schéma malformé refusés. PASS. Aucun pool connecté.
- Validation pure supplémentaire du contexte courant et des SHA attendus par les alias : PASS, contexte `IC-INDUSTRIAL-2-2`, 4 sites, 1 demande, 64 labels. Les fichiers du paquet n'ont pas été altérés.
- Probe directe hors Vitest avec `evaluateIndustrialPlan(industrialFixture(true))` : PASS, 8 295 ms, 10 000 engagements, plan `feasible`.

## Échecs observés et limites

1. `tests/domain/industrial.test.ts:18`, test du portefeuille complet : dépassement de son délai de 60 000 ms, environ 163 132 ms mesurés par le worker Vitest. Le même calcul exécuté directement hors Vitest a fini en 8 295 ms. Le calcul domaine n'est pas modifié dans ce delta. Je ne retiens pas un bug runtime confirmé à partir de ces résultats contradictoires ; le test Vitest reste FAIL observé et ne doit pas être annoncé PASS.
2. `tests/server/pdf-routes.test.ts`, cas de déconnexion du client : `listen EPERM: operation not permitted 127.0.0.1`. Limite sandbox sur l'ouverture du serveur TCP ; les tests injectés Fastify n'ont pas cette limitation.
3. `--init`, `--readback`, transactions, concurrence, redémarrage PostgreSQL, TLS réel et Aiven : NOT_RUN par mandat. Les garanties DB ci-dessus sont issues de la lecture et des tests existants lus, pas d'une observation DB dans cette revue.
4. `--check` valide le portefeuille et la politique épinglés, pas les fichiers contexte/alias. Leur validation pure supplémentaire a été faite séparément dans cette revue. Le statut de cette commande ne doit donc pas être utilisé seul comme preuve d'import complet contexte/alias.
5. Aucun navigateur, build Docker, fournisseur, événement métier réel, publication, commit ou push exécuté. Le certificat de projet a été vérifié par empreinte et utilisé dans les tests de configuration sans ouverture de connexion.

## Conclusion de revue

Delta examiné, aucune correction obligatoire identifiée. Réception DB complète et suite locale entièrement verte non attestées : conserver les limites et les deux échecs observés dans le reçu final.


## Revalidation du delta v2 : quatre inputs épinglés

Date : 22 octobre 2026. Même paquet, manifeste actualisé à 25 fichiers. Les 25 empreintes sont conformes avant et après cette revalidation. Les fichiers hors delta conservent les empreintes déjà examinées.

Delta lu intégralement :

- `tools/recover-industrial.ts`, SHA-256 `ec0b683933ff88b5349a3441176a3659801884fd18465a3a83fd4d532346a032`.
- `tests/server/recovery.test.ts`, SHA-256 `69a04f62dd0268019be7805657f754d5ef2579adfb19f8657ea6bd3b4958862b`.

Les quatre inputs sont désormais lus, comparés à leurs SHA fixes et décodés avant toute création de pool, dans chacun des trois modes. Le contexte est aussi validé contre le snapshot synthétique avant la branche `--check`. Les mêmes objets déjà validés sont réutilisés à l'import ; aucune relecture du disque ne crée d'écart entre la validation et l'import. Le reçu noyau inclut maintenant les quatre empreintes. Les transactions, verrous, refus d'une société évoluée et clés d'import idempotentes sont conservés. Aucune branche de reset ajoutée.

Contrôles exécutés depuis le workdir exact, sans variables DATABASE_URL/TEST_DATABASE_URL :

- Les cinq nouveaux tests `tests/server/recovery.test.ts` : 5/5 PASS.
- Commande réelle `node --import tsx tools/recover-industrial.ts --check` : PASS, 10 000 lignes, 6 dépôts, dataHash inchangé `8ec5df0ed8499f7ca43936b4fbb09b9d99448fbf86859f5f9a4f7830e2d59083`.
- `npm run typecheck` : PASS. Le nouveau test importe l'utilitaire, désormais suivi transitivement par TypeScript.
- Probe indépendant en mémoire : chacun des quatre fichiers rendu absent puis changé, dans chacun des trois modes `--check`, `--init`, `--readback`. 24/24 refus attendus avant DB. Le hook de connexion PostgreSQL installé dans le probe a observé exactement zéro tentative de connexion. Aucun fichier candidat altéré.

Verdict du delta : aucun finding retenu. La limite antérieure concernant l'absence d'épinglage contexte/alias et la portée portefeuille seul de `--check` est levée par ce delta. La validation sémantique complète du profil d'affichage reste dans sa commande d'import ; ses octets exacts sont désormais vérifiés dès `--check`.

Les réserves PostgreSQL/Aiven, concurrence, navigateur et les deux échecs historiques de la sélection complémentaire restent inchangés : ils n'ont pas été rejoués ou réputés résolus par cette revalidation ciblée. Aucun appel externe, création de service, commit ou push.
