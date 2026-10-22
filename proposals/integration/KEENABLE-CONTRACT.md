# Raccord Keenable au chantier existant

22 octobre 2026. Propriétaire du test intégré : intégration, chat 01a162bd-d470-7522-9d95-a03a82d9bd68. Propriétaire collecte : données/veille, chat 01a162bd-e262-7fa2-a1f3-aab46f68fc1a.

Conserver CollectorInput et CollectionResult, SourceEvidence et les résultats par source du contrat C1. Chaque preuve porte URL originale HTTPS, titre, contenu borné, publication si connue, collecte, hash du contenu, mode et origine. Les erreurs, contenus partiels et dates absentes restent explicites. Pas de données commerciales dans les requêtes web ; aucun nom client, stock, commande ou secret transmis.

Le constructeur données propose un export factory de collecteur recevant la configuration privée et un fetch injecté. L'intégrateur crée le client au moment utile côté serveur. Les clés restent dans .env.access privé géré par le propriétaire des accès, jamais dans code, prompts, bundle, traces ou reçus.

Proposer dans proposals/data/ la liste positive de sujets publics, la validation des sources, les limites de requêtes/réponses et le schéma de capacités pour remplacer le couple BOAMP fixe. Le serveur ne retire pas ses validations avant réception de ce contrat. Une requête de recherche peut utiliser le domaine de l'API comme connecteur ; la preuve doit conserver l'URL originale de l'éditeur. Pas de téléchargement arbitraire hors garde réseau.

Couverture cible reçue d'Erwan : actualités sectorielles et régionales, communiqués fournisseurs, incidents, projets et marchés publics, opportunités commerciales, réglementation française/européenne avec échéances. Qualifier séparément chaque couverture documentée, implémentée, testée et NOT_RUN. La recherche partenaire fournit une source candidate et sa comparaison de services ; sa recommandation n'est pas un résultat API.

L'intégrateur reçoit un nouveau READY exact et ses deux revues, puis exécute un appel borné et crée un dossier depuis la preuve persistée. La relation avec nos fournisseurs fictifs demeure à vérifier. Le calcul métier est centralisé dans les modules existants. Le raccord de dossier est préparé dans CASE-CONTRACT-DRAFT.md ; aucun deuxième moteur d'impact dans la collecte.
