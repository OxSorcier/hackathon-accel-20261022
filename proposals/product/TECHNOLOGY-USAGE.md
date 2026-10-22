# Accel : sponsors, crédits et usages pour notre produit

22 octobre 2026, Paris. Version 1. Synthèse documentaire et propositions d'intégration. Mots de recherche : Accel, sponsors, crédits, Modal, Aiven, OpenAI, Keenable, technology usage.

Pour notre bureau de décisions, les trois rôles immédiats sont clairs : **Aiven conserve les données et doit héberger l'application ; OpenAI fournit le modèle ; Keenable découvre les sources web.** Les autres technologies peuvent répondre à une extension précise. Leur intérêt dépend de ce que nous voulons démontrer à Paul.

## Les offres et leur utilité

Les dotations ci-dessous viennent de la [fiche officielle du hackathon sur Luma](https://luma.com/0v3c010v) et de la [page Resources BuilderBase](https://builderbase.com/track-dashboard/accel-ai-innovate-paris/resources), ouverte dans Aside à la demande d'Erwan le 22 octobre. Les six PDF proposés sur Resources ont été téléchargés et leurs huit pages extraites : packs n8n, Modal, Keenable, Devin, ElevenLabs et brief Aiven. Le suivi propriétaire `docs/ACCES-CREDITS.md` conserve l'état des activations. Les usages proposés sont notre analyse, pas des intégrations déjà réalisées.

| Technologie | Crédit ou offre annoncés | À quoi elle sert | Intégration possible dans notre produit |
| --- | --- | --- | --- |
| [Aiven](https://aiven.io/docs/products/runtime) | Crédits participants, montant public non indiqué. Essai distinct de 50 USD sur 30 jours reçu selon le propriétaire. | PostgreSQL managé pour conserver les données ; Runtime pour faire tourner notre application en conteneur. | Conserver stocks, réservations, sources, propositions et décisions ; exécuter le serveur et la veille même quand Paul ferme son navigateur. Socle retenu. |
| [OpenAI](https://developers.openai.com/api/docs/guides/function-calling) | 50 USD API. Dotation disponible et échéance au 21 novembre 2026 constatées par le propriétaire. | Modèles capables de demander des outils de l'application et de composer une réponse à partir de leurs résultats. | Lire le contexte autorisé, demander les calculs métier, puis préparer une proposition expliquée. Fournisseur retenu ; les calculs et l'approbation restent côté serveur. |
| [Keenable](https://docs.keenable.ai/) | 1 000 USD par participant, confirmés par le pack PDF ; solde et quotas reçus par le propriétaire. | Recherche web et accès aux contenus pour les agents, via API ou MCP. | Trouver des sources sectorielles, régionales et réglementaires. Enregistrer provenance et date, puis qualifier le lien avec l'entreprise avant tout calcul d'impact. |
| [Anthropic](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) | 100 USD API ; demande avant le 5 novembre, expiration trois mois après attribution selon les conditions lues par le propriétaire. | Claude peut lui aussi appeler les outils définis par l'application. | Fournisseur alternatif derrière notre adaptateur. Éventuellement comparer la qualité sur les mêmes cas, sans ajouter deux modèles au premier parcours. Crédit demandé, attribution en attente. |
| [Modal](https://modal.com/docs/guide/functions) | 100 USD par participant ; nombre de réclamations limité selon le pack PDF. | Calcul cloud à la demande, en particulier fonctions Python, CPU/GPU et traitements parallèles. | Extraire des catalogues PDF, produire des embeddings ou calculer beaucoup de scénarios de réapprovisionnement. Extension conditionnelle : aucun besoin de calcul massif démontré dans notre scénario actuel. |
| [n8n](https://docs.n8n.io/) | Un mois de Cloud Pro par personne, valeur annoncée de 60 EUR. Code à utiliser pendant l'événement, activations limitées. | Automatisations visuelles entre applications, déclenchées notamment par webhook. | Après une décision validée, transmettre un événement à un workflow ERP/CRM ou préparer un récapitulatif. Garder notre calendrier métier, nos droits et notre état durable dans l'application. Non intégré. |
| [Supabase](https://supabase.com/docs) | 25 USD, présentés comme un mois Pro. | Plateforme backend avec PostgreSQL, authentification, stockage de fichiers et temps réel. | À terme, comptes clients et pièces jointes. Le PostgreSQL Aiven du concours couvre déjà notre stockage métier ; une deuxième base ajouterait une synchronisation. Non intégré. |
| [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) | 120 USD. | Point d'accès aux modèles de plusieurs fournisseurs, avec suivi des requêtes et des coûts. | Comparer ou changer de fournisseur en gardant un point d'accès commun. Peut être appelé depuis Aiven ; il n'impose pas d'héberger l'application sur Vercel. Offre et accès non reçus dans le suivi consulté. |
| [ElevenLabs](https://elevenlabs.io/docs/overview/intro) | 110 000 crédits par participant, récupération via Discord selon le pack PDF. | Synthèse vocale, transcription et agents vocaux. | Paul dicte une question ou écoute un résumé de ses alertes ; autre usage possible, une voix pour la vidéo de démo. L'usage vidéo serait un outil de production, à distinguer d'une fonction du produit. Non intégré. |
| [Devin / Cognition](https://devin.ai/) | 200 USD de réduction promotionnelle sur un abonnement Teams ou Max selon le pack PDF. | Agent de développement logiciel, pour construire et tester du code. | Aider à développer un connecteur ou corriger un bug. Outil de construction possible, distinct de l'agent utilisé par Paul. Offre absente de la liste Luma relevée, mais bien présente dans Resources. Aucun usage ni abonnement reçu. |
| [Stripe](https://docs.stripe.com/payments) | 500 USD par équipe. Périmètre exact du crédit à confirmer. | Paiements, facturation et abonnements. | Facturer plus tard l'abonnement du négoce à notre service. Cela ne réalise pas les achats fournisseurs proposés par l'agent. Non intégré ; crédit annoncé distinct d'argent encaissé. |
| [Lovable](https://docs.lovable.dev/introduction/welcome) | Crédits, montant non publié sur Luma. | Construire et itérer une application web en décrivant ce que l'on veut. | Prototyper un onboarding ou une landing page. Le produit actuel possède déjà sa direction A et sa base React/Vite. À créditer comme outil de construction seulement s'il est réellement utilisé. |
| [Miro](https://help.miro.com/hc/en-us/articles/360017730533-What-is-Miro) | Un mois Enterprise. | Espace de collaboration pour parcours, ateliers et schémas. | Cartographier la journée de Paul, le parcours de décision ou l'architecture. Outil de conception possible ; aucun usage attesté ici. |
| [Lightdash](https://www.lightdash.com/integrations) | Un mois Cloud Pro par équipe. | Analyse et tableaux de bord sur les données, avec connexion PostgreSQL documentée. | Mesurer latence, coût des runs, décisions et résultats des essais via des vues analytiques en lecture seule. La connexion à notre base et les métriques restent à construire ; aucun gain métier n'est déjà mesuré. |

## Conditions précisées dans Resources

Les cinq packs commerciaux tiennent chacun sur une page. Le brief Aiven a trois pages. Les repères ci-dessous viennent des documents téléchargés depuis les boutons observés dans Aside ; aucune offre n'a été réclamée par ce travail et les codes ne sont pas recopiés.

- **Devin, pack 04, page 1 :** connexion au portail partenaire avec l'email d'inscription au hackathon pour obtenir un code individuel, puis application au checkout Stripe d'un abonnement Teams ou Max. Les 200 USD concernent cet abonnement ; ce ne sont pas des crédits API modèle.
- **ElevenLabs, pack 05, page 1 :** rejoindre le Discord officiel, accéder au canal coupon-codes, choisir Start Redemption et AI Innovate Paris, puis utiliser l'email d'inscription. Le bot fournit un coupon individuel. La documentation explique les capacités vocales ; la durée audio couverte dépend des fonctions et modèles utilisés.
- **Keenable, pack 03, page 1 :** à l'inscription, choisir Other et fournir le code du pack. Les crédits sont annoncés le jour même. Le pack donne aussi la bonne adresse de documentation, [docs.keenable.ai](https://docs.keenable.ai/), effectivement ouverte et lue après cette vérification.
- **Modal, pack 02, page 1 :** créer d'abord un compte Modal, puis utiliser le formulaire de réclamation du pack. La dotation est par participant et le nombre de réclamations est limité. Le PDF ne donne pas d'échéance d'expiration.
- **n8n, pack 01, page 1 :** choisir Cloud Pro et appliquer le code au checkout pendant l'événement. Le code partagé a un nombre limité d'utilisations. Le pack ne précise pas les conditions de renouvellement après le mois offert.
- **Aiven, brief, pages 1 à 3 :** application à déployer sur Runtime ; services de données Aiven lorsque pertinents. Des crédits sont annoncés pour chaque équipe, sans montant. Le brief mentionne aussi un prix distinct pour le meilleur usage de la plateforme Aiven.

Les trois cartes de code lues directement dans Resources indiquent : Anthropic, 100 USD API valables 90 jours, utilisables via API/Claude Code avec compte Console et pas via un abonnement claude.ai ; OpenAI, 50 USD API valables 30 jours après récupération ; Supabase, 25 USD et un mois de Pro. Les boutons Show n'ont pas été ouverts, puisque les valeurs des codes ne sont pas nécessaires à la synthèse.

## Modal, concrètement

**Modal permet de louer de la puissance de calcul quand une tâche en a besoin.** On décrit une fonction, son environnement et ses ressources ; Modal lance le conteneur et peut multiplier les exécutions. Ses fonctions peuvent revenir à zéro conteneur actif lorsqu'elles ne reçoivent plus de travail. Les GPU sont disponibles pour les tâches qui en ont besoin ; une tâche CPU peut aussi suffire. Sources : [fonctions Modal](https://modal.com/docs/guide/functions) et [traitements par lots](https://modal.com/docs/guide/batch-processing).

Exemple proposé : Paul importe 200 catalogues fournisseurs en PDF. Notre serveur soumet des documents autorisés à un traitement Modal. Les fonctions extraient références, unités et disponibilités déclarées en parallèle. Le serveur valide le résultat et l'enregistre dans PostgreSQL Aiven avec sa provenance ; une extraction ne confirme pas une disponibilité commerciale actuelle.

Autre exemple proposé : explorer des milliers de combinaisons de dépôts, coûts et dates pour suggérer les meilleures options. Modal porte le calcul, tandis qu'Aiven conserve l'état et que notre serveur vérifie les contraintes avant de présenter le résultat. Pour les trois dépôts de la démo, notre moteur déterministe Node suffit à ce stade. Un besoin de GPU, un gain de temps ou une économie restent à mesurer.

La [documentation GPU Modal](https://modal.com/docs/guide/gpu) exige un moyen de paiement valide enregistré pour utiliser un GPU. L'éventuelle exception du pack hackathon n'est pas reçue ; les 100 USD annoncés ne prouvent donc pas à eux seuls un accès GPU activé.

Raccord éventuel : serveur Aiven → fonction Modal protégée et bornée → résultat structuré validé → PostgreSQL Aiven → proposition révisable. Cette chaîne reste proposée, sans activation ni exécution Modal par ce travail. Les [endpoints HTTP Modal](https://modal.com/docs/guide/webhooks) décrivent une voie d'appel depuis une autre application.

## Ce que nous pouvons attester aujourd'hui

Lecture du checkout et des reçus le 22 octobre 2026 ; les essais ci-dessous n'ont pas été relancés dans cette synthèse.

| Périmètre | Preuve effectivement lue | Ce qui reste à vérifier |
| --- | --- | --- |
| PostgreSQL Aiven | `proposals/integration/AIVEN-PRODUCT-SMOKE.json` : connexion réelle du produit, TLSv1.3, migrations 001/002/003, session synthétique créée explicitement et relue après reconnexion. | Parcours complet, reprise applicative et version finale. Déploiement Runtime : NOT_RUN dans ce reçu. |
| OpenAI | Dernier delta de l'intégrateur relu : `OPENAI-REAL-QUESTION.json` puis `REAL-CASE-FLOW.json`, reçu du 22 octobre à 11 h 55, Paris. Modèle réel gpt-5.4-mini, outils métier, proposition, approbation et relecture sur Aiven. | Réception finale UI/données et reprise applicative de la version finale. Aucun nouveau run modèle effectué par cette synthèse. |
| Keenable | `REAL-CASE-FLOW.json` et `docs/STATUS.md` : publication ROCKWOOL de juillet réellement lue via Keenable, source conservée puis utilisée dans le dossier et le calcul conditionnel. La branche confirmée utilise un événement interne synthétique distinct. | Collecte bornée partielle. L'URL reçue prioritairement puis lue ne prouve pas un succès de classement Search. La source publique ne confirme aucun lien commercial ni retard réel. |
| Autres offres | Capacités décrites dans les sources officielles ; Anthropic demandé, Modal/n8n en réserve et Supabase sans activation reçue dans le suivi consulté. | Crédit, accès et usages produit non attestés. Devin, Vercel, ElevenLabs, Stripe, Lovable, Miro et Lightdash : activation inconnue dans les sources consultées. |

L'essai Aiven et le crédit sponsor sont deux dotations différentes. Un crédit disponible, une API testée et une fonction produit éprouvée correspondent à trois états différents. Les conditions détaillées des offres non activées et les soldes courants n'ont pas été relus dans les comptes par ce travail. Le propriétaire des accès reste le chat indiqué dans `docs/ACCES-CREDITS.md`.

Le dernier reçu de parcours remplace donc, dans cette synthèse, l'ancien état limité aux essais API autonomes. Le serveur est local et la base est sur Aiven. L'approbation a été enregistrée puis relue ; le stock est resté inchangé. Aucun achat, transfert ou contact réel n'a été exécuté. Le déploiement Aiven Runtime et la réception finale de l'interface restent distincts et en attente.

## Bloc anglais prêt pour le README

Proposition conservée séparément pour l'intégrateur, propriétaire de `README.md`. Ce bloc décrit le rôle et l'état actuel sans revendiquer un parcours complet déjà éprouvé.

```markdown
## Technology usage

- **Aiven for PostgreSQL:** durable storage for company data, source evidence, versioned proposals, decisions and attributed memory. The product connection, migrations and readback after reconnection have been tested on Aiven with synthetic data.
- **Aiven Runtime:** target hosting for the application server and background monitoring. Deployment is pending.
- **OpenAI API:** bounded tool calling for company-context lookup, deterministic business evaluation and reviewable proposals. Real model calls, proposal approval and persisted readback have been exercised from the local server against Aiven with synthetic company data.
- **Keenable API:** public web search and content retrieval for sector monitoring. A real public source has been retrieved, persisted and used in a decision case. Collection is bounded and partial; public news does not establish a commercial relationship or an actual supplier delay.

Final UI/data reception and Runtime deployment are pending. No inventory movement or purchase is executed by approval. See docs/ACCES-CREDITS.md and docs/STATUS.md for the current evidence.
```

Après un usage réellement livré, une ligne supplémentaire peut prendre cette forme : « Modal for parallel extraction of supplier catalogue data » ; « n8n for approval-triggered ERP workflows » ; « ElevenLabs for voice summaries of operational alerts » ; « Lightdash for operational and agent-performance dashboards ». Ces quatre formulations sont conditionnelles. Elles ne figurent pas parmi les technologies utilisées tant que ces fonctions ne sont pas implémentées et testées.

## Sponsors, organisateurs et prix

Luma présente Accel et Iterate comme organisateurs, et BuilderBase comme plateforme de l'événement. Ils peuvent apparaître dans les remerciements. La section « Technology usage » doit expliquer les technologies effectivement utilisées, leur fonction et leur état.

Les prix sont distincts des dotations participants. Luma annonce notamment 5 000 USD Modal, 5 000 USD Anthropic et 5 000 USD Supabase pour les équipes gagnantes selon ses formulations, ainsi que 12 000 USD Aiven, 12 000 USD Vercel AI Gateway et 25 000 USD AWS dans la rubrique des prix. Leur attribution et leur répartition exactes restent à confirmer avec l'organisateur. AWS apparaît dans cette rubrique ; le Pocket est un lot matériel. Aucun de ces lots n'est un crédit déjà reçu par notre équipe. Source : [rubriques participants et prix de Luma](https://luma.com/0v3c010v).

## Sources et limites

Sources consultées le 22 octobre 2026 : fiche Luma pour les offres publiques ; Resources BuilderBase lu dans Aside, ses trois cartes de codes et six PDF ; documentations officielles liées dans chaque ligne pour les capacités ; suivi `docs/ACCES-CREDITS.md`, `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/OWNERSHIP.md`, `README.md`, reçu Aiven et reçus `OPENAI-REAL-QUESTION.json` / `REAL-CASE-FLOW.json` pour l'état du projet. Les huit pages des PDF ont été extraites en texte ; leur mise en page n'a pas fait l'objet d'une recette visuelle. La présence du raccord Keenable a été contrôlée dans le checkout, sans audit de son implémentation ni exécution. La première adresse app.keenable.ai/docs demandait JavaScript ; l'adresse docs.keenable.ai donnée dans le pack est accessible et sa documentation a ensuite été lue.

Cette synthèse complète le suivi existant des accès ; elle ne le remplace pas. Les derniers deltas datés priment sur les lignes historiques encore présentes dans certains documents. Aucun compte, crédit, dépendance ou service n'est activé par cette proposition. Pas de modification du code applicatif ou de README, ni commit, push ou déploiement. Relecture indépendante de la recommandation : NOT_RUN, sans délégation dans ce mandat ; priorisation proposée à partir du socle déjà reçu.

Préparation documentaire avec les skills recherche-multisource, briques-da, google-drive et pdf, et la découverte des capacités du projet. Les fichiers locaux gardent leur contenu éditable et leur version HTML autonome ; les liens externes nécessitent Internet lorsqu'on les ouvre.
