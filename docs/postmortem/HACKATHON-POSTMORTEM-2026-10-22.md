# Ce qui s'est passé au hackathon Accel

22 octobre 2026. Physical Impact, anciennement AdaptOps et Accel decision desk. Version 1. Enquête factuelle, code produit en lecture seule. Heures en Europe/Paris, UTC+2 ce jour-là.

## Le résultat établi

Le projet a produit davantage qu'une maquette : un parcours local avec modèle et outils réels, calcul métier déterministe, approbation et persistance Aiven, puis un rapport industriel et une exécution explicitement simulée. Il a aussi produit un site public et un parcours de démonstration scénarisé. Ces surfaces n'étaient pas interchangeables. Leur rapprochement est resté incomplet au moment où la démo a été essayée en urgence. [S08, S11, S14]

Erwan a désigné, pendant cette enquête, **le site final actuellement déployé sur [physical-impact.com](https://physical-impact.com)** comme support final présenté ou soumis. L'accueil et la démo publique ont donc un rôle dans le résultat réel. Cette confirmation ne précise ni les clics joués devant le jury, ni le contenu du formulaire, ni une éventuelle vidéo. Son message d'arrêt rapporte que le projet n'a pas gagné. Aucun retour du jury, classement, score ou motif de non-sélection n'est établi. [S16, S20]

L'explication la mieux étayée est un défaut de convergence entre périmètre, données, interface, état connecté et présentation. L'hypothèse « nous aurions gagné avec un plus beau site » n'est pas démontrée. L'hypothèse « il n'y avait pas de frontend ni de design au départ » est contredite par les sources. [S04, S13, S14]

## Comment lire les preuves

**Fait observé par l'audit** : contenu source lu, état Git, pixels ou page consultés maintenant. **Fait consigné** : résultat historique dans un reçu ou une trace, attribué à sa version. **Fait rapporté** : déclaration humaine ou d'un agent. **Inférence** : explication compatible avec plusieurs faits, sans mesure causale. **Inconnu / NOT_RUN** : information absente ou essai non exécuté. Ces niveaux peuvent coexister pour une même fonction.

Les tests historiques n'ont pas été relancés pour ce post-mortem. Le produit arrêté n'a été ni redémarré, ni réinitialisé ; aucun appel modèle, SQL métier, collecte ou service externe n'a été lancé. Le contrôle actuel du site public reçoit son état actuel, pas une reconstruction de ce que voyait le jury plusieurs heures auparavant.

Base publique examinée : `8b9e609ad2ba5fafff5729355f75bc578b50585a`. L'inventaire daté de l'enquête compte 1 263 chemins suivis, dont 75 sous `src`, 65 sous `tests`, 993 sous `proposals` et 40 sous `design`. Il voit aussi 24 entrées suivies modifiées ou supprimées et 111 entrées non suivies, parfois des dossiers. Ces comptes ne mesurent ni temps de travail ni complexité utile. Les contenus locaux ultérieurs gardent leurs propres empreintes. [S01]

## Le problème initial et son élargissement

Paul dirige un négoce de matériaux. Une livraison retardée met une commande urgente A en danger. Déplacer huit palettes pour la couvrir peut prendre le stock réservé à B. La proposition de valeur initiale est de relier une information à l'exposition réelle de l'entreprise, calculer les options qui protègent ses engagements, puis laisser Paul décider. Le cas synthétique permet de vérifier cette contrainte sans données commerciales privées. [S03, S07]

Le kit v5 préparait ce travail : direction A, parcours, données ERP/CRM fictives, règles, variantes, oracles opérateur et principes de reprise. Son archive était vérifiée, mais elle ne contenait pas le produit prêt à lancer. Le dossier d'import indique explicitement `code_created=false`. Le mandat de départ demandait de reprendre ce kit, sans refaire le brainstorming. [S02, S03]

La vision s'élargit ensuite : société déjà connue, veille sectorielle et régionale, risques et opportunités, rapport préparé, plan commun achats/opérations/ventes, exécution approuvée et mémoire. Le portefeuille passe à 10 000 lignes de commande, six dépôts, 200 produits, 40 fournisseurs et 400 clients. S'ajoutent contexte industriel, demande CRM qualifiée, PDF Modal et nouvelles compositions d'interface. Ce sont des changements de portée explicites, pas des abandons inexpliqués. Leurs bénéfices pour la présentation n'ont pas été mesurés. [S05, S09, S12]

## Chronologie reconstituée

L'heure d'un reçu indique son checkpoint, pas nécessairement le début de l'activité. Les heures de Git sont des heures de commit. Les dates de modification des fichiers ne servent pas à inventer l'ordre de construction.

| Heure / période | Ce que les sources établissent | Niveau et réserve |
| --- | --- | --- |
| 18 au 21 octobre, puis nuit du 22 | Préparation du brief, directions visuelles, kit v1 à v5, données et protocoles. Tests de briques BSF/ErwanOS dans leurs versions sources. | Consigné. Préparation documentaire et essais de réemploi, pas produit Accel exécuté. S02-S03 |
| 22, 09 h 39 | Erwan demande de reprendre v5, créer le dossier produit et lancer les conversations. | Message humain horodaté. S19 |
| 09 h 48 | Brief déclaré inchangé ; accès Aiven encore à configurer. L'admissibilité du réemploi n'est pas confirmée par l'organisateur dans les sources reçues. | Rapporté, sans décision organisateur inventée. S03, S19 |
| 10 h 29 à 10 h 33 | Projet ouvert dans Codex ; lancement des quatre constructeurs. Début du frontend A à 10 h 33. | Traces de dispatch et de chat. La cible historique d'application à 10 h 15 était déjà dépassée au lancement. S04, S06, S13, S19 |
| 10 h 55 | Premier smoke local : PostgreSQL, BOAMP partiel, modèle non configuré, `needs_input`. | Consigné. Ce n'était pas encore la boucle modèle réelle. S08 |
| 10 h 58 à 11 h 12 | Premières unités données et métier reçues ; première interface A livrée, 21 tests annoncés et contrôle Aside. | Consigné par module, pas recette de la vision industrielle ultérieure. S07, S13 |
| 11 h 07 puis fin de matinée | Cadrage risques/opportunités et écarts A1-A8 documentés, transmis et reçus progressivement par les propriétaires. | Lecture du build à 11 h 07 et reçus de transmission ; réception distincte de l'intégration. S05 |
| 11 h 46 | Smoke Aiven réel, PostgreSQL 18.6 et TLS ; reconnexion avec état conservé. | Consigné. Base distante utilisée, application encore locale. S08 |
| Avant 12 h 39 | Parcours risque corrigé : vraie question générique, cinq appels modèle, 16 événements de trace, proposition à 1 420 EUR, approbation UI et reprise. Une mauvaise cible antérieure et un `needs_input` restent historiques. | Consigné sur le snapshot figé de 3001. Pas d'achat ni mouvement de stock. S08 |
| 12 h 05 à 13 h 03 | Intégration PDF demandée ; extraction Modal réelle, client Node puis cache Aiven isolé reçus séparément. | Consigné. La route application arrive plus tard ; citation modèle/UI restent distinctes. S12, S19 |
| 13 h 19 à 13 h 35 | Import industriel 10 000 lignes et réception de relecture. | Import explicite et lecture Aiven. Ce volume ne prouve pas encore l'agent à cette échelle. S09 |
| 13 h 33 à 14 h 27 | R1/R2 de mémoire : observations réutilisées dans un nouveau run, puis correction contrôlée de source et plan périmé. Des oracles erronés sont corrigés et conservés. | R1 modèle réel ; R2 fournisseur injecté sur Aiven. Aucun gain d'apprentissage mesuré. S10 |
| 13 h 38 à 13 h 41 | Retour de recherche demandé par Erwan et adaptation locale du skill `recherche-multisource` : découverte RSS/API/export et qualification date, entité, produit, dépendance. | Mise à jour locale appliquée, huit fichiers actifs relus et ancienne version conservée. Rechargement par d'autres chats, essai nouvel agent et gain causal non établis. S21 |
| 13 h 45 à 14 h 30 | Nouveau frontend Physical Impact, avec Overview, Watchtower, plan, actions et compagnie. Chevauchement de fichiers réconcilié à 14 h 15. Première publication de ce front vers 14 h 30. | Refonte tardive, pas premier frontend tardif. S13-S14 |
| 14 h 39 à 14 h 42 | Documents de soumission archivés dans Drive ; premier commit produit à 14 h 42 min 45 s, puis push. | Package préparé et code publié. Le reçu de soumission du formulaire reste `NOT_RUN`. S01, S17 |
| 14 h 52 | Première veille publique industrielle : trois avis BOAMP retenus, deux preuves Keenable incomplètes exclues de la projection. | Collecte réelle partielle. Aucun lien au feu synthétique ou à la demande CRM. S11 |
| 15 h 00 à 15 h 08 | Premier essai modèle sans rapport structuré ; second essai prépare le rapport. En parallèle, annonce de frontend « complet », essai humain négatif, puis demande de correction urgente pour enregistrer. | Deux suites contemporaines distinctes. Un rapport serveur prêt ne prouve pas le parcours de la démo publique. S11, S14 |
| 15 h 08 à 15 h 17 | Approbation d'abord HTTP 400, correction d'identifiant ; approbation et simulation réussissent ensuite par API. Six enregistrements durables. | Consigné sur 3003. Clics d'approbation/simulation dans le navigateur : NOT_RUN. S11 |
| 15 h 18 à 15 h 39 | Trois questions réelles après action ; correction du parser qui refusait 10 001 allocations ; reprise et affichage Aside reçus. Le script de démonstration continue d'être actualisé. | Lecture après action réelle. Recalcul courant après action refusé ; détails de plan historique incomplets. S11, S13, S17 |
| 15 h 38 | PDF via route application, Modal et Aiven : 17 pages, puis lecture cache sans nouvel appel. | Consigné. Ni citation PDF par le modèle ni parcours UI PDF final reçu. S12 |
| 20 h 05 à 20 h 08 | Vérification documentaire de reprise publique, puis second commit à 20 h 08 min 40 s. | Postérieur à la fenêtre annoncée du concours. 407 tests réussis et 123 ignorés consignés sans DB ; ne pas les attribuer au premier commit. S15 |
| 20 h 07 à 20 h 13 | Reprise du runtime après correction d'un client PostgreSQL ; même état durable. Erwan demande l'arrêt à 20 h 10 ; arrêt local reçu à 20 h 13. | Correctif dans snapshot séparé, pas dans le code public de 20 h 08. Arrêt volontaire, pas disparition des preuves. S16 |

L'enquête ne possède pas un relevé exhaustif des minutes actives par personne, agent ou outil. L'écart entre 09 h 39 et 10 h 33 est un intervalle de mise en place observé, pas 54 minutes entièrement perdues : récupération, permissions, ouverture manuelle du projet et lancement s'y trouvent, sans ventilation fiable. [S19]

## Architecture et choix réels

| Frontière | Implémentation lue | Ce que cela permet et limite |
| --- | --- | --- |
| UI | React 19.3.1, Vite, CSS, `App.tsx`, `IndustrialDesk.tsx`, adaptateurs HTTP et `physical-demo.ts` | Un chemin navigateur préparé et un chemin connecté. Leur sélection ne suffit pas à garantir mêmes chiffres, mêmes états ou mêmes interactions. |
| API et autorité | Fastify 5.12.7, Zod 4.6.7, `auth.ts`, `app.ts`, `validation.ts` | Le serveur résout acteur/société/rôle et contrôle Origin et révisions. Un ID fourni par le modèle ne donne aucun droit. |
| Persistance | pg 8.23.1, `PgStore`, 12 migrations, snapshots JSONB et tables d'événements/reçus | Transactions, verrous société, historique, idempotence et reprise. JSONB pratique pour le prototype, sans preuve d'un modèle ERP de production. |
| Modèle et outils | Adaptateurs HTTP OpenAI/Anthropic, `runner.ts`, `specialized-runner.ts` | Fournisseur réellement utilisé dans les reçus : alias `gpt-5.4-mini`. Aucun AI SDK installé. Six tours, douze outils, soixante secondes par défaut ; modèle servi non attesté indépendamment dans certains reçus. |
| Calcul métier | `domain/engine.ts`, `contract.ts`, `industrial.ts` | Calcul déterministe sur engagements, unités, réservations, dates et budget. Politique C1 liée à six règles exactes et à ORD-B. Le calcul industriel énumère des stratégies bornées ; ce n'est pas un optimiseur universel. |
| Veille et mémoire | `source-policy.ts`, collecteurs BOAMP/Keenable, engine, repositories, research-service | Sources publiques bornées, traces attribuées, versions, fraîcheur et invalidation. Une publication ne prouve pas un lien fournisseur/SKU ni une demande client. |
| Simulation | `industrial-runtime.ts`, `industrial-execution.ts` | Approbation serveur, plan recalculé, écriture atomique et reçu durable. Achats futurs, transfert programmé et offre brouillon. Aucun connecteur ERP/CRM de production. |
| PDF | Service Modal Python/pypdf, client, stockage, routes et knowledge port | Texte natif par pages, cache et provenance. Pas d'OCR ; extrait borné ; acquisition, lecture et citation modèle sont trois preuves différentes. |

Le worker et la veille vivent côté serveur, indépendamment de l'onglet. Le modèle reçoit une liste positive et des résultats bornés, sans lecture libre du disque ou SQL. Les 10 000 lignes sont calculées côté serveur ; elles ne sont pas toutes injectées dans le prompt. Les documents de construction et événements futurs restent hors du contexte produit jusqu'à une libération opérateur précise. Ces garanties sont des acquis à conserver. [S07]

Une boucle d'apprentissage du Harness a aussi été appliquée pendant l'événement : la recherche a reconnu le manque de découverte explicite des flux et précisé les garde-fous de pertinence métier dans le skill local existant. Ce changement documentaire installé n'ajoutait ni scraper, ni feed produit, ni scheduler. Il constitue un apprentissage matérialisé, avec comportement nouveau-agent et efficacité encore non mesurés. Le post-mortem doit en partir, sans proposer de recréer le même delta. [S21]

### Modèles, outils et skills effectivement tracés

| Usage | Preuve positive d'utilisation | Limite |
| --- | --- | --- |
| Construction des unités | READY données et UI déclarent `gpt-6.1-sol` ; REVIEWS intégration indique ce modèle configuré, effort xhigh | Métadonnée de session ou modèle demandé, identité effectivement servie non attestée indépendamment. Pas attribution mesurée de productivité au modèle. |
| Contre-revue et cadrage | Reçus de revues et appels de sous-agents distincts : contre-revue Sol, revue/cadrage `gpt-6-astra`, contextes neufs | Verdict sur code exact et corrections utiles, pas preuve qu'Astra a amélioré le résultat du concours ni de son identité backend servie. |
| Agent produit | Runs réels OpenAI/outils du risque et de l'industrie, alias configuré `gpt-5.4-mini` | Ne pas confondre modèle du produit et agents qui construisent le produit. Certaines identités servies non enregistrées. |
| UI initiale et QA | Traces de lecture `erwan-product-ui`, `ux-ui-visual-first`, `ce-work`, `ce-test-browser`, `erwan-internal-review`, `erwan-ticket-delivery`, puis Aside et captures | Invocation/lecture attestée, conformité à chaque règle et réussite finale non automatiques. |
| Refonte, visuels et correction | Traces du front : `ce-work`, `ce-simplify-code`, `ce-code-review`, skill Vercel CLI ; `ce-debug` après retour humain ; `imagegen` pour variantes ; opérations Figma et pixels reçus | Image ou flow Figma distinct de code utilisable ; certaines variantes restent propositions. |
| Présentation et recherche | `work-reconcile`, `demo-package`, Briques, PDF et Drive lus dans les chats concernés ; `recherche-multisource` utilisé puis corrigé localement | Skill packaging invoqué sans preuve de film final reçu. Playwright recording, Remotion et studios vidéo ne sont pas attestés dans les traces de build lues. |
| Outils d'exécution | Commandes TypeScript/build/Vitest, PostgreSQL local/Aiven, commandes de gel/hash, Aside, CLI publication et connecteurs de documents dans les traces | Ces usages appartiennent à leurs droits et versions historiques. Aucun nouvel usage fournisseur par cet audit. |

Sources positives : `proposals/data/READY.json` champs implementationModel/modelEvidence, `proposals/ui/READY.json` champs realizationModelRequested/servedModel, `proposals/integration/REVIEWS.json` et arguments d'outils dans les tours S13-S14/S19. Cette matrice est une réception ciblée des usages retrouvés, pas un inventaire exhaustif de chaque invocation ni un relevé de facturation.

## Trois états à ne pas fusionner

| Surface | Établi par les sources | Ce qui manque pour la transformer en preuve plus large |
| --- | --- | --- |
| Risque historique 3001 | Source publique, confirmation interne fictive séparée, modèle réel, calcul, approbation dans Aside, Aiven et reprise ; 173 tests sur sa source figée. | Généralisation industrielle, exécution métier et déploiement public. |
| Industriel connecté 3003 | 10 000 engagements protégés, dépense 1 720 EUR, contribution potentielle 1 100 EUR, rapport réel, approbation et simulation API, six reçus, questions, reprise et lecture UI. | Clics initiaux de décision/simulation dans l'UI, recalcul après action, recette complète des perturbations, runtime public. |
| Site public et `/demo` | Support final désigné par Erwan ; UI scénarisée, réponses préparées et persistance navigateur ; versions publiées et corrections de recording. | État durable Aiven et appels réels ne se déduisent pas de ces écrans. Même contrat de forme ne garantit pas un même scénario métier. |

Le comparatif du petit cas oppose le transfert à 120 EUR qui laisse B sans huit palettes et l'achat à 1 420 EUR qui protège A et B. Ce n'est ni 1 300 EUR économisés, ni une ablation LLM sans données. Les résultats industriels et les chiffres de la démo scénarisée constituent encore d'autres jeux. Aucun revenu réalisé ni temps utilisateur économisé n'est mesuré. [S08-S11, S13, S17]

Un résultat négatif compte particulièrement : la synthèse en prose du rapport industriel réel dit « no known exposure » pour les trois avis publics. Ils concernent des enrobés à Calais, des essais/mesures à Nîmes et du transport routier en Guyane, sans exposition bois/panneaux/isolation établie. À ce checkpoint, la collecte réelle n'a donc fourni aucun signal d'impact métier établi. Le plan utile vient des faits internes et du feu synthétiques libérés séparément. Cela limite la preuve de valeur de la chaîne publique, même si l'agent a correctement refusé de fabriquer un lien. [S11]

## Incidents, corrections et travail répété

| Incident observé | Effet concret | Correction / limite reçue |
| --- | --- | --- |
| Mauvaise cible d'exposition et ancien run `needs_input` | Un résultat technique ne portait pas correctement la décision A attendue. | Correction, revues et QA du parcours générique ; ancien négatif conservé. S08 |
| Course de création de veille | Collision de clé primaire sous appels concurrents. | Sérialisation/verrou reçu et tests ciblés. Pas benchmark Aiven de charge. S07-S08 |
| R1 attendait cinq preuves réutilisables, dont deux snippets non admissibles | Faux échec de réception. | Oracle corrigé à trois observations Fetch réutilisables ; cinq sources brutes restent conservées. S10 |
| Comparaison JSONB R2 sensible à l'ordre de clés, puis champ de validation absent | Répétition de vérifications et correction de l'oracle/finalizer. | Comparaison sémantique et champs précis ; R2 reste injecté. S10 |
| Premier agent industriel ne préparant pas le rapport | Calcul correct mais fin `REPORT_NOT_PREPARED` ; pas de dossier révisable. | Nouvelle politique de consigne et deuxième essai réel, premier coût en appels conservé. S11 |
| Contrat HTTP refusant une référence réellement produite | Rapport déjà prêt, décision HTTP 400. | Boundary corrigée, sans rappeler le modèle ni libérer de nouveau l'événement. S11 |
| Parser UI limité à 10 000 allocations, sortie réelle à 10 001 | API et simulation reçues, navigateur bloqué. | Limite corrigée et tests de parser ; preuve de lecture UI ultérieure. S13 |
| Nouveau front sur fichiers déjà possédés par le builder | Risque concret de deux fronts et de preuves sur des octets différents. | Transfert de composition reçu à 14 h 15 ; builder recentré sur adaptateurs. S06, S13 |
| Démo annonçant encore une réponse prête après exécution | L'état du parcours et la narration ne correspondaient pas à l'action jouée. | Correction urgente du scénario/recording après essai humain négatif. S14 |
| Erreur réseau sur client PostgreSQL emprunté | Processus 3003 arrêté malgré des tests antérieurs réussis. | Listener permanent par client, deux pannes de sessions propres éprouvées et revues. Coupure prolongée / COMMIT interrompu non éprouvés. S16 |

Les réceptions, relectures et recalculs ont parfois révélé des défauts différents ; leur répétition n'est donc pas entièrement du gaspillage. En revanche, tester plusieurs versions puis découvrir le même écart de scénario dans un autre chat a un coût de coordination plausible. Les sources ne permettent pas de le convertir en heures ni d'accuser un outil ou modèle unique.

## Démo, esthétique et expérience

La direction A existait avant le build ; des images A/B/C et plusieurs explorations ultérieures sont conservées. L'interface initiale a été testée dans Aside. La dernière expérience a reçu captures, tests de parseurs et vérifications de composants. Il serait faux d'écrire « aucun test visuel ». Il serait tout aussi faux d'en déduire un parcours final utilisable : l'essai humain vers 15 h 05 signale précisément le contraire. [S13-S14]

Les symptômes établis concernent surtout la hiérarchie du travail préparé, des libellés ambigus, l'état après action et le passage entre surfaces. Le qualificatif esthétique « AI slop » reste un jugement : une interface soignée peut être générique ou déroutante ; un parseur fiable ne garantit ni distinction visuelle ni bonne UX. La critique des pixels et les retours humains sont détaillés dans les enseignements, sans score esthétique inventé.

Le pitch, les scripts anglais, one-pager et documents de preuve existent. Aucun fichier MP4/MOV/WebM de la démo finale n'a été retrouvé dans le périmètre local inventorié, hors dépendances et préparation. Cela ne prouve pas qu'Erwan n'a rien enregistré ailleurs. Aucun replay vidéo final n'a pu être reçu. [S17]

## État final et inconnues utiles

L'historique local contient deux commits, sans branche d'abandon retrouvée ni réécriture dans le reflog consulté : première publication à 14 h 42, reprise publique à 20 h 08. La première importe 1 216 fichiers, largement des dossiers/preuves ; ce n'est pas le début du code. Aucun ancien PR ou issue GitHub, aucune exécution Actions n'a été renvoyé par les requêtes d'enquête ; Discussions est désactivé. Cela borne ces surfaces, pas les conversations Codex et le suivi Linear, beaucoup plus riches. [S01, S18]

Le dernier runtime figé compte 99 fichiers au digest `2c9624220f05f6b9c4f777220beb7a37e748887fe101182c10ac740b436df4c4`. Leurs 99 empreintes ont été revérifiées pendant l'audit. Quinze chemins diffèrent du checkout courant, notamment le correctif PG. Le collector sectoriel ultérieur est aussi un candidat distinct. Déclarer « HEAD est le dernier live testé » serait incorrect. [S16]

Les traces établissent un site public, Aiven PostgreSQL et Modal, mais pas le déploiement de l'application sur Aiven Runtime ni la réception publique du backend `/live`. Le brief reçu demandait pourtant Runtime. L'autorisation tardive de le créer ne prouve pas sa réalisation. Les services et activités ont ensuite été arrêtés ou mis en pause selon leurs propriétaires ; cet audit ne les réactive pas. [S02, S16, S20]

Restent inconnus : reçu de soumission, version exacte du site servie à chaque instant du jury, parcours joué, durée et fichier vidéo, audience de la démo, feedback du jury, coût consolidé des agents et fournisseurs, heures actives et répartition réelle de l'effort. Le non-gain rapporté ne permet pas d'en attribuer la cause à ces éléments. La comparaison prospective proposée dans vNext doit mesurer la compréhension et la livraison, en plus de la qualité du code.

## Sources et suite

La [carte des sources](SOURCE-MAP.md) relie S01-S21 aux fichiers, symboles, dates et limites. Sources décisives : `docs/BUILD-PLAN.md`, `docs/OWNERSHIP.md`, `docs/PRODUCT-VISION.md`, reçus `FINAL-UI-FLOW`, `FINAL-PREVIEW-RESTART`, `INDUSTRIAL-RUNTIME-3003`, `CONNECTED-RESTART-v8-3003`, `HUMAN-STOP-RECEIPT`, chats UI/front/vision/accès, suivi [ERW-133](https://linear.app/briques/issue/ERW-133) et confirmation d'Erwan pendant l'enquête.

Lire ensuite [les problèmes et leurs remèdes testables](HARNESS-LESSONS.md), [la proposition de workflow](HACKATHON-HARNESS-VNEXT.md) et [les candidats à transmettre à ErwanOS](ERWANOS-LEARNING-PACK.md). Ces propositions n'activent aucun skill, agent, automatisation ou changement produit.
