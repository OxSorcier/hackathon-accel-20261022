# Sources, couverture et limites de l'enquête

22 octobre 2026. Version 1. Carte du mandat complet : chronologie, produit/moteur, UX/UI, orchestration, présentation, dual-track, skills et vidéo, learnings locaux/Harness/ErwanOS. L'inventaire n'est pas une lecture intégrale ; chaque famille ci-dessous précise la réception utile à la question. Les résultats historiques sont attribués à leurs auteurs, sans réexécution pendant l'audit.

## Références épinglées

- Dépôt : [OxSorcier/hackathon-accel-20261022](https://github.com/OxSorcier/hackathon-accel-20261022).
- Premier commit : `285cfb0d1bfd1c313c4b57ffba5f2515446acffd`, 22 octobre à 14 h 42 min 45 s Paris.
- Base publique auditée : `8b9e609ad2ba5fafff5729355f75bc578b50585a`, 20 h 08 min 40 s.
- Checkout original : `/Users/erwan/Projects/hackathon-accel-20261022`, branche `build/accel-local`, avec delta local préservé. Le snapshot de métadonnées initial est daté du 22 octobre à 18:22Z. Les hashes des sources décisives sont dans [SOURCE-PINS.json](SOURCE-PINS.json).
- Production documentaire isolée : branche `codex/hackathon-postmortem-2026-10-22`. Le manifeste de réception est [AUDIT-RECEIPT.json](AUDIT-RECEIPT.json).
- Pour un chemin absent de la base publique, l'empreinte et l'extrait factuel reçu sont conservés ici ; un chemin local n'est pas une promesse d'accès depuis GitHub. Les traces brutes de chats et secrets ne sont pas publiés.

## S01. Git et périmètre local

`git log --all`, `branch --all`, `reflog --all`, `status --porcelain`, `ls-files` et les deux `show --shortstat` ont été lus. Deux commits et un historique local sans autre branche d'abandon retrouvée. Premier commit : 1 216 fichiers, 481 006 insertions, incluant beaucoup de preuves ; second : 78 fichiers, 7 630 insertions et 220 suppressions. Ce ne sont pas des mesures du code produit ou de l'effort. Inventaire initial : 1 263 chemins suivis, 24 entrées suivies sales et 111 entrées non suivies. Aucun reset, stash ou remplacement des changements d'autrui.

## S02. Brief et règles reçus

Lecture du document conservé `.preparation/accel-20261022/kit-accel-20261022/context/20261021-brief/BRIEF-ACCEL-20261021.md`, notamment exigences, cinq critères, horaires et inconnues. C'est une synthèse de réception du 21, pas une nouvelle décision organisateur. [PDF fourni à l'époque](https://drive.google.com/file/d/1gGpZlRTYJVLw5DQ6KcpqA_esH3DM0AZL/view), [page officielle identifiée](https://builderbase.com/event/accel-ai-innovate-paris). Le PDF original n'a pas été réextrait par cet audit. Exigence reçue Aiven Runtime ; pondération, fermeture technique et autorisation organisateur de réemploi inconnues. Pas de nouveau barème ou feedback inventé.

## S03. Préparation, import et réemploi

`docs/IMPORT-RECEIPT.json`, `SETUP-RECEPTION.json`, `HANDOFF.md`, kit START-HERE, bilan et matrice sous `.preparation/accel-20261022/verification-backend-20261022/`. Archive v5 `c44eea191cc20e2e8d1f9bfe30780592d8a2ddf2ae085f2a1ebb89d799e59b51`. 471 fichiers de préparation au checkpoint d'import, 470 entrées de contenu de manifeste vérifiées selon reçu. BSF 25dbfed : 164 unitaires et 75 PG ; patch distinct avec 25 échecs PG ; ErwanOS e1206d8 : 238 ciblés. Résultats historiques lus, sources externes BSF/ErwanOS non réauditées ni tests relancés ici. Correspondance de mécanismes étayée dans le produit, aucune filiation ligne à ligne supposée.

## S04. Plan et écarts de calendrier

[`docs/BUILD-PLAN.md`](https://github.com/OxSorcier/hackathon-accel-20261022/blob/8b9e609ad2ba5fafff5729355f75bc578b50585a/docs/BUILD-PLAN.md), intégralement lu. Priorité tranche complète puis élargissement ; cible historique première application Aiven 10 h 15, gel fonctions 14 h, package 14 h 30, soumission reçue 15 h à reconfirmer. Cibles distinctes de résultats et de temps de travail effectif.

## S05. Vision et changements

`PRODUCT-VISION.md`, historique v1/v1.1/v2/v3, HANDOFF, `proposals/product/RELAY-RECEIPT.json`, `CHAIN-CHECKPOINT.json`, dossiers alignment et commentaires Linear. Sources ciblées du cadrage à 11 h 07, risques/opportunités/effets mixtes, A1-A9 et transmissions. Lecture du contenu et des niveaux reçus, pas preuve que chaque transmission fut immédiatement intégrée. Chat `Vision et MAJ`, ID `01a16306-b164-72f3-83d9-9edd27ded2ef`, dix derniers tours utiles lus par le lecteur UX.

## S06. Propriétaires et orchestration

`OWNERSHIP.md`, `THREADS.json`, mandats `docs/tasks/`, `CONTRACTS.md`, READY et `proposals/ui/industrial/FRONT-TRANSFER.json`. Contrats et dispatch lus, scopes et gel/réception rapprochés des sources. Quatre constructeurs : intégration `01a162bd-d470-7522-9d95-a03a82d9bd68`, données `01a162bd-e262-7fa2-a1f3-aab46f68fc1a`, métier/agent `01a162bd-ee93-7cc2-a93f-659950f41d93`, UI `01a162bd-facf-7b63-861b-9bbf7f402938`. La présence d'un mandat ne vaut pas preuve d'invocation de tous les skills qu'il nomme.

## S07. Moteur, données et tests

Lecture sémantique des chemins démarrage/API/auth/config/provider/store/worker/migrate/operator ; domaine model/contract/engine/industrial ; runners et contextes ; data/watch/research/relations/trigger ; contrats index/industrial/api/research/pdf et les douze migrations. Entrées clés : `start`, `PgStore.transaction/claimRun/finishRun/decide`, `evaluateOptions`, `policyFromContract`, `evaluateIndustrialPlan`, `createWatchEngine`, `createResearchRepository`, `runSpecializedAgent`, `createIndustrialAgentPort`, `IndustrialReleaseRepository.release`, `createIndustrialDemoExecutor`.

Deux scénarios SQL lus intégralement : `tests/integration/industrial-runtime.test.ts` et `industrial-execution.test.ts`, incluant provider injecté, droits, révision, 10k engagements, replay/concurrence/rollback/readback et perte de retour applicative. Corps ciblés et titres d'autres tests selon mécanisme. Tous les corps de tous les tests ne sont pas relus ; aucune famille fonctionnelle du moteur n'est omise de la carte. Tests non réexécutés ; aucune certification mathématique ou production.

## S08. Risque initial, erreurs et réception réelle

Reçus `proposals/integration/LIVE-SMOKE-v1.json`, `AIVEN-PRODUCT-SMOKE.json`, `REAL-CASE-FLOW.json`, `FINAL-UI-FLOW.json`, `FLOW-CODE-RECEIVED.json`, `FINAL-PREVIEW-RESTART.json`, `FINAL-3001-QA.json`, source/case/confirmation et revues associées ; reçus data READY et WATCH-RACE. Champs utiles, dates, IDs, données et réserves lus. Version figée 3001 avec 173 tests consignés ; cinq appels modèle/16 événements, achat proposé 1420 EUR contre transfert120. Aucun effet stock/achat exécuté par cette seule approbation. Mauvaise cible et anciens needs_input préservés.

## S09. Portefeuille industriel

`alignment-20261022/v2/{DATA-RECEIPT.md,CORE-READY.json,INDUSTRIAL-READY-v2.json}`, `INDUSTRIAL-CORE-AIVEN`, `INDUSTRIAL-CONTEXT-AIVEN`, `INDUSTRIAL-DISPLAY-AIVEN`, `INDUSTRIAL-READ-CANDIDATE` et contrôles d'import/relecture. Dataset source SHA `88305b739661df5cdb7f1686ad461afa05f7f1d5206bbaec7055eada3f6333af`. Comptes, identités, imports et limites reçus ; les 10k lignes ne sont pas toutes lues une à une par l'audit. Données synthétiques, aucune connexion ERP/CRM réelle. Test de calcul local isolé n'est pas benchmark modèle/Aiven.

## S10. Recherche et mémoire R1/R2

`proposals/agent/R1-{FIRST-FAILURE,RECEPTION}.json`, `R2-{FAILURE,ORACLE-CORRECTION,FINALIZER-FAILURE,RECEPTION}.json`, `proposals/integration/RECEIVED-RESEARCH-R1-R2.json`. Reçu final12:27Z. R1 : deux runs réels, trois observations réutilisables parmi cinq sources brutes ; premier PID/session/transport incomplets. R2 : Aiven et fournisseur injecté ; correction source generation2, plan1420 périmé malgré faisabilité et contrôle approuvé conservé. Correction de l'ordre JSONB et champs de finalization reçue. Pas apprentissage causal mesuré.

## S11. Parcours industriel réel

Reçus sous `proposals/integration/` : `INDUSTRIAL-PUBLIC-FEED-3003`, `INDUSTRIAL-RUNTIME-FIRST-NO-REPORT-3003`, `INDUSTRIAL-RUNTIME-3003`, `INDUSTRIAL-RUNTIME-REPORT-HTTP400-3003`, `INDUSTRIAL-COMMAND-HTTP-3003`, `INDUSTRIAL-WORKSPACE-COMMAND-HTTP-3003`, `CONNECTED-RUNTIME-v6-BUILD`. QA privée `.local/qa-adaptops-v2/{COMMAND-FLOW-API-3003,CHATBOT-AFTER-ACTION-3003}.json` et CSV opérateur. Dates et faits métier lus, pas toutes les traces brutes littéralement.

Rapport `report:7ad05a01-fe99-4d73-8e10-c367374510c7`, approbation `industrial-approval:8bd39351-aa34-484f-a02e-c0feb96639a3`, exécution `5f85ad71-6eab-405d-8189-e010b05ab58b`, révision `R-c61ff6d9-74ff-498f-a0b1-8202db653ef4`. 10000 engagements protégés,172000cents de dépense,110000cents de contribution potentielle,6enregistrements simulés. Approbation/simulation API, lecture navigateur ultérieure, clics initiaux UI NOT_RUN. BOAMP réel, feu et confirmations opérateur synthétiques ; aucun lien causal public inventé.

`INDUSTRIAL-RUNTIME-3003.json`, synthèse en prose autour de la ligne 928 : « no known exposure » pour trois avis, enrobés Calais, essais/mesures Nîmes, transport routier Guyane. Il s'agit d'une phrase du rapport, pas d'un enum JSON. Aucune exposition sectorielle bois/panneaux/isolation établie. Négatif de pertinence réellement reçu, pas seulement absence de preuve causale.

## S12. Modal PDF

Sources Python `modal_app.py`, `accel_pdf_http.py`, `accel_pdf_reader.py` ; Node `pdf-client`, `pdf-documents`, `pdf-routes`, `pdf-knowledge` ; contrat et migration. Corps lus. Reçus `MODAL-LIVE`, `CLIENT-LIVE`, `AIVEN-DOCUMENTS-LIVE`, `APP-PDF-ACQUISITION-v6-r2`, revues et cache readback. 17pages/40113caractères ; route application réelle15:38Paris, un téléchargement et un appel Modal, puis GET cache sans nouvel appel. OCR, citation modèle et UI finale NOT_RUN.

## S13. UI, design et pixels

Sources UI : sélection App, `physical-demo.ts` et `IndustrialDesk.tsx` complets, physical-model complet, pages et diffs ciblés, industrial-api complet, api/PDF ciblés, contrats parsers. Tests physiques demo/enriched-fire/recording/connected complets et régression10001 ; autres titres inventoriés. Reçus A/BROWSER, JOURNEY-FOLLOWUP, ADAPTOPS-DEMO-CHECKPOINT, Figma-flow, physical-impact-build, physical-connected, physical-recording, enriched-fire, FRONT-TRANSFER, allocation-v6, company/watchtower. Tests lus, pas relancés.

Quinze images réellement vues par le lecteur UX : direction A, AdaptOps decision-first, deux écrans Physical flow, ancienne proposition approuvée, premier front public, trois captures du recording et du plan, captures de scénario enrichi local, de refus10001 et de V6 UI. Inventaire du reste sans claim de lecture pixels. Les images générées/Figma sont des références, pas des interfaces connectées. Les listes exactes et empreintes de ces captures sont conservées dans le dossier d'enquête privé ; les fichiers sources publics restent au dépôt.

Chiffres réconciliés : HEAD et Demo initiale1600EURdépense/3800revenu/1620contribution ; LIVE1720/3800/1100 ; Demo enrichie43140/68400/29400. SHA physical-demo actuel et recording final identiques : `8e9afebeb3520b8f6202e275774684fc90dd9cd7282eec29fe5d7d49546161f4`. Ce n'est pas la version de HEAD.

## S14. Retours humains et rework

Chats réellement lus : `Accel : interface A`12tours ; `Faire le point par chantier`20tours ; `Préparer une démo live en 10 min`5tours ; `Créer le flow UX/UI dans Figma`20derniers tours utiles ; `Vision et MAJ`10derniers. IDs stables repris dans le manifeste de pins/chat et ci-dessous.

Front initial10:33-11:12, tour `01a162bd-fd45-7400-898f-ecf526fd8afc`. Refonte13:45-14:31, tour `01a1636d-d6a0-70e1-abd6-174b96c4d409`. Annonce «complet»15:00-15:04, tour `01a163b2-db4d-7fa2-ad9d-a06c9ff74cd1`. Retour humain négatif et correction15:05, tour `01a163b7-7f42-7031-83dd-779f86422376`. Recording/changement de scénario et refus de substituer `/live` à `/demo` : tours `01a163b9-0512-7f83-9225-409d5b7c35d7`, `01a163ba-35d2-7172-aaab-7f8122b90e63`, `01a163bf-1ef4-73c0-9b5b-8a0d263465f2`. Ces messages sont du feedback utilisateur pendant construction, jamais du feedback jury.

## S15. Publication et reprise publique

`PUBLICATION.md`, `RECOVERY.md`, `DECISIONS.md`, `REPOSITORY-GUIDE.md`, `repository-docs-20261022/public-recovery-v2/VERIFICATION.json` et cold-read. Portée exacte du second commit, 407tests/123skipped sans DB, setup/readback et limites reçus. La base publique est récupérable sans chemins privés historiques ; elle ne contient pas tous les candidats ultérieurs. Rationale de DECISIONS est explicitement maintenu, pas transcription d'arbitrages initiaux.

## S16. Incident et arrêt

`PUBLISHABLE-RUNTIME-v3.json`, `PG-CLIENT-RECOVERY-REVIEWS.json`, `CONNECTED-RESTART-v8-3003.json`, `HUMAN-STOP-RECEIPT.json`, QA privée PG-RECOVERY. Dernier snapshot de 99 fichiers, digest `2c9624220f05f6b9c4f777220beb7a37e748887fe101182c10ac740b436df4c4` ; 99 pins recalculés conformes, 15 chemins différents du checkout. Correctif PG sur ce snapshot, pas dans config de HEAD. Reprise à 18:07Z, soit 20 h 07 Paris ; arrêt reçu à 18:13Z, soit 20 h 13 Paris. Coupure prolongée et COMMIT interrompu non éprouvés. Demande humaine d'arrêt et non-gain rapporté lues dans le chat accès à 18:10Z. Ne pas assimiler le correctif reçu à un déploiement public.

## S17. Présentation et documents

Chat `Prepare hackathon submission` ID `01a16382-f36e-72d3-8db3-8756139edc9d`, quatre tours substantiels ; `proposals/product/submission-20261022/` dont RECEIPT, EVIDENCE-DATA, EVIDENCE-IT-WORKS, DATA-LAYER, ONE-PAGER, SUBMISSION-COPY, PITCH et ARCHIVE-RECEIPT ; DEMO-SCRIPT et history. Préparé/archivé distinct de soumis. Aucun MP4/MOV/WebM final retrouvé par inventaire du dépôt hors dépendances/préparation/Git ; autres emplacements personnels et upload externe non vérifiés. La source PDF de preuve a été supprimée localement avant audit ; son archive Drive est retrouvée. Une absence locale ne signifie pas absence du livrable.

## S18. Suivi externe, coûts et limites de lecture

ERW-133description, commentaires et historique utile lus via connecteur. État courant du ticket Todo, non modifié par inférence. Source GitHub publique, issue search sans résultat, PR list/Actions sans résultat et Discussions=false reçus avant création de la PR de cet audit. Aucun message envoyé à un autre chat ou à une personne.

Le CSV opérateur comporte 32 lignes, en-tête compris, pas seulement les composants visibles dans sa projection comprimée. La relecture native a reçu trois cas intégrés PASS et onze perturbations NOT_RUN. Cas API ligne 25, questions 26, premier navigateur incompatible 27, V6 lecture 28, replay 29 dans le fichier original. Les compteurs de tests de versions différentes ne sont pas additionnés. Coût monétaire global et temps humain indisponibles. `get_agent_context` a renvoyé outil non trouvé ; repli sur issue, commentaires et sources, sans prétendre lire des notes absentes.

## S19. Lancement et accès

Chats `Hackathon Accel` ID `01a15f24-8d9c-7fd2-8a00-1b039732248f` et `Reprendre et lancer le hackathon` ID `01a16283-2006-7bd3-b07f-2ceaf2535784`, plus `Clarifier et documenter le repo` ID `01a16393-fa43-7050-aee1-26938ecf8de3` et `Faire le point sur l’app` ID `01a163b5-2382-72d1-a6b8-8b94e66bfcbc`. Messages utilisateur/finals horodatés extraits des logs locaux pour ces identités, sans tool payloads ni raisonnement privé. Derniers tours coordinateur lus par API en projection de messages. Création de dossier demandée09:39, accès à configurer09:48, ouverture manuelle du projet10:29 ; demande PDF12:05 ; demande `/live`15:08 ; autorisation budget ultérieure. Trace des blocages de permissions et actions autorisées, sans secrets ni coordonnées de comptes publiés.

## S20. Support final confirmé et site actuel

Réponse directe d'Erwan dans ce chat à la question sur le support soumis/montré : «le site final actuellement deploy sur physical-impact.com». Observation en lecture seule via Aside le22octobre pendant l'audit : accueil, `/demo` fraîchement navigué et `/live/`. L'accueil «Try it live» cible `/demo/`, «Live product» cible `/live/`. Démo fraîche : scénario enrichi240/360palettes,68400EUR potentiel et état déjà complété dans le stockage navigateur existant ; asset `index-CjOjDFKl.js`. Pas de reset/approbation/rejeu effectué par l'audit. Ancien onglet préchargé montrait encore le petit scénario : navigation fraîche requise avant conclusion. `/live/` affiche Coming soon.

Snapshots et captures ont été reçus ; les screenshots fullPage Aside ont présenté des répétitions de tuiles et ne servent pas à conclure sur la structure de toute la page. Les captures viewport et constats DOM ciblés complètent la réception. État actuel ne prouve pas octets exacts au jury. Web open n'accédait pas au domaine ; Aside hôte autorisé a fonctionné après erreur sandbox. Aucun redémarrage produit.

## S21. Skills et recherche outils

Lectures des skills `audit-source`, `recherche-multisource`, `briques-da`, découverte des capacités et références utiles ; analyse dédiée des capacités UI/demo existantes, dont adaptation Emil déjà présente. Recherche primaire publique avec arbres/révisions, docs, code, erreurs et tests ciblés. [TOOL-RESEARCH.md](TOOL-RESEARCH.md) conserve les sources exactes, licences, dates, couvertures et limites par outil. Tests externes et rendu vidéo NOT_RUN. Disponible maintenant, lu pendant cet audit, invoqué historiquement et gain mesuré sont quatre claims distincts.

Boucle historique effectivement appliquée : `proposals/product/research-data-20261022/sector-sources/RESEARCH-METHOD-RETROSPECTIVE.md` et `skill-update-20261022/SKILL-UPDATE-RECEIPT.json`, lus intégralement après contre-lecture de couverture. Installation locale à 11:38:59Z, soit 13 h 38 Paris ; quatre fichiers ajoutés/modifiés dans un paquet de huit, invocation inchangée, original conservé. Statut `LOCAL_CODEX_SKILL_UPDATED_AND_BYTE_VERIFIED`, manifeste `ef82b748f9ad6cde32e88dfc8e88fb00146fbea17a2d90f8171a2e43164fa2cc`. Nouvel agent NOT_RUN, gain causal non établi, aucun collecteur produit ajouté. Ce travail historique n'est pas une modification d'ErwanOS par le présent audit.

## Couverture finale du mandat

| Zone | Lecture reçue | Disposition / limite |
| --- | --- | --- |
| Historique/branches/diffs/abandons | S01,S15,S19 | Couvert pour l'enquête ; Git trop grossier pour minute par minute ; pas abandon versionné retrouvé |
| Brief/idée/valeur/pivots | S02-S05,S14 | Couvert via sources conservées et messages ; règles organisateur finales non reçues |
| Architecture/services/code/tests | S07-S12 | Chemins pertinents suivis ; aucune réexécution ni preuve production nouvelle |
| UX/design/assets/démo | S13-S14,S20 | Pixels historiques et site actuel lus ; jury/parcours exact/vidéo finale inconnus |
| Coordination/outils/skills réellement utilisés | S06,S14,S19,S21 | Traces distinguées des prescriptions ; aucun relevé exhaustif de tous appels/coûts prétendu |
| Issues/PR/discussions/logs/suivi | S01,S18-S19 | Surfaces disponibles consultées ; pas accès à un formulaire de soumission reçu |
| Dual-track et alternative | Enseignements et vNext | Proposition liée aux incidents ; bénéfice causal non testé |
| Skills UI et vidéo demandés | S21,TOOL-RESEARCH | Identités/révisions primaires, chemins utiles et maintenance observée ; pas adoption ni installation |
| Pack local/Harness/ErwanOS | Learning pack | Candidats et évaluations, aucun transfert/activation global |
| Réception documentaire | AUDIT-RECEIPT | Contrôles de contenu, revue indépendante, HTML/offline/archivage/PR selon états effectivement reçus |

La couverture vise les mécanismes et questions pertinents, pas chaque ligne des993chemins de propositions, chaque source web historique ni toutes les branches de chaque test. Une campagne runtime non exécutée limite le niveau de preuve ; elle ne transforme pas une lecture nécessaire accessible en exception. Les inconnues qui demandent un retour humain ou un artefact non retrouvé restent nommées dans les quatre documents.
