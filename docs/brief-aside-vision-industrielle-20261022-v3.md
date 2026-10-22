# Brief pour Aside : notre vision industrielle et la preuve à construire

22 octobre 2026. Version 3. Document pour avis extérieur. Projet Accel. Propriétaire produit : Erwan.

**Aside, nous voulons ton regard critique sur la cohérence entre notre vision, le client visé, les données, le fonctionnement de l'agent et la démonstration.** La construction est engagée. Aide-nous à choisir les priorités qui rendent le produit utile et crédible.

Ce brief actualise l'ancien document centré sur un petit cas de négoce. Il distingue la vision, le client synthétique proposé et les résultats techniques reçus. Il te demande un avis, sans lancer de modification, de déploiement ou d'action sur un compte.

## 1. Ce que vend notre entreprise

**Nous transformons les changements d'une filière en décisions réalisables pour les entreprises qui dépendent de stocks, de fournisseurs et d'engagements clients.**

Le premier terrain est le bois et les matériaux de construction en France, avec des relations européennes. Le produit doit relier une information extérieure à la réalité précise d'une entreprise : ses sites, ses produits, ses achats, ses clients, ses chantiers et ses règles.

Il couvre les risques, les opportunités et les effets mixtes. Une difficulté d'approvisionnement peut menacer certains engagements et ouvrir une piste commerciale ailleurs. Chaque effet exige des données et une vérification propres.

« Decision Desk » est un descriptif de travail ; le nom de marque reste ouvert. Une extension à d'autres industries est une ambition à valider.

## 2. Le client que nous voulons représenter

Il faut distinguer **notre startup**, qui vend le produit, de **l'entreprise cliente**, dont l'agent connaît l'activité et les données.

Le client de démonstration proposé est un grand groupe de matériaux, explicitement synthétique : cinq sites en France et un en Belgique, des fournisseurs européens, de nombreux engagements et programmes de construction. Le premier périmètre modélisé est la distribution de matériaux. Des activités de découpe et de finition sont envisagées ; les capacités de production ne sont pas encore modélisées.

Paul serait le directeur des opérations du groupe. Il travaille avec les achats, la logistique des sites et les responsables commerciaux. Son problème quotidien : comprendre quels engagements sont touchés par un changement et arbitrer entre plusieurs réponses sans déplacer le problème vers un autre chantier.

Le sponsor commercial envisagé est la direction des opérations, avec la finance et l'IT pour les dépenses et l'intégration. Ce persona reste une hypothèse : aucun entretien terrain observé, pilote signé, paiement ou gain client mesuré n'est établi.

## 3. L'identité de l'entreprise doit gouverner l'agent

Par « harness », nous entendons l'environnement qui donne à l'agent son contexte autorisé, ses outils, ses règles et sa mémoire. Un prompt de présentation ne suffit pas.

| Couche | Ce qu'elle doit apporter |
| --- | --- |
| Identité et périmètre | Société, établissements, rôles, régions servies, familles de produits et relations fournisseur/client identifiées. |
| ERP/WMS | Stocks, réservations, commandes, réceptions, unités, dates, devis et engagements courants. |
| CRM | Comptes, interlocuteurs autorisés, opportunités, stade de qualification et responsable commercial. Une piste reste distincte d'une commande. |
| Politique | Substitutions autorisées, marges de sécurité, plafonds, droits de décision et contraintes logistiques. |
| Connaissances | Sources déjà examinées, faits attribués, confirmations, versions et conditions des décisions antérieures. |
| Outils | Lectures ciblées, recherche publique, vérification de relation, calcul métier et préparation d'une proposition. |

Les futurs ERP/CRM restent maîtres de leurs données. PostgreSQL Aiven conserve des copies attribuées, les preuves, dossiers, exécutions, propositions, décisions et éléments de mémoire. Les identifiants natifs, dates, révisions et statuts de vérification doivent suivre les informations.

Le serveur résout les droits et l'entreprise. Le modèle choisit ses outils ; les calculs de disponibilité, délais, réservations et coûts restent déterministes. Une proposition est révisable et soumise à une décision humaine. Son approbation doit être refusée si ses données sont périmées.

## 4. Une veille adaptée à cette entreprise

L'agent doit savoir quoi rechercher, pour quelle décision, sur quelle zone et avec quel horizon.

| Veille proposée | Lien métier à vérifier |
| --- | --- |
| Fournisseurs et capacités industrielles France/Europe | Site, produit, fournisseur et achats concernés ; distinguer capacité future et disponibilité immédiate. |
| Filière bois et actualités régionales | Régions des sites et fournisseurs, essences, usages et période des données. |
| Chantiers et demande publique | Zone desservie, produits compatibles et qualification commerciale. BOAMP ou un permis ne prouvent pas une commande. |
| Identité et événements d'entreprise | Entité juridique et établissement exacts ; rejet des homonymes. |
| Contraintes produit et circulation | Origine, lot, usage, rôle de l'entreprise, territoire et date d'application. |

Les recherches déjà conservées recensent des publications originales, BOAMP, des sources professionnelles bois et des API publiques candidates. Leur présence dans la recherche ne prouve pas un connecteur produit opérationnel.

Les requêtes externes portent sur des sujets publics. Les quantités de stock, commandes et informations commerciales privées restent dans les outils internes autorisés. L'agent doit réutiliser une connaissance encore valide avant de chercher à nouveau et réévaluer ses conclusions lorsqu'une source change. Cette boucle de mémoire reste à démontrer.

## 5. Tester sur beaucoup de données

Un candidat synthétique cohérent avec ce client a été préparé dans un dossier séparé :

- 6 sites, 200 produits, 40 fiches fournisseurs et 400 fiches clients ;
- 24 programmes de construction et 2 502 commandes ;
- 10 000 lignes de commande, 9 999 réservations et 81 opportunités CRM ;
- 24 228 lignes au total, toutes tables confondues.

Les contrôles locaux vérifient identifiants, relations, réservations, unités, quantités et dates. Un calcul métier local unique a produit les 10 000 lignes de couverture en environ 2,5 secondes. Ce résultat est un contrôle ponctuel, pas un benchmark de l'agent ni une mesure de passage à l'échelle.

**Ce candidat n'est pas encore importé dans l'application ou Aiven. Aucun parcours modèle sur ce portefeuille ni connecteur ERP/CRM réel n'est démontré.** C'est un instantané, avec seulement deux lignes d'achat héritées, sans historique transactionnel complet, capacité industrielle ni calcul de marge.

Le calcul complet produit environ 6,5 Mo de résultat. Cela rend concret le travail restant : conserver toutes les dépendances nécessaires au calcul côté serveur et donner au modèle des résultats ciblés, bornés, sourcés et explicitement partiels si nécessaire. L'absence d'une ligne dans un résumé ne doit jamais signifier qu'elle est sans risque.

Le critère de réussite : retrouver les bons engagements au milieu du volume, protéger les autres engagements et produire une décision valide avec une latence et un usage modèle mesurés.

## 6. Ce qui fonctionne aujourd'hui et ce qui reste à prouver

État lu dans les reçus du projet le 22 octobre ; ce brief ne relance pas les essais.

| Périmètre | État reçu et limite |
| --- | --- |
| Application et stockage | Application locale React/Vite, Fastify et TypeScript utilisant réellement PostgreSQL Aiven. Persistance et reconnexion testées. |
| Agent | Appels réels OpenAI avec choix d'outils, lectures métier, calcul et proposition persistée. |
| Source publique | Publication originale ROCKWOOL sur Soissons, datée du 10 juillet 2026, récupérée via Keenable. Collecte bornée et partielle. |
| Changement de donnée | Retard puis confirmation internes explicitement synthétiques, nouvelle révision et ancien plan périmé. |
| Décision | Un parcours reçu aboutit à une proposition d'achat urgent de 1 420 euros, approuvée et relue en base. C'est un coût calculé, pas une économie. Aucun achat ni transfert réel exécuté. |
| Limites de fiabilité | Une tentative antérieure a calculé une option sans enregistrer de proposition ; cet échec est conservé. La réception finale des évolutions interface/données reste en cours. |
| Preuves suivantes | Portefeuille industriel avec agent, ERP/CRM réels, réutilisation de recherche entre sessions, correction de source et parcours d'opportunité : non démontrés dans ces reçus. |
| Déploiement | Stockage Aiven testé. Déploiement de l'application sur Aiven Runtime : NOT_RUN. |

**Point critique à challenger : la publication publique concerne une capacité industrielle future, à horizon 2028. Elle ne prouve ni notre relation fournisseur ni un retard de livraison demain.** Le retard du scénario vient d'un événement synthétique distinct. Le parcours prouve des mécanismes techniques, mais cette source seule ne justifie pas l'achat urgent.

La démonstration finale doit choisir une source et des faits internes dont les produits, relations et horizons correspondent. À défaut, elle doit présenter clairement les deux preuves séparées et leurs limites.

## 7. L'histoire produit et la démonstration

Promesse de travail : **« Comprenez ce qu'un changement du marché implique pour votre entreprise, puis décidez avec vos données. »**

Le site, le communiqué de présentation, le README, la démo et la slide doivent porter la même histoire :

1. Une entreprise possède plusieurs sites et de nombreux engagements. Paul voit ses priorités et ses données à jour.
2. Un signal pertinent arrive. L'agent vérifie sa source, son horizon et le lien avec l'entreprise.
3. Il identifie les engagements concernés, les inconnues et les options admissibles.
4. Une donnée métier change. Le calcul est actualisé et l'ancien plan devient périmé.
5. Paul examine la proposition, son coût et ses conditions, puis décide. La décision reste consultable après reprise.

Le premier film doit montrer un parcours complet. Le portefeuille industriel apparaît comme réel dans le produit seulement après import et relecture vérifiés. Le parcours d'opportunité peut être présenté comme la suite tant que demande, capacité libre et calcul commercial ne sont pas reçus.

Preuve souhaitée : comparer les mêmes cas avec une approche naïve qui ignore réservations ou mises à jour, puis avec le système complet. Mesurer exactitude des engagements détectés, respect des contraintes, refus des plans périmés, temps jusqu'à une proposition valide, latence et usage modèle. Le temps gagné chez un client exige une référence terrain distincte.

Selon le brief transmis par Erwan, le hackathon demande un produit fonctionnel, un agent utilisant réellement les données, un parcours complet, un déploiement Aiven Runtime et un résultat mesuré. Les cinq critères valent chacun 20 % : produit, agent, données, résultats, exécution/pitch. Les six livrables sont nom, pitch, MP4 de trois minutes, texte sur les données, fichier de preuve et lien vers une seule slide. Ces modalités sont reprises du brief reçu, sans nouvelle vérification organisateur ici.

Les premiers utilisateurs envisagés sont des responsables opérations et achats de matériaux accessibles par le réseau d'Erwan. Leur disponibilité et leur intention d'adoption restent à confirmer.

## 8. Ce que nous te demandons précisément

1. **Positionnement et persona :** notre promesse correspond-elle à un problème assez fréquent et coûteux pour Paul ? Quel périmètre métier choisir en premier dans cette grande entreprise ?
2. **Cohérence :** quels liens manquent entre identité de l'entreprise, recherche, ERP/CRM, mémoire et décision ? Quelles données sont indispensables au premier parcours ?
3. **Signal et causalité :** quel événement public permettrait la meilleure démonstration sans inventer une relation commerciale ou une urgence ?
4. **Agent et volume :** quel test minimal prouverait une sélection pertinente parmi 10 000 lignes ? Un import attribué suffit-il pour cette preuve, ou quel avantage précis justifierait un véritable ERP de démonstration ?
5. **Différenciation et adoption :** pourquoi une équipe utiliserait-elle ce produit en complément de ses outils ? Quelle hypothèse commerciale vérifier d'abord ?
6. **Priorités et récit :** quels sont les trois changements les plus utiles avant la démo, et quelle histoire peut-on honnêtement raconter en trois minutes ?

Réponds avec un verdict argumenté, les trois faiblesses principales, trois priorités classées, un pitch en une phrase et un déroulé de trois minutes. Sépare les recommandations immédiates de la vision à plus long terme. Distingue ce que ce document permet de juger de ce qui exige un essai de l'application ou un entretien client. Identifie les promesses qui dépassent nos preuves actuelles.

## Sources internes et portée

Ce document prépare une demande d'avis. Il ne remplace pas la vision propriétaire, ne vaut pas réception de l'application et ne contient pas encore d'avis d'Aside. Les statuts peuvent évoluer pendant la construction.

- `docs/PRODUCT-VISION.md`, version 1.1 : vision propriétaire et suppléments reliés.
- `proposals/product/alignment-20261022/ALIGNMENT-AND-STORY.md` : client proposé, données, segmentation et récit.
- `proposals/product/alignment-20261022/DATA-CHECKS.json` et `LOCAL-DOMAIN-SMOKE.json` : contrôles et limites du portefeuille synthétique.
- `docs/STATUS.md` : preuves runtime reçues et réception encore en cours.
- `proposals/product/MEMOIRE-RECHERCHE-TRACES.md` et `proposals/product/research-data-20261022/sector-sources/SECTOR-DATA-STRATEGY.md` : mémoire et recherche de sources.
- `proposals/product/alignment-20261022/PRESS-RELEASE.md`, `WEBSITE-COPY.md` et `DEMO-SCRIPT.md` : textes préparés, sans publication attestée.
- Brief du hackathon transmis par Erwan et instructions courantes du projet.

Mots de recherche : Accel, vision industrielle, entreprise multi-sites, Paul, ERP, CRM, harness, veille sectorielle, portefeuille synthétique, Aiven, avis Aside.
