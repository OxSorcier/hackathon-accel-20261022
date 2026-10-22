# Mieux chercher les signaux utiles à AdaptOps

22 octobre 2026. Version 1. Retour de méthode demandé par Erwan. Statut : correction documentaire du skill local appliquée et relue ; gain de recherche non mesuré. Dossier propriétaire : recherche sectorielle existante, suivi [ERW-133](https://linear.app/briques/issue/ERW-133).

**Oui, la recherche pouvait mieux cibler ses premières vérifications.** Le manque principal du skill était la découverte explicite des flux. Plusieurs autres garde-fous existaient déjà ; ils devaient être mieux appliqués aux conclusions métier.

## Les écarts utiles à corriger

| Écart observé | Ce qu'il fallait vérifier plus tôt | Traitement |
| --- | --- | --- |
| Des sites spécialisés évoqués comme candidats au scraping avant une méthode explicite de découverte des flux. | API, export et liens RSS de l'éditeur. FNB et France Bois Forêt avaient des flux annoncés, effectivement lus pendant la recherche. | Nouvelle référence du skill : découverte et qualification des RSS, Atom et JSON Feed. |
| Une annonce de future usine rapprochée d'une urgence de livraison. | Site, produit, horizon et dépendance commerciale. La publication ne confirmait pas le retard du fournisseur synthétique. | Exemples concrets ajoutés à la vérification des conclusions métier. |
| Un incendie envisagé comme preuve d'arrêt de production. | Ce qui a brûlé, l'effet réellement rapporté et sa durée. Le communiqué ROCKWOOL historique précise que l'activité industrielle était maintenue. | Lire les conséquences et les éléments qui réfutent l'impact supposé. |
| Des dates de publication et de mise à jour proches de périodes statistiques plus anciennes. | Période décrite, événement, publication, modification et collecte. | Distinction précisée dans la référence sur les flux. |
| Dix entrées RSS ou un accès HTTP 200 susceptibles de sembler suffisants. | Fenêtre couverte, contenu réel, accès à l'article et historique. Un flux court ne prouve aucune exhaustivité. | Limites de couverture, doublons et corrections explicites. |
| La concurrence trop présente dans le cadrage d'un hackathon. | Le rôle demandé par Erwan : construire le parcours reçu maintenant, étudier les mécanismes intéressants après. | Priorité corrigée dans le dossier. Le skill conserve une recherche concurrentielle proportionnée au mandat. |

Le manque de données internes reste distinct du manque de sources web. Davantage d'articles ne révèle pas automatiquement les réservations, l'origine d'un lot, la dépendance d'un achat ou la demande commerciale confirmée. Lorsqu'une de ces données manque, la prochaine action doit viser ce fait précis.

## Ce qui change dans le skill

Le skill existant [recherche-multisource](skill-update-20261022/recherche-multisource/SKILL.md) garde son nom, sa sélection et ses autres références. Sa nouvelle [référence sur les flux](skill-update-20261022/recherche-multisource/references/feeds.md) indique comment trouver et vérifier un accès publié, lire l'original nécessaire, distinguer dates et couverture, et conserver identifiants et révisions. Les points techniques s'appuient sur les spécifications originales de [découverte RSS](https://www.rssboard.org/rss-autodiscovery), [RSS 2.0](https://www.rssboard.org/rss-specification), [Atom](https://www.rfc-editor.org/rfc/rfc4287), [JSON Feed](https://www.jsonfeed.org/version/1.1/) et [HTTP](https://httpwg.org/specs/rfc9110.html#conditional.requests).

Une nouvelle version locale contient huit fichiers, dont quatre ajoutés ou modifiés. L'ancienne version et ses empreintes sont conservées. Les autres liens de skills et la politique d'invocation sont inchangés. Le [reçu technique](skill-update-20261022/SKILL-UPDATE-RECEIPT.json) identifie les versions ; le [diff](skill-update-20261022/SKILL-DELTA.patch) rend la correction révisable.

## Concurrence : inspiration après le hackathon

Un produit voisin ne retire pas l'intérêt du projet. Pour cette livraison, nous jugeons la pertinence du signal, son impact sur l'entreprise et la qualité du plan calculé. Les références concurrentes déjà trouvées sont conservées. Leur étude détaillée et l'emprunt éventuel de mécanismes sont différés, comme demandé ; aucune nouvelle recherche concurrentielle n'a été lancée.

## Preuves et limites

Le validateur du skill passe. Les références locales et les huit fichiers actifs ont été contrôlés ; l'ancienne version est intacte. Les erreurs métier ci-dessus sont rapprochées des [preuves d'accès existantes](PUBLIC-ACCESS-PROBES.json), des [sources d'incidents qualifiées](INDUSTRIAL-INCIDENTS-20261022.json) et du [checkpoint de réception](CHAIN-RECEPTION-CHECKPOINT.json).

La correction est disponible dans le skill Codex local et relue dans ce chat. Son application automatique dans les autres chats, un essai avec un nouvel agent et l'amélioration mesurée de la recherche restent non vérifiés. Aucun scraper, flux produit, scheduler ou calcul métier n'a été ajouté par cette mise à jour.
