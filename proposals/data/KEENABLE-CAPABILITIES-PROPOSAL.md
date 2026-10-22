# Raccord Keenable et couverture des sources

22 octobre 2026. Delta demandé par Erwan dans le chat données et veille. Proposition de raccord à recevoir par l'intégrateur ; aucun fonctionnement déclaré par ce document.

## Répartition reçue

- Données et veille : collecteur Keenable, normalisation, provenance, capacités publiques, validation des entrées et résultats, tests et nouveau reçu du module.
- Intégrateur : contrat canonique, API des capacités, configuration privée, dossiers d'impact, raccord modèle et calcul, persistance/relecture de la proposition et test intégré.
- Chat recherche existant : contrat API observé, source sectorielle réelle candidate, comparaison Keenable/Exa et sources réglementaires originales.

Le READY initial et ses résultats restent historiques. Les fichiers originaux sont archivés sous `proposals/data/history/v1/` avant toute modification. Le nouveau code émettra un reçu distinct `READY-KEENABLE-v2.json`.

## Compatibilité C1 proposée

Conserver `CollectorInput`, `CollectionResult` et les champs C1 de `SourceEvidence`. La liste positive des sources devient BOAMP et Keenable Search, au lieu de BOAMP uniquement. Un collecteur public compose les deux adaptateurs ; l'injection dans le moteur reste `createWatchEngine({ repository, collector })`.

La source Keenable possède une identité stable de capacité `https://api.keenable.ai/v1/search`. L'accès réellement utilisé, public ou avec clé injectée côté serveur, est conservé en provenance. Un endpoint public ne consomme pas le crédit du compte selon la documentation ; aucun passage automatique au paiement x402 ou autre fournisseur n'est prévu.

Les sujets restent des profils publics reçus. La requête n'est jamais construite à partir du stock, de commandes, de noms clients ou d'identifiants internes. Les profils associent sujet, famille, requête publique fixe, domaine(s) de publication admissibles, horizon éventuel et sources permises. L'API des capacités peut exposer `publicTopics`, `sourceUrls` et une liste `profiles` descriptive, sans laisser l'utilisateur définir une URL ou une requête réseau arbitraire.

Les deux anciens sujets BOAMP et leurs URL/identifiants restent acceptés. Un résultat Keenable reçoit `keenable:<sha256 URL canonique>` et conserve l'URL de la publication originale, son titre, son contenu effectivement obtenu, la date publiée lorsqu'elle est fournie et vérifiée, la date de collecte et le hash du contenu normalisé. Le hash ne dépend pas de l'heure de collecte. Une découverte par snippet ne devient pas une lecture intégrale. Une extraction tronquée, un document inaccessible ou une réponse incohérente restent partiels ou en erreur.

## Couverture des profils proposée

| Famille | Sources/capacité | Statut à produire |
| --- | --- | --- |
| Actualités sectorielles | Keenable Search puis Fetch de publications admissibles BTP, bois, matériaux | Signal daté, pertinence à qualifier |
| Actualités régionales | Recherche publique avec contexte géographique fixe du profil | Lieu vérifié ou inconnu |
| Communiqués fournisseurs | Domaines officiels de fabricants reçus | Communication publique, aucun lien commercial implicite |
| Incidents industriels | Recherche sectorielle et sources originales ou institutionnelles | Incident rapporté, exposition à vérifier |
| Projets et marchés publics | BOAMP direct et recherche publique complémentaire | Opportunité à qualifier, aucune commande inventée |
| Réglementation France | Recherche restreinte à Légifrance et sources administratives reçues | Texte identifié, applicabilité à vérifier |
| Réglementation UE | Recherche restreinte à EUR-Lex et institutions UE reçues | Texte identifié, applicabilité à vérifier |
| Réalité de l'entreprise | Données métier déjà libérées côté serveur | Fournisseurs, commandes, confirmations, stock, réservations, transport ; synthétiques tant que non raccordées à une source réelle |
| Opportunités commerciales | Rapprochement du signal, des clients et du stock compatible libre par les outils métier | Calcul et proposition sous conditions, pas de prospection ni d'envoi automatique |

## Métadonnées complémentaires à recevoir

Proposition d'extension optionnelle de `SourceEvidence`, possédée par l'intégrateur : une provenance de récupération (`provider`, endpoint, méthode `search_snippet`/`fetch`, date d'indexation éventuellement fournie, `truncated`, profil) et une qualification de famille. Les métadonnées supplémentaires ne doivent pas être cachées dans un champ arbitraire ou déclarées prouvées par le seul moteur de recherche.

Pour la réglementation, distinguer au minimum : juridiction FR/UE, identité officielle du texte, date de publication, entrée en vigueur, date d'application, échéance, conditions de champ et statut d'applicabilité (`à vérifier`, `confirmée`, `non applicable`). Une date absente reste inconnue. La publication ou le classement réglementaire ne suffit jamais à déclarer un produit interdit, une entreprise non conforme ou un engagement compromis. Le calendrier doit recevoir des échéances confirmées et attribuées, avec leur source/version ; une fréquence de veille n'est pas une échéance juridique.

## Bornes de la première intégration

Un appel Search borné et quelques Fetch bornés par collecte. Timeouts, taille, nombre de résultats et annulation contrôlés. Aucun contenu externe ne donne un droit ou une commande. Les publications et dates futures incohérentes, redirections, hôtes non admis, URL avec identifiants ou chemins privés, réponses JSON invalides, corps vides et erreurs natives restent visibles.

Le test intégré devra utiliser une information sectorielle réellement reçue par Keenable, montrer son identité et sa date, conserver le lien métier en hypothèse si la société reste synthétique, puis exercer les outils métier et relire une proposition calculée. Un résultat de recherche, un test scripté du modèle ou une proposition sans calcul ne satisfait pas ce critère.

## Documentation ouverte pour le raccord

- [API et authentification Keenable](https://docs.keenable.ai/api-reference)
- [Search](https://docs.keenable.ai/api-reference/search)
- [Fetch](https://docs.keenable.ai/api-reference/fetch)

Ces pages décrivent les capacités et limites ; leurs exemples ne prouvent pas le fonctionnement dans le produit.
