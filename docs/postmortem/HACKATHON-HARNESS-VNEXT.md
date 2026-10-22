# Hackathon Harness vNext : deux tracks, une expérience reçue

22 octobre 2026. Version 1. Proposition à tester, non adoptée. Aucun produit, skill, agent ou système ErwanOS n'est modifié par ce document. Origine : enseignements L01-L10 du [retour Physical Impact](HARNESS-LESSONS.md).

## La décision proposée

Tester deux tracks dès le kickoff : **Experience / Demo** et **Live / Engine**, sur un scénario et des contrats communs. Conserver un seul frontend, ses composants et ses états. Donner à chaque track une preuve propre, puis recevoir leur raccord à intervalles courts. Le but est d'obtenir tôt une expérience qui se comprend et un moteur qui prouve sa valeur, sans attendre la dernière heure pour les confronter.

Physical Impact possédait déjà un shell commun avec adaptateurs DEMO et HTTP. L'expérience suggère de renforcer ce mécanisme plutôt que de créer deux applications : les types étaient partagés, mais les données, chiffres et parcours avaient divergé. Le dual-track n'est pas une découverte ex nihilo ; c'est une hypothèse sur **le démarrage, la discipline de contrat et la réception** de ces deux chemins. [S13-S14]

Le récit central reste : Paul connaît ses engagements ; un signal change une dépendance ; il comprend l'impact, compare un plan, décide et retrouve le résultat. Le volume 10k, la veille, le PDF et la mémoire n'apparaissent que s'ils rendent cette décision plus convaincante et démontrable. Ils ne deviennent pas tous des fonctionnalités obligatoires parce qu'un sponsor les propose. [S02, S05, S21]

## Responsabilités et sorties

| Travail | Track A : Experience / Demo | Track B : Live / Engine | Réception commune |
| --- | --- | --- | --- |
| Question | Que doit comprendre et faire Paul en trois minutes ? | Quelle opération réelle et mesurée rend la décision meilleure ? | Un scénario reçu et la preuve attendue pour chaque étape |
| Production initiale | Direction reçue, écrans vrais contenus, adaptateur déterministe, états d'erreur et résultat | Plus petite tranche API/modèle/calcul/persistance, puis hébergement exigé et autorisé | Même contrat, données identifiées, unités et versions |
| Qualité | Hiérarchie, compréhension, responsive, interactions, répétition et première capture | Validation, droits, concurrence, erreurs, persistance, latence et observabilité utiles | Parcours joué de bout en bout, source exacte servie |
| Sortie finale | DEMO reproductible, transcript, film et captures | LIVE connecté, preuves et limites | Package fidèle aux deux et reçu de livraison |

Les tracks sont des responsabilités, pas deux équipes ou deux nouveaux agents obligatoires. Avec quatre constructeurs, l'UI et la préparation de présentation alimentent A ; données/veille et métier/agent alimentent B ; l'intégrateur possède les contrats et le raccord. Un binôme peut porter les deux. En solo, privilégier une seule tranche verticale et des états de test dans le même code.

## Contrat minimal avant les écritures indépendantes

Réutiliser les contrats TypeScript et reçus du projet. Un court document de scénario suffit ; ne pas créer un nouveau framework. Il décrit les éléments suivants et un exemple réussi plus un exemple refusé.

| Élément | Exemple Physical Impact et garde |
| --- | --- |
| Identité | Société, acteur, rôle et révision résolus côté serveur ; noms lisibles séparés des IDs. DEMO possède ses propres IDs. |
| Données | Source, hash/version, synthétique/public/réel, date de collecte et date d'événement, inconnues ; futur opérateur exclu du contexte initial. |
| Quantités | SKU, unité, dépôt, réservation, dates, devise et champs cents explicites. Zéro et inconnu restent distincts. |
| États | Initial, signal reçu, impact à qualifier, plan préparé, attente de décision, approuvé, effet demandé, appliqué en simulation, échec/incertain, périmé. |
| Actions | Entrée, rôle, précondition, révision attendue, clé d'idempotence, résultat et résultat après reload. Une suggestion « envoyer » doit réellement envoyer la question. |
| Capacités | Disponible, désactivée et raison. Un écran ne propose pas une action non raccordée. Pas de simulation cachée après timeout LIVE. |
| Cardinalités | Vide, courant et borne+1. Le plan à 10 001 allocations est un cas réel à conserver, sans gonfler toutes les listes dans le prompt. |
| Parité | Même scénario logique dans les deux adaptateurs. Si LIVE ne couvre qu'une partie, correspondance explicite et étapes non connectées visibles. |
| Fin | Titre, compteur, CTA, reçus et conséquence changent ensemble. Achat programmé ne signifie pas stock reçu ; offre brouillon ne signifie pas vente. |

Le modèle ne choisit ni autorisation ni valeur finale de stock. Le calcul complet reste côté serveur, la projection modèle reste bornée. Un replay n'efface pas un état réel ; reset réservé à des données de démonstration isolées et autorisées.

## Raccord progressif

1. A construit contre l'adaptateur déterministe du scénario reçu. B implémente la même frontière et ses validations. Les interfaces n'attendent pas la disponibilité des fournisseurs pour montrer les états.
2. Premier raccord sur une lecture, puis calcul/proposition, décision et reprise. À chaque étape, les capacités indiquent ce qui est reçu. Conserver le même composant de présentation.
3. Exécuter les mêmes assertions de scénario contre les adaptateurs, puis le parcours complet dans le navigateur. Comparer signification, unités et résultat, pas les IDs de runs qui doivent rester distincts.
4. Figer un checkpoint source/données/contrats/URL. Toute modification matérielle invalide sa preuve concernée. Le dernier bundle de démonstration peut rester disponible pendant la suite, mais son statut ne change pas.
5. Avant livraison, le mode DEMO se répète sans réseau depuis son état initial. Le mode LIVE annonce clairement ses opérations réelles et leurs limites. Jamais de routage `/live` vers un scénario préparé pour masquer une indisponibilité.

Une légende courte dans la démonstration suffit, avec détails accessibles : société de démonstration, opération simulée, source réelle, état durable reçu. Elle ne doit pas transformer chaque écran en rapport technique. La transparence sur la nature des opérations reste compatible avec une narration centrée sur le bénéfice utilisateur.

## Cadence candidate pour un événement de six heures

Ces budgets servent de garde de livraison, pas de norme déjà validée. Les horaires officiels, les droits et les gates de code du projet priment. L'exemple suppose que la soumission ferme à T+6 h ; le 22 octobre, l'heure technique exacte n'était pas attestée.

| Échéance proposée | Résultat observable | Arbitrage si absent |
| --- | --- | --- |
| T+20 min | Client, décision, barème, scénario, preuve et rôles reçus ; droits et accès en cours | Réduire la tranche, conserver inconnues et responsables |
| T+45 min | Direction choisie ou réutilisée ; états/contrat et exemple de données ; squelette hébergé si exigé et autorisé | Résoudre le chemin obligatoire avant nouvelle extension |
| T+90 min | Première boucle de 30-45 s sur A ; lecture/écriture et première opération utile sur B | Montrer le blocage concret ; couper un écran ou une extension |
| T+2 h | Première capture/export court et premier raccord dans le même shell | Corriger le contrat avant d'élargir |
| T+3 h | Tranche LIVE centrale avec mesure simple, contrôles et revues requis ; répétition par lecteur neuf | Choisir explicitement le périmètre livrable ; ne pas appeler complet un composant reçu |
| T+4 h | Gel des fonctions, source et données de présentation ; deux tracks rapprochés | Corrections bloquantes seulement, ou nouveau gel explicitement reçu |
| T+5 h | Vidéo 180 s lue intégralement, liens jury testés, README/slide alignés | Export simple plutôt qu'effets de montage |
| T+5 h 30 | Soumission possible avec marge ; fichier final et champs prêts | Garder une marge réelle pour upload et accès |
| T+6 h | Reçu de soumission et version montrée conservés | Sans reçu, statut « préparé » ou « transmission non attestée » |

Les deux revues de code indépendantes restent obligatoires selon le dépôt. Réduire le code et préparer leurs contextes tôt ; leur coût ne justifie ni suppression ni fausse attestation. Les tests indépendants peuvent avancer pendant un accès ou une approbation en attente. Ne pas créer un second chantier pour contourner le propriétaire du premier.

## Workflow UX/UI composable

La recherche actuelle retrouve déjà `ux-ui-visual-first`, `erwan-product-ui`, `motion-checks`, `ce-test-browser` et `demo-package`. Le premier sert à explorer lorsqu'aucune direction n'est reçue ; il n'impose pas de refaire trois pistes à chaque itération. `erwan-product-ui` relie parcours, vrais contenus, états et micro-versions. `motion-checks` cite déjà Emil au SHA `2d228630ba1446365f614a108cb8252f1feda202`. Leur disponibilité actuelle n'atteste pas leur invocation historique. [S21]

Proposition : un court brief d'intention et de références, des tokens compacts, une seule particularité visuelle utile, puis micro-versions de un à trois changements. Conserver les composants installés et les primitives natives adaptées. Utiliser CSS pour un retour simple ; ne pas ajouter une bibliothèque de motion, de composants ou un deuxième système de styles sans défaut concret à résoudre.

| Contrôle | Critère candidat observable | Ce qu'il ne prouve pas |
| --- | --- | --- |
| Esthétique | Hiérarchie, rythme, densité et cohérence avec la référence ; critique sur mêmes données/viewport ; écart géométrique supérieur à 5 px traité selon règle projet | Préférence du jury ou meilleure conversion |
| Compréhension / UX | Lecteur neuf retrouve signal, source, décision et conséquence sans aide ; durée et erreurs consignées | Qualité d'une API ou validité du calcul |
| Fonctionnement | Oracle du résultat, permissions/révisions, reprise, commande répétée, états erreurs/périmés | Distinction visuelle ou compréhension humaine |
| Responsive / accès | 390, 768 et 1440 px sans contenu critique coupé ni débordement global ; clavier et focus visibles ; texte long ; reduced-motion ; interruptions des transitions | Safari ou téléphone réel non testés |

Aside reste le premier navigateur de QA : snapshot, action observée, snapshot et capture. Chrome sert aux capacités manquantes et diagnostics, avec motif conservé. Screenshot diff et critique par modèle sont des aides : ils peuvent conserver un mauvais design ou inventer un défaut. Chaque finding automatique pointe une zone et un critère ; la baseline visuelle change seulement après réception.

### Apports externes, sans installation proposée aujourd'hui

| Source lue et version | Apport utile | Disposition |
| --- | --- | --- |
| [Anthropic frontend-design, dbd4588](https://github.com/anthropics/skills/blob/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design/SKILL.md) | Intention, audience, contenu réel, retenue et autocritique ; méthode textuelle, pas moteur de rendu | Complément P1 à l'exploration existante, essai esthétique local NOT_RUN |
| [Emil, animate 2d22863](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/skills/animate/SKILL.md) | Intention/fréquence, interruption et état final, reduced-motion | Réutiliser d'abord `motion-checks` déjà adapté ; aucun second skill à importer |
| [Vercel, grille 434b7f9](https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/command.md) | Clavier, focus, formulaires, erreurs, overflow, mouvement et contenu long | Adapter quelques checks ; figer la version, le wrapper recharge sinon une URL mouvante |
| [Base UI](https://base-ui.com/react/handbook/styling), [Motion](https://motion.dev/docs/react-use-reduced-motion) | Options de primitives sans CSS et adaptation du mouvement | Documentation consultée, pas audit de bibliothèque ou recommandation de remplacement |

La [recherche technique](TOOL-RESEARCH.md) conserve révisions, licences, fichiers et limites. Qualité esthétique, UX et fiabilité ont chacune leur réception ; aucun skill ne garantit les trois.

## Pipeline vidéo de trois minutes

`Scenario → Browser Capture → Script → Narration → Video Composition → QA → Export`

Le scénario et un premier texte précèdent la capture ; le script final se règle sur ce qui a effectivement été capturé. Adapter la recette de `demo-package/references/repo-and-media.md`, sans créer de nouvel orchestrateur. Un manifeste de scènes local suffit : étape, durée cible, mode, source/version, état initial, geste, oracle, narration/caption, fichier brut et statut de preuve.

| Étape | Production | Critère de sortie |
| --- | --- | --- |
| Scenario | Un utilisateur, une décision, reset explicite, scènes et secours | Parcours en 180 s ; chaque phrase relie un bénéfice à une scène ou une preuve |
| Browser Capture | Contexte de test isolé, viewport/date/locale maîtrisés, gestes reproductibles, vidéos brutes et images clés | Attendre les états métier et affirmer leur résultat ; pas seulement `sleep` ; fermer le contexte pour finaliser le fichier |
| Script | Texte révisé à partir des captures obtenues | Chiffres, nature des données et actions fidèles ; supprimer toute phrase non démontrée |
| Narration | Voix humaine, ou TTS autorisé ; audio et durée réels | Réécoute noms/chiffres, cache par scène/texte/voix/version ; aucune substitution silencieuse de fournisseur |
| Video Composition | Assembleur simple existant, ou Remotion si variantes récurrentes ; captures, voix et sous-titres | Horloge et framerate explicites ; coupes d'attente déclarées ; zooms sans fabriquer de fonction |
| QA | Décodage, durée, début/fin, images clés, son, sous-titres et visionnage intégral | Aucun écran noir involontaire, texte critique coupé, secret, clipping ou sous-titre hors bornes ; chiffres cohérents avec l'oracle |
| Export | MP4, SRT, transcript, raw, manifeste et reçu | Lecture hors ligne du fichier final ; récupération en contexte neuf ; accès jury et soumission vérifiés séparément |

Budget de narration candidat : 0-20 s problème/utilisateur ; 20-40 contexte et données ; 40-75 signal/impact ; 75-115 plan/arbitrage ; 115-150 décision et conséquence ; 150-170 preuve LIVE et limites ; 170-180 conclusion. Si LIVE manque, ce segment montre son état réel et sa limite. Une compétition peut exiger capture continue ou démo en direct ; le montage ne remplace alors pas cette exigence.

### Outils vérifiés et choix proportionné

Tous les rendus vidéo et intégrations ci-dessous sont **NOT_RUN**. Les dates sont l'activité observée le 22 octobre, pas une garantie de maintenance future.

| Outil | Existence, code et maintenance reçus | Choix proposé / limites |
| --- | --- | --- |
| [Playwright v1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1), 14 octobre | Recorder et tests ciblés lus ; WebM par contexte, sans audio, finalisation à sa fermeture. La stable lue produit déjà du CFR. | Premier candidat de capture batch répétable, après QA Aside. Pas besoin de recorder CDP maison avant défaut mesuré. |
| [Remotion v4.0.538](https://github.com/remotion-dev/remotion/releases/tag/v4.0.538), 22 octobre | Renderer, captions/SRT et tests lus ; composition React/rendu CLI/API | P1 pour films récurrents. Un montage simple suffit au premier essai. Licence propre, à qualifier selon l'entité ; aucune licence d'exploitation supposée acquise. |
| [Ultrademo e7bdcfc](https://github.com/new-xp/ultrademo/tree/e7bdcfc241600b65bf6536f2c3c990a00a765b2d), 10 juillet | Capture Playwright → TTS/cache → Remotion, clips, curseur, SRT et formats ; aucun test trouvé dans l'arbre étudié | Alternative d'essai P1, pas couche supplémentaire. Skill pouvant provisionner/installer : extraire seulement les idées utiles, ne pas le lancer aveuglément. |
| [Demo Studio AlexAnsart 74ecd6c](https://github.com/AlexAnsart/demo-studio/tree/74ecd6c949b7f903fd616ee4b0c53ad22d2a68aa), 26 juillet | CDP/JPEG/FFmpeg, caméra par zones, composition, narration/sync et smoke test lus | Alternative P1. QA par défaut max 130 s à adapter ; heuristique de page vide non suffisante ; test non exécuté. |
| [DemoStudio snchande 8cad216](https://github.com/snchande/DemoStudio/tree/8cad216e346f5fd10edf7cbe71875dd36f8b8d2a), 26 août | Scénario JSON et pipeline FFmpeg/edge-tts ciblés lus | Identité distincte. Droits et endpoint officiels de la voix online non établis ; pas adoption recommandée. |
| [Agent Demo Studio b7921b3](https://github.com/khajaaijaz26/agent-demo-studio/tree/b7921b334957128b16b686539343aee4bbe14e18), push 1 octobre | Identité/arbre/package/recorder lus ; autres surfaces non auditées | Piste identifiée, pas recommandation d'intégration de tout le studio. |
| [ElevenLabs TTS](https://elevenlabs.io/docs/overview/capabilities/text-to-speech), [Piper](https://github.com/OHF-Voice/piper1-gpl) | Capacités documentées ; Piper annonce rechercher des mainteneurs, licences des voix distinctes | Voix humaine suffisante P0 ; TTS P1 avec compte/voix/droits autorisés. Aucun appel ni installation réalisé. |

« Demo Studio » est ambigu ; choisir une identité avant de comparer. Les licences du code ne donnent pas automatiquement les droits sur les voix ou actifs. Ne pas empiler Ultrademo, Demo Studio et un troisième orchestrateur.

P0 : scénario, reset, capture, oracle, narration intelligible, sous-titres/transcript, montage et lecture finale. P1 : Remotion, TTS, cache par scène, contact sheet et visual diff. P2 : zooms CDP sophistiqués, musique, voix clonée et variantes verticales.

## Mesurer si la méthode est meilleure

Commencer par un exercice synthétique de 90 minutes, avant le prochain événement : même brief, données, critères, moyens et droits ; une seule tranche verticale de référence, puis la variante dual-track, avec ordre alterné ou équipes comparables. Réutiliser le même barème de compréhension et les mêmes oracles. Déclarer les effets d'apprentissage et l'échantillon trop petit pour une conclusion générale.

| Mesure | Référence historique disponible | Mesure du prochain essai |
| --- | --- | --- |
| Temps première répétition complète | Heure exacte du premier parcours public complet non reçue ; rework humain observé après 15 h | Chronomètre de kickoff à scénario réussi par lecteur neuf, sans aide |
| Compréhension | Retour négatif humain, sans score standardisé | Questions fixées avant essai : utilisateur, signal, raison du plan, conséquence, nature DEMO/LIVE ; temps, erreurs et aide |
| Fiabilité | API, UI lecture et état durable reçus séparément ; onze perturbations NOT_RUN | Taux de réussite complet depuis reset ; tests prioritaires droits, périmé, double commande et reprise |
| Parité | Quatre scénarios/chiffres distincts | Divergences non déclarées entre adaptateurs, contexte, résultats et captions |
| Packaging | Package documentaire prêt, vidéo finale et soumission inconnues | Heure premier MP4, re-capture d'une scène, QA et reçu de soumission |
| Effort et coût | Coût consolidé inconnu | Temps humain/setup/retouches, appels et tokens disponibles, dépenses réelles et données manquantes |

Cibles candidates à recevoir avant essai : répétition plus tôt sans régression métier ; trois répétitions DEMO identiques ; aucune confusion de mode chez les lecteurs ; un export 180 s récupérable ; aucune fonction LIVE revendiquée sans sa preuve. Ne pas fabriquer une réduction en pourcentage avec une baseline historique inconnue. N'adopter que si le gain total dépasse la préparation, la duplication et la maintenance.

## Quand renoncer aux deux tracks

| Contexte | Risque du dual-track | Adaptation |
| --- | --- | --- |
| Jury très orienté intégration/sponsor | Belle cible qui consomme le temps du chemin exigé | Déployer et mesurer d'abord la tranche minimale ; A devient sa présentation |
| Épreuve très courte / solo | Coût de contrat et deux adaptateurs supérieur au gain | Une tranche verticale, quelques états de test ; pas deux applications |
| Faisabilité technique incertaine | UX qui promet un résultat impossible ou trop lent | Spike bref avant fixation de l'interaction ; représenter honnêtement attente et échec |
| Critères centrés produit/pitch | Moteur correct incompréhensible en quelques secondes | Renforcer A et la narration, conserver au moins la preuve LIVE obligatoire |
| Compétition interdisant simulation ou montage | DEMO insuffisante, même transparente | Respecter capture continue/live et règles de préconstruction reçues |

## Matrice de priorités

| Priorité | À préparer / tester | Fin vérifiable |
| --- | --- | --- |
| P0 | Scénario reçu, contrat sémantique, squelette obligatoire autorisé, shell unique/deux adaptateurs, répétition et premier export | Une boucle comprise, rejouable, correctement attribuée et livrable |
| P1 | Recettes existantes composées, évaluation comparée des outils, transfert de propriétaire et QA versionnée | Moins de reprises et temps total réduit sans perte de preuve |
| P2 | Effets cinéma et automatisation de critique avancée | Gain perceptif mesuré au-delà du coût, aucune altération des faits |

Sources : [post-mortem](HACKATHON-POSTMORTEM-2026-10-22.md), [enseignements](HARNESS-LESSONS.md), [sources versionnées des outils](TOOL-RESEARCH.md) et [carte de couverture](SOURCE-MAP.md). Adoption et évaluations prospectives restent NOT_RUN.
