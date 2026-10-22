# Mandat : données et veille

Lis AGENTS.md, START-HERE.md, docs/HANDOFF.md, docs/OWNERSHIP.md et le contrat canonique publié dans src/contracts/ quand disponible. Réutilise la fixture initiale CO-DEMO pour les tests de stockage, sans lire les futurs événements dans le runtime.

Construis dans src/data/ et src/watch/ : lecture/écriture PostgreSQL par les ports reçus, collecte d'une source publique directe autorisée, normalisation et provenance, déduplication, calendrier durable, occurrences, baux/fence et reprise. Manuel et périodique partagent le moteur ; navigateur fermé ne stoppe pas le travail. Ne tenir aucune transaction pendant réseau/modèle. La réponse de chaque source distingue error, partial, empty et not_run.

Avant le contrat canonique, tu peux préparer fonctions pures, tests et propositions dans ton périmètre ; attends le contrat reçu pour les imports partagés. Propose SQL et dépendances dans proposals/data/ ; l'intégrateur possède migrations et lockfile. Pas de modifications dans les chemins agent, UI ou serveur d'un autre rôle.

Tests utiles : doublon, source en erreur, collecte partielle, réveil concurrent, bail expiré et reprise. Stockage en mémoire de test est étiqueté ; il ne prouve pas PostgreSQL. Aucun scraping illimité ni API payante sans accès et budget autorisés. Retour final avec fichiers, modèle réalisateur, preuves, limites et hash du périmètre dans proposals/data/. Les revues finales sont coordonnées par l'intégrateur.
