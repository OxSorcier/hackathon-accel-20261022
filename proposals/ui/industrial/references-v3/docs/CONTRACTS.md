# Contrats communs à fixer par l'intégrateur

Version C1 publiée le 22 octobre 2026 dans src/contracts/index.ts. Types canoniques pour le raccord ; aucun type ne prouve une exécution. Chaque constructeur propose les extensions dans son dossier proposals/. Révision métier opaque (R0 initial), policyVersion opaque (P1 initial).

## Raccord C1
L'intégrateur possède le repository des snapshots, runs, propositions, décisions et mémoires. Le constructeur données reçoit SqlPort et construit collecte/veille PostgreSQL, avec SQL proposé dans proposals/data/. Export attendu : Collector depuis src/data/index.ts et moteur de veille depuis src/watch/index.ts, ou proposition de raccord explicite.
Le constructeur agent exporte BusinessEngine depuis src/domain/index.ts et AgentRunner depuis src/agent/index.ts. Une absence de clé produit une erreur/not_run explicite ; les tests injectés restent mode test. Les règles/calculs déterministes peuvent être affichés séparément d'une inférence réelle.
Le constructeur interface exporte App par défaut depuis src/ui/App.tsx. L'entrée src/main.ts importe App. React 19, CSS standard et Vite ; aucun framework CSS imposé. API enveloppée ApiResponse<T>, GET /api/company retourne CompanyView, GET /api/decisions retourne DecisionsView, GET /api/runs/:id retourne AgentRun. Les mutations ont une session cookie HttpOnly, créée par POST /api/session avec {token}; le serveur résout l'acteur depuis sa configuration. GET /api/session retourne {actor}. POST /api/questions reçoit QuestionInput et retourne AgentRun (202). POST /api/watches reçoit WatchInput. POST /api/proposals/:id/decision reçoit DecisionInput. Le token est saisi par l'utilisateur ; aucune valeur privée par défaut dans le bundle. Toutes les mutations vérifient Origin avant effet.

Extension compatible C1 : GET /api/watch-capabilities publie les deux sujets publics reçus, la source BOAMP fixe et les bornes de cadence (5 à 10080 minutes). L'exemple UI « Production d’isolants en France et perturbations publiques » est un alias reçu du sujet canonique isolants. Un autre sujet ou une autre source reçoit un refus 400 explicite avant toute requête web. Une occurrence manuelle et une occurrence automatique ont des identités distinctes et une exclusion par veille. Un résultat fournisseur uncertain garde ce statut et sa demande de réconciliation même si la révision métier change ; aucune proposition périmée n'est conservée. Une nouvelle tentative de publication SQL réutilise le même résultat et le même fence, sans appel fournisseur supplémentaire.

## Identité, versions et état
Le serveur fournit companyId, actorId et rôle. CO-DEMO est une société de démonstration, pas une identité de connexion. La révision métier et la version de politique sont présentes dans contexte, évaluation et proposition. Une approbation exige les révisions courantes. Chaque opération logique possède une clé stable distincte du run, de sa tentative et de l'appel fournisseur.

## Ports applicatifs
- Repository : lire un snapshot cohérent, retrouver un run/une proposition, enregistrer une mutation avec sa révision et son événement, réserver une occurrence avec bail/fence, publier sous fence courant. L'implémentation reste PostgreSQL ; les adaptateurs de test sont identifiés.
- Collector : sujet public et sources autorisées, budget borné, résultats par source avec provenance/publication/collecte et état success, empty, partial, error ou not_run.
- Business engine : snapshot cohérent et options permises ; retourne contraintes, inconnues, quantités/dates/coûts calculés et options faisables ou conditionnelles. Aucun effet de stock.
- Agent runner : demande ou événement libéré et contexte serveur ; outils typés autorisés, borne de tours/appels/temps, résultats persistés. Sortie proposal, needs_input, stale_context, error ou budget_exhausted. La rédaction seule ne valide pas un plan.
- Proposal store : enregistre les références d'une évaluation valide et la proposition non exécutante. La décision utilisateur est un autre chemin serveur, authentifié, versionné et déterministe.
- Memory : souvenir attribué à une société, auteur, décision, contexte et conditions ; lecture scoped et révalidation si le contexte change.

Pas de transaction SQL conservée pendant un appel web/modèle. Les retries de lecture sont bornés ; un lancement externe dont le résultat est inconnu reste uncertain jusqu'à réconciliation.

## Première surface HTTP proposée
GET /api/company, GET /api/decisions, GET /api/runs/:id pour la lecture de démonstration. POST /api/questions pour la question, POST /api/watches et POST /api/watches/:id/run pour la veille. POST /api/proposals/:id/decision pour une décision sur révision courante. Les commandes exigent la session serveur ; aucune clé privée dans le navigateur. L'intégrateur peut réduire cette surface pour la première tranche et consigne le delta.

Chaque réponse renvoie data ou error, ainsi que runId/revision quand pertinents. Données fictives, observation publique, replay et direct sont explicitement distingués. Un HTTP 200 vide après erreur native n'est pas un succès de collecte.

## Preuve de première tranche
Le modèle choisit un outil de lecture, reçoit un résultat corrélé, choisit un calcul pertinent puis prépare une proposition conservée et affichée avec ses conditions. Refaire avec une date manquante. Toute inférence ou persistance simulée est étiquetée et ne reçoit pas un statut réel.

## Extension reçue : dossier observation et relation, 22 octobre

Les types canoniques CaseRef, EvidenceRef, CaseRelation, DecisionCase, ReleasedCaseContext et les commandes CaseInput, CaseRevisionInput, CaseAnalysisInput sont publiés. Le cadrage Astra de CASE-CONTRACT-DRAFT.md est reçu ; le code final exige encore les deux revues. Les champs caseRef restent optionnels pour les anciens runs, propositions et mémoires, mais sont obligatoires et égaux pour toute chaîne issue d'un dossier. AgentRunnerInput.caseContext est une liste positive, liée au run, à la société et au triplet révision métier, politique et caseRef.

Une version immuable fixe occurrenceId, evidenceId, contentHash, preuve, relation et engagements candidats. La preuve doit provenir d'une occurrence terminée de la société ; un identifiant ambigu est refusé. Une relation est unverified ou none dans cette tranche. Verified est refusé faute de registre attribué. Les produits/fournisseurs candidats sont validés dans le harness. Une hypothèse ne retire aucune livraison confirmée et ne prouve aucune causalité. Qualification to_verify ou no_known_exposure. Les calculs d'opportunité commerciale restent à recevoir.

Routes : GET /api/cases retourne DecisionCase[]. GET /api/cases/:id retourne {current,versions}. POST /api/cases reçoit CaseInput. POST /api/cases/:id/revise reçoit CaseRevisionInput. POST /api/cases/:id/analyze reçoit CaseAnalysisInput et retourne AgentRun en 202. Les mutations exigent une session métier direction/achats et Origin. Le serveur fixe companyId, acteur, versions et références ; il ne reçoit aucun contenu public arbitraire du navigateur.

Les commandes possèdent des reçus idempotents incluant acteur, identités, contenu et révision attendue. Lire le reçu avant le contrôle d'une révision désormais ancienne. Ordre de verrouillage : société, dossier, run/proposition. L'analyse sur une nouvelle révision métier rafraîchit atomiquement la version du dossier et ses candidats avant de mettre le run en file. La correction d'une source est explicite via revise ; une recollecte identique n'invalide rien. L'ancienne version reste dans l'historique. Une correction ou un rafraîchissement périme les propositions pending associées.

L'agent dispose de read_observation_context et d'un contrôle currentCaseRef en plus de currentVersion pour les runs de dossier. Il vérifie le triplet avant/après outils et avant proposition. Les cibles de evaluate_options doivent appartenir aux candidats du dossier. None ou aucun candidat retourne needs_input, sans proposition causale. Unverified conserve RELATION_UNVERIFIED dans les conditions, sans perturbation de couverture inventée. La décision serveur refuse approve tant que la relation reste non vérifiée ; reject est autorisé sur un contexte courant. Une proposition sans caseRef égal au run ne peut pas être publiée. Une ancienne mémoire de dossier est exclue si caseRef manque ou diffère du contexte courant ; les souvenirs sans dossier restent compatibles avec le chemin question seul.

Les champs optionnels SourceEvidence.provenance, family et regulation distinguent snippet, Fetch et enregistrement API. Les dates réglementaires absentes restent null et l'applicabilité unknown ou to_verify. Une collecte n'accorde ni droit ni conformité.

### Nature d'impact et risque conditionnel de cette tranche

La nature est distincte de la vérification : DecisionCase/ReleasedCaseContext portent impactKind risk ou undetermined et riskAssumption optionnel. CaseInput et sa révision peuvent recevoir une hypothèse explicite inbound_delay : ligne d'achat courante, date supposée (ou null inconnue), justification. Le serveur valide produit et ligne d'achat, attribue l'auteur et conserve cette hypothèse dans la version du dossier. Sans hypothèse, nature undetermined ; aucune tonalité d'article ne classe le risque. Avec hypothèse, nature risk, relation toujours unverified, calcul clairement conditionnel sur société synthétique. L'information réelle ne prouve ni le lien ni le retard supposé.

L'outil evaluate_options compare la couverture réelle courante à un clone où seule la date de cette ligne d'achat change. Le clone ne modifie pas le snapshot durable. L'évaluation conserve actualCoverage, riskAssumption, caseRef et la couverture conditionnelle. La proposition affiche ces hypothèses et reste non approuvable tant que la relation est inconnue. Le moteur existant protège tous les engagements, SKU, unités et réservations ; transfert cassant B reste rejeté. La réévaluation après retrait de l'hypothèse ou correction de preuve utilise une nouvelle caseRevision. Cette tranche démontre le maillon risque conditionnel ; le calcul d'opportunité commerciale et l'effet mixte restent à construire séparément.

### Confirmed internal fact and positive approval

The positive branch is based on a confirmed inbound date inside the synthetic company, not on a verified causal link to the public article. InternalConfirmation is a server-owned release with event, company, case/version, purchase line/product, previous/current dates, operator, timestamp, basis, business/policy versions and synthetic origin. It is mutually exclusive with an active RiskAssumption.

POST /api/operator/cases/:id/confirm-inbound accepts CaseConfirmationInput. Operator session and exact business/case versions are required. The command only changes the date of an already confirmed purchase. In one company/case transaction it changes the durable snapshot revision, creates an immutable inbound_confirmation event, creates a new case version, removes the hypothesis, invalidates pending plans and saves an idempotent receipt. The model has no confirmation tool. A business actor cannot confirm and an operator cannot approve.

The model evaluates the durable confirmed snapshot, with coverageBasis confirmed_internal_synthetic and no hypothetical clone. External relation unverified remains an informative condition. Approval requires rereading the immutable event and matching company, case/version, line/product, current date, business/policy revision, then deterministic feasibility, role and ceiling checks. A JSON field alone grants no authority. A later snapshot change invalidates this active basis; analysis cannot silently renew the event. A source/case revision invalidates the old plan and requires fresh confirmation before another positive approval. Previous source, hypothesis, confirmation and decisions remain historical.

Client copy: "Inbound date confirmed in the simulation by the operator. Link to the public news remains unverified." Approval records the decision and attributed memory; it does not execute a purchase or a stock transfer.
