# Accel : une mémoire de recherche qui connaît l'entreprise

22 octobre 2026. Version 1. Propriétaire produit : Erwan. Complément à PRODUCT-VISION, suivi existant ERW-133. Mots de recherche : mémoire entreprise, recherche, antériorités, réglementation, contexte, harness, traces, télémétrie, réutilisation.

**Vision exprimée par Erwan : conserver ce qui a déjà été trouvé pour que les nouvelles recherches repartent des acquis et du contexte de la boîte.** Le cadrage couvre les recherches sectorielles, régionales, fournisseurs et réglementaires, leurs sources, leurs conclusions et leurs limites. Les choix techniques ci-dessous restent des propositions à recevoir par les propriétaires du build.

## Ce que le produit doit savoir retrouver

Le produit rapproche trois ensembles liés, avec leurs droits et leur historique.

- **La réalité de l'entreprise** : activité, sites, produits, fournisseurs, clients, engagements, stocks, contraintes, règles et priorités validées. Les systèmes maîtres ERP/CRM et les personnes autorisées gardent leur autorité.
- **Les connaissances issues des recherches** : question posée, périmètre, sources effectivement consultées, dates, contenu disponible, faits étayés, hypothèses, contradictions et inconnues. Une recherche sans résultat utile doit aussi être retrouvable, sans être transformée en preuve d'absence.
- **Les décisions et leurs suites** : options calculées, choix humain, auteur, conditions, contexte utilisé et résultat réellement observé, lorsqu'il existe. Une décision acceptée ne prouve pas son exécution ou son efficacité.

L'agent « connaît la boîte » lorsqu'il retrouve les éléments pertinents de ces ensembles et peut montrer d'où ils viennent. Le harness organise les lectures, les calculs, les droits, les révisions et la persistance. Un rôle spécialisé de mémoire est possible ; un nouvel agent autonome ou une nouvelle infrastructure n'est pas nécessaire pour définir cette capacité.

Les documents de construction, la stratégie de notre propre société, les oracles et les événements futurs d'essai restent dans la documentation du projet. Ils ne deviennent pas des connaissances de l'entreprise cliente chargées dans le modèle produit.

## La boucle à construire

**Question → recherche dans les acquis autorisés → contrôle de fraîcheur et de pertinence → recherche externe du complément utile → rapprochement avec l'entreprise → résultat sourcé et versionné → décision éventuelle → réutilisation.**

Avant un appel externe, le produit doit pouvoir dire ce qu'il sait déjà, ce qui manque et pourquoi une nouvelle recherche est utile. Il réutilise un acquis encore pertinent ; il vérifie une source devenue ancienne ou modifiée ; il conserve le delta et les versions antérieures. Deux textes identiques peuvent être dédupliqués sans que deux affirmations proches aient forcément le même sens.

Chaque connaissance porte au minimum une société et un périmètre d'accès, un sujet ou une entité, les références des preuves, les dates utiles, le statut de vérification, les conditions de validité et les dossiers ou décisions qui en dépendent. Les propositions restent distinctes des faits reçus. Une correction remplace l'usage courant de la connaissance concernée et garde son historique.

Pour une source réglementaire, conserver séparément publication, entrée en vigueur, date d'application, échéance éventuelle, juridiction, version et périmètre. Un texte trouvé ne prouve pas son applicabilité à cette entreprise. Le produit garde « à vérifier » tant que ce rapprochement n'est pas étayé. Ce cadrage décrit la provenance attendue ; aucune règle juridique particulière n'est interprétée ici.

## État vérifié dans le checkout

Lecture ciblée du code local le 22 octobre 2026. Checkout partagé actif, sans commit produit disponible ; cette observation ne fige pas les travaux concurrents.

| Capacité | Présence constatée | Limite importante |
| --- | --- | --- |
| Contexte d'entreprise | Snapshot, politique, engagements et société contrôlée côté serveur. | Données de démonstration synthétiques ; les raccords ERP/CRM réels ne sont pas prouvés ici. |
| Conservation des sources | Preuves de veille PostgreSQL avec identité, empreinte, première et dernière observation. | La déduplication source/empreinte ne constitue pas une recherche des antériorités par sujet ou sens. |
| Dossiers et révisions | Dossiers liés à une preuve et à un contexte métier versionnés. | La chaîne intégrée conserve sa réception et ses essais propres. |
| Mémoire de décisions | Écriture attribuée lors d'une décision ; lecture des 20 derniers souvenirs de la société ; filtrage par révision, politique et dossier. | Ce souvenir est essentiellement le choix et le titre de proposition, avec ses conditions. Ce n'est pas une base générale de recherche. Un contexte différent impose une revalidation. |
| Consultation avant recherche externe | Pas de chemin de consultation d'une base de connaissances retrouvé dans les interfaces et chemins lus. | La réutilisation des recherches passées reste à construire et à démontrer. |
| Traces d'agent | Manifest de contexte, intention et résultat modèle, appels d'outils corrélés, entrées/résultats et horaires ; écriture incrémentale dans le run via le worker. | Leur existence dans le code ne prouve pas un parcours modèle réel achevé. |
| Consommation et télémétrie | Tokens conservés quand fournis et valides ; durée déductible des horaires. | Pas de coût calculé, d'export OpenTelemetry ou de tableau de métriques identifié dans les chemins, dépendances et configuration lus. Usage absent signifie inconnu. |

Les sources conservées constituent un socle utile. L'écart central est de rendre les connaissances retrouvables, réutilisables et révisables avant une nouvelle recherche, puis de prouver ce comportement.

## Ce que les traces doivent nous permettre de comprendre

Pour une réponse donnée : quelle société, quelles versions, quelles connaissances réutilisées ou écartées, quelles nouvelles sources, quels outils, quels résultats, quelle proposition et quelle décision humaine. Les références d'exécution relient ces étapes. Les traces restent consultables selon leurs droits, sans raisonnement privé ni secret.

La mémoire métier et les traces gardent des usages distincts. Un résultat sourcé peut alimenter la mémoire après qualification. Un log, un succès technique ou une réponse du modèle ne devient pas automatiquement une vérité sur l'entreprise.

Mesures proposées : temps jusqu'à une proposition admissible, erreurs et résultats incertains, appels externes, tokens renseignés, coût lorsqu'il peut être établi, acquis réutilisés, recherches nouvelles justifiées et connaissances périmées refusées. Le nombre d'appels évités se mesure sur une référence explicite ; aucun gain de temps, de coût ou de qualité n'est établi par cette note.

## La prochaine tranche concrète

**Prouver une recherche réutilisée dans une nouvelle session, puis correctement révisée lorsqu'une source change.** Garder le persona et le chantier de données ERP/CRM déjà engagés ; cette tranche précise comment leurs données alimentent la mémoire et le harness.

1. L'intégrateur reçoit le contrat minimal de connaissance, ses liens aux preuves, dossiers et décisions, les lectures autorisées et la révision. Il conserve les contrats et migrations partagés.
2. Données et veille conservent et retrouvent les sources ; métier et agents consultent d'abord les acquis, justifient le complément et gardent le résultat qualifié. Les droits de société sont contrôlés côté serveur.
3. L'interface montre les acquis utilisés, leur source et leur fraîcheur, les vérifications nouvelles et les réserves, depuis le dossier existant.
4. L'intégrateur reçoit les deux revues indépendantes du code final et vérifie la chaîne intégrée, avec les conditions ci-dessous. Aucun lancement ou message aux autres chats n'est effectué par cette note.

| Essai à réaliser | Résultat attendu |
| --- | --- |
| Même question, connaissances toujours valides | Acquis retrouvés et cités ; aucun appel de recherche externe supplémentaire sans raison enregistrée. |
| Nouvelle session ou redémarrage | Même historique durable et mêmes droits, sans réinitialisation de la démonstration. |
| Source corrigée ou fraîcheur dépassée | Vérification ciblée, nouvelle version, historique préservé et propositions concernées réévaluées ou périmées. |
| Autre société, homonyme ou hypothèse non confirmée | Aucune fuite et aucun rapprochement métier promu en fait sans preuve. |
| Échec de recherche ou résultat fournisseur inconnu | Limite visible, état durable et reprise contrôlée sans réussite inventée. |

Ces essais de mémoire de recherche restent **NOT_RUN**. Ils doivent montrer la différence entre données stockées et connaissances effectivement réutilisées.

## Contrôles de cette note et sources

Tests exécutés sur le checkout actif : `node --import tsx ./node_modules/vitest/vitest.mjs run tests/agent/runner.test.ts tests/agent/usage.test.ts tests/agent/case.test.ts`. Résultat : **22 réussis sur 23**, dont les 13 tests runner/usage réussis. Le test du nouveau retard hypothétique attend une proposition et reçoit uncertain. Ce défaut est signalé pour réception par le propriétaire agent ; il n'est pas corrigé par cette note. Aucun test Aiven, appel modèle réel ou essai de la nouvelle boucle de mémoire n'est revendiqué ici.

Sources réellement consultées : START-HERE, HANDOFF, OWNERSHIP, CONTRACTS, STATUS, THREADS, package.json et PRODUCT-VISION ; `src/agent/context.ts` (recallMemories, buildModelContext), `src/agent/runner.ts` (createAgentRunner), `src/data/watch-repository.ts` (finish), `src/server/store.ts` (memories et écriture à la décision), `src/server/worker.ts` (écriture incrémentale des traces), `src/contracts/index.ts` ; tests runner, usage et dossier ; reçus produit ALIGNMENT-RECEIPT et RELAY-RECEIPT. Le mandat persona/ERP/CRM de l'autre chat a été relu pour éviter un second chantier.

Références propriétaires : [vision conservée](https://drive.google.com/file/d/1OufYkYFbwSC7Onj-iPCqhVTZYBMaUKm_/view), [suivi Accel existant](https://linear.app/briques/issue/ERW-133/preparer-accel-ai-innovate-paris-du-22-octobre). Les observations de cette note complètent le snapshot antérieur de PRODUCT-VISION ; elles ne le remplacent pas rétroactivement. Le reçu local MEMOIRE-RECHERCHE-TRACES-RECEIPT.json conserve les contrôles documentaires, empreintes et références d'archivage.

Statut : vision utilisateur consignée, proposition de tranche et lecture ciblée de l'existant. Aucun code applicatif, contrat, fixture, dépendance ou statut de livraison produit modifié. La mise en oeuvre et sa réception restent aux propriétaires existants.
