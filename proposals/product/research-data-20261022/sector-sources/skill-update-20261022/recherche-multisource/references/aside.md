# Recherche avec Aside

Lire ce document lorsque la recherche utilise Aside. Rafraîchir les commandes depuis l'aide installée ; les sites et helpers disponibles peuvent évoluer.

## Accès et environnement

1. Lire `aside guide repl`, puis `aside skills list` et le skill intégré du site concerné s'il existe. Utiliser les helpers documentés pour Google Search ou YouTube. Dans l'environnement observé le 19 octobre 2026, X et Reddit se lisent avec le navigateur et ses snapshots.
2. Piloter directement avec `aside repl --host local`. `aside exec` déclenche un agent distinct : son usage nécessite une autorisation de délégation.
3. Une erreur de connexion sous sandbox ne prouve pas qu'Aside est arrêté. Vérifier l'accès hôte autorisé avant de conclure. Conserver les permissions du système ; ne pas modifier sa configuration pour faire disparaître un refus.
4. Pour reprendre une page, inspecter les onglets pertinents avec `listBrowserTabs()`, puis attacher le `targetId` observé avec `attachBrowserTab()`. Ouvrir un onglet avec `openTab()` quand aucun onglet pertinent n'existe. Éviter d'afficher l'inventaire des onglets sans rapport avec la recherche.

Dans les invocations CLI ponctuelles testées, les variables JavaScript ne survivent pas d'un appel à l'autre. Reprendre par l'identité de l'onglet et un nouveau snapshot ; réserver la réutilisation des variables au contexte REPL qui les conserve effectivement.

## Recherche et lecture

- Utiliser `snapshot(page, { interactive: true })` comme première lecture. Si le contenu manque, passer au snapshot complet, puis à une capture si nécessaire. Pour limiter une page longue, cibler une référence fraîche ou un sélecteur réellement observé ; conserver le snapshot sans le tronquer arbitrairement.
- Agir sur des éléments observés. Chaque nouveau snapshot invalide les anciennes références. Vérifier les effets d'une action avec un nouveau snapshot ou une capture.
- Une page qui affiche encore un chargement justifie une brève attente puis une nouvelle lecture. La navigation seule ne prouve pas que les résultats sont arrivés.
- Sur X, utiliser la recherche native, examiner les tris pertinents et ouvrir les posts retenus. Développer les textes tronqués. Relever leur lien permanent et leur date ; distinguer le post courant du contenu cité.
- Sur Reddit et Hacker News, lire le post et les commentaires qui apportent une précision ou une objection. Citer la contribution concernée lorsque son lien permanent est disponible.
- Les recherches Google du helper Aside se font séquentiellement : examiner une réponse avant de décider la suivante. Les rafales parallèles augmentent le risque de blocage.
- Utiliser les sessions déjà autorisées pour la lecture. Garder la recherche passive : publier, répondre, suivre un compte, contacter quelqu'un ou modifier un réglage nécessite un mandat distinct. Un accès indisponible reste une limite explicite ; ne pas chercher des cookies ou des identifiants pour le contourner.

## Vidéo

Avec le skill YouTube installé, rechercher les vidéos, lire leurs métadonnées et les langues de sous-titres, puis récupérer la transcription utile avec horodatages.

Conserver ID, URL, auteur ou chaîne, publication, consultation, durée, langue et nature de la piste quand elle est déterminable. Vérifier l'ordre et les bornes temporelles. Citer seulement des débuts de passages contrôlés. Signaler une piste absente ou une anomalie ; une description de vidéo ne remplace pas sa transcription. Distinguer les propos transcrits d'une démonstration visuellement vérifiée.

## Repli

En fin de recherche, fermer seulement les onglets créés pour ce travail lorsqu'ils ne sont plus nécessaires. Conserver ceux que l'utilisateur veut revoir et les onglets préexistants. Recevoir cette fermeture depuis l'interface réellement utilisée ; ne pas la déduire de la fin du script.

Après un échec, choisir une autre voie qui apporte réellement la preuve manquante : source officielle, autre contribution accessible, API autorisée ou autre navigateur permis par le projet. Distinguer les sources découvertes des sources effectivement lues. Garder la surface manquante visible dans la couverture et continuer les recherches indépendantes.
