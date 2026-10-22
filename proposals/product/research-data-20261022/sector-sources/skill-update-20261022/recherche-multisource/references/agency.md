# Filiation avec Agency

Lire cette référence pour réutiliser les anciens collecteurs ou comprendre les choix repris. Elle n'est pas une dépendance d'exécution.

Sources consultées le 19 octobre 2026 dans le dépôt local `browse-club-agency-model`, chemin `/Users/erwan/Documents/Code - Xcode/browse-club-agency-model`, HEAD `4ef712c42824e3438513b251829b67fe2dec546f`. Les fichiers suivants étaient sans modification signalée par Git lors du contrôle ciblé :

| Source | Identité Git du fichier lu | Apport conservé |
|---|---|---|
| `_gstack/skills/research.md` | `efbe1b57ee3c73f42d645b14c9b3da971a691044` | Décomposition, choix d'une voie par sous-question, recomposition et recherche interne préalable |
| `.claude/agents/alphonse.md` | `b73ef0aaf5acf3a66831ee46792e5732d5381779` | Perspectives, lecture des sources, contradictions et distinction entre fait, inférence et hypothèse |
| `_library/scripts/client-research.py` | `ce5d11042b916d39beabc3a5e629d88d73ac12ca` | Collecteurs, classement, dédoublonnage et erreurs explicites |

Lecture ciblée du collecteur : `fetch_reddit` prévoit PRAW puis la route JSON ; `fetch_hn` utilise Algolia ; `fetch_x` appelle `clix`. `run_all_sources` compose les sources sélectionnées, dédoublonne par URL et prévoit un repli SearXNG. Les entrées du module et les symboles de scoring et de transcription ont aussi été repérés. Aucun appel à ces fournisseurs, test de leurs identifiants ou contrôle de leur déploiement n'a été exécuté ici.

Deux notes historiques ont guidé l'adaptation : `memory/aligned-research-scraping-system.md` et `memory/feedback-social-research-read-actual-content-not-snippets.md`. Elles expliquent le besoin de lire les contributions sociales réelles dans une session autorisée.

Le skill courant reprend ces principes avec les outils effectivement disponibles. Il remplace les anciens automatismes de navigateur par le routage Aside documenté et conserve les API lorsqu'elles répondent mieux au besoin. Les noms de backends, plafonds historiques, états de service et procédures de validation propres à Agency restent historiques ; les droits et validations du projet courant font autorité.

## Renforcement du 20 octobre 2026

Les sources Agency ont été relues au même HEAD `4ef712c42824e3438513b251829b67fe2dec546f`, sans modification locale signalée sur `research.md`, `alphonse.md` et `research-close.py` lors de ce contrôle. Leur présence n’atteste pas la disponibilité de leurs services dans Codex.

- Du routeur : choix de la profondeur, sous-question vers preuve/voie adaptée, approfondissement motivé par un manque. Les anciens plafonds par backend ne deviennent pas un critère de couverture.
- D’Alphonse : perspectives avant collecte, contre-exemples, diversité et lecture des contributions originales, qualification de confiance et suivi des questions ouvertes.
- De `client-research` : intérêt de collecteurs réutilisables, classement et dédoublonnage ; aucune activation automatique ni promesse de disponibilité des API.
- De `research-close.py::main` : précontrôle des affirmations puis revue de leur solidité, distinction entre appel réussi et contenu du verdict. Le script dépend de `research-claims-precheck.py` et `codex-review.py` et utilise une lecture heuristique du verdict ; il n’est pas repris comme validateur de vérité ni installé par ce skill.

Les fonctions sont adaptées dans `investigation.md` et `verification.md`. Les fournisseurs et gates historiques d’Agency ne sont pas transportés implicitement ; les contrôles et droits du projet de destination gardent leur autorité.

## Conservation complémentaire du 20 octobre 2026

La branche [découverte ciblée](discovery.md) restaure le déclencheur, les opérateurs et la table de réception du DORK d'Alphonse, lignes 63 à 76 à la révision ci-dessus. Les perspectives et sous-questions conservent le sens de sa préparation STORM, sans installer Stanford STORM ni reprendre des quotas historiques.

Le registre existant ErwanOS `recovery/agency/registre.md`, groupe G08 et unités T107-T115/T210-T220, conserve aussi Exa search, academic-search, fetch-url, le collecteur Hugging Face optionnel, GPT Researcher quick/deep, les contrats de fraîcheur/budget et l'organe factcheck. Ce sont des actifs retrouvables, pas des adaptateurs actifs dans chaque hôte. Toute reprise doit lire leur interface et éprouver leur erreur : une restriction Hugging Face inconnue n'est pas une autorisation, un résumé n'est pas la source et une recherche profonde ne reçoit pas ses propres conclusions.

Contre-exemple conservé : le wrapper Agency `client-research-resumable.py` importe à la ligne 59 un module `client_research` absent de la révision examinée ; le test `test_resumable_cabling.py` lui substitue un module. Son patron de reprise reste utile, son raccord réel n'est pas reçu. Ne pas copier ce wrapper comme collecteur opérationnel.
