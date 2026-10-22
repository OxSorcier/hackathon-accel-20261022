# Oracles de démonstration, hors contexte de l'agent produit

Jeu de préparation synthétique du 21 octobre. Ces résultats attendus sont destinés au contrôle humain et au futur évaluateur. Ils ne sont pas des décisions déjà calculées par le produit. Ne pas indexer evaluation ou scenarios dans le contexte accessible aux agents métier.

## États à publier séquentiellement

R0, avant événements : PO-1 couvre les huit palettes d'A le 23 octobre ; le Centre a huit palettes réservées à B et zéro libre. PO-2 est non confirmé. Les huit palettes ISO120 du Sud ne sont pas substituables à ISO100.

Après EV-0 seulement : un signal illustratif ne confirme aucun retard de PO-1. Demander la vérification de l'exposition et de la commande ; ne pas déclarer un retard client certain.

Après EV-1 : PO-1 arrive le 27, donc A manque de huit palettes à sa date de besoin. Réaffecter le stock de B n'est pas admissible tant que sa couverture de remplacement reste non confirmée. Achat urgent possible sous validité du devis et décision de direction, pas d'achat automatique.

Après EV-2 : PO-2 est confirmé pour le 29. Le plan de réaffectation conditionnel peut couvrir A le 23 avec le transport d'un jour et B avant le 5 novembre, marge de deux jours comprise. Coût transport fictif 120 euros. La simulation n'a pas encore modifié les réservations. Seul un plan complet conserve les liens vers les deux commandes et la nouvelle couverture de B.

Après EV-3, avant approbation du plan : PO-2 passe au 7 novembre. Le plan précédent devient périmé et la réaffectation échoue au respect de B. L'achat urgent porte sur huit fois 155 euros plus 180 euros de transport, total brut 1 420 euros ; il requiert la direction selon les plafonds fictifs. Ce montant n'est ni une économie de BFR ni un gain mesuré. Le changement ne doit pas être masqué par une comparaison de texte insensible à l'ordre des dates.

## Contre-épreuves

- Retirer la confirmation de PO-2 : aucune couverture confirmée inventée.
- Intervertir SKU-ISO100 et SKU-ISO120 : substitution refusée sans règle reçue.
- Deux observations d'EV-1 : un événement métier, observations conservées, pas de double effet.
- Lire seulement A : le validateur doit encore refuser toute option qui casse B ; le modèle ne possède pas l'autorité de contourner cette contrainte.
- Tenter d'approuver le plan d'avant EV-3 : rejet de version et recalcul, pas de mutation.
- Claire choisit l'achat urgent à 1 420 euros : demande à la direction ; les lignes employees ne valent pas authentification.
- Source externe en erreur avec HTTP 200 : état incomplet, pas « source vérifiée ».
- Suspendre la veille puis déclencher un ancien réveil : absence de nouveau run tant que la révision suspendue fait autorité.
- Reprendre un job fournisseur connu : lire son résultat, ne pas créer un nouveau job par défaut.
- Réponse perdue après lancement fournisseur : résultat incertain jusqu'à réconciliation, pas de nouveau POST automatique.
- Une décision enregistrée puis relue : la mémoire cite l'auteur et le contexte ; aucune amélioration de précision n'est déduite de ce seul cas.

Réalisation, appels modèles et tests de ces contre-épreuves sur le produit : NOT_RUN.
