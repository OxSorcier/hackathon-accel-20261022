# Profil Hackathon V0

État courant du 21 octobre 2026 : les modules `hackathon-bootstrap` 0.3.1, `hackathon-ideation` 0.2.0 et `demo-package` 0.1.0 sont installés sur demande explicite. [La réception datée](updates/20261021-brief/HARNESS-RECEPTION-20261021.md) précise tests, versions et limites. Le texte initial ci-dessous décrit la préparation du 18 octobre ; son absence d'installation appartient à cet historique.

Version V0.1 candidate pour évaluation documentaire, 18 octobre 2026. Entrée : URL d'événement, intention d'Erwan et projet existant éventuel. Sortie : décisions sourcées, plan borné, livrables vérifiables et état de reprise. Consumer actuel : pilote [ERW-132](https://linear.app/briques/issue/ERW-132). Aucune inscription dans un catalogue, installation de skill, activation WorkOS ou automatisation n'est effectuée.

## Delivery language, received 22 October 2026

All authored hackathon deliverables use English: product UX/UI and agent output, design/flow images, README/documentation, websites, slides, demo/video copy and submission material. Apply the [shared language contract](../../work/hackathon-skills-candidate-20261018/skills/hackathon-bootstrap/references/language.md) before producing or reviewing any of them. Preserve original source material, native IDs and dated historical evidence. Conversation with Erwan may remain in French. This standing instruction supersedes the earlier README-only language default; earlier receipts retain their historical scope.

## 1. Retrouver avant de produire

Lire le point d'entrée du projet, son contrat et ses décisions courantes. Rechercher événement, URL, dépôt, anciens noms, tickets/parents et propriétaire actif. Reprendre l'audit et le dernier reçu, puis noter les changements de sources. Ne pas lancer un second worker sur un périmètre déjà possédé. Si la recherche est vide, conserver requêtes, projet, pagination et date ; cela étaye une absence dans ce périmètre, pas une absence universelle.

Composer `work-reconcile`, `audit-source` et la découverte des capacités de `plan-validate-execute-learn`. Réutiliser le tracker et le stockage adoptés : GitHub pour architecture/code/savoir versionné, Linear pour travail, Figma pour design validé, FigJam pour les parcours et Drive selon le contrat projet. Les miroirs et noms lisibles ne changent ni IDs ni autorités.

Pour ce pilote, le résultat est un parent ERW-132, un enfant nouveau ERW-133 pour le 22 et le parent GLUE existant ERW-110. H01-H06 restent sous ERW-110 ; ERW-128/129/101/106/99 sont liés comme capacités, sans relancer leurs missions.

## 2. Recevoir l'événement

Lire la fiche et ses liens officiels. Renseigner dans le dossier événement : titre/URL canonique ; date, horaires et fuseau ; lieu/modalité ; organisateurs ; admission et équipe ; challenges ; jury/barème ; partenaires et obligations ; code préexistant, IA, données, licences ; soumission, format, champs, taille/durée, accès jury ; deadline et preuve de réception.

Pour chaque champ conserver `OBSERVED`, `REPORTED`, `INFERRED` ou `UNKNOWN`, source/date et conséquence. Un crédit annoncé n'est ni reçu ni activé. Un conférencier n'est pas un juge par déduction. Une heure de pitch ne prouve pas l'heure limite de dépôt. Ne pas emprunter à un autre événement ses règles ou son jury. Toute règle nouvelle invalide les décisions concernées et revient au contrôle d'admissibilité.

Sortie : une fiche sourcée, liste des inconnues et des décisions dépendantes. Le contact avec un organisateur ou une inscription restent des actions d'Erwan hors mandat actuel. Si le règlement interdit le pré-build, préparer stratégie/canevas autorisés et construire seulement dans la fenêtre admise. Si cette règle est inconnue, ne pas déclarer la réutilisation admissible.

## 3. Choisir une seule expérience

Pour comparer des idées depuis le brief, le jury connu, les partenaires et nos moyens, utiliser `hackathon-ideation`, installé en version 0.2.0. La [source locale versionnée](../../work/hackathon-skills-candidate-20261018/skills/hackathon-ideation/SKILL.md) conserve la méthode ; les anciens essais restent attachés à leurs versions. Esquisser les pistes depuis les utilisateurs, puis confronter les actifs réellement vérifiés et conserver les réemplois retenus ou écartés. Comparer une option indépendante du patrimoine quand cela éclaire le choix. Après sélection d’une idée, réutiliser `ce-brainstorm` pour un besoin réellement ouvert, `ce-strategy` pour une direction durable et `ce-plan` pour traduire une direction décidée en exécution. Ces méthodes sont des capacités à invoquer à leur phase, pas des documents à produire systématiquement. Ne pas rejouer un brainstorm déjà arbitré.

Comparer deux ou trois concepts après réception des challenges. Utiliser le barème officiel s'il existe ; sinon nommer explicitement une grille interne : douleur concrète, différence, résultat visible, dépendances disponibles, coût/temps et conformité. Ne pas lui attribuer le statut de grille du jury. Chaque idée indique ce qu'on sacrifie et ce qui ferait abandonner l'option. Erwan choisit le concept et un scénario central.

Transformer les principes d'[Orbit](https://docs.google.com/document/d/16H3j49XgTI24_bdMNHXM-daV9PHRBPt3jah7TQAKDhg/edit) en actions : commencer par comprendre le brief ; terminer l'analyse par une décision ; réduire les intermédiaires ; vérifier horloge/ressources ; livrer dans le format demandé. La règle « ne pas changer de stratégie » venait d'une simulation de crise : un challenge nouveau ou une contrainte rédhibitoire justifie un arbitrage explicite, pas l'obstination.

Sortie : une promesse, un utilisateur, un chemin nominal, une preuve observable, un hors-scope et un plan de coupe. Aucun agent ne change silencieusement cette décision.

## 4. Valider le produit et le visuel

Réutiliser `erwan-product-ui` : source actuelle -> intention -> variantes visuelles si choix ouvert -> version retenue -> flows et états -> composants. `ux-ui-visual-first` apporte des variantes raster comparables quand une exploration UI est effectivement demandée. Ne pas générer ici une DA pour un produit encore non choisi. Une version approuvée reste valable tant que le changement ne la touche pas.

FigJam porte les parcours selon le contrat du projet, avec IDs communs aux étapes, captures et tests. Montrer attente, erreur, réessai, correction/retour, sources, sauvegarde et partage concernés. Figma porte les écrans/design validés. Lire le brief et le mockup adoptés en plus du node ; cibler un node précis ; vérifier pixels et mesures avant livraison d'UI. Une image raster déposée dans Figma ne vaut pas bibliothèque de composants natifs.

`briques-da` s'applique aux supports de marque Briques concernés ; la palette de Clarity ou GLUE reste propre à son produit. Le profil ne choisit pas une identité commune à tous les hackathons.

Recette Stockholm reçue en complément : nommer les éléments et leurs états, utiliser le vrai contenu autorisé plutôt qu'un remplissage générique, avancer par petits blocs et vérifier le viewport réellement concerné, dont le mobile si le parcours le demande. Elle complète les micro-versions et les gates UX existants ; l'ancien ordre « visuel après code », les boutons d'un fournisseur et les nombres d'écrans ne sont pas importés comme règle.

## 5. Construire uniquement sous mandat distinct

Après concept et flows validés, utiliser le workflow du dépôt et `ce-work`, les contrats existants et les tests appropriés. Attribuer un propriétaire par fichier/worktree et un intégrateur. Paralléliser seulement les unités réellement indépendantes et autorisées. Les compétences Figma, navigateur, hébergement ou site sont choisies selon la stack courante ; aucun fournisseur n'est imposé par ce profil.

Avant toute livraison de code, appliquer `erwan-internal-review` : contre-revue par le même modèle réalisateur et revue Astra, reviewers distincts en contextes neufs. Un modèle indisponible reste `NOT_RUN`. Tests, revue, PR, merge, déploiement et parcours observé conservent leurs états séparés. Un contrôle documentaire de ce pilote n'équivaut pas à cette revue de code, car aucun code produit n'est modifié.

Un site fait partie du package souhaité par Erwan. Préparer sa structure, sa DA et son lien vers la démo ; réutiliser domaine/hébergement existants si reçus. Vérifier propriété, accès et destination avant toute opération. Un domaine mentionné dans une Bible ne prouve ni propriété, ni DNS, ni site publié. Achat et déploiement restent hors mandat actuel.

## 6. Présenter une version reçue

Réutiliser le package Clarity comme structure, sans sa copy métier ni son identité : README anglais avec problème/promesse, lancement, walkthrough, architecture, documentation, tests et limites ; captures réelles légendées ; GIF ; film/pitch si utile ou requis ; site cohérent ; scénario minuté, reset et secours annoncé.

Pour chaque média conserver version applicative lorsqu'elle est connue, date, route, viewport, origine des données et statut réel/simulé. Si le SHA servi n'est pas exposé, le dire. Ne pas transformer une capture ou un HTTP 200 en preuve d'appel réel, persistance ou valeur utilisateur. Un fallback peut préserver le récit ; il ne satisfait une exigence de vrai appel que si le règlement l'admet. Les tests et le script portent sur le même scénario et la même version.

Avant une démo sur place, prévoir le test du réseau de la salle et d'une connexion de secours déjà disponible, un appareil existant de repli et un enregistrement du chemin nominal lié à sa version. Ces contrôles restent à exécuter et n'autorisent ni achat ni activation. Un enregistrement doit être annoncé comme tel. Montrer le périmètre cohérent reçu suffit, sans raconter toutes les idées abandonnées ; conserver toute limite ou simulation qui change l'interprétation de la preuve.

Prévoir une deadline interne avant la deadline officielle vérifiée. Le repère Orbit de 30 minutes devient un buffer candidat à ajuster au format, jamais une nouvelle heure officielle. En retard, couper d'abord les variantes et fonctions secondaires ; préserver un chemin complet et le temps de vérification. Préparer trois objections et réponses liées aux arbitrages réels.

## 7. Contrôler la soumission

Checklist à appliquer selon les exigences reçues, statut initial `NOT_RUN` tant que non exécutée :

- Format, champs, contraintes de taille/langue/durée et deadline officielle relus.
- README anglais cohérent, liens et assets résolus à la version soumise.
- Parcours nominal, reset, panne et fallback répétés ; réel et simulé visibles.
- Permissions du dépôt, du site et des médias testées avec un accès équivalent jury.
- Licence, attributions et données contrôlées selon les règles et droits reçus.
- Identité équipe/projet et obligations sponsor rapprochées du formulaire officiel.
- Validation d'Erwan et autorisation de publication/soumission présentes.
- Reçu de soumission conservé : identifiant, date/fuseau, version, URL et statut.

Ce pilote prépare la checklist ; il n'effectue aucune soumission, inscription ou publication. La réception d'un package reste différente de celle d'une soumission.

## 8. Corriger, apprendre et reprendre

À chaque contrôle : conserver input, source/version, oracle, outil/contexte, résultat, preuve et limites dans le reçu existant. Sur échec, préserver la première observation ; nommer cause étayée, correction bornée, périmètre affecté et prochain contrôle. Deux tentatives infructueuses successives imposent un diagnostic et un blocker concret selon la méthode existante. Une limite externe bloque seulement sa branche.

Si une génération dérive, préserver le travail acquis, isoler la reprise et repartir de la dernière référence correcte reçue ; reformuler résultat, éléments précis, contraintes et critère d'arrêt, puis vérifier un petit delta. Ne pas multiplier les réparations sur un état mal identifié. Les anciens conseils de désactiver confirmations ou contrôles de données sont retirés du profil générique : la reprise conserve les frontières et permissions. Aucun reset destructif n'est autorisé par cette recette.

Réutiliser `learning-reuse` et, quand un problème résolu mérite une leçon durable, `ce-compound`. Conserver une leçon candidate avec situation, mécanisme, exception, avant/après vérifié et prochain consumer. La promotion n'est pas automatique. Une amélioration du document n'établit ni gain métier ni avantage causal sans baseline comparable.

Le paquet de reprise donne objectif et droits, WorkItems natifs, propriétaire actif, sources/révisions/digests utiles, décisions validées, contrôles réellement exécutés, inconnues et prochaine action faisable. Le nouveau lecteur reçoit le point d'entrée et les sources brutes ; les réponses attendues et verdicts précédents restent hors de son contexte. Sa lecture effective et son résultat sont évalués séparément.

## Composition et maturité

`hackathon-bootstrap` et `demo-package` sont déjà des noms candidats dans l'architecture ErwanOS. Ce profil remplit leur rôle d'entrée/composition documentaire ; il ne les recrée pas comme skills installés. Les mécanismes source restent gouvernés par leurs versions et contrats. L'évaluation V0 prouve des cas documentaires bornés ; les événements réels, l'installation et la promotion restent à recevoir séparément.
