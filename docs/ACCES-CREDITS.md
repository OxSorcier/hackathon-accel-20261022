# Accès et crédits utiles

22 octobre 2026. Propriétaire des comptes et activations : chat « Reprendre et lancer le hackathon », ID 01a16283-2006-7bd3-b07f-2ceaf2535784. Coordination avec « Hackathon Accel » autorisée par Erwan. Ce document conserve des états non secrets ; codes d'activation et clés restent dans leurs canaux et configurations autorisés.

## Accès réellement reçus
- Projet Codex local : Accel, ID 8c1ddc08-8cfc-42cb-ad37-5b132ce345eb, dossier /Users/erwan/Projects/hackathon-accel-20261022.
- Dépôt GitHub privé vide : https://github.com/OxSorcier/hackathon-accel-20261022. Créé et relu par le chat d'accès ; métadonnées relues par le coordinateur. Aucun commit/push, CI ou déploiement reçu lors de cette passation.
- Aiven : le chat d'accès rapporte une connexion réelle, organisation a5ec0ff0b365, projet accel-20261022, https://console.aiven.io/account/a5ec0ff0b365/project/accel-20261022/get-started.
- Aiven : dotation d'essai de 50 USD sur 30 jours constatée par le chat d'accès avant la création du premier service. Crédit sponsor hackathon non reçu à ce stade ; ces deux dispositifs restent distincts. Le solde après consommation reste à relire.
- PostgreSQL Aiven : création confirmée au chat d'accès pour le service accel-postgres, projet accel-20261022. Configuration rapportée : PostgreSQL 18, tier Professional, plan Hobbyist, 1 CPU, 2 Go de RAM, 8 Go de stockage, Google europe-west9 (Paris), estimation de 25 USD/mois sur 730 heures. [Console du service](https://console.aiven.io/account/a5ec0ff0b365/project/accel-20261022/services/accel-postgres). Connexion SQL réelle et TLS vérifiés selon le dernier reçu du propriétaire ; migrations et parcours produit encore à vérifier.
- Modèle : accès OpenAI et tool calling réellement testés par le propriétaire, HTTP 200 ; parcours du produit encore à vérifier. Recherche : accès Keenable réellement testé par le propriétaire, HTTP 200 ; raccord produit encore à vérifier, voir les derniers deltas.

Le raccord Git local, les commandes et les contenus appartiennent à l'intégrateur ; aucune opération Git concurrente depuis le chat des comptes. La visibilité privée ne prouve pas une sauvegarde du code : le dépôt est encore vide.

## Liste des offres transmise par Erwan
Les lignes suivantes sont les annonces transmises par Erwan dans le chat coordinateur. Conditions détaillées à vérifier dans les liens sponsor et les comptes. Elles ne constituent pas des soldes reçus.

| Offre annoncée | Conditions transmises | Usage pour notre tranche | État |
| --- | --- | --- | --- |
| Aiven, crédits par équipe, montant non indiqué | Crédit sponsor à récupérer | Priorité : Runtime et PostgreSQL requis | Essai distinct reçu selon chat d'accès ; sponsor à récupérer |
| Anthropic, 100 USD API | 90 jours, activation au plus tard le 5 novembre, une par organisation ; Platform/Claude Code, pas abonnement claude.ai | Premier fournisseur possible si accès et tool calling confirmés | Demande soumise selon le propriétaire ; crédit et API non reçus |
| OpenAI, 50 USD API | Échéance du 21 novembre 2026 constatée par le propriétaire | Fournisseur retenu sur Cliccc par Erwan ; un raccord à la fois | Dotation disponible, clé dédiée transférée et premier appel autonome avec outil HTTP 200 selon le propriétaire ; parcours produit à vérifier |
| Keenable, 1000 USD par participant | API recherche web agents ; offre et compte désormais lus par le propriétaire | Collecteur Keenable confié au chat données, assemblage à l'intégrateur | Solde et quotas reçus ; clé transférée après accord humain et un appel réel HTTP 200 selon le propriétaire ; raccord produit à vérifier |
| Modal, 100 USD | Offre Accel Paris attribuée le 22 octobre 2026, expiration au 31 octobre 2027 selon le propriétaire | Réserve si calcul spécifique utile ; pas requis pour le premier parcours | Crédit sponsor Active, 100/100 USD disponibles selon le propriétaire ; calcul et API NOT_RUN |
| n8n, un mois Cloud Pro annoncé à 60 EUR | Code au checkout pendant l'événement, activations limitées | Réserve ; conserver un seul calendrier métier dans notre app | Liste transmise, non activé ici |
| Supabase, 25 USD, présenté comme un mois Pro | Conditions à recevoir | Réserve ; PostgreSQL Aiven reste la couche de données reçue pour ce concours | Liste transmise, non activé ici |

## Réception de chaque activation
Le propriétaire vérifie le compte et l'organisation destinataires avant l'activation ; il distingue code soumis, crédit attribué, solde lisible et appel API réussi. Conserver date d'activation, échéance, périmètre, quota et éventuel moyen de paiement requis. Une offre annoncée, un abonnement chat et un accès API ne sont pas interchangeables.

Ordre utile : crédit Aiven sponsor ; un accès modèle testé ; accès de recherche si utile. Les autres offres ne déclenchent pas un changement d'architecture ou une consommation simplement parce qu'elles sont disponibles. Les confirmations nécessaires à une nouvelle permission, acceptation de conditions ou dépense restent dans le parcours du compte.

Un nouveau chat consacré aux crédits reprend d'abord ce fichier et docs/THREADS.json, puis le propriétaire existant. Il ne crée pas d'organisation ou d'activation en doublon. Les résultats se qualifient séparément : annoncé, éligibilité vérifiée, activation soumise, crédit reçu, API testée, utilisé dans le produit.

## Prochaine action
Le chat d'accès poursuit crédits sponsor et modèle. L'intégrateur poursuit la construction locale et reçoit les identités/états utiles, sans secret dans les documents. Un déploiement nécessite encore accès effectifs, version à déployer et autorisation applicable.


Actualisation de coordination : le propriétaire des accès rapporte l’accord d’Erwan « utilise les 50 et on voit ensuite » pour préparer les services dans les 50 USD d’essai Aiven, sans carte ni dépassement de cette enveloppe. Il possède cette préparation de ressources ; l’intégrateur possède toujours la version applicative et ses contrôles. PostgreSQL est désormais créé selon le reçu du propriétaire. Appel modèle, connexion produit et déploiement restent à recevoir.

## Dernier reçu du propriétaire des accès

Le 22 octobre, le chat « Reprendre et lancer le hackathon » confirme la création de PostgreSQL ci-dessus et le raccord GitHub/Aiven. Ce reçu porte sur la ressource créée et le raccord de compte, sans test SQL ou connexion depuis l'application.

Pour Anthropic, Erwan a choisi le compte Briques et a validé la passkey. Le parcours affiche désormais la création d'organisation Briques ; aucun crédit API ou appel produit n'est encore reçu. Le propriétaire rapporte avoir effectivement lu les ressources sponsor officielles : Anthropic 100 USD sur 90 jours, OpenAI 50 USD sur 30 jours. Ces conditions lues ne sont pas encore des activations ou des inférences produit réussies.

Le propriétaire rapporte l'accord exact d'Erwan pour raccorder Aiven à GitHub, limité au seul dépôt privé hackathon-accel-20261022. Le raccord est désormais terminé et reçu dans GitHub et Aiven : GitHub App Aiven Platform, installation 174054864, mode Only select repositories, exactement un dépôt sélectionné, permissions affichées de lecture du code et des métadonnées. Aiven affiche GitHub connected et reconnaît OxSorcier. Runtime et code distant ne sont pas encore déployés ; sélectionner la source nécessite une branche et un manifeste publiés dans l'autorisation Git applicable.

Historique du raccord : le contrôle automatique avait refusé « Connect GitHub account », car la connexion permet aux membres de l'organisation Aiven de déployer les dépôts sélectionnés. L'action refusée n'avait pas été exécutée. Le nouvel accord humain est ciblé sur le dépôt du hackathon ; il ne constitue pas une autorisation pour les autres dépôts.

Anthropic : le propriétaire dispose du lien privé d'offre fourni directement par Erwan et l'utilise dans la session Briques authentifiée. Le tableau de bord affichait 0 USD avant demande. La page officielle AI Innovate Paris, lue par le propriétaire, annonce 100 USD, une demande avant le 5 novembre, une expiration trois mois après attribution et un délai d'attribution de un à deux jours ouvrés après formulaire. Le dernier reçu confirme la soumission : la page affiche « Demande soumise ». Le champ requis a été rempli après réponse d'Erwan. Crédit attribué, clé API dédiée et premier appel restent à vérifier. Le lien et le code privés ne sont pas recopiés dans ce dossier ni transmis aux autres chats.

Conséquence pour le build : ne pas compter ces 100 USD comme disponibles pour la démo du 22 octobre. Le premier appel réel nécessite un accès déjà crédité ou une autre offre réellement activée. Le chat d'accès vérifie la piste OpenAI si Anthropic reste en attente. Une demande de crédit, une clé créée et une réponse modèle réussie restent trois preuves distinctes ; aucun test modèle réussi n'est reçu à ce stade.

## Demande élargie des accès, 22 octobre

Erwan a demandé au coordinateur de solliciter les autres clés pour préparer les accès. La demande a été transmise au propriétaire existant des comptes. Priorité immédiate : OpenAI ou accès déjà crédité pour le modèle, Keenable pour la recherche après vérification, puis Anthropic dès disponibilité. Modal, n8n et Supabase sont à préparer comme offres de réserve, sans ajout au socle de la démo ni souscription payante implicite. Les valeurs secrètes restent hors des messages et documents.

Le dernier statut du propriétaire confirme la demande Anthropic soumise dans l'organisation Briques, en attente d'examen et d'attribution. Ce reçu remplace le statut précédent où un champ obligatoire attendait la réponse d'Erwan. Le raccord GitHub App limité au dépôt du hackathon est terminé selon son reçu dans les deux interfaces. La source OxSorcier/hackathon-accel-20261022 est sélectionnée dans l'assistant Aiven, avec main affichée ; aucun scan réussi ni déploiement produit n'est attesté. Les autres clés sont demandées, pas réputées obtenues.

Pour les offres de réserve, le propriétaire rapporte une lecture des conditions générales officielles : moyen de paiement requis pour Modal, API n8n absente de l'essai et disponible sur un plan payant, carte requise pour Supabase Pro sans arrêt automatique garanti à l'épuisement des 25 USD. Les éventuelles exceptions du Builders Pack restent à vérifier avant activation. Ces services ne sont pas ajoutés à l'architecture. Le propriétaire poursuit OpenAI et Keenable pour obtenir un accès utilisable pour la démo.

## Delta reçu : crédit OpenAI disponible, clé Keenable créée

Le propriétaire des accès rapporte le choix humain « Utiliser Cliccc pour le hackathon ». L'offre OpenAI a été appliquée : nouvelle dotation de 50 USD datée du 22 octobre 2026, statut Available et expiration au 21 novembre 2026 constatés sur Credit grants. L'ancienne offre de septembre est distincte. La création d'une clé dédiée et un premier appel borné restent à recevoir ; aucun appel modèle produit réussi n'est attesté ici.

Keenable affiche, selon le propriétaire, un solde de 1000 USD correspondant à 250000 requêtes payées, plus 100000 requêtes gratuites restantes renouvelées le 22 novembre 2026, et une limite de 10 requêtes par seconde. Une clé dédiée accel-hackathon-20261022 a été créée. Le contrôle automatique a refusé son transfert par le presse-papiers ; le propriétaire a demandé l'autorisation exacte à Erwan. Aucune copie n'a été effectuée et aucun fichier secret n'a encore été écrit à ce stade. La création de clé ne constitue pas un test API.

Le fichier .env.access est réservé au chat des comptes pour la passation locale autorisée, avec permissions 600 et exclusion Git. Ce reçu ne confirme ni sa création ni son chargement par le serveur. Les valeurs des clés ne sont pas conservées dans ce document.

## Delta reçu : Keenable testé et passation transmise

Le propriétaire rapporte désormais l'accord explicite d'Erwan pour le transfert local de la clé Keenable. La clé dédiée est enregistrée dans .env.access, variable KEENABLE_API_KEY, permissions 0600 et exclusion Git vérifiées par ce propriétaire ; le presse-papiers a été effacé. Ce reçu remplace l'état de transfert en attente ci-dessus. Le coordinateur n'imprime ni ne recopie le fichier.

Un appel réel POST https://api.keenable.ai/v1/search, authentifié par X-API-Key avec un champ query, a retourné HTTP 200 et 10 résultats. Identité non secrète du test : request_id 01a162ed-b2d9-715b-a516-102369da1717. L'accès API est testé ; le raccord du collecteur au produit et la chaîne jusqu'à la proposition ne sont pas prouvés par ce seul résultat.

Le coordinateur a transmis cette passation aux chats intégration et données existants. Le premier possède le chargement serveur et l'assemblage, le second le collecteur et les sources. OpenAI et la connexion SQL Aiven restent à recevoir selon le dernier message du propriétaire des accès.

## Delta reçu : OpenAI testé et configuration prête pour l'intégrateur

Le propriétaire des accès confirme une clé OpenAI dédiée restreinte sur le compte Cliccc choisi par Erwan, avec lecture des modèles, écriture Responses et requêtes Chat Completions. Expiration de la clé : 30 jours selon le propriétaire. La configuration privée .env.access contient les noms MODEL_PROVIDER, MODEL_API_KEY, MODEL_NAME et KEENABLE_API_KEY ; fournisseur openai et modèle demandé gpt-5.4-mini. Aucune valeur de clé n'est conservée dans ce document. Le coordinateur a vérifié indépendamment l'existence du fichier et son mode 0600, sans en afficher le contenu.

Test autonome réel rapporté : OpenAI Chat Completions, HTTP 200, modèle résolu gpt-5.4-mini-2026-03-17, appel d'outil read_stock, finish_reason tool_calls, 192 tokens. Identité non secrète : request_id req_944c53bd28dd4fffa663e66e6b6575f3. Cela confirme l'accès API et un appel d'outil ; ce test ne prouve ni les outils métier de notre application ni sa proposition ou sa validation.

La passation est transmise à l'intégrateur pour chargement serveur explicite, raccord à l'adaptateur revu et essai produit borné. Le fichier privé reste réservé au chat des comptes. La preview stable du port 3001 reste distincte de la version d'intégration.

PostgreSQL Aiven est affiché Running et ready selon le propriétaire. Les paramètres de connexion privés et la connexion SQL du produit restent à recevoir. Aucun changement de plan ni déploiement n'est attesté par ce reçu.

## Delta reçu : paramètres PostgreSQL Aiven transmis

Le propriétaire des accès confirme l'ajout de DATABASE_URL et DATABASE_CA_FILE dans .env.access, toujours en mode 0600. La CA est conservée dans .local/accel-postgres-ca.pem ; aucun identifiant secret n'est recopié ici. La version observée du service est PostgreSQL 18.6, Running/ready, région Paris ; solde d'essai observé par le propriétaire : 49,97 USD.

Le propriétaire lance la vérification SELECT 1 par src/server/config.ts avec validation TLS. Son résultat n'est pas encore reçu. Le coordinateur a transmis la disponibilité des paramètres à l'intégrateur pour préparer la connexion applicative et les migrations ; il ne lance pas un second test en parallèle et ne modifie pas la configuration privée. Connexion SQL réussie, migrations appliquées, parcours produit sur Aiven et déploiement Runtime restent des preuves distinctes à recevoir.

## Delta reçu : connexion SQL Aiven et TLS vérifiés

Le dernier reçu du propriétaire remplace le statut SELECT 1 en attente : connexion réelle via createPool du produit, SELECT 1 avec ok=1, base defaultdb et PostgreSQL 18.6. pg_stat_ssl confirme ssl=true et TLSv1.3. L'intégrateur a reçu ce résultat et la disponibilité de la configuration privée.

Les trois accès sont donc testés séparément par le propriétaire : OpenAI avec appel d'outil, recherche Keenable et connexion PostgreSQL Aiven. Migrations de l'application, parcours modèle/outils vers proposition et décision, persistance, relecture, reprise après redémarrage et déploiement Runtime restent à vérifier par l'intégrateur sur sa version exacte. Le propriétaire ne modifie ni ses migrations ni son serveur.

État des offres secondaires rapporté : Anthropic en attente d'attribution après soumission ; Supabase sans crédit ni projet activé, OAuth bloqué par un bouton désactivé ; Modal et n8n en réserve, sans carte ou abonnement engagé. Le propriétaire rapporte le refus automatique d'ouverture du formulaire Modal, pour risque de transmission du code ; aucun contournement ni activation attestés.

## Delta reçu : Modal attribué, conservé en réserve

Après connexion réalisée par Erwan et accord de soumission reçu dans le chat des accès, le propriétaire rapporte une seule soumission du formulaire officiel Modal et son accusé de traitement. L'attribution a ensuite été vérifiée dans le workspace oxsorcier : grant Accel AI Innovate Hackathon - Paris, statut Active, activation le 22 octobre 2026, expiration le 31 octobre 2027, restant 100/100 USD. Ce reçu remplace les états Modal en attente ou bloqué ci-dessus.

Solde total observé à 11 h 57, heure de Paris : 101 USD, dont 1 USD Starter et 100 USD sponsor. La limite de workspace et les environnements affichent 101 USD sans carte, consommation et charges observées à zéro. Aucun ajout de carte, upgrade, calcul, projet ou token n'a été effectué selon le propriétaire. Crédit reçu ne prouve pas un appel API ou un calcul exécuté. Modal reste en réserve, sans modification de l'architecture du produit.
