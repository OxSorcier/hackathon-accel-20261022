# Raccord du bureau de décisions

22 octobre 2026. Constructeur UI : 01a162bd-facf-7b63-861b-9bbf7f402938. Modèle réalisateur attesté par le contexte de session : gpt-6.1-sol.

Le code autonome reste sous src/ui/. Aucun fichier commun, dépendance ou contrat partagé n'est modifié. La direction A est reçue dans design/A-bureau-decisions.png. Les données et libellés de la capture ne constituent pas des résultats produit.

## Entrée prévue

L'export par défaut de `src/ui/App.tsx` monte le bureau connecté avec l'adaptateur HTTP C1. L'export nommé `App` reçoit un `UiApi` typé pour les essais. Le port UI est une projection de lecture, pas une source de vérité métier. Les commandes HTTP ne fournissent jamais acteur, rôle ou société. La décision transmet les révisions observées et la clé d'opération ; l'option est déjà attachée à la proposition côté serveur. Les reçus sont contrôlés sur leur objet, société, opération et révision.

L'intégrateur possède package.json, le lockfile, Vite et index.html. Les dépendances reçues sont React, React DOM, Zod et TypeScript, aux versions explicites du package de l'intégrateur. Aucune dépendance n'a été ajoutée par le constructeur UI. Le CSS est importé par App ; l'entrée `src/main.ts` est déjà compatible.

## Vérification

Les tests UI peuvent utiliser un adaptateur synthétique explicitement étiqueté sous tests/ui/. Ce mode ne prouve ni stockage, appel modèle, collecte ni Aiven. Le raccord intégré et les essais métier restent reçus par l'intégrateur. Le reçu final READY.json fixe les empreintes et les contrôles réellement exécutés.

L'interface de test est `/tests/ui/preview.html` sur le serveur Vite de développement uniquement. `responsive.html?width=390` crée un vrai viewport CSS dans une iframe de test, sans émulation tactile. Ces fichiers ne sont pas importés par l'entrée produit et ne font pas partie du build client de production.

## Limites du raccord C1

La mémoire attribuée n'a pas de route GET dans C1. Son panneau reste vide plutôt que de simuler une lecture. Le navigateur ne déclenche ni reset ni commande opérateur. La révision reçue invalide l'approbation ; le recalcul passe par une nouvelle question.

Le serveur a ajouté `/api/watch-capabilities` pendant le gel du module UI. Le formulaire courant exige une URL publique explicite et affiche les refus serveur ; il ne charge pas encore ces suggestions. Pour la réception intégrée, utiliser les sujets et la source autorisés de ce contrat. Un sujet libre ou une URL arbitraire peut être refusé. L'UI expose 15, 30 et 60 minutes, sous-ensemble des cadences serveur reçues. L'idempotence de création de veille relève du serveur, C1 ne transmet pas de clé de création ; aucun retry HTTP automatique n'est effectué par l'UI.

Le test en lecture seule de l'application assemblée à `http://127.0.0.1:3000` a affiché CO-DEMO/R0 et deux veilles persistées, dont les sources BOAMP marquées partielles avec leurs dates. Aucune session réelle n'a été ouverte par ce constructeur ; aucun appel modèle, décision réelle ou test Aiven n'est revendiqué. Les erreurs techniques de collecte sont conservées telles que reçues dans les notes de source.

Le reçu est livré dans ce dossier pour réception par l'intégrateur, sans message inter-chats. Après READY.json, les fichiers du périmètre sont gelés ; toute correction exige un nouveau reçu et la revalidation de son empreinte.

## Méthodes lues

erwan-product-ui pour le flow déjà reçu, ux-ui-visual-first pour la reprise de la direction A, erwan-ticket-delivery pour la portée des preuves, erwan-internal-review et ses deux mandats de reviewers pour les revues froides. Le guide Aside REPL a été lu. Les essais commencent par Aside.
