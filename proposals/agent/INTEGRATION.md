# Raccord métier et agent, C1

Entrées publiques : `businessEngine(snapshot)` ou `evaluateBusiness(snapshot, targetOrderLineId)` dans `src/domain/index.ts` ; `createAgentRunner(options)` dans `src/agent/index.ts`.

`businessEngine` recalcule toutes les cibles confirmées, car le callback C1 de décision ne reçoit qu'un snapshot. Chaque option identifie un tuple typé contenant la cible et le devis : préfixe lisible plus SHA-256 du tuple JSON. Cet encodage garde une taille bornée et ne confond pas des identifiants natifs contenant des séparateurs. `evaluateBusiness` retourne une seule cible pour les outils du modèle. Le serveur retrouve l'option exacte dans la réévaluation globale, sans confondre les options d'A et de B/C. Les anciens IDs des versions de revue v1/v2 ne sont pas compatibles avec cette version v3. Les IDs natifs restent dans les effets et allocations ; un hash ne donne aucun droit.

C1 expose les allocations par un `sourceId` sans type de table. Le parseur refuse donc des IDs de ressource ambigus entre stock, approvisionnement et devis. Une entrée future ne peut ainsi pas se faire passer pour du stock physique. Une évolution vers des IDs qualifiés par type relève du contrat partagé, pas d'une réécriture de leurs identités natives.

Le moteur accepte le snapshot C1. Il contrôle la cohérence société/révision et les six règles initiales exactes. Une politique inconnue est refusée, car C1 expose seulement du texte libre. Le coeur `evaluateOptions` prend le résultat validé de `parseSnapshot` et une politique structurée. Aucun calcul ne modifie ses entrées ni le stock.

Les effets proposés sont descriptifs : `targetOrderLineId`, `productId`, `quantity`, `unit`, `fromDepotId`, `toDepotId`, `quoteId`, `arrivalDate`, `coverage`, `simulationOnly`. Les prix sont calculés en centimes puis convertis en `costEur` pour C1. Le chemin de décision serveur doit recalculer avec le même moteur sur la révision courante, contrôler le rôle et le plafond courant, puis appliquer uniquement un effet simulé explicite. La faisabilité ne constitue pas une autorisation.

Un transfert ou achat porte uniquement la quantité qui manque à la cible. Un achat de quatre palettes à 155 EUR avec 180 EUR de fret coûte 800 EUR ; il ne doit pas annoncer huit palettes. La marge de remplacement suit la quantité physique qui couvre les engagements explicitement visés par la politique, avec ou sans réservation et après réallocation indirecte entre stocks. Les nouvelles contraintes de date sont propagées jusqu'à stabilisation. Un surplus libre ou un changement entre stocks interchangeables qui laisse cette quantité physique intacte ne déclenche pas cette marge.

La politique reçue donne deux jours de marge à B, pas à C. Le type métier conserve cette portée dans `replacementOrderLineIds` ; l'adaptateur C1 la résout sur les lignes de `ORD-B`. C doit rester couvert au plus tard à sa date de besoin reçue. Dans le cas indirect, le moteur peut garder le stock physique pour B et affecter l'entrée confirmée du 4 novembre à C dont c'est la date de besoin : cette option est faisable si tous les engagements restent couverts. La nouvelle vérification ne confond pas ce cas avec B couvert le 4 novembre, qui demeure inadmissible.

Le runner requiert un `ModelProvider` autorisé et `currentVersion()` côté serveur. Sans fournisseur, `agentRunner` renvoie `needs_input`, modèle nul, aucune proposition et aucun faux appel. Le fournisseur est injecté ; le chat d'accès et l'intégrateur choisissent le modèle et son protocole réel. Aucun SDK, clé, fournisseur ni appel réel ajouté ici. Les tests injectent exclusivement un fournisseur scripté avec `mode: test` ; cela ne prouve aucune inférence réelle.

`currentVersion()` relit société, révision et politique hors transaction longue. `writeTrace(trace)` est un port facultatif pour persister chaque intention et résultat pendant le run. Sinon les traces sont retournées à `finishRun` C1 : le redémarrage pendant une inférence ne prouve pas la réception de ces traces. Les références d'évaluation sont locales à une tentative. La persistance et le fence final restent à l'intégrateur ; un worker ancien ne peut publier via ce seul module.

Un appel fournisseur interrompu reste `uncertain`. La trace terminale reste dans le résultat même si le budget d'écriture est expiré ou si le sink échoue ; `finishRun` doit la conserver. Aucun retry fournisseur automatique n'est réalisé. Les messages d'un lot contiennent tous les appels assistant, puis leurs résultats outils corrélés, pour les protocoles qui regroupent ces blocs.

Une proposition retourne l'évaluation exacte et reste `pending`. `prepare_proposal` n'accepte que les évaluations produites dans ce run et une option non rejetée. Une option conditionnelle doit conserver ses conditions et rester non approuvable côté serveur tant qu'elles subsistent. Une simple sortie texte reste `needs_input`.

La mémoire C1 est attribuée à une société, un acteur et une proposition. Une révision ou politique différente force une nouvelle validation ; le contenu rappelé reste un conseil non fiable et ne modifie pas la politique. L'écriture de la décision authentifiée et de son souvenir relève du serveur. Aucun apprentissage mesuré n'est revendiqué.

La date de lecture, `manifest.assembledAt`, borne les souvenirs futurs. `snapshot.updatedAt` n'est pas une borne de lecture : une décision légitime peut avoir été créée après la dernière modification métier. Les identités des souvenirs étrangers restent hors des résultats envoyés au modèle.

Tests : `npx --no-install vitest run tests/domain tests/agent`. Pas de dépendance ajoutée par ce rôle. L'intégration réelle, PostgreSQL/Aiven, le fournisseur et le navigateur restent à tester dans la version assemblée.

Réception : consommer le manifeste final de READY.json. Les manifests v1, v2 et v3 et leurs constats restent historiques. Le delta final corrige la portée B au sein du troisième cycle revue/corrections, après diagnostic de la perte de portée dans l'adaptation C1. Il ne relance pas une exploration générale.

Le suivi `.codex/task-state/01a162bd-ee93-7cc2-a93f-659950f41d93.json` n'a pas pu être créé : `.codex` est en lecture seule dans ce chat. Le rapprochement objectif, preuves et reste à faire est maintenu manuellement, puis dans READY.json.
