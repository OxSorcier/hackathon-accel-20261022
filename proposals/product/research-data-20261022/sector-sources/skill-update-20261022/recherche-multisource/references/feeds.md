# Flux et accès directs aux publications

Lire pour découvrir des sources sectorielles, suivre des publications ou choisir entre API, flux et extraction de pages. Une recherche ponctuelle simple garde sa portée. Cette référence qualifie les accès ; elle ne crée aucun abonnement, collecteur ou calendrier.

## Découvrir une voie publiée

Partir des éditeurs et organismes pertinents pour la question. Examiner leur documentation, catalogue de données, rubrique actualités et liens de flux. Une API adaptée, un export ou un flux publié évite souvent une extraction de page fragile ; comparer leur contenu et leur fraîcheur au besoin réel.

Dans le HTML, chercher les liens `rel="alternate"` annonçant RSS (`application/rss+xml`), Atom (`application/atom+xml`) ou JSON Feed (`application/feed+json`). Résoudre les URL relatives avec l'URL finale de la page et son éventuel élément `base`. Lire aussi les liens visibles de la rubrique : un flux thématique peut différer du flux général. Une adresse conventionnelle essayée reste une piste jusqu'à sa lecture ; l'absence de lien dans une page inspectée signifie « non découvert ici ».

Ouvrir le point d'accès et vérifier le contenu reçu, pas seulement HTTP 200 ou son extension : flux XML/JSON, page HTML de connexion, erreur ou contenu tronqué. Retenir URL demandée/finale, éditeur, format, date de collecte et entrées pertinentes. Si le flux ne contient qu'un résumé, lire l'article ou le document original qui soutient la conclusion ; sinon limiter la conclusion à l'extrait effectivement reçu.

## Mesurer ce que le flux couvre

Examiner la fenêtre visible, les thèmes et les dates d'un échantillon utile. Dix entrées reçues établissent cet échantillon, pas l'historique complet, l'absence d'incident ou la détection de toutes les publications. Chercher une archive ou une pagination publiée si la période demandée l'exige. Un sitemap peut aider à découvrir des URL ; son `lastmod` n'établit pas à lui seul une date d'événement.

Conserver séparément publication, modification, événement, période statistique et collecte. Un bulletin récent peut décrire un trimestre ancien ; le changement d'une page ne prouve pas un changement d'activité. Une réponse vide, une panne ou un refus d'accès reste une limite de collecte.

Pour une actualisation, conserver l'identifiant natif lorsqu'il existe et le contenu observé. RSS `guid`, Atom `id` ou JSON Feed `id` servent à reconnaître une entrée ; un identifiant peut être distinct de l'URL et rester identique après correction. Pour un RSS sans `guid`, qualifier la clé de rapprochement retenue. Conserver les révisions, URL et empreintes utiles plutôt que recréer un fait à chaque lecture. Plusieurs reprises d'une annonce gardent leur filiation ; elles ne deviennent pas des confirmations indépendantes. Une entrée JSON Feed sans identifiant exploitable reste rejetée ou en erreur, selon le format.

Quand le serveur fournit des validateurs, réutiliser `ETag`/`If-None-Match` ou `Last-Modified`/`If-Modified-Since` selon HTTP. Un `304` signifie que la représentation validée n'est pas modifiée ; il ne prouve ni l'absence d'événements dans le secteur ni la fraîcheur de toute la connaissance métier. La pertinence et les corrections d'une source restent à réévaluer.

## Relier la collecte à la décision

Associer la source à une question, une entreprise ou un périmètre public : entités, sites, produits, géographie et horizon utiles. Chercher menaces, opportunités et changements qui corrigent un constat précédent. Distinguer le sentiment de l'article de son effet pour l'entreprise. Une source publique ne fournit pas à elle seule la dépendance commerciale, la demande confirmée ou le stock mobilisable.

Dans le suivi existant, noter : voie publiée ou page retenue, preuve lue, couverture et rythme observés, champs utiles, limites d'accès, fait interne manquant et prochaine vérification. Séparer accès testé, collecte intégrée, surveillance active et impact reçu. Les conditions d'accès et de réutilisation restent celles de l'éditeur ; une disponibilité technique ne vaut pas licence de republication.

## Repères de format

- [RSS Autodiscovery, version 1.0](https://www.rssboard.org/rss-autodiscovery) : liens de découverte et résolution des adresses.
- [RSS 2.0.11](https://www.rssboard.org/rss-specification) : entrées, résumés, identifiants et dates facultatifs.
- [Atom, RFC 4287](https://www.rfc-editor.org/rfc/rfc4287) : identifiants, liens et versions d'une entrée.
- [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) : format, découverte, identifiants et pagination.
- [HTTP, RFC 9110, section 13](https://httpwg.org/specs/rfc9110.html#conditional.requests) : requêtes conditionnelles et validation de représentation.
