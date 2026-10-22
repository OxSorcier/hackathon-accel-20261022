# Contre-lecture indépendante : post-mortem Accel

22 octobre 2026. Mandat : couverture de la mission, fidélité des affirmations décisives et raccord recommandations/preuves. Lecture seule du produit et des services. Aucun autre agent lancé. Aucun redémarrage, appel modèle, SQL, import, test mutatif, publication ou transmission à des tiers.

## Sources et objet reçu

- Mission originale lue intégralement : `/Users/erwan/.codex/attachments/2751c214-4516-42c7-a3c3-8d83852b39fc/Texte collé.txt`, 255 lignes.
- Méthode lue : `audit-source/SKILL.md`, `references/large-audit.md`, `references/evidence.md`.
- Les quatre livrables Markdown, `SOURCE-MAP.md`, `TOOL-RESEARCH.md` et README lus. Les fichiers évoluaient pendant la revue ; les constats ci-dessous distinguent l'état initial et les corrections relues.
- Originaux : `/Users/erwan/Projects/hackathon-accel-20261022`, HEAD `8b9e609ad2ba5fafff5729355f75bc578b50585a`, avec delta local distinct. `START-HERE`, `HANDOFF`, `OWNERSHIP`, BUILD-PLAN et brief conservé du 21 octobre lus. Arbre Git et familles de propositions confrontés à la carte. Git log, branches et reflog relus : deux commits produit ; branche documentaire créée ensuite ; aucune branche produit abandonnée ou réécriture retrouvée.
- Reçus produit, opérateur, de publication et de reprise inspectés par champs/ranges utiles. CSV opérateur : 32 lignes totales, dont en-tête ; 11 perturbations NOT_RUN et 3 cas intégrés PASS restent distincts des composants.
- Manifeste PUBLISHABLE-RUNTIME-v3 : vérification indépendante des 99 fichiers, aucune empreinte manquante ou divergente, 15 chemins différents du checkout courant. Le constat de séparation HEAD/checkout/runtime est confirmé.
- Chats lus via `read_thread` : `Accel : interface A`, 12 tours en deux pages ; `Faire le point sur l’app`, deux derniers tours utiles ; `Faire le point par chantier`, 19 tours utiles en deux pages pour les lectures de skills et outils ; `Créer le flow UX/UI dans Figma`, 10 derniers tours utiles pour ces mêmes métadonnées ; `Prepare hackathon submission`, 4 tours substantiels. Réception limitée aux messages utilisateur/finals et métadonnées de tools nécessaires ; pas d'utilisation des raisonnements privés ni d'autres conclusions de reviewers.
- Pixels vus directement : `design/A-bureau-decisions.png` et `proposals/ui/physical-impact-build-v1/QA-PUBLIC-01a1638a.png`. Les autres pixels revendiqués dans S13/S20 restent des observations du lecteur auteur, pas de cette contre-lecture.
- Outils externes : métadonnées/arbres versionnés dans `/tmp/accel-source-research`, sources ciblées recorder Playwright stable, QA et alignement Demo Studio AlexAnsart, TTS/cache Ultrademo, licence Remotion stable. Pas d'exécution. Les arbres vérifiés sont non tronqués ; Ultrademo n'y présente pas de suite de tests, AlexAnsart y présente `test-engine.mjs`.

## Findings et corrections

### F01. P2 : une boucle d'apprentissage déjà appliquée manquait à la reconstruction

**État initial.** Le récit et le pack proposaient la qualification des sources vers `recherche-multisource`, sans reconstruire la mise à jour du même skill déjà réalisée pendant le hackathon. Cette omission changeait la prochaine action : refaire la méthode au lieu de recevoir et évaluer le delta existant.

**Originaux décisifs.**

- `proposals/product/research-data-20261022/sector-sources/RESEARCH-METHOD-RETROSPECTIVE.md:3-18,20-34`, SHA-256 `4942fb6957c04ccd5c7e21c0b6cc99e520370b8198eb3841def98e860fe3e90b`. Défauts RSS/qualifications, annonce de future usine, incendie avec activité maintenue, dates/couverture et concurrence différée ; correction locale et limites.
- `.../skill-update-20261022/SKILL-UPDATE-RECEIPT.json:84-102`, SHA-256 `4e5c05c581fd8d1fb641e761aeb4f49c9f273773dcae9ec53ed9c8b9f8f00fc8`. Installation consignée à `11:38:59Z`, soit 13 h 38 Paris ; manifeste `ef82b748f9ad6cde32e88dfc8e88fb00146fbea17a2d90f8171a2e43164fa2cc` ; 8 fichiers actifs vérifiés ; nouvel agent NOT_RUN, gain causal NOT_ESTABLISHED, aucun collector produit ajouté.
- `.../sector-sources/RECEPTION.json:81-86,132-134`, SHA-256 `76789f13254e95810b376c30888476f8cc8a40d49c9b81f503d567cc00adb7d8`. Réception documentaire privée à 11:41:55Z ; portée locale et limites séparées.

**Correction relue.** Ajout dans chronologie du post-mortem, architecture/apprentissages, S21, L06 et pack ErwanOS. L'ancien paquet, la portée locale et l'absence de preuve de gain sont conservés. Finding traité sur les sections relues. Je n'ai pas réattesté l'état actuel du lien de skill hors projet ; le fait demeure historique consigné.

### F02. P2 : le Harness n'avait pas de matrice positive des modèles/outils/skills réellement utilisés

**Sections.** Post-mortem architecture et orchestration ; SOURCE-MAP S06/S21. La mission demande explicitement quels agents, outils et skills ont effectivement été utilisés. Le texte distinguait présence et invocation, mais ne donnait pratiquement que le modèle du produit `gpt-5.4-mini` et les quatre propriétaires. Cela laisse la partie Harness trop abstraite pour reproduire ou comparer la méthode.

**Preuves accessibles.**

- `proposals/data/READY.json:15-16,135-147` : `gpt-6.1-sol` configuré pour construction, `gpt-6.1-sol` et `gpt-6-astra` demandés pour les deux revues ; identité servie non attestée.
- `proposals/ui/READY.json:13-14` : réalisateur demandé `gpt-6.1-sol`, servi UNATTESTED.
- `proposals/integration/REVIEWS.json:4-6,13-15,31-33` : sol configuré, effort xhigh ; contre-revue sol et architecture Astra demandées ; servi non vérifié.
- Le premier tour du chat `Accel : interface A`, ID `01a162bd-fd45-7400-898f-ecf526fd8afc`, comporte des appels Chrome/CUA et des vérifications navigateur, puis annonce 21 tests et réception Aside. Les tours suivants utilisent les outils de lectures et suivi Codex. Une prescription dans AGENTS n'établit toujours pas l'invocation d'un skill.

**Correction relue.** La section `Modèles, outils et skills effectivement tracés` du post-mortem, lignes 77-89 de la version finale relue, ajoute 7 usages et leurs limites. Les READY soutiennent les modèles configurés/demandés et l'identité servie non attestée. Les commandes du premier tour UI confirment les six lectures de skills listées ; les tours front, Figma et submission confirment les lectures de recette, debug, simplification, revue, image et packaging nommées. Construction, produit, présence actuelle et efficacité restent distincts. Finding traité sans prétendre à un inventaire exhaustif.

### F03. P2 : rendre explicite le résultat négatif des trois sources publiques du run industriel

**Sections.** Post-mortem chronologie/architecture/trois surfaces ; HARNESS-LESSONS L06. Le texte qualifie correctement les avis de pistes non qualifiées et ne leur attribue pas le feu synthétique. Il omettait toutefois le résultat plus précis du rapport réel : chacune des trois notices avait `no known exposure`, sans pertinence bois/panneaux/isolants établie.

**Preuve.** `proposals/integration/INDUSTRIAL-RUNTIME-3003.json:924-937`, notamment la valeur complète de `prepare_industrial_report.input.summary` ligne 928. Trois notices : enrobés bitumineux à Calais, essais/mesures de matériaux à Nîmes, transport de matériaux routiers en Guyane. Le modèle n'établit pour aucune un impact connu sur l'entreprise. Il traite séparément le feu opérateur et la demande CRM synthétiques préexistante. Les dates de tools 13:07:46Z à 13:08:03Z correspondent à 15 h 07-15 h 08 Paris.

**Impact.** Le fait qu'une collecte soit réelle n'établit pas qu'elle ait fourni un signal métier utile à ce checkpoint. Ce négatif est utile pour juger la proposition data-centric et la priorité de qualification, sans attribuer la défaite au choix des sources ni déclarer ces notices inutiles en général.

**Correction relue.** Post-mortem ligne 101, L06 ligne 75 et SOURCE-MAP S11 ligne 62 donnent maintenant ce résultat négatif concret et sa portée au checkpoint. Une première correction employait l'apparence de statut `no_known_exposure` ; le readback final emploie bien la phrase en prose « no known exposure » et dit explicitement qu'il ne s'agit pas d'un enum JSON. Finding traité.

### Point visuel initial, corrigé dans le livrable courant

L'état initial renvoyait à une critique des pixels dans HARNESS-LESSONS, mais les fiches portaient surtout sur le parcours et les états. Le tableau ajouté `Ce que les images permettent de critiquer` apporte maintenant caractéristiques visuelles, interprétation esthétique bornée et contrôles de compréhension séparés. Les deux images directement vues ici soutiennent le contraste bureau dense/teal-crème plus aéré ; aucune inférence de victoire, de jury ou de causalité esthétique n'en est tirée. Pas de finding ouvert sur cette question après lecture du tableau ajouté.

## Couverture de la mission

| Demande originale | Ce qui est reçu dans les livrables | Reste ou limite |
| --- | --- | --- |
| Reconstruction idée, ordre, pivots, incidents et résultat | Chronologie distingue commits, checkpoints et temps actif ; petit risque, extension industrielle, refonte, runtime et arrêt séparés | Version exacte au jury, clics, audience, vidéo et soumission non reçus ; limite honnête |
| Audit Product Discovery, UX/UI, orchestration et démo | L01-L10 rattachées aux sources ; coût de coordination comme inférence ; tableau pixels ajouté | F02/F03 corrigés et relus ; absence de minutes/coûts consolidés préservée |
| Dual-track critique | Deux responsabilités, shell unique, sémantique commune, raccord progressif et alternative tranche verticale | Proposition et gain causal NOT_RUN ; critères du vrai concours priment |
| Skills UX/UI | Capacités locales d'abord, Anthropic/Emil/Vercel versionnés, bibliothèques documentées sans remplacement imposé | Présence actuelle distincte de l'invocation historique ; F02 corrigé complète la réception positive |
| Vidéo trois minutes | Pipeline exact demandé, capture/script/narration/captions/QA/export ; nécessaire/facultatif ; identités Demo Studio distinctes | Aucun rendu ou intégration exécuté ; licence/voix et maintenance future non garanties |
| Learnings local/Harness/ErwanOS | Candidats avec problèmes, preuves, causes probables, solutions, gains, coûts, priorités, tests et destinations | F01 corrigé ; adoption globale et expériences restent NOT_RUN |
| Quatre livrables et priorités/contradiction | Quatre Markdown présents, matrices P0/P1/P2, contre-cas dual-track dans plusieurs documents | HTML, archivage partagé, rendu/offline, AUDIT-RECEIPT et PR encore hors réception de cette contre-lecture |

## Contrôles des affirmations décisives

- Les heures Git 14:42:45 et 20:08:40 Paris concordent avec les objets Git ; elles ne sont pas présentées comme débuts du développement.
- Les 99 pins et 15 divergences sont confirmés ; HEAD n'est pas promu au dernier runtime testé.
- 17 pages, 40 113 caractères et lecture cache PDF sans nouvel appel concordent avec APP-PDF-ACQUISITION-v6-r2. La citation modèle et l'UI PDF restent séparées.
- Le CSV conserve les 11 perturbations NOT_RUN, les composants, les 3 cas intégrés et l'absence de clics initiaux de décision navigateur. Les tests historiques ne sont pas additionnés en total d'efficacité.
- Le calcul industriel, les offres potentielles et l'effet simulé ne sont pas présentés comme livraison réelle, revenu réalisé ou achat ERP. Les tests SQL lus incluent concurrence, rollback, perte d'ACK applicative et readback, avec environnement conditionnel ; pas de nouvelle exécution par ce reviewer.
- Le support final est le site désigné directement par Erwan. Sa confirmation ne précise ni séquence au jury ni vidéo ; les livrables conservent cette limite. Je n'ai pas revisité le site ni rejoué son état navigateur.
- Playwright stable lu produit bien WebM, `-an` et sortie CFR ; le commentaire d'un autre recorder ne le réfute pas. Demo Studio AlexAnsart a bien un max 130 secondes par défaut et une heuristique PNG pour blank ; Whisper force `language="en"`. Les limites d'intégration nommées sont justifiées.
- Les recommandations sont globalement rattachées à un incident ou à une hypothèse prospective identifiée. Aucune preuve de gain, de retour jury ou d'adoption ErwanOS n'est ajoutée.

## Limites de cette contre-lecture

Il s'agit d'un contrôle indépendant de couverture documentaire et de claims décisifs, pas d'un second audit complet de toutes les lignes produit, de tous les chats ou de chaque monorepo externe. Je n'ai pas relu les sources BSF/ErwanOS de préparation ni le PDF organisateur original, explicitement bornés dans S02/S03. Les requêtes GitHub/Linear/Drive faites par l'auteur ne sont pas réexécutées ici. Ces points ne sont pas déclarés observés par ce reviewer.

Les outils lean-ctx ont refusé des fichiers `/tmp` ou renvoyé une root étrangère pour l'inventaire/recherche hors projet. Repli sur lectures natives ciblées et numérotation depuis les lignes originales. Certaines premières sorties groupées ont été tronquées ; les parties nécessaires ont été reprises séparément, sans les compter comme lectures intégrales.

Les corrections F01/F02/F03 ont été relues. Aucun finding ouvert ni trou requis supplémentaire identifié dans le contenu Markdown contre la mission reçue. Cette clôture porte sur la contre-lecture indépendante du contenu et des preuves ciblées ; elle ne certifie ni HTML/offline, ni Drive, ni PR, ni reprise en contexte neuf des livrables finaux. Le workflow demeure candidat et ses évaluations prospectives restent NOT_RUN.



## Empreintes de clôture du contenu relu

- `HACKATHON-POSTMORTEM-2026-10-22.md` : `ffc4f2e93b3394c2838ff51015b09710980d8f0f7175d1c8137e1ece75f13dde`, 142 lignes.
- `HARNESS-LESSONS.md` : `7c9ab88868b199fbd3cbe40f02e76fa5addd5265b813197dbb9f61b55fce0d9a`, 149 lignes.
- `HACKATHON-HARNESS-VNEXT.md` : `66f39c05b1070ddeca0270979743df1f826eba90897bff32a010f0fc050dd3cb`, 165 lignes.
- `ERWANOS-LEARNING-PACK.md` : `68d9959bb0e3c66e85637f5f48b6989d00b9f1f3aa828c382329f996f3a0c4b9`, 77 lignes.
- `SOURCE-MAP.md` : `8b0b0c84edee4aa7ef6c8560d598c08ba23c0a553fa8a336422f5d19966a6253`, 131 lignes.
- `TOOL-RESEARCH.md` : `46a06146c325faafd9693c9e38e2d3c6ac0e5be57256af5eee33d4544151de76`, 108 lignes.
- `README.md` : `8722f882d42cc927003facbfdef981321ebab223ea4f37c06e535196c6d96371`, 16 lignes.

## Revalidation de forme après clôture

La dernière ligne vide de `TOOL-RESEARCH.md` a été retirée. Vérification octet par octet par reconstruction : ajouter un unique LF aux octets finaux redonne exactement le SHA-256 original `a760fd4e9861e5ebb4dddb62806e2e02c6f888a5650b186bab77714a54912443`. Aucun autre contenu modifié. Nouvelle empreinte `46a06146c325faafd9693c9e38e2d3c6ac0e5be57256af5eee33d4544151de76`. Les quatre livrables et SOURCE-MAP correspondent toujours aux empreintes de clôture. Pas de nouvelle revue produit, d’exécution de test ou de validation HTML/Drive/PR par ce contrôle.
