# Ce que le Harness doit apprendre de Physical Impact

22 octobre 2026. Version 1. Propositions candidates, non adoptées. Les constats renvoient au [post-mortem](HACKATHON-POSTMORTEM-2026-10-22.md) et à [sa carte de sources](SOURCE-MAP.md). Les gains attendus ne sont pas des gains déjà mesurés.

## Le diagnostic

Le Harness a su protéger plusieurs invariants difficiles : droits serveur, calcul déterministe, versions, sources attribuées, approbation séparée de l'effet, idempotence, reprise et conservation des premiers échecs. Ces acquis ont rendu possible une preuve locale assez riche. Il a moins bien fait converger le résultat vers une expérience unique, compréhensible et disponible sur le support final. Le dernier essai humain a découvert des problèmes de parcours après des annonces de complétude. [S07-S14]

Le problème n'est donc pas l'absence de méthode ou de design. Des méthodes, images, contrats et réceptions existaient déjà. Le défaut récurrent est le passage d'un niveau de preuve au suivant : unité reçue vers application assemblée, API correcte vers clic utilisable, scénario local vers démo publique, package préparé vers soumission attestée. Les enseignements ci-dessous cherchent à raccourcir ces passages, sans supprimer les contrôles qui ont évité des erreurs métier.

## Ce que les images permettent de critiquer

| Surface réellement vue | Observation | Interprétation bornée et critère utile |
| --- | --- | --- |
| Référence A et ancienne UI approuvée | Bureau dense à trois colonnes ; question générique avant le travail déjà préparé ; badge « Direct execution » malgré absence d'achat ou mouvement. | Le cadrage métier existait. L'entrée et le libellé rendaient l'état difficile à comprendre ; ce n'est pas un défaut de calcul. |
| Nouveau front public | Palette teal/crème cohérente, cartes plus aérées, navigation Overview/Actions/Watchtower ; compteurs de footprint et de travail à revoir. | Hiérarchie plus calme, mais nombre de lignes dans le contexte ne prouve pas leur utilisation dans le plan. Tester ce que le lecteur croit comprendre. |
| Accueil public actuel | Grand hero centré, accent vert, halo clair, illustration d'interface et cartes. | Grammaire SaaS familière ; risque de faible différenciation, jugement esthétique. Aucun de ces choix ne prouve une production par IA. Référence distinctive et lecteur neuf utiles. |
| Démo fraîche après action | Bandeau de résultat, étapes cochées et titre « Your response. Put into action. » ; achats programmés et offre brouillon explicités. | La correction d'état est aujourd'hui visible. Elle ne valide pas rétroactivement l'annonce faite avant l'essai humain négatif. |
| Liens de l'accueil actuel | « Try it live » mène à `/demo/`, « Live product » mène à `/live/` qui affiche Coming soon. | Risque de confusion de mode à tester ; observation actuelle, sans attribution d'effet sur le jury. |

Sources : captures historiques inspectées et réception actuelle S13-S14/S20. Les screenshots fullPage de l'audit présentaient des répétitions de tuiles ; ces répétitions ne sont pas attribuées au design de la page.

## L01. Fixer une démonstration centrale et payer chaque extension

**Problème observé, preuves.** Le mandat initial reprend un petit risque stock ; la vision s'élargit aux opportunités, au portefeuille 10k, au PDF et à l'exécution. La nouvelle composition frontend commence à 13 h 45 pour une soumission annoncée à 15 h. La démo garde d'abord huit palettes malgré la nouvelle promesse industrielle. Le gel prévu vers 14 h n'est pas respecté par ces extensions. [S04-S05, S09, S13-S14]

**Cause probable.** Les ajouts étaient utiles individuellement, mais leur coût cumulé de contrat, données, UI, revues, raccord et narration n'avait pas une contrepartie explicite dans le périmètre livré. Les traces établissent cette expansion, pas une mesure du temps imputable à chaque ajout. La vision reçue évoluait ; il ne s'agit pas de reprocher aux constructeurs de l'avoir suivie.

**Solution proposée, priorité P0.** Au kickoff : un utilisateur, une décision, cinq à huit étapes, une mesure et un support final. Chaque extension indique quel critère du concours elle sert et ce qu'elle retire ou reporte. Conserver un backlog dans le suivi existant ; après le gel, n'accepter que correction bloquante ou remplacement explicite de la tranche.

Gain attendu : moins de rework et une première répétition plus tôt. Coût : 15 à 20 minutes de cadrage proposées, puis quelques minutes par changement ; budgets à éprouver. Test : sur le prochain exercice de six heures, comparer le temps jusqu'à la première répétition complète, le nombre d'étapes changées après gel et les défauts échappés. Destination : `hackathon-bootstrap`, critères et arbitrages du mandat ; localement `BUILD-PLAN`/scénario propriétaire.

## L02. Partager les significations de DEMO et LIVE, pas seulement les types

**Problème observé, preuves.** Le même shell et ses adaptateurs existent déjà. Pourtant, quatre scénarios se côtoient : risque à 1 420 EUR ; Demo initiale à 1 620 EUR de contribution ; industriel connecté à 1 100 EUR ; Demo enrichie à 29 400 EUR. Le parseur UI refuse aussi 10 001 allocations réellement produites. [S08, S11, S13]

**Cause probable.** Les DTO communs ont limité la duplication de composants, mais n'ont pas imposé mêmes identités métier, unités, cardinalités et postconditions. Une belle image du futur ne constitue pas un contrat d'interaction.

**Solution proposée, P0.** Étendre le contrat existant avec un scénario versionné : société, révision, hypothèses, données, oracles, états et capacités. Les deux adaptateurs suivent la même machine d'états. Le mode garde sa provenance, ses IDs et ses reçus séparés. Quand les données diffèrent intentionnellement, la correspondance et la limite sont déclarées avant la capture. Aucun fallback silencieux vers un mock après échec LIVE.

Gain attendu : raccord progressif sans refaire le frontend, moins de faux états et de mauvaises comparaisons. Coût moyen : un petit corpus partagé et tests de contrat ; aucune nouvelle couche d'orchestration. Test : rejouer le scénario contre les deux adaptateurs, vérifier unités/chiffres et états finaux, plus 0, limite et limite+1 éléments. Pour une migration partielle, vérifier que la scène annonce exactement quelle opération est connectée. Destination : `docs/CONTRACTS`, adaptateurs UI existants ; recette générique dans `demo-package` et `erwan-product-ui`.

## L03. Recevoir la séquence jouée avant de dire « complet »

**Problème observé, preuves.** Première UI A et contrôles visuels présents ; annonce de parcours complet vers 15 h 04, puis essai humain négatif. Après exécution, le titre indique encore une réponse prête. Suggestions qui remplissent seulement le champ, échange quittant le dossier et lisibilité du résultat nécessitent correction. Dans le connecté, l'API est davantage éprouvée que les clics finaux. [S13-S14]

**Cause probable.** Les tests de composants, écrans et API ne portaient pas tous sur le parcours exact public depuis son état initial jusqu'à la conséquence visible. L'annonce a promu une vérification d'affichage en réception de séquence.

**Solution proposée, P0.** Une personne ou un lecteur neuf joue les gestes prévus sans instructions orales correctrices. À chaque étape : snapshot, geste sur élément observé, oracle de résultat, capture. Répéter après reset, puis après reload. Réserver la formule « parcours reçu » à cette version, ces données et ce navigateur. Les revues de code restent distinctes.

Gain attendu : découverte des défauts au moment où ils coûtent encore peu. Coût faible à moyen : une courte répétition à chaque raccord matériel. Test : le lecteur trouve le signal, comprend l'impact, choisit le plan, échange et retrouve le résultat ; consigner durée, erreurs et demandes d'aide. Cible candidate : zéro étape bloquée sur trois répétitions DEMO et une chaîne LIVE autorisée ; seuils de compréhension fixés avant l'essai. Destination : `erwan-product-ui`, `ce-test-browser` avec Aside en premier, et protocole `demo-package`.

## L04. Éprouver le support obligatoire avant les raffinements

**Problème observé, preuves.** Le brief reçu demande Aiven Runtime. Le produit utilise Aiven PostgreSQL et Modal, mais l'application reste locale ; `/live` est une page d'attente. L'autorisation de Runtime arrive après 15 h, et aucun déploiement Runtime n'est reçu avant l'arrêt. [S02, S16, S20]

**Cause probable.** La preuve du chemin imposé et la preuve fonctionnelle ont progressé séparément. Le coût d'accès, budget, publication et hébergement n'avait pas été résolu assez tôt pour servir de support à la démonstration intégrée. L'autorisation n'existait pas nécessairement plus tôt ; ne pas transformer la recommandation en permission historique.

**Solution proposée, P0.** Dès le kickoff, vérifier la règle et obtenir les accords applicables pour un minimum hébergé : page, API de santé, une lecture/écriture de données de test et version servie. Si cette voie bloque, traiter le blocage comme un risque de livraison visible et réduire les extensions qui en dépendent. Ne créer aucun service avant autorisation.

Gain attendu : découvrir le risque d'éligibilité et d'accès avant la dernière heure. Coût moyen, dépendant des droits ; renoncer provisoirement à une extension plutôt que promettre l'URL. Test : URL ouverte dans un contexte neuf, version identifiée, opération autorisée et relecture après reprise. Destination : `hackathon-bootstrap`, runbook de déploiement du projet et checklist de `demo-package`.

## L05. Recevoir un transfert de propriétaire avant le premier fichier concurrent

**Problème observé, preuves.** Le découpage intégration/données/agent/UI était explicite et quatre chats existaient. Un nouveau propriétaire du front apparaît ; le builder découvre App/styles/IndustrialDesk déjà modifiés. Le transfert du 14 h 15 préserve les snapshots et limite ensuite le builder aux adaptateurs. Le snapshot final prouvé diffère encore du checkout et du Git public. [S06, S13, S16]

**Cause probable.** L'identité du propriétaire et le périmètre de composition ont suivi le changement de vision après le début des écritures. Le checkout partagé rend un import, test ou hash sensible aux modifications d'autrui.

**Solution proposée, P1.** Conserver `OWNERSHIP` et READY, déjà utiles. Avant changement de propriétaire : nommer les chemins transférés, geler le dernier candidat, recevoir les hashes et retirer l'ancien mandat d'écriture. Pour chaque répétition, un seul manifeste relie source, données, URL, asset servi et état de QA. Un worktree n'isole pas les schémas DB ou services : préciser aussi ces frontières.

Gain attendu : moins de collision et de revalidation sur la mauvaise version. Coût faible, quelques champs dans les reçus existants. Test : deux lecteurs identifient le même propriétaire et la même version sans demander un autre chat ; une dérive de hash invalide seulement sa réception concernée. Destination : `OWNERSHIP`, workflow de réception et de reprise existant ; pas nouveau registre global.

## L06. Garder la preuve publique et la causalité métier séparées

**Problème observé, preuves.** Une annonce de capacité future ne justifie pas un retard demain. La synthèse en prose du rapport dit « no known exposure » pour les trois avis BOAMP réellement reçus : enrobés Calais, essais/mesures Nîmes et transport Guyane. Aucun signal public d'impact métier établi à ce checkpoint ; le plan vient des faits internes et du feu synthétiques. Les avis ne confirment ni incendie, ni dépendance fournisseur, ni commande CRM. Le moteur a dû recevoir des confirmations synthétiques indépendantes et une demande qualifiée préexistante. [S05, S07, S11]

**Cause probable.** Un événement sectoriel plausible et une entreprise fictive donnent facilement l'impression d'un lien réel. La recherche, le mapping et le scénario de démonstration répondent pourtant à trois questions différentes.

**Solution proposée, P1, invariant à conserver dès P0.** Pour chaque signal : entité/site, produit ou lot, date/horizon, dépendance interne attribuée, inconnues, confirmation nécessaire. Choisir une histoire démontrable avec ces faits avant d'ajouter plus de sources. Conserver l'oracle futur hors du contexte modèle et la nature synthétique visible dans le récit.

Gain attendu : décisions mieux fondées et narration plus courte. Coût faible à moyen : qualification ciblée, pas un nouveau collecteur. Test : cas de même secteur mais mauvaise entité, événement ancien, futur, feu de stock sans arrêt usine, demande non qualifiée. Aucun ne devient automatiquement risque commercial confirmé. Destination : `recherche-multisource` et frontières source/context du projet. Ce delta RSS/pertinence a déjà été appliqué localement vers 13 h 38 pendant le hackathon, avec huit fichiers relus, ancienne version conservée et politique d'invocation inchangée. La prochaine tâche est d'en évaluer l'application et le gain, pas de recréer la référence flux. Essai nouvel agent et gain causal restent NOT_RUN/non établis. [S21]

## L07. Auditer aussi les oracles et le transport des preuves

**Problème observé, preuves.** R1 attend cinq preuves quand trois sont réutilisables. R2 compare du JSON sérialisé dont l'ordre de clés a changé. Des checkpoints deviennent invalides après dérive d'une dépendance partagée. [S10, S19]

**Cause probable.** L'infrastructure de réception introduit ses propres hypothèses. Un test rouge peut signaler une mauvaise attente ; un hash correct ne prouve pas que le contenu utile a été lu, ni qu'il porte sur le bon objet.

**Solution proposée, P1.** Garder les premiers négatifs ; isoler défaut produit, défaut d'oracle et erreur de lecture. Comparer des identités et valeurs métier canonisées. Revalider les dépendances qui changent. Pendant cet audit, la lecture comprimée du CSV a aussi omis des lignes `NOT_RUN` ; la relecture native des 32 lignes a corrigé le dénominateur. Cet incident appartient à l'audit, pas à la journée de build. [S18]

Gain attendu : moins de fausses alertes et de clôtures indûment positives. Coût faible sur petits jeux de référence. Test : ordre de clés différent doit passer, valeur modifiée doit échouer ; sources exclues restent présentes dans l'historique ; le rapport conserve les onze perturbations industrielles `NOT_RUN`. Destination : méthode `audit-source` et tests de réception locaux, sans prétendre modifier lean-ctx ou le moteur d'exécution.

## L08. Produire une première vidéo avant d'avoir besoin de la vidéo finale

**Problème observé, preuves.** Les scripts et supports existent, mais vers 15 h 08 puis 15 h 14, Erwan demande des corrections en dix puis cinq minutes pour enregistrer. L'histoire industrielle doit encore être enrichie. Aucun export vidéo final n'a été reçu par l'audit. [S14, S17]

**Cause probable.** Le script préparé décrivait une cible et plusieurs versions ; la capture du vrai parcours n'était pas encore un livrable reçu avec la même version. L'outil vidéo seul n'aurait pas réparé des états faux.

**Solution proposée, P0.** Dès qu'un parcours de 30 à 45 secondes existe, le capturer et produire un export court lisible hors ligne. Puis étendre les scènes jusqu'à trois minutes. Le script final se corrige sur les captures réellement obtenues. Conserver MP4, transcript, sous-titres, version et reçu de lecture intégrale. Le pipeline détaillé figure dans vNext.

Gain attendu : détecter tôt le coût de narration et des captures, recapturer seulement la scène modifiée. Coût faible avec enregistrement et montage simples, moyen avec composition réutilisable. Test : trois captures après reset, puis remplacement d'une scène ; mesurer délai jusqu'au premier export et retouches. Destination : `demo-package/references/repo-and-media.md`, sans nouveau service permanent.

## L09. Composer les skills déjà présents avant d'en ajouter

**Problème observé, preuves.** Direction A, variantes, Figma, captures et micro-versions existaient. Le dernier défaut de démo est un problème d'acceptation de parcours. L'inventaire actuel retrouve déjà `ux-ui-visual-first`, `erwan-product-ui`, `motion-checks`, `demo-package` et `ce-test-browser`. Emil est déjà référencé dans `motion-checks`. Présence actuelle et invocation pendant le hackathon restent deux faits différents. [S13-S14, S21]

**Cause probable.** Le manque ressenti a été formulé « nouveau skill UX/UI », alors que plusieurs briques existent et que leur raccord au scénario reste à améliorer.

**Solution proposée, P1.** Relier intention, direction, parcours, états, capture et critique dans ces workflows. Utiliser les petites grilles Anthropic et Vercel comme compléments ciblés, versionnés, après test. Ne pas imposer une nouvelle bibliothèque pour changer l'apparence. L'esthétique, la compréhension et le fonctionnement ont trois verdicts séparés.

Gain attendu : plus de cohérence sans coût d'un nouveau système. Coût faible pour la recette, moyen pour sa vraie évaluation. Test : brief et contenu identiques, mêmes viewports, critique aveugle des captures, puis mesure de compréhension et défauts fonctionnels. Une préférence esthétique ne suffit pas à adopter. Destination : skills existants précités ; la DA Briques reste celle des rapports, pas celle du produit.

## L10. Mesurer le résultat livré et éprouver les pannes qui le menacent

**Problème observé, preuves.** Beaucoup de tests et revues, mais état final public connecté non reçu, onze perturbations industrielles non exécutées et panne réseau PG après QA. Coût consolidé et temps utilisateur inconnus. [S11, S15-S18]

**Cause probable.** Les métriques de construction sont plus faciles à produire que celles de livraison ou d'expérience. La reprise heureuse ne couvre pas toutes les déconnexions. La correction PG a été utile, mais n'a pas prouvé une coupure prolongée ou un COMMIT interrompu.

**Solution proposée, P1.** Ajouter quelques mesures au suivi existant : première tranche utilisable, première répétition, premier export, accès public, réussite complète, demandes d'aide, heures/retouches et coûts réellement disponibles. Garder les contrôles métier/sécurité nécessaires et choisir les tests de panne selon le chemin montré, sur des données isolées.

Gain attendu : arbitrages fondés sur l'effet réel et moins de surprises à la démo. Coût moyen ; aucune observabilité générale à bâtir pour un seul événement. Test : scénario lent, mauvais input, connexion interrompue, double commande et reprise ; vérifier état durable et absence de nouvel effet. Destination : protocole de `demo-package`, runner et tests du projet ; indicateurs de coût non disponibles conservés inconnus.

## Ce qui peut être parallélisé, et ce qui doit rester commun

La parallélisation existait déjà : données/veille, métier/agent et UI progressaient pendant que l'intégrateur construisait stockage, API et assemblage ; accès, PDF et préparation de présentation avançaient à côté. Le prochain gain est de produire la **même tranche démontrable** en parallèle, pas d'augmenter le nombre de chats. [S06, S19]

| Travail indépendant utile | Contrat commun requis | Réception qui referme la dépendance |
| --- | --- | --- |
| UI cible et adaptateur déterministe | États, nombres, erreurs, permissions, capacités | Scénario joué sur la composition finale |
| Calcul/stockage et tests métier | Identités, unités, révisions et effets | Même scénario passé dans le moteur |
| Texte, pitch et captures initiales | Utilisateur, bénéfice démontré et limites | Captures de la vraie version retenue |
| Accès et hébergement | Accord, budget, périmètre et environnement | URL/version et lecture-écriture reçues |
| Recherche et qualification | Questions publiques, entités et preuves manquantes | Signal retenu ou hypothèse explicitement rejetée |

## Revue contradictoire

Deux tracks peuvent être moins performants pour une équipe solo, une épreuve très courte ou un problème dont l'interaction dépend d'une capacité technique encore inconnue. Un beau DEMO peut consommer le temps de l'intégration obligatoire, verrouiller un faux modèle métier ou masquer les vraies latences. Si le jury exige une chaîne LIVE ou une capture continue, le montage d'une expérience cible ne remplace pas cette preuve.

Dans ces cas, préférer une seule tranche verticale, avec quelques états déterministes dans le même adaptateur de test. Réduire les écrans et préserver le temps de la preuve obligatoire. L'hypothèse dual-track mérite un essai comparatif ; elle ne devient pas la nouvelle règle d'ErwanOS par ce document.

## Matrice de priorités

| Priorité | Candidats | Résultat attendu avant le prochain hackathon |
| --- | --- | --- |
| P0 | L01, L02, L03, L04, L08 | Un scénario, un contrat sémantique, une répétition complète, support obligatoire éprouvé avec autorisation, premier export vidéo. |
| P1 | L05, L06, L07, L09, L10 | Transfert avant collision, causalité qualifiée, oracles sûrs, skills composés et mesures de livraison. Les invariants déjà requis restent obligatoires. |
| P2 | Raffinements vidéo et design facultatifs | Zooms avancés, musique, variantes de format, automatisation de critique seulement après preuve de gain et maintien de la fidélité. |

Sources : [S01-S21 et couverture](SOURCE-MAP.md), modules et reçus nommés dans le post-mortem, [recherche technique versionnée](TOOL-RESEARCH.md). Aucun nouveau skill, outil ou test prospectif n'a été activé par ces propositions.
