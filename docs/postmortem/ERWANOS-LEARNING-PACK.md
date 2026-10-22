# Pack candidat ErwanOS : apprendre de Physical Impact

22 octobre 2026. Version 1. Statut : candidats documentaires à évaluer. Destinataire : propriétaire ErwanOS et prochains hackathons. Aucun fichier ErwanOS, skill installé, mémoire globale, hook ou automatisation n'est modifié. Le projet Physical Impact demeure arrêté dans son mandat d'exécution ; ce pack n'autorise pas sa reprise.

## Le changement utile à éprouver

La construction a obtenu des garanties métier et une chaîne modèle/Aiven réelles, mais les preuves d'unités, d'API, de navigateur et du support final ne convergeaient pas assez tôt. Le dual-track proposé vise cette transition. Il doit conserver les contrôles qui ont empêché des décisions inadmissibles et mieux recevoir le résultat joué par un utilisateur. Ce n'est pas une conclusion sur les critères réels de victoire : aucun retour du jury ne permet cette attribution. [S07-S16]

Le support final désigné par Erwan est le site actuellement déployé sur [physical-impact.com](https://physical-impact.com). L'audit y observe une démo publique enrichie et une page `/live` encore en attente. Le formulaire reçu, une éventuelle vidéo et le parcours exact devant le jury restent inconnus. Le candidat ErwanOS doit conserver ces niveaux de preuve au lieu de les aplatir en « hackathon livré » ou « échec technique ». [S20]

## A. Local au projet

| Candidat | Problème, preuve et cause probable | Action proposée et gain attendu | Coût / priorité / test | Destination proposée |
| --- | --- | --- | --- | --- |
| A1. Capsule finale des surfaces | HEAD, runtime 99 pins, checkout et démo publique diffèrent ; quatre jeux économiques. Cause probable : versions et réceptions décalées. S01, S13, S16 | Conserver le tableau des surfaces, source exacte, données et limites. Retrouver sans demander un chat lequel a prouvé quoi. | Faible, P0 documentaire. Lecteur neuf retrouve la démo enrichie, le LIVE 1720/1100 et le correctif PG distinct sans les confondre. | Ce dossier ; liens depuis le suivi propriétaire, sans nouvelle registry |
| A2. Backlog produit encore ouvert | UI clicks connectés, onze perturbations, recalcul après action, plan historique, citation/UI PDF, Runtime non reçus. S11-S16, S18 | Garder les critères ouverts, sans relancer le produit. Si reprise ultérieure autorisée, choisir une tranche au lieu de déclarer la vision terminée. | Faible pour la note ; réalisation non chiffrée, P1 conditionnelle. Vérifier chaque critère sur un candidat futur exact. | STATUS et propriétaires existants lors d'une reprise autorisée |
| A3. Support réellement remis | Site final confirmé, mais MP4/reçu du formulaire et feedback jury manquants. S17, S20 | Ajouter les preuves si elles sont retrouvées ; garder leur date et version. Éviter une histoire rétrospective inventée. | Faible, P1. Un lien récupéré doit ouvrir l'artefact exact, pas seulement un dossier contenant un script. | Package submission existant et ERW-133 |

Ces actions de conservation ne modifient pas les fonctionnalités. Les demandes d'implémentation du backlog restent candidates et dépendent d'un mandat de reprise.

## B. Hackathon Harness

Les fiches L01-L10 de [HARNESS-LESSONS](HARNESS-LESSONS.md) portent les problèmes, preuves, causes, solutions, gains, coûts et tests détaillés. Les destinations ci-dessous proposent des deltas bornés aux méthodes déjà présentes.

| Candidat | Apprentissage à conserver | Gain et compromis | Priorité et évaluation | Récepteur proposé |
| --- | --- | --- | --- | --- |
| B1. Scénario et budget de changements | L01 : vision/portefeuille/UI s'élargissent peu avant l'échéance. Contrat clair au départ puis arbitrage explicite à chaque extension. | Répétition plus tôt ; peut réduire l'ambition visible. Coût faible de cadrage. | P0. Temps première répétition, changements après gel, défauts échappés ; aucune baseline horaire totale inventée. | `hackathon-bootstrap`, scénario et BUILD-PLAN existants |
| B2. Deux adaptateurs, une sémantique | L02 : types communs mais chiffres, états et limites divergent. | Évite un second front ; maintenir deux chemins et un oracle reste un coût moyen. | P0. Même scénario réussi/refusé, unités/états/capacités, borne+1, aucun fallback silencieux. | `demo-package` + `erwan-product-ui`, contrats du projet |
| B3. Répétition comme preuve de livraison | L03 : affichage reçu puis essai humain négatif. | Découvre tôt les défauts de séquence ; coût faible à moyen d'un lecteur neuf. | P0. Trois replays DEMO, une chaîne LIVE autorisée, compréhension sans aide, résultat après reload. | `demo-package`, `ce-test-browser`, Aside en premier |
| B4. Support obligatoire avant extension | L04 : Aiven DB n'est pas Aiven Runtime, `/live` reste en attente. | Réduit le risque d'accès/éligibilité ; dépend d'accords et peut retarder du polish. Coût moyen. | P0. URL/version, lecture-écriture test et reprise reçues dans les droits. | `hackathon-bootstrap` et runbook de déploiement existant |
| B5. Première vidéo courte | L08 : recording demandé dans l'urgence, artefact final non reçu. | Détecte le travail de narration et permet recapture de scène ; coût faible avec montage simple. | P0. Export 30-45 s puis 180 s, lecture intégrale/offline, erreur sélecteur et reprise de scène éprouvées. | `demo-package/references/repo-and-media.md` |
| B6. Composer les capacités visuelles | L09 : méthodes déjà présentes, Emil déjà adapté ; réception finale manquante. | Moins de doublons, mais aucun skill ne garantit le goût ou la compréhension. Coût faible pour recette, moyen pour évaluation. | P1. Comparer briefs et captures identiques ; esthétique/UX/fiabilité séparées. | `ux-ui-visual-first`, `erwan-product-ui`, `motion-checks` |

Le [workflow vNext](HACKATHON-HARNESS-VNEXT.md) donne rôles, cadence, contrats, outils et pipeline. Il n'ajoute aucun agent permanent. Playwright/Remotion et un seul des studios vidéo sont des options d'essai ; aucun n'a été installé ou intégré.

## C. ErwanOS global

| Pattern candidat | Preuve dans Physical Impact et cause à traiter | Adaptation, gain attendu et coût | Priorité / test | Destination possible, non modifiée |
| --- | --- | --- | --- | --- |
| C1. Une preuve garde son objet et sa version jusqu'au consumer | L05 : manifeste figé reçu, source courante différente ; transfert de front après chevauchement. | Réutiliser références/version/owner existants, avec source/données/URL/état de réception. Moins de relectures du mauvais objet, coût faible. | P1. Dérive d'une dépendance invalide la seule preuve concernée ; deux lecteurs retrouvent le même objet. | Contrat de références stables, reprise et `work-reconcile`. Applicable BSF, Glue, Sibelle selon leurs autorités. |
| C2. L'oracle et le lecteur sont aussi testables | L07 : R1/R2 faux négatifs ; omission de lignes par lecture comprimée pendant cet audit. | Comparer le sens canonique, conserver premier échec et dénominateur complet ; vérification native ciblée d'une preuve décisive. Réduit les faux verdicts, coût faible. | P1. Ordre JSON modifié accepté, valeur modifiée refusée ; toutes lignes NOT_RUN conservées dans une synthèse. | `audit-source`, `recherche-multisource`, évaluations de réception existantes |
| C3. Contexte utile ne signifie pas autorité | L06 et code serveur : source publique, confirmation synthétique, calcul et décision sont distincts. | Conserver provenance, rôle, révision et garde au consumer. Plus fiable que promouvoir un titre ou résumé en permission, coût moyen adapté au domaine. | P1, invariant obligatoire dans chaque projet. Source persuasive ou mémoire ancienne ne valide pas un plan périmé. | Méthodes de recherche et contrats projet ; pas politique stock universelle |
| C4. Réception du dernier effet visible | L03/L10 : API correcte, résultat UI faux ; reprise heureuse suivie d'une panne PG. | Tracer déclencheur, décision, effet, readback et présentation ; mesurer livraison et aide nécessaire. Coût moyen de tests ciblés. | P1. Injecter perte de retour, double commande, déconnexion, écran après reload ; aucun effet dupliqué ni succès supposé. | Recettes de livraison et tests métier de chaque projet |

Ces patterns ne justifient pas de copier le moteur de stock dans BSF ou Sibelle. La politique C1 accepte six règles exactes et une ligne ORD-B ; les données et permissions gardent leur autorité locale. La correspondance de mécanismes avec BSF/ErwanOS est établie dans le code et la préparation, pas une filiation ligne à ligne ou un gain causal mesuré. [S03, S07]

Un delta du Harness est déjà matérialisé : le 22 octobre à 13 h 38, le skill Codex local `recherche-multisource` a été mis à jour pour découvrir les flux et mieux qualifier la causalité métier. Reçu `LOCAL_CODEX_SKILL_UPDATED_AND_BYTE_VERIFIED`, manifeste `ef82b748f9ad6cde32e88dfc8e88fb00146fbea17a2d90f8171a2e43164fa2cc`, huit fichiers relus. L'ancien paquet est conservé ; distribution partagée, rechargement des chats existants, essai nouvel agent et gain causal non établis. C3 doit recevoir et évaluer ce delta existant, sans l'installer une seconde fois ni le présenter comme un simple futur projet. [S21]

## Expériences à créer avant adoption

| Évaluation candidate | Matériel et contrôle | Résultat à recevoir | État |
| --- | --- | --- | --- |
| E1. Dual-track vs tranche verticale | Même brief synthétique, scénario, données, temps, droits et barème ; ordre alterné pour limiter apprentissage | Temps première répétition, compréhension, défauts, effort/setup et livraison, avec limites d'échantillon | NOT_RUN |
| E2. Parité DEMO/LIVE | Une lecture, un calcul, décision, effet simulé et reload ; erreurs et stale | Mêmes significations/oracles, provenance séparée, aucune substitution de mode | NOT_RUN |
| E3. Skill composition frontend | Capacités actuelles d'abord, puis quelques règles externes épinglées ; mêmes captures/références | Critique aveugle, compréhension et fiabilité ; temps/coût des retouches | NOT_RUN |
| E4. Vidéo répétable | 30-45 s, trois runs, une scène modifiée ; capture simple vs un candidat | Export relisible, synchro/captions, retouches et coût total ; ensuite 180 s | NOT_RUN |
| E5. Réception froide | Sources brutes, point d'entrée normal, livrable sans briefing des conclusions attendues | Retrouvez version/owner/mode, limites et prochaines tâches sans oracle injecté | NOT_RUN pour adoption du workflow |

Une revue de ce pack vérifie sa cohérence ; elle ne remplace aucune de ces expériences. Une mémoire qui retrouve une observation ne prouve pas que l'agent apprend mieux, ni que l'utilisateur économise du temps. Ne pas mesurer l'amélioration par le nombre de skills, de chats, de captures ou de tests produits.

## Mode de transfert recommandé

Le propriétaire ErwanOS peut recevoir ce dossier et choisir un premier delta. Commencer par B1/B2/B3/B5 dans les skills existants ; conserver les noms et identités, les versions antérieures et l'autorité de chaque projet. Exécuter E1-E4 dans un bac autorisé, recevoir les résultats puis décider de l'adoption. Ne pas installer un nouveau skill général `hackathon-mode` avant d'avoir démontré une lacune qui ne tient pas dans les recettes existantes.

Le paquet fourni est documentaire, pas une mise à jour automatique des mémoires. Les autorisations de ce post-mortem couvrent les documents et la PR brouillon ; elles ne donnent pas permission de réactiver les services, lancer un événement, transmettre des messages à d'autres chats, ni modifier ErwanOS.

## Revue contradictoire et matrice de priorités

Une seule tranche verticale peut gagner lorsque le temps est court, l'équipe réduite, l'interaction dépend d'une capacité inconnue, ou le barème exige une intégration live. Deux tracks risquent de doubler l'effort, figer une fausse promesse ou faire passer le polish avant le critère obligatoire. Conserver cette possibilité dans E1 ; l'objectif est un meilleur résultat vérifiable, pas la victoire d'une méthode.

| Priorité | Périmètre | Critère de fin |
| --- | --- | --- |
| P0 | A1, B1-B5 | Scénario/version retrouvables, contrats communs, support obligatoire autorisé, répétition et premier film ; aucune confusion entre ce qui est simulé et connecté |
| P1 | A2-A3 conditionnels, B6, C1-C4 | Deltas reçus dans méthodes existantes après évaluations ; gain et coût mesurés au bon niveau |
| P2 | Caméra avancée, musique, formats marketing, critiques automatisées sophistiquées | Aucun ajout avant bénéfice démontré sur le pipeline simple |

Sources : [carte S01-S21](SOURCE-MAP.md), [reconstruction](HACKATHON-POSTMORTEM-2026-10-22.md), [fiches L01-L10](HARNESS-LESSONS.md), [workflow proposé](HACKATHON-HARNESS-VNEXT.md), [outils et révisions](TOOL-RESEARCH.md). Tout transfert/adoption et effet utilisateur futurs restent non établis.
