# Raccord observation vers décision, tranche C1 additive

22 octobre 2026. Proposition technique à cadrer avant publication du contrat. Propriétaire : intégration. Mandat humain reçu : OpenAI, Aiven, chaîne métier et coordination des trois constructeurs. La copie stable 3001 reste intacte.

## Résultat de cette tranche

Une preuve publique réellement collectée devient un dossier de la société courante. Le serveur conserve la preuve, ses versions, la relation métier et sa provenance. Il calcule les engagements candidats depuis le snapshot courant. L'agent choisit ses outils sur cette entrée positive, prépare une proposition durable, puis une décision humaine est contrôlée côté serveur. Une correction de preuve, de relation ou de snapshot périme l'ancien contexte. Les cas sans lien et les homonymes restent visibles.

Les fournisseurs SUP-1/2/3 sont fictifs. Une actualité réelle ne peut créer une relation vérifiée avec eux. Une hypothèse de produit ou fournisseur reste explicite ; le calcul porte alors sur la couverture actuelle et ne retire aucune livraison confirmée. L'hypothèse seule ne suffit pas à approuver une option de stock ou d'achat. Aucun effet externe n'est disponible.

## Types proposés

- CaseRef : caseId et caseRevision opaque.
- DecisionCase : id, companyId, caseRevision, observation SourceEvidence, relation, candidateOrderLineIds, businessRevision, policyVersion, createdAt, updatedAt et auteur serveur.
- Relation : status unverified, verified ou none ; productId et supplierId optionnels ; justification attribuée ; relationId de société pour verified. Le serveur vérifie ces identités, pas le modèle. La première tranche accepte unverified et none ; verified exige une relation attribuée déjà présente dans le harness de société. Aucun rapprochement par seul nom.
- ReleasedCaseContext : ref, preuve positive bornée, relation et engagements candidats, avec qualification to_verify ou no_known_exposure. Aucun document de construction ni scénario futur.
- AgentRun et Proposal : champ caseRef optionnel. AgentRunnerInput : caseContext optionnel. Les anciens appels sans dossier restent compatibles.
- DecisionsView : cases optionnel pendant le raccord, puis servi par le serveur ; UI existante compatible en absence du champ.

## Autorité et persistance

POST /api/cases reçoit occurrenceId, evidenceId, relation candidate, operationKey. La preuve est relue dans l'occurrence PostgreSQL de la société configurée ; aucun contenu arbitraire reçu du navigateur. Une variante opérateur de preuve explicitement libérée reste séparée et n'est pas chargée au démarrage.

POST /api/cases/:id/revise reçoit expectedCaseRevision et nouvelles références de preuve/relation. Une transaction verrouille la société puis le dossier, garde l'ancienne version, crée la suivante et périme les propositions pending associées. Une même opération rejouée rend le même résultat ; un autre contenu sous cette clé est refusé.

POST /api/cases/:id/analyze reçoit expectedCaseRevision, question et operationKey. Le serveur enregistre caseRef dans le run ; le worker relit le contexte exact. Il ne réutilise pas une version corrigée sous la référence ancienne. Les contrôles avant/après outils et à la publication comparent version métier, politique et dossier. La décision compare aussi la version actuelle du dossier et sa relation. Aucune transaction ouverte pendant le modèle ou le web.

GET /api/cases et GET /api/cases/:id retournent le dossier courant et son historique de versions. Le modèle dispose d'un outil read_observation_context ; evaluate_options ne retire aucun stock ni inbound pour déduire une causalité d'un article. La preuve externe devient donnée non fiable. Une relation non vérifiée reste une condition explicite de la proposition et bloque son approbation ; le rejet humain reste possible.

Une mutation métier marque les propositions pending périmées et le dossier à réévaluer. Une correction de preuve crée une nouvelle version, invalide les anciennes propositions et permet une nouvelle analyse explicitement demandée. Aucun retry fournisseur après uncertain.

## Répartition et preuves

Intégration : contrats canoniques, migrations, stockage et HTTP, worker, versions courantes, décision, test intégré et preuve réelle. Agent : contexte positif, outil de lecture, contraintes de relation et propagation des références ; aucun changement avant contrat fixé. Données : collecte réelle et provenance ; pas de doublon de calcul métier. UI : sources reliées au dossier, relation, engagements candidats, proposition et états de révision, après contrat fixé.

Tests requis : preuve étrangère refusée ; homonyme sans relation ; hypothèse sans mutation d'inbound ; aucun lien connu sans plan causal ; correction de preuve et changement métier refusent l'ancien plan ; idempotence et concurrence ; relecture après reconnexion ; modèle réel distinct des tests HTTP injectés.

Opportunités commerciales complètes et réglementation avec échéances restent des tranches suivantes : les types ne prétendent pas que leur calcul est disponible. Leur couverture de source et leur provenance sont préparées par données/veille.
