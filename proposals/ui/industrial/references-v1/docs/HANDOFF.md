# Passation de construction, 22 octobre 2026

## Delta de vision reçu dans le chat de présentation

Le cadrage reçu couvre les risques, opportunités et effets mixtes pour les entreprises dépendantes de stocks et de leurs filières. Le BTP et le bois sont le premier terrain ; l'expansion à d'autres industries reste à démontrer. Voir [la vision et la lecture ciblée du système](PRODUCT-VISION.md) : le socle courant est compatible, mais la qualification des signaux publics et le parcours d'opportunité ne sont pas encore raccordés. Les critères A1 à A8 y restent à recevoir par l'intégrateur. La direction A, les fixtures, contrats et mandats existants sont conservés. Ce delta documentaire ne prouve aucune prise en charge par les constructeurs déjà actifs.

## Mandat et état reçu
Erwan demande de reprendre le kit v5, préparer un dossier produit propre et lancer les conversations de build. Il a confirmé le brief inchangé au kickoff ; accès Aiven à configurer. Il demande de poursuivre sans refaire le brainstorming. Le réemploi est demandé par Erwan, sans confirmation organisateur attestée. La direction A et le socle métier sont reçus. Aucun produit, dépôt distant, appel modèle produit ou déploiement n'est attesté au départ.

Coordinateur de la préparation : chat 01a15f24-8d9c-7fd2-8a00-1b039732248f, titre courant Hackathon Accel. Suivi documentaire existant : ERW-133. Un autre chat de reprise, 01a16283-2006-7bd3-b07f-2ceaf2535784, a aussi commencé la récupération ; ne pas y lancer un chantier concurrent. Le fichier docs/THREADS.json recevra les identités des constructeurs effectivement créés. L'intégrateur possède la version produit.

## Produit et utilisateur
Paul dirige un négoce de matériaux. Il veut savoir quelles commandes sont menacées quand une information change, et quelles options respectent ses engagements. Une société synthétique CO-DEMO, trois dépôts, ISO100 et deux chantiers A/B constituent le scénario initial. Une variante ajoute C. L'intérêt du père d'Erwan est rapporté ; aucun pilote signé ou client payant n'est établi.

Parcours : contexte d'entreprise et question/veille, observation sourcée, exposition, calcul d'options, proposition versionnée, décision humaine, effet de simulateur éventuel avec relecture, mémoire attribuée et reprise. L'interface A est préférée ; le nom de marque et toute la copy des images ne sont pas reçus.

## Choix de construction
React/Vite, Fastify et TypeScript ; une application Node sert HTTP et la boucle de veille. PostgreSQL est la source de vérité pour révisions, occurrences, runs, propositions et mémoire. Une boucle modèle/outils avec un seul fournisseur est suffisante. La disponibilité d'une clé, le modèle et la version du SDK doivent être réellement vérifiés. Les exemples AI SDK v6 ne sont pas interchangeables avec la documentation v7.

Commencer par une source publique directe, puis une découverte web seulement si utile et accessible. Tavily est candidat ; Apify est repli conditionnel, pas une chaîne déjà validée. Les extractions essayées ont échoué. Aucun crédit annoncé n'est réputé activé.

## Scénario et limites
A : huit palettes ISO100, Lille, besoin le 23 octobre. B : huit palettes ISO100, Centre, besoin le 5 novembre ; stock entièrement réservé. Sud a ISO120, substitution non autorisée. L'entrant PO-2 non confirmé ne couvre pas B. Le transfert Centre vers Lille prend un jour, coût 120 euros. La politique impose deux jours de marge avant le besoin de B.

Les événements futurs sont publiés un à un par l'opérateur après disponibilité du produit. Les heures 09:00 à 09:15 de la fixture sont logiques, jamais un rattrapage selon l'heure réelle. S0/S1/S2/S3 et le nouveau chantier C sont des branches séparées selon les instructions opérateur. Ne pas exécuter un transfert puis rejouer une branche sur le même état.

Les avis BOAMP publics sont des opportunités à qualifier. Aucun lien commercial vérifié ne relie une usine réelle à SUP-1/2/3 ou à PO-1/2. Un titre de presse ne confirme pas le retard de notre fournisseur fictif. Pas de prévision ou self-learning revendiqué sans mesure. Les preuves montrent les outils et résultats, sans raisonnement privé.

## Réemploi réellement éprouvé
BSF commité 25dbfed : 164 tests unitaires et 75 PostgreSQL réussis localement. Son patch local de transfert a 25 échecs PostgreSQL, donc ne pas le reprendre comme prêt. ErwanOS main observé e1206d8149725f20970bb89a24fd21421d2da7e2 : 238 tests ciblés réussis. Ces résultats prouvent les versions sources, pas l'adaptation au produit.
Reprendre les principes de transactions, déduplication, contexte attribué, autorisation sur version, baux/fencing et readback. Ne pas copier toute la composition Slack/Render, le modèle désactivé, les restrictions de connexion BSF ou l'état SQLite local comme base du produit. Voir le bilan complet dans .preparation/accel-20261022/verification-backend-20261022/.

## Accès et autorisations
Le chat dédié aux accès détient le compte Aiven cible communiqué par Erwan. Aucun secret ni adresse de connexion n’est nécessaire dans ce document produit. Accès, organisation, crédit participant, rôles, GitHub App et clé modèle à configurer. Crédits gagnants et crédits participants sont distincts.
Le mandat présent couvre préparation du dossier, création des chats et construction/tests locaux. Git distant, commits/push, dépenses, comptes, services et déploiement nécessitent leur accord explicite applicable. Une dépendance d'accès bloque sa seule branche ; avancer le code et les contrôles indépendants.

## Fin de la reprise
Un agent neuf sait où écrire, quelles interfaces consommer, quelles données publier au modèle, comment tester et quelles actions restent en attente. La réception du dossier ne signifie pas que l'application fonctionne. L'intégrateur reçoit le code exact, les deux revues indépendantes et les contrôles avant de déclarer une tranche livrée.
