# Démarrer le produit Accel

Ce dossier est le checkout partagé de Physical Impact, construit pour le hackathon Accel du 22 octobre 2026. Le kit v5 reste une référence historique locale sous .preparation/accel-20261022/. Du code et des parcours vérifiés existent désormais ; les candidats en cours gardent leurs preuves séparées.

Commencer par [README.md](README.md), puis le [guide du dépôt pour les agents](docs/REPOSITORY-GUIDE.md), aussi disponible en [HTML hors ligne](docs/REPOSITORY-GUIDE.html). Le guide explique le besoin de Paul, les données et leur provenance, les choix techniques, les versions vérifiées et la reprise par propriétaire. Il distingue la preview connectée du risque, le portefeuille industriel et le mode Demo du navigateur. Lire ensuite les sources propriétaires ci-dessous pour l'état courant.

0. Lire [la vision et l'alignement du produit](docs/PRODUCT-VISION.md) pour le cadrage reçu risques et opportunités, les écarts observés et leur statut. Ce document ne prouve pas leur intégration.
1. Lire docs/HANDOFF.md pour les décisions et limites.
2. Lire docs/OWNERSHIP.md et prendre le mandat de son rôle dans docs/tasks/.
3. Recevoir les contrats communs de docs/CONTRACTS.md avant les imports entre modules.
4. Suivre docs/BUILD-PLAN.md. L'intégrateur complète docs/STATUS.md avec les preuves réelles.
5. Lire les références détaillées seulement pour sa branche de travail.

Références courtes :
- Contexte métier : .preparation/accel-20261022/kit-accel-20261022/preparation-backend/CONTEXT.md
- Contrat agentique : .preparation/accel-20261022/kit-accel-20261022/preparation-agentique-20261022/CONTRAT-AGENTIQUE.md
- Déploiement : .preparation/accel-20261022/passage-aiven-20261022/DEMARRAGE-AIVEN.md
- Interface courante : mandat Physical Impact dans docs/PRODUCT-VISION.md. La direction A de design/A-bureau-decisions.png conserve son rôle historique pour les premiers parcours.
- Données initiales : fixtures/company/dataset.json et fixtures/company/company-policy.json
- Évaluation réservée à l'opérateur : operator/
- Provenance du transfert : docs/IMPORT-RECEIPT.json

Government APIs and timber-sector sources: [sector data research](proposals/product/research-data-20261022/sector-sources/SECTOR-DATA-STRATEGY.md), with [offline HTML](proposals/product/research-data-20261022/sector-sources/SECTOR-DATA-STRATEGY.html), source-access evidence and explicit product integration limits. This supplements PRODUCT-VISION and the existing data research.

Accès, dépôt et crédits : [docs/ACCES-CREDITS.md](docs/ACCES-CREDITS.md). Ce suivi distingue annonces, essais reçus et activations encore attendues. Le chat existant dédié aux accès possède ces opérations.

## Reprise publique autonome
Lire [RECOVERY.md](docs/RECOVERY.md), [DECISIONS.md](docs/DECISIONS.md) et [CONTRIBUTING.md](CONTRIBUTING.md). Les anciens chemins `.local` et chats de build sont des traces historiques, pas des prérequis. Le checkpoint public courant est [PUBLICATION.md](docs/PUBLICATION.md).
