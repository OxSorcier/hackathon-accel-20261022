# Données et veille : raccord C1

Mandat local en cours, 22 octobre 2026. Contrat canonique reçu : `src/contracts/index.ts`, version C1.

Entrées : `createWatchRepository(sql)` dans `src/data/watch-repository.ts`, `createWatchEngine({ repository, collector })` dans `src/watch/engine.ts`, `createPublicCollector()` dans `src/watch/collector.ts`. Le SQL est injecté par le port C1 `SqlPort`. Aucun client ou secret n'est créé dans ces modules.

Le repository assure la création idempotente de veille, les occurrences manuelles et périodiques, la prise de bail atomique avec fence, la publication sous fence courant et les preuves dédupliquées. Le moteur expose `runOnce` pour le worker serveur. Chaque appel est attendu ; aucune transaction SQL n'est tenue pendant le réseau. Les routes et le démarrage du worker restent à l'intégrateur.

La migration candidate sera livrée dans `proposals/data/watch-schema.sql`, à recevoir dans `migrations/` par l'intégrateur. Les tables utilisent le préfixe `accel_watch_`. Aucune dépendance de production supplémentaire prévue.

Source directe : API publique BOAMP DILA, hôte fixe `www.boamp.fr`, chemin `/api/explore/v2.1/catalog/datasets/boamp/records`. Les autres URLs et redirections sont refusées. Les avis sont des pistes publiques, sans relation commerciale attestée avec les fournisseurs fictifs. Le sujet sortant est limité à une liste publique reçue, sans identifiant ni donnée commerciale.

## Raccord serveur

L'intégrateur applique `watch-schema.sql` comme migration contrôlée. Le module ne l'applique jamais au démarrage. Il injecte son `SqlPort` dans `createWatchRepository`, puis passe `{ repository, collector: createPublicCollector() }` à `createWatchEngine`.

La commande serveur authentifiée utilise `createWatch(actor, input, operationKey)`. Elle représente l'accord de créer la veille ; la fixture contient un brouillon non approuvé et ne crée aucune veille automatiquement. Les rôles direction et achats sont admis. L'acteur doit avoir été résolu côté serveur. Une clé réutilisée avec un autre acteur ou d'autres paramètres est refusée.

Le clic de contrôle appelle `enqueueManual(actor, watchId, operationKey)`. La boucle serveur appelle et attend `engine.runOnce(workerId)`, indépendamment du navigateur. Un tick réserve au plus vingt échéances et effectue au plus une collecte. Les échéances manquées restent dans le calendrier et sont rattrapées par ticks bornés. Une veille n'a jamais deux occurrences running simultanément. Un résultat error ou not_run termine l'occurrence en error ; un résultat partial reste completed avec son état de collecte partial lisible.

Le bail par défaut dure 60 secondes et la collecte est bornée à 15 secondes par le moteur. Le collecteur dispose aussi de son timeout réseau de 12 secondes. Une interruption avant publication laisse une occurrence reprenable au prochain bail. Les tentatives partagent l'identité de l'occurrence mais incrémentent son fence. `startedAt` décrit le démarrage de la tentative courante ; un résultat plus ancien est refusé. Les gardes de publication et renouvellement utilisent aussi `clock_timestamp()` côté PostgreSQL pour qu'une heure appelante périmée ne prolonge pas un bail expiré. Les lectures sont scoped par société et bornées. La connexion SQL, TLS, session HTTP, gestion des erreurs API et le démarrage/arrêt de la boucle sont sous la responsabilité de l'intégrateur.

## Vérifications disponibles

- `node_modules/.bin/vitest run tests/data tests/watch` : tests sans base ; les huit tests PostgreSQL sont explicitement sautés si `DATA_WATCH_TEST_DATABASE_URL` manque.
- Avec une base de test explicitement autorisée, définir `DATA_WATCH_TEST_DATABASE_URL` et exécuter la même commande. La suite crée et supprime son schéma aléatoire ; elle ne réinitialise aucune session produit.
- `node tests/watch/live-boamp.ts` : collecte directe publique bornée à deux avis. Un résultat partial est attendu quand le total dépasse cette borne. Ne pas utiliser ce script comme affirmation de fraîcheur ou d'exhaustivité.
- `LIVE-COLLECTION-PG.json` : première observation de deux collectes directes stockées dans un PostgreSQL 17.6 local temporaire, avec reconnexion entre les collectes et deux preuves dédupliquées.
- `LIVE-COLLECTION-PG-CYCLE2.json` : même vérification sur le code corrigé après revue, avec l'empreinte examinée et les résultats relus depuis PostgreSQL.

La requête BOAMP peut remonter des avis anciens et des homonymes, par exemple des appareils respiratoires isolants. Le collector ne confirme aucune perturbation d'usine, aucune date d'approvisionnement et aucun lien aux fournisseurs fictifs. Une pertinence métier doit être établie par le chemin produit avant une proposition.

Ce module publie les collectes et leurs preuves. Le déclenchement d'un calcul métier ou d'un run modèle à partir d'une occurrence terminée reste un raccord d'intégration : aucun accès aux modules d'un autre constructeur n'est ajouté ici.

Le reçu final `READY.json` fixera les fichiers, empreintes, contrôles et limites. Les tests de module ne prouvent pas Aiven, le démarrage de la boucle HTTP intégrée, le cycle de vie d'un serveur déployé ni une inférence modèle.
