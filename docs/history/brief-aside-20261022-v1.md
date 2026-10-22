# Notre projet Accel : un bureau de décisions pour le négoce

22 octobre 2026 · Version 1 · Brief pour avis extérieur · Construction en cours

**Aside, nous aimerions ton avis critique sur ce projet : sa valeur pour l'utilisateur, le rôle réel de l'agent et des données, et la démonstration la plus convaincante en trois minutes.** Le cas d'usage est déjà choisi et sa construction a commencé. Aide-nous à le rendre plus clair et plus probant avec des améliorations ciblées. Ce document te demande un avis ; il ne te demande ni de modifier le projet ni d'effectuer des actions sur des comptes.

## 1. Le produit en une phrase

Un agent aide le dirigeant d'un négoce de matériaux à repérer les commandes menacées quand une information change, comparer les solutions possibles et préparer une décision qu'il peut vérifier, corriger et approuver.

Le nom de marque reste à choisir. « Bureau de décisions » décrit le produit à ce stade.

## 2. Pour qui et pour quel problème ?

Paul dirige un négoce de matériaux avec plusieurs dépôts. Une livraison fournisseur change de date. Il doit déterminer quels chantiers sont exposés, regarder les stocks et réservations, comparer un transfert ou un achat de secours, puis vérifier le coût et les délais.

La difficulté : une solution qui dépanne un client peut compromettre un autre engagement. Un stock physiquement présent peut déjà être réservé ; un approvisionnement prévu peut ne pas être confirmé ; un produit voisin peut être interdit en substitution.

Notre hypothèse de valeur : réduire le temps passé à rapprocher ces informations et éviter les arbitrages faits sur des données incomplètes. Le travail manuel actuel et son temps réel restent à observer. L'intérêt du père d'Erwan est rapporté ; aucun pilote signé, client payant ou gain mesuré n'est établi.

## 3. Le cas de démonstration

Les données commerciales sont synthétiques et montrables publiquement : une société fictive, trois dépôts et deux chantiers.

| Élément | Situation initiale |
| --- | --- |
| Chantier A, Lille | Besoin de 8 palettes ISO100 le 23 octobre ; aucun stock local ; une réception fournisseur est attendue ce jour-là. |
| Chantier B, Centre | Besoin de 8 palettes ISO100 le 5 novembre ; les 8 palettes en stock sont entièrement réservées à B. |
| Dépôt Sud | 8 palettes ISO120 ; la substitution à ISO100 n'est pas autorisée. |
| Approvisionnement de Centre | Une réception est prévue mais non confirmée ; elle ne constitue pas une couverture acquise. |
| Transfert Centre vers Lille | Délai d'un jour, coût de 120 € ; il faut préserver la couverture de B et sa marge de sécurité de deux jours. |

Pendant la démo, une information fournisseur synthétique change, de manière explicite. L'agent doit revoir son évaluation avec cette nouvelle donnée, faire apparaître ce qui manque et actualiser sa proposition. Une ancienne proposition ne doit plus pouvoir être approuvée si sa base est périmée.

Le moment à rendre visible : **une donnée change, l'arbitrage change, et l'utilisateur peut comprendre pourquoi.** La bonne réponse peut aussi être une demande de confirmation ou le refus d'une option insuffisamment étayée.

## 4. Le parcours complet visé

1. Paul ouvre le contexte de son entreprise et pose une question, ou active une veille dont il confirme le sujet et la fréquence.
2. L'agent lit les engagements, stocks, réservations et informations disponibles, avec leurs sources et dates.
3. Il appelle un outil de calcul métier pour vérifier quantités, références, délais, coûts et contraintes.
4. Il compare les options, signale les inconnues et prépare une proposition enregistrée, liée à la version des données utilisée.
5. Paul inspecte les preuves et les conditions, demande une révision, approuve ou refuse. Le serveur recontrôle ses droits et les données courantes.
6. La décision et son contexte sont conservés pour la reprise. Un éventuel effet de démo est réalisé dans un simulateur explicite, puis relu. Aucun achat ou transfert logistique réel n'est revendiqué.

L'interface retenue suit la direction A : un bureau de décisions. Elle doit permettre de voir rapidement ce qui a changé, les commandes concernées, les options et la prochaine décision utile.

## 5. Ce qui rend l'agent et les données indispensables

L'agent choisit ses outils de lecture et de calcul, rassemble des éléments sourcés, vérifie les conditions d'une option et prépare une proposition révisable. Les calculs métier restent déterministes. Le modèle ne peut pas s'accorder des droits, modifier arbitrairement le stock ou approuver sa propre proposition.

| Données | Rôle dans le produit |
| --- | --- |
| Commandes, stocks, réservations, réceptions, devis | Déterminer l'exposition et la faisabilité réelle des options. |
| Politique de l'entreprise et droits | Contrôler substitutions, marges de sécurité et plafonds d'approbation. |
| Observations publiques datées | Apporter des signaux à qualifier ; conserver provenance, fraîcheur et limites de collecte. |
| Historique des évaluations, propositions et décisions | Expliquer un changement, refuser un plan périmé et reprendre après interruption. |
| Mémoire attribuée | Retrouver une décision antérieure et ses conditions, puis vérifier si elles s'appliquent encore. |

Une actualité publique sur une usine ne prouve pas le retard de notre fournisseur fictif. Les avis BOAMP sont des pistes d'opportunités à qualifier, sans lien commercial établi avec nos commandes. Les signaux publics et événements synthétiques doivent rester distingués à l'écran. La mémoire ne constitue pas un apprentissage dont l'efficacité serait déjà démontrée.

## 6. Architecture et état réellement reçu

Architecture retenue : React/Vite pour l'interface, Fastify/TypeScript dans une application Node pour le serveur et la veille, PostgreSQL comme source durable, un fournisseur de modèle avec appels d'outils bornés. Le déploiement cible est Aiven Runtime, avec PostgreSQL Aiven.

Circulation prévue : sources et données métier → collecte et validation côté serveur → PostgreSQL → contexte autorisé et outils de l'agent → proposition persistée → interface → décision humaine revalidée côté serveur → historique et mémoire.

Les secrets et données commerciales restent côté serveur. Le modèle reçoit uniquement les informations autorisées. Les documents de construction et les réponses attendues des essais restent hors de son contexte produit. Un redémarrage ne doit pas réinitialiser la démo.

État documentaire consulté le 22 octobre, sans relancer ici les tests du produit :

| Périmètre | Preuve et limite |
| --- | --- |
| Cadrage et contrats | Parcours et contrats C1 documentés ; code en construction dans le checkout partagé. |
| Données et veille | Le reçu du constructeur rapporte 14 tests réussis, dont 8 PostgreSQL locaux, ainsi que deux collectes publiques partielles avec reconnexion. Ces résultats restent limités à ce module et à son environnement local. |
| Métier et agent | Module et raccord documentés ; tests avec fournisseur scripté identifié comme test. Ce reçu ne prouve aucune inférence réelle. |
| Aiven | Le propriétaire des accès rapporte la création de PostgreSQL. Connexion de l'application et déploiement Runtime non attestés dans les sources consultées. |
| Parcours intégré | Réception finale, appel modèle réel, tests navigateur, mesure de valeur et soumission : NOT_RUN ou non reçus dans ce brief. |

Le tableau d'état global du dépôt n'intègre pas encore tous les reçus des constructeurs. Ce brief ne certifie donc pas la version assemblée. Les 50 USD d'essai Aiven sur 30 jours ont été constatés par le propriétaire des accès ; le solde courant n'est pas relu ici. Les 12 000 USD annoncés pour le gagnant constituent un prix distinct.

## 7. La preuve que nous voulons montrer

Comparer sur les mêmes cas une lecture naïve sans réservations ni mises à jour avec notre parcours utilisant les données courantes et les contrôles métier. Ajouter une référence manuelle mesurée si nous pouvons l'observer. Présenter la comparaison synthétique comme telle.

Mesures proposées, encore à exécuter : proportion de propositions respectant toutes les contraintes, détection des options invalides ou conditionnelles, refus d'une proposition périmée, temps jusqu'à une proposition vérifiable, latence et coût du run. Aucune amélioration chiffrée n'est annoncée avant les essais.

Déroulé proposé des trois minutes : 20 secondes pour Paul et son problème, 90 secondes de parcours avec changement de donnée, 40 secondes pour les sources et la preuve comparative, 30 secondes pour la valeur et les premiers utilisateurs. Les premiers contacts potentiels sont les dirigeants et responsables achats de négoces accessibles par le réseau d'Erwan ; leur disponibilité reste à confirmer.

## 8. Les contraintes du hackathon

Selon le brief transmis par Erwan : un produit fonctionnel, un agent qui utilise réellement les données, un parcours complet, un déploiement sur Aiven Runtime et un résultat mesuré. Les cinq critères pèsent chacun 20 % : valeur produit, capacités de l'agent, rôle des données, résultats mesurables, exécution et pitch.

Échéance transmise : jeudi 22 octobre 2026 à 15 h, heure de Paris, sur [BuilderBase](https://builderbase.com/track-dashboard/accel-ai-innovate-paris/overview). Six éléments : nom, pitch en une phrase, MP4 de trois minutes, texte sur la couche de données, fichier de preuve et lien accessible vers une seule slide. Pour le top 8, cette slide sera le seul support affiché sur scène. Ces modalités sont reprises du message d'Erwan, sans nouvelle vérification organisateur dans ce brief. Le réemploi du kit a été demandé par Erwan ; sa validation par l'organisateur n'est pas attestée.

## 9. Notre demande à Aside

1. **Valeur :** le problème de Paul est-il assez douloureux et le bénéfice assez concret pour donner envie d'essayer ? Quelle hypothèse faut-il vérifier en premier auprès d'un vrai utilisateur ?
2. **Agent :** à quel moment voit-on qu'il recherche, vérifie et adapte sa proposition ? Quel passage risque de paraître artificiel ou trop déterministe ?
3. **Données :** réservations, confirmations et historique ont-ils un rôle assez central ? Quelle donnée changeante offrirait la meilleure preuve sans inventer un lien fournisseur ?
4. **Démo :** quel enchaînement ferait comprendre la valeur en trois minutes ? Qu'enlèverais-tu pour garder un seul moment fort ?
5. **Mesure :** quelle comparaison minimale serait honnête, rapide à exécuter et convaincante pour le jury ?
6. **Priorités :** quels sont les trois risques majeurs, et les trois améliorations les plus utiles avant la soumission ?

Réponds avec ton verdict, les points solides, les faiblesses précises, trois recommandations classées par impact et un scénario de démo resserré. Distingue ce que tu peux juger sur ce document de ce qui nécessiterait d'utiliser l'application. Si tu proposes une autre direction, explique le problème précis qu'elle résout et le coût du changement à ce stade.

## Sources et portée

Synthèse du cadrage existant, préparée pour solliciter un avis. Ce n'est ni une nouvelle décision produit, ni un rapport de recette, ni une preuve de déploiement. Aucun avis d'Aside n'est encore reçu dans ce document.

- Message d'Erwan du 22 octobre 2026 : brief, critères, livrables et crédits.
- Sources du checkout consultées : `START-HERE.md`, `docs/HANDOFF.md`, `docs/OWNERSHIP.md`, `docs/CONTRACTS.md`, `docs/BUILD-PLAN.md`, `docs/STATUS.md`, `docs/ACCES-CREDITS.md`, `README.md`.
- Cas métier : `fixtures/company/dataset.json`. Les contraintes de marge sont également décrites dans `docs/HANDOFF.md`.
- Reçus lus, sans réexécution : `proposals/data/VERIFICATION.json`, `proposals/data/LIVE-COLLECTION-PG.json`, `proposals/agent/INTEGRATION.md`.
- Projet : [dépôt privé du hackathon](https://github.com/OxSorcier/hackathon-accel-20261022). Le lien nécessite un accès ; il ne prouve pas que le code local y est publié.

Mots de recherche : Accel, Paul, négoce de matériaux, bureau de décisions, réservations, Aiven, avis Aside.
