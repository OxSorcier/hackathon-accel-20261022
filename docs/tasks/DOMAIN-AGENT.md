# Mandat : métier et agents

Lis AGENTS.md, START-HERE.md, docs/HANDOFF.md, docs/OWNERSHIP.md et le contrat canonique de src/contracts/ quand disponible. Références détaillées : CONTRAT-AGENTIQUE.md et CONTEXT.md dans .preparation/. Lire les règles initiales de fixtures/company/ ; les oracles et événements futurs ne sont jamais une entrée modèle.

Construis dans src/domain/ et src/agent/ : calcul déterministe des couvertures, dates, quantités et coûts ; contexte scoped et manifeste ; outils validés ; boucle modèle/outils bornée ; proposition versionnée non exécutante ; récupération de mémoire attribuée. Les droits et la décision finale appartiennent au serveur, pas au modèle.

Une entrée non confirmée ne couvre pas B. ISO120 ne remplace pas ISO100. Un transfert ne peut casser B ou C. Une mutation pertinente invalide la possibilité d'approuver un ancien plan, même avant recalcul du worker. Les mémoires sont revalidées ; stockage seul ne vaut pas apprentissage.

Tu peux commencer fonctions pures et tests sans clé modèle. L'adaptateur réel attend un fournisseur/version et clé autorisés. Propose dépendances dans proposals/agent/ ; l'intégrateur possède package/lockfile et contrats. Pas de changements dans données/veille, UI ou serveur d'un autre rôle. Retour final avec fichiers, modèle réalisateur, tests réels, limites et hash dans proposals/agent/. Les revues finales sont coordonnées par l'intégrateur.
