# Mandat : interface A

Lis AGENTS.md, START-HERE.md, docs/HANDOFF.md et docs/OWNERSHIP.md. Ouvre design/A-bureau-decisions.png avant de coder. C'est la direction préférée d'Erwan ; affiner sobrement, sans nouveau brainstorming ou nom de marque reçu implicitement.

Construis dans src/ui/ un bureau de décisions professionnel : contexte de société, À décider/En cours/Terminé, question, veille, sources et fraîcheur, proposition avec conditions/révisions, trace d'outils et états d'erreur. Le rapport utilise des composants contrôlés ; aucun HTML/JS libre du modèle. Tous les labels fictif/public/direct/rejeu restent fidèles aux données.

Prépare composants et adapter UI dans ton périmètre ; branche seulement sur les contrats reçus. Les mocks de développement sont étiquetés, séparés et ne déclenchent pas une fausse preuve modèle/collecte. L'intégrateur possède package, configuration Vite, HTML d'entrée et routes serveur ; tes demandes sont dans proposals/ui/.

Utilise les méthodes produit/UI et Aside en premier pour le parcours. Si une capacité manque, nomme le repli et le navigateur réellement testé. Tester attente, erreur, plan périmé et tailles mobile/desktop ; ne déclarer le parcours reçu qu'après raccord à la version intégrée. Retour final : fichiers, captures réellement obtenues, contrôles et limites, modèle réalisateur et hash dans proposals/ui/. Les revues finales sont coordonnées par l'intégrateur.
