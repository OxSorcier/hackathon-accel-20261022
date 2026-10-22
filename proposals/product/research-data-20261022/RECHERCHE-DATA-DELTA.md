# Accel : Keenable, sources métier et réglementation

22 octobre 2026 · Version 1 · Recherche et raccord proposés · Propriétaire documentaire : chat recherche data, 01a162e0-1387-7a10-92d4-97b76208a26c · Suivi : [ERW-133](https://linear.app/briques/issue/ERW-133).

**Keenable peut tenir le rôle de découverte web et de lecture de pages pour notre première tranche. Huit essais publics bornés apportent des preuves positives et négatives. Ils ne valident ni une couverture exhaustive, ni une supériorité sur Exa, ni le parcours produit jusqu'à une proposition.**

## 1. Delta et responsabilités

Ce document complète le dossier `research-tools-20261021` du kit reçu et la [vision produit](../../../docs/PRODUCT-VISION.md). La copie de préparation reste figée. Les recommandations Tavily/Apify précédentes et leurs échecs restent historiques ; ce delta ajoute Keenable avec ses preuves propres. Aucun choix antérieur n'est effacé.

Le mandat humain a été relu dans le chat données, message du 22 octobre `01a162e9-e3a8-7391-8411-b166f70dabf9` : coordination avec l'intégrateur et la recherche, raccord Keenable, vrai signal jusqu'à proposition calculée, couverture métier élargie et réglementation FR/UE. La recherche fournit ici des faits et limites. Le chat données possède le collecteur ; l'intégrateur possède contrats, serveur et test intégré. Aucun module produit, secret ou service n'est modifié par ce dossier.

L'état de l'intégration reste tenu par [STATUS.md](../../../docs/STATUS.md). Ce reçu documentaire ne clôt pas le parcours produit. Le [contrat Keenable reçu](../../integration/KEENABLE-CONTRACT.md) conserve les preuves C1 et l'autorité côté serveur.

## 2. Keenable peut-il remplacer Exa ?

**Oui pour le rôle borné « chercher des pages puis en lire le texte », sous réserve des essais métier. Une équivalence de toute la plateforme Exa n'est pas établie.** La raison de commencer avec Keenable est son accès sponsor déjà pris en charge et une surface HTTP adaptée au collecteur, pas un benchmark comparatif gagné.

| Besoin | Keenable documenté et essayé | Exa documenté | Conclusion pour Accel |
| --- | --- | --- | --- |
| Recherche web | Modes `pro` et `realtime`, filtre de domaine et dates. Recherche ciblée réussie ; un autre sujet est vide. | Recherche avec modes, domaines inclus/exclus et dates. Aucun appel Exa exécuté ici. | Keenable est un candidat fonctionnel pour la découverte. La pertinence FR/BTP reste à mesurer. |
| Lecture de pages | `fetch` renvoie du Markdown ; copie indexée par défaut, `live=true` pour lecture à la source. Quatre lectures réussies, deux refusées sur une même page. | `contents` peut retourner texte, extraits et résumé, avec politiques de fraîcheur. | Recouvrement utile ; aucune garantie de lire tout site ni d'accéder à une source protégée. |
| Recherche approfondie et suivi | Les deux endpoints examinés n'établissent pas d'équivalent complet. | La documentation expose notamment des modes de recherche approfondie et des surfaces Agent, Monitors et Websets. | Capacités distinctes à évaluer seulement si nécessaires. Leur simple présence ne prouve pas leur adéquation. |
| Qualité, fraîcheur, coût réel | Échantillon public réduit ; pas de coût authentifié ni mesure comparative. | Aucun compte, appel ou benchmark exécuté dans ce mandat. | Aucun verdict de supériorité, rappel ou économie chiffrée. |

Sources : [Keenable API](https://docs.keenable.ai/api-reference), [recherche](https://docs.keenable.ai/api-reference/search), [lecture](https://docs.keenable.ai/api-reference/fetch), [Exa Search](https://exa.ai/docs/reference/search), [Exa Contents](https://exa.ai/docs/reference/get-contents). Les anciennes options Exa `livecrawl` sont désormais dépréciées au profit de `maxAgeHours` selon la page lue. Ne pas recopier silencieusement un ancien exemple.

## 3. Contrat HTTP utile au raccord

| Opération | Contrat documentaire reçu |
| --- | --- |
| Recherche authentifiée | `POST https://api.keenable.ai/v1/search`, corps JSON, clé dans `X-API-Key`. Aucun secret dans le navigateur, les requêtes publiques ou les traces. |
| Recherche publique essayée | `POST /v1/search/public`, même corps, en-tête `X-Keenable-Title` obligatoire, sans clé ni crédit consommé selon la documentation. |
| Entrées recherche | `query` obligatoire ; `mode` vaut `pro` par défaut ou `realtime` ; `site`, `published_after/before`, `acquired_after/before`, `query_time` facultatifs. `max_results` : 1 à 50 ; `snippet_max_length` : 180 à 10000. |
| Sortie recherche | `query`, `mode`, `results[]` avec titre, URL, description, extrait, dates lorsqu'elles sont présentes. Les résultats observés utilisent des dates textuelles. |
| Lecture | `GET /v1/fetch?url=...`, ou `/v1/fetch/public` sans clé. `max_chars` borne le texte et peut le tronquer ; `live` vaut `false` par défaut. |
| Sortie lecture | URL originale, titre, contenu Markdown, champs facultatifs. `published_at` est documenté et observé en secondes Unix, contrairement à la recherche. Un champ absent reste inconnu. |

La copie indexée n'est pas une lecture fraîche de l'éditeur. `acquired_at` est une date d'indexation, distincte de la publication, de l'événement et de notre collecte. `query_time` borne l'index à un instant, sans rendre la source historique complète. La documentation offre aussi une extraction par instruction `prompt` ; elle n'est pas essayée et ajouterait une transformation par modèle à qualifier.

La [limite publique documentée](https://docs.keenable.ai/rate-limits) est partagée par IP : 1000 requêtes par heure et 10 par seconde. Le quota du compte sponsor et son usage authentifié ne sont pas reçus par ces essais. Les accès restent chez leur propriétaire et dans la configuration privée autorisée.

Le constructeur conserve validation des enveloppes, types et dates, URL originale HTTPS, taille, temps, provenance et hash. HTML et Markdown récupérés restent des données non fiables. Distinguer `empty`, erreur, partiel et non exécuté ; une réponse HTTP 200 ne suffit pas. Aucun retry aveugle sur un effet métier. Une limite de sortie atteinte ne prouve pas la complétude.

## 4. Ce qui a réellement répondu

Les [preuves API](evidence/API-TRIALS.json) gardent requêtes publiques, statuts HTTP, clés de réponse, nombres de résultats, dates et empreintes. Elles excluent les clés et la copie intégrale des articles. Les corps bruts de travail restent des fichiers temporaires locaux, pas un corpus produit.

| Essai du 22 octobre | Résultat observé | Portée |
| --- | --- | --- |
| Recherche `realtime`, Lucens septembre 2026, `site=isover.ch`, depuis septembre | HTTP 200, zéro résultat | Aucun résultat dans cette requête. Cela ne prouve pas l'absence d'incident. |
| Lecture ISOVER Lucens, copie indexée puis `live=true` | Deux HTTP 403, `Upstream forbidden` | La cible refuse l'accès. Aucun texte original reçu ; ce signal est écarté du corpus utilisable. Aside local affiche aussi un contrôle de navigateur. |
| Recherche `pro`, Courmelles/ROCKWOOL/calendrier 2028, domaine et date ciblés | HTTP 200, cinq résultats ; article du 5 mars au rang 3 | La recherche retrouve la source connue. Un résultat concerne une formation au Royaume-Uni ; le domaine seul ne garantit pas la pertinence locale. |
| Lecture ROCKWOOL, articles de mars et juillet 2026 | Deux HTTP 200 avec texte reçu | Les communiqués sont lisibles. L'état industriel présent et la relation commerciale restent non établis. |
| Lecture ROCKWOOL, incident de décembre 2025 | HTTP 200 avec texte reçu | Contrôle historique utile : l'industriel annonce un dommage de stock mais aucun impact sur l'activité industrielle. Aucun retard actuel déduit. |
| Lecture de la page ministérielle RPC | HTTP 200 avec texte reçu | Exemple d'extraction réglementaire. L'applicabilité à un SKU reste à qualifier. |

Deux recherches générales précédentes avaient remonté des résultats anciens ou hors région. Leurs réponses brutes n'ont pas été conservées ; elles restent des observations de ce chat, distinctes des huit appels tracés ci-dessus. Une première requête avec un extrait limité à 150 caractères avait été refusée ; elle a été corrigée à une valeur admise. Aucun benchmark ni test de charge n'a été exécuté.

## 5. Signal primaire pour le parcours intégré

**Candidat principal : communiqué ROCKWOOL du 10 juillet 2026 sur le chantier de Courmelles/Soissons, Aisne, Hauts-de-France.** L'éditeur annonce la poursuite de la construction et une nouvelle phase de fondations pendant l'été. Les décisions administratives sont rapportées par l'industriel ; les jugements n'ont pas été consultés. [Original](https://www.rockwool.com/fr/soissons/actualites/actualite-du-10-juillet-2026/).

Le texte a été reçu par l'outil web et par Keenable public. L'identité éditoriale et le site sont nommés ; aucun identifiant juridique natif de société n'a été établi. La date de collecte est conservée dans la preuve HTTP. Une collecte du 22 octobre ne transforme pas l'annonce de juillet en constat d'aujourd'hui.

Le calendrier publié le [5 mars 2026](https://www.rockwool.com/fr/soissons/actualites/actualite-du-05-mars-2026/) envisageait les bâtiments au second semestre 2026, les équipements en 2027 et le démarrage en 2028. Ce sont des prévisions de l'éditeur, pas du stock disponible pour les commandes d'octobre ou novembre.

**Contradiction de date conservée :** l'éditeur affiche le 5 mars ; Keenable retourne `published_at=1772781600`, soit le 6 mars 2026 à 07:20 UTC. Préserver les deux valeurs, la précision au jour de la date visible et l'origine de chaque champ. Ne pas inventer une heure de publication ni écraser silencieusement la contradiction.

Les deux observations paraphrasées et leurs métadonnées sont dans [PUBLIC-SIGNALS.json](PUBLIC-SIGNALS.json). Aucun lien ne les rattache à `SUP-1/2/3`, `SKU-ISO100/120`, aux achats ou aux clients fictifs. Aucune équivalence laine de roche/SKU ni confirmation de livraison n'est établie.

Le parcours à recevoir est : preuve publique persistée, qualification de la relation, calcul de la couverture actuelle sur les données synthétiques autorisées, puis proposition révisable dont les hypothèses sont visibles. L'absence d'exposition prouvée est un résultat admissible. Une hypothèse publique ne change ni un entrant confirmé ni une réservation. Le texte de ce rapport, ses critères de test et ses reçus restent hors du contexte modèle ; seuls les faits explicitement libérés peuvent y entrer.

## 6. Couverture de la vision et données nécessaires

| Famille demandée | Source ou mécanisme adapté | Données nécessaires pour une décision | État de cette passe |
| --- | --- | --- | --- |
| Actualités sectorielles et régionales | Découverte Keenable puis original, avec date, lieu et entité | Sites et dépendances de l'entreprise | Exemple régional retrouvé ; couverture générale non mesurée. |
| Communiqués fournisseurs | Domaine officiel, page/RSS connu, relecture des mises à jour | Identité fournisseur et relation commerciale vérifiée | Deux annonces ROCKWOOL lues ; aucun fournisseur fictif raccordé. |
| Incidents | Émetteur industriel, autorités locales et ARIA comme historique | Produit/site touché, durée, confirmation commerciale | Un historique lisible ; Lucens inaccessible. Pas de retard courant établi. |
| Projets et marchés publics | BOAMP/API directe et dossier de consultation ; avis CPV et lots | Quantités, compatibilité, calendrier, éligibilité et acheteur | Collecteur BOAMP existant. Avis 26-101741 reçu dans le corpus du 21 ; non relu ici. |
| Réalité de l'entreprise | ERP, WMS, CRM, confirmations et transport autorisés | SKU, unités, stock, réservations, achats, clients et droits | Données synthétiques du produit. Une recherche web ne les acquiert pas. |
| Opportunités commerciales | Signal public puis qualification par l'équipe | Besoin confirmé, client, produit compatible, stock libre et transport | Pistes et exigences proposées. Calcul commercial et conversion réelle non éprouvés ici. |
| Réglementation FR/UE | Légifrance, EUR-Lex et explications officielles datées | Juridiction, produit, rôle, taille, permis, transition et preuves | Trois candidats documentés ci-dessous. Surveillance et alertes non activées. |

Une chaîne unique peut composer recherche et sources connues. Elle doit conserver le calendrier métier durable existant. Aucun ajout de second ordonnanceur n'est proposé. Une modification interne peut demander un recalcul même sans nouvelle actualité.

## 7. Réglementation : faits publics et applicabilité interne

La règle publiée est un fait extérieur. La qualification de son applicabilité dépend du profil de l'entreprise et du projet. Conserver ces deux objets reliés permet d'éviter une alerte générique « tout le stock est non conforme ». [REGULATORY-CANDIDATES.json](REGULATORY-CANDIDATES.json) expose trois exemples et les champs inconnus, sans activer d'alerte.

| Candidat | Dates et périmètre reçus | Alerte proposée, après contrôle humain |
| --- | --- | --- |
| RPC UE 2024/3110 | Publication du règlement le 18 décembre 2024. La page ministérielle, mise à jour le 18 février 2026, décrit une transition par spécification harmonisée, généralement douze mois après son entrée en vigueur, avec exceptions. Aucun délai propre à nos SKU établi. | Vérifier famille, usage, norme applicable et déclaration du fournisseur avant offre ou substitution. Ne pas appliquer une échéance uniforme à tous les produits. |
| RE2020, extension française de 2026 | La page ministérielle, mise à jour le 18 septembre 2026, indique l'extension à plusieurs usages neufs au 1er mai 2026. Le décret 2026-16 et sa publication au JO du 17 janvier sont identifiés ; son texte intégral reste à recevoir. | Qualifier neuf/rénovation, usage, localisation et date de permis avant devis. Vérifier le régime transitoire et les performances exigées. |
| RDUE, bois, règlement 2023/1115 modifié par 2025/2650 | La Douane confirme la publication de la modification le 23 décembre 2025 et l'application à partir du 30 décembre 2026. Le report au 30 juin 2027 de certains petits opérateurs comporte une exception pour les produits déjà visés par le règlement bois 995/2010, visible dans le texte législatif Conseil lu. | Déterminer code produit, rôle, taille, dates de production/mise sur le marché et traçabilité. Préparer les pièces avant l'échéance reçue ; proposer J-60/J-30/J-7, sans calendrier activé. |

Sources réellement lues : [ministère, RPC](https://rpc-construction.ecologie.gouv.fr/rpc-20243110), [ministère, RE2020](https://www.ecologie.gouv.fr/politiques-publiques/reglementation-environnementale-re2020), [Douane, report RDUE](https://www.douane.gouv.fr/actualites/lutte-contre-la-deforestation-report-de-la-mise-en-application-du-reglement-ue-20231115), [Conseil, texte législatif PE-CONS 60/25](https://data.consilium.europa.eu/doc/document/PE-60-2025-INIT/fr/pdf), articles 37 et 38, page imprimée 49.

Actualisation RDUE : la [Commission européenne](https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en), relue dans cette passe, confirme la date du 30 décembre 2026 pour les micro/petits opérateurs déjà couverts par le règlement bois. Elle mentionne aussi une modification de l'annexe I par le règlement délégué 2026/2102 et une application au 30 décembre 2027 pour les produits nouvellement ajoutés. Cela impose de recevoir la liste courante et le code du produit ; ce délai distinct n'est pas un report général du bois.

Le texte du Conseil est antérieur à la publication finale ; il ne remplace pas une consolidation courante. Les accès intégraux EUR-Lex ont renvoyé un contrôle de navigateur, Légifrance et le portail RT-RE des refus 403, une page ministérielle RDUE un 503. Ces lectures restent non reçues. Les dates d'entrée en vigueur non attestées sont laissées inconnues. Les fiches sont des candidats de veille, pas une détermination juridique de conformité. La taille, les matières et les références génériques de la fixture ne permettent pas de conclure à l'applicabilité.

Ces trois candidats ne constituent pas toute la réglementation d'un négoce. REP PMCB, REACH/CLP, transport et règles propres aux sites ou aux autres familles de produits restent à approfondir selon le périmètre reçu. Aucun moteur de conformité universel n'est revendiqué.

## 8. Réception et prochaine preuve

**Reçu ici :** documentation officielle des deux APIs, huit essais publics bornés, deux observations sectorielles attribuées, trois fiches réglementaires proposées et une carte de couverture. Aucun appel Exa ni authentifié Keenable exécuté par ce chat. Aucune intégration Aiven ou proposition calculée attribuée à ces seuls essais. Relecture indépendante du cadrage non exécutée.

Le constructeur données doit recevoir ce delta, conserver les erreurs/dates/provenances dans son collecteur et publier le nouveau reçu de code exact avec ses deux revues. L'intégrateur doit ensuite observer l'appel réel autorisé, la persistance/relecture de la source, le calcul métier centralisé, les hypothèses et la proposition versionnée. Les tests de réseau partiel, document inaccessible, source ancienne, absence de relation, modification du stock et plan périmé restent à recevoir au niveau produit.

L'archivage privé, le contrôle du HTML et la réception des messages sont consignés séparément dans `RECEPTION.json`. La disponibilité de ces fichiers ne vaut pas chargement dans le runtime. Aucun compte, service, abonnement, dépense, commit/push ou déploiement n'est créé par cette recherche.

## Sources et continuité

- Méthodes lues : recherche-multisource et ses références investigation/vérification ; work-reconcile ; découverte des capacités ; erwan-ticket-delivery ; Google Drive ; briques-da, profils et recette de rapport. Aside REPL a été lu et utilisé directement après accès hôte autorisé.
- Précédent conservé : `.preparation/accel-20261022/kit-accel-20261022/research-tools-20261021/RECHERCHE-OUTILS-VEILLE-20261021.md`, version 1.1 reçue dans le kit. Cette référence est historique, pas une nouvelle exécution de ses tests.
- Corpus antérieur relu : `.preparation/accel-20261022/kit-accel-20261022/reception-finale-20261021/corpus/CORPUS-PUBLIC.md`. Avis BOAMP et limites commerciales conservés ; aucun avis n'est devenu une commande acquise.
- Contrats et état produit : [vision](../../../docs/PRODUCT-VISION.md), [état](../../../docs/STATUS.md), [raccord Keenable](../../integration/KEENABLE-CONTRACT.md), [preuves API](evidence/API-TRIALS.json), [observations candidates](PUBLIC-SIGNALS.json), [réglementation candidate](REGULATORY-CANDIDATES.json).
