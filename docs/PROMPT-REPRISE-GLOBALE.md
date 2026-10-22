# Reprendre Accel : société, entreprise cliente, données, agents et démonstration

22 octobre 2026. Prompt de reprise préparé à la demande d'Erwan. Les intentions ci-dessous proviennent de ses messages ; les états de construction sont un point de départ documentaire à rafraîchir. Ce prompt renvoie aux sources propriétaires et aux chantiers existants.

## Mandat

Reprends le projet dans `/Users/erwan/Projects/hackathon-accel-20261022`. Fais avancer un ensemble cohérent : vision de société, persona, entreprise cliente, données ERP/CRM, veille segmentée, connaissances durables, harness, application, site et démonstration du hackathon.

Commence par rapprocher les décisions reçues, les recherches, les propriétaires, les fichiers actuels et les preuves. Poursuis les travaux utiles déjà autorisés. Le résultat recherché est un produit démontrable et une présentation fidèle à son fonctionnement.

## 1. Reprendre les sources et les travaux existants

Lis les instructions du dépôt, puis :

- `/Users/erwan/Projects/hackathon-accel-20261022/START-HERE.md` : point d'entrée et sources à consulter.
- `/Users/erwan/Projects/hackathon-accel-20261022/docs/PRODUCT-VISION.md` : vision reçue, risques/opportunités/effets mixtes, écarts, critères A1 à A8 et projection de communiqué.
- `/Users/erwan/Projects/hackathon-accel-20261022/README.md` : présentation et fonctionnement décrit du produit.
- `/Users/erwan/Projects/hackathon-accel-20261022/docs/HANDOFF.md` : décisions, passation et limites.
- `/Users/erwan/Projects/hackathon-accel-20261022/docs/OWNERSHIP.md` et `/Users/erwan/Projects/hackathon-accel-20261022/docs/THREADS.json` : chemins et chats propriétaires.
- `/Users/erwan/Projects/hackathon-accel-20261022/docs/CONTRACTS.md`, `/Users/erwan/Projects/hackathon-accel-20261022/docs/BUILD-PLAN.md` et `/Users/erwan/Projects/hackathon-accel-20261022/docs/STATUS.md` : interfaces, réception et état actuel.
- `/Users/erwan/Projects/hackathon-accel-20261022/proposals/product/RELAY-RECEIPT.json` : réception de la vision par les constructeurs.
- `/Users/erwan/Projects/hackathon-accel-20261022/proposals/product/CHAIN-CHECKPOINT.json` : contrôle daté de la chaîne, à rapprocher des progrès suivants.
- `/Users/erwan/Projects/hackathon-accel-20261022/proposals/product/MEMOIRE-RECHERCHE-TRACES.md` : acquis, recherches, mémoire de l'entreprise et traces ; limites d'implémentation.
- `/Users/erwan/Projects/hackathon-accel-20261022/proposals/product/research-data-20261022/RECHERCHE-DATA-DELTA.md` : outils et sources réellement essayés, limites et exigences métier.
- `/Users/erwan/Projects/hackathon-accel-20261022/docs/brief-aside-20261022.md` : brief corrigé en version 2 et démonstration à la bonne échelle.

Retrouve les recherches complémentaires depuis ces références et les reçus du suivi existant ERW-133. Lis les versions utiles et conserve les limites historiques. La préparation réservée aux constructeurs ne doit pas être chargée dans le contexte produit.

Le checkout est partagé et actif. Rafraîchis son état avant toute modification ; respecte les propriétaires et les gels de modules. Une lecture ou un message reçu ne prouve pas une intégration. Réutilise les chats existants et les accords applicables ; aucune création de chat ou messagerie supplémentaire n'est autorisée par ce prompt.

## 2. Relier deux identités distinctes

**Notre société** développe une intelligence opérationnelle pour les entreprises dépendantes de stocks et de filières. Sa promesse est de transformer les changements du marché en décisions : protéger les engagements, saisir les opportunités et mobiliser les ressources au bon endroit. Le bois et les matériaux français sont le premier terrain ; l'expansion sectorielle reste à éprouver.

**L'entreprise cliente de démonstration** est une grande entreprise industrielle française, avec une activité principalement française et des relations européennes. Elle possède plusieurs sites et dépôts, de nombreuses références, fournisseurs, clients et grands chantiers. Précise sa place dans la filière : production, transformation, distribution ou combinaison documentée. Son ERP, son CRM et ses autres sources métier doivent correspondre à cette activité.

Le site public et le communiqué présentent notre société et son produit. Le contexte du modèle produit concerne l'entreprise cliente et ses données autorisées. La stratégie de notre société, les documents de construction et les réponses attendues des essais restent dans le dossier projet.

## 3. Définir le persona et l'identité exploitable de la cliente

Pars de la direction des opérations ou des achats, puis précise : utilisateur quotidien, décideur, acheteur, décisions récurrentes, tâches pénibles, outils, responsabilités, droits et critères de réussite. Distingue les hypothèses des éléments réellement observés auprès d'utilisateurs.

Définis le profil d'entreprise nécessaire au produit : identité et périmètre, activité, pays et régions, sites et rôles, produits et unités, fournisseurs et relations vérifiées, clients et chantiers, stocks, engagements, capacités, règles et priorités validées. Chaque élément utilisé doit avoir une origine, une date et une autorité identifiables.

Il faut pouvoir répondre : pourquoi cette information concerne cette entreprise, ce site, ce produit ou cet engagement ? Qu'est-ce qui permet cette conclusion, et qu'est-ce qui manque encore ?

Inscris les précisions reçues dans la source de vision courante, avec leur date et leurs conséquences, en respectant son propriétaire. Relie ensuite le persona et le profil client à cette source. Préserve l'historique et la distinction entre vision, proposition, réalisation et observation.

## 4. Faire découler données et connecteurs des décisions

Construis une matrice : question du persona → décision → données nécessaires → source et système maître → identités et relations → outil → preuve de réussite.

- ERP/WMS : produits, unités, lots si utiles, sites, stocks, réservations, achats, réceptions, mouvements, commandes, coûts et capacités.
- CRM : entreprises, contacts, besoins, opportunités, historique utile et engagements commerciaux.
- Chantiers : client, localisation, calendrier, produits requis, commandes et contraintes de livraison.
- Sources extérieures : fait publié, entité, lieu, produit, dates, provenance, fraîcheur, contradictions et confirmations.

Examine les pistes déjà repérées : WideWorldImporters, données de démonstration Odoo, Snowfakery et TPC-H via DuckDB. Elles sont documentées, sans import ni test dans ce projet au moment du repérage. Vérifie versions, conditions de réutilisation, cohérence et coût d'adaptation avant sélection. Aucun outil n'est imposé.

Propose une base réutilisée, une génération ou une combinaison qui représente notre métier. Les relations, réservations, dates, unités et capacités doivent rester cohérentes lorsque le volume augmente.

Sépare les preuves : fichiers inspirés d'un ERP ; import d'un export ERP ; lecture d'un ERP de démonstration par API ; intégration cliente réelle. Précise la même chose pour le CRM. Une table nommée CRM ne prouve pas un connecteur.

L'ERP/CRM garde son rôle de système maître lorsqu'il est réellement raccordé. Identifie ce que PostgreSQL Aiven conserve pour notre produit : copies attribuées, versions, preuves, dossiers, propositions, décisions et mémoire. Vérifie les besoins avant de proposer un changement d'infrastructure.

## 5. Adapter la veille à l'entreprise et à la décision

Définis des profils de veille versionnés selon les filières, produits, fournisseurs, sites, régions, pays, clients et décisions concernés. Pour chaque profil : objectif, sources, langues utiles, périmètre public, exclusions, fréquence, horizon, fraîcheur et condition d'alerte. Toute proposition d'extension de périmètre doit rester explicite et autorisée.

Relie les familles de signaux à une utilisation : incidents, capacités industrielles, disponibilité, transport, marchés et grands projets, demande, prix, concurrence et réglementation lorsque pertinente. Recherche et collecte ont des périmètres différents selon la question ; une liste générique de mots-clés ne suffit pas à établir l'exposition.

Conserve risque, opportunité, effet mixte, absence d'impact connu et besoin de vérification. Un article alarmant ne prouve pas notre retard ; une difficulté concurrente ne prouve pas une demande cliente. L'applicabilité d'une réglementation dépend d'éléments internes à vérifier.

Les requêtes web portent sur des sujets publics. Les stocks, commandes, contacts et relations commerciales confidentiels restent dans les outils internes autorisés.

## 6. Rendre ce contexte utilisable par le harness

Le harness doit organiser : identité serveur et droits, sélection du contexte pertinent, connaissances autorisées, recherche des acquis, outils typés de recherche et calcul, budgets, versions, mémoire, traces et validation humaine.

L'agent consulte ce qui est déjà connu, vérifie fraîcheur et pertinence, cherche les compléments nécessaires, rapproche les preuves et l'entreprise, puis prépare une proposition. Une nouvelle preuve ou une donnée interne modifiée peut provoquer une réévaluation.

Les données volumineuses restent dans les systèmes de données. Les outils filtrent, agrègent et calculent. Le modèle reçoit les faits utiles et leurs références ; il ne dispose pas d'un accès arbitraire au disque ou au SQL. Les droits et règles métier sont contrôlés côté serveur.

La mémoire doit distinguer faits, hypothèses, recherches, décisions et résultats observés, avec société, auteur, sources, dates, portée et conditions de validité. Une connaissance corrigée garde son historique et cesse d'être utilisée comme fait courant. Les traces documentent appels, résultats et consommation disponible, sans raisonnement privé ni secret.

## 7. Prouver le parcours et le changement d'échelle

Conserve un scénario principal : un événement extérieur concerne une dépendance du portefeuille ; l'agent enquête, établit ou limite le lien, identifie risques et opportunités, calcule les options et prépare une décision. Une confirmation change, l'ancienne proposition est refusée ou révisée, puis le résultat reste retrouvable après reprise.

La démo commence par l'entreprise et ses nombreux engagements, puis zoome sur un dossier explicable. L'échelle montrée doit exister dans les données. Les volumes, montants et conséquences économiques viennent des calculs.

Propose des paliers justifiés, par exemple 10 000, 100 000 puis 1 million de lignes pertinentes. Mesure les bonnes entités et les bons engagements retrouvés, faux rapprochements, contraintes respectées, cas sans impact, fraîcheur, latence, coût disponible, concurrence et reprise. Les gains de productivité exigent une référence observée. Aucun seuil n'est une performance acquise avant exécution.

Les scénarios futurs et résultats attendus restent réservés à l'opérateur des évaluations. Les données synthétiques, faits publics réels, replays et opérations directes gardent des étiquettes distinctes.

## 8. Préparer dès maintenant le récit, le site et le dossier jury

Réutilise la projection de communiqué existante et prépare un texte de lancement compréhensible : pour qui, quel problème, fonctionnement, valeur et première preuve. La projection de levée sert d'exercice de positionnement ; aucun financement, client ou gain n'est inventé.

Fais découler du même récit le README, le contenu du site, le pitch, la slide unique et le scénario du film de trois minutes. Prépare le contenu et les éléments locaux indépendants des accès. Respecte le propriétaire du site ou de l'interface avant de coder sur ses chemins ; conserve la direction reçue et les consignes de langue courantes.

Le site doit permettre de comprendre la société, l'utilisateur, le parcours, la couche de données, la preuve et l'accès à la démo. Distingue dans les supports les captures de la version fonctionnelle et les projections. Chaque affirmation de capacité ou de résultat doit renvoyer à sa preuve, sa version et son environnement.

Relie les cinq critères reçus du hackathon à un résultat observable : valeur produit, capacités de l'agent, rôle central des données, résultats mesurables, exécution et pitch. Les six livrables reçus sont nom, pitch en une phrase, MP4 de trois minutes, texte sur les données, fichier de preuve et lien vers une slide unique. Le déploiement cible est Aiven Runtime. Revalide les modalités depuis les sources officielles ou les reçus du projet avant une soumission.

Préparer le site et son déploiement ne prouve pas sa publication. Réutilise les accords explicites au périmètre reçu. Ce prompt n'autorise aucune nouvelle dépense, création de compte/service, publication, commit/push ou soumission externe.

## 9. Ordre de travail et réception

1. Donne un diagnostic bref et sourcé : vision reçue, hypothèses, état réel, écarts et propriétaires. Rafraîchis les preuves plutôt que reprendre les statuts ci-dessous tels quels.
2. Fixe le persona, le profil client et la matrice de données avec leurs hypothèses ouvertes ; réconcilie les deltas avec la source de vision et les contrats.
3. Prépare le jeu métier, la veille segmentée, les raccords et les évaluations sur les chemins autorisés. Avance en parallèle le communiqué, les textes du site et le scénario jury.
4. Reçois une première chaîne complète mesurée et révisable, puis les paliers de volume. Préserve les revues et validations nécessaires de la version finale.
5. Mets à jour les supports avec les résultats observés, puis accomplis les prochaines actions autorisées jusqu'au résultat attendu. Une livraison documentaire ne clôt pas l'intégration.

Point de départ à rafraîchir : vision et README rédigés ; lecture de la vision confirmée chez les quatre constructeurs ; socle métier et persistance testés séparément ; connexion PostgreSQL Aiven testée par le produit selon STATUS ; dossiers et chaîne agentique encore en réception ; mémoire de recherche et portefeuille industriel élargi non démontrés ; connecteurs ERP/CRM réels et tests de volume non attestés par les sources consultées.

La vision courante garde une seule source propriétaire. Les contrats partagés, la configuration, les dépendances et migrations restent à l'intégrateur. Relie les critères et preuves au suivi existant, sans nouveau registre concurrent. Respecte les fichiers actifs des autres constructeurs.

Le résultat final doit permettre d'expliquer, démontrer et mesurer comment cette entreprise cliente utilise les changements du monde extérieur et ses données internes pour décider. Pour chaque critère nécessaire, indique ce qui est implémenté, testé localement, testé sur Aiven ou NOT_RUN, ainsi que la prochaine action faisable et son propriétaire.
