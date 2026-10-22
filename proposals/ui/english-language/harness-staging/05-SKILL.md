---
name: demo-package
description: "Préparer ou contrôler une démo et sa présentation : scénario, README anglais, captures/GIF, site, preuves et dossier de submission. Traiter une retouche ciblée sans relancer toute la préparation hackathon."
metadata:
  status: CANDIDATE
  version: 0.1.1
---

# Rendre le résultat compréhensible et démontrable

Préparer le package demandé depuis une version identifiable du projet, avec un récit clair, des media fidèles et des preuves bornées. On peut l'utiliser seul pour un README, un GIF ou une répétition, ou après hackathon-bootstrap. Son résultat ne confère aucune permission de publication, d'installation ou de submission.

## Delivery language

Read and apply [English-only hackathon deliverables](../hackathon-bootstrap/references/language.md) before authoring, revising or checking the package. The rule covers the UI shown, generated copy, README, documentation, site, media, pitch and submission.

## Choisir le périmètre et la bonne version

Lire la demande, les instructions locales, le README/dossier de démo existant et les décisions pertinentes. Recevoir projet, branche/SHA ou version locale, scénario, audience, langue/format, environnement et droits. Conserver les IDs et propriétaires existants après un renommage ou déplacement ; rechercher le même objet avant d'en créer un autre.

Pour un simple correctif, traiter le delta demandé. Pour un package complet, relier les livrables exigés par le concours aux preuves disponibles. Récupérer le brief ou profil existant ; si une règle déterminante manque, suspendre le geste dépendant, sans inventer un règlement ou recommencer le projet. Si la préparation elle-même manque, proposer hackathon-bootstrap si disponible.

Choisir les sources de la version cible avant de rédiger « ce qui fonctionne ». Comparer code, tests/reçus, media et déploiement ; un checkout modifié n'est pas le HEAD distant, et un HTTP 200 n'est pas un workflow réussi. Une preuve ancienne peut illustrer l'historique si sa date, version et portée sont visibles.

## Produire seulement les éléments utiles

Lire [dépôt et media](references/repo-and-media.md) pour un README, des captures, un GIF/film ou un dossier de submission. Lire [les exemples Clarity](references/clarity-patterns.md) lorsqu'un exemple de présentation ou de provenance aide à choisir. Réutiliser la structure et la méthode ; adapter la DA, le vocabulaire, la stack et le scénario au projet actuel.

Pour un package complet :

1. **Récit.** Dire le problème, l'utilisateur et le changement observable. Dérouler un scénario central : entrée, gestes, résultat, source/preuve et limites. Adapter sa durée au concours, sans faire du format Clarity une règle universelle.
2. **Répétition.** Relier le scénario à la version et à l'environnement. Préparer un reset et un secours déclaré. Vérifier le parcours bout en bout si mandat et accès le permettent ; sinon conserver NOT_RUN et l'étape bloquée. Une répétition préparée ne devient pas un test d'intégration réel.
3. **Présentation.** Rédiger le package selon le contrat de langue anglais ci-dessus, avec toute exception explicitement reçue. Relier le site, les media, installation, architecture, vérifications et limites qui servent ce projet. Garder les décisions de design reçues ; une nouvelle DA relève de la méthode UX adoptée, pas d'un reskin automatique.
4. **Réception.** Vérifier les liens/fichiers, la version et l'accès du destinataire. Indiquer séparément package local préparé, version publiée, déploiement, répétition et submission. Un lien dans un formulaire ou un draft n'est pas un reçu organisateur.

## Qualifier chaque preuve

Pour les claims décisifs, garder résultat, source/version, date, environnement et type de donnée. Séparer code lu, tests exécutés, CI historique du SHA, capture observée, simulation, appel distant et usage matériel. Un GIF d'une fixture prouve son rendu, pas une API sponsor ; une réponse live isolée ne prouve pas toute la chaîne. Les intégrations externes n'ont ce nom qu'avec la preuve correspondante ; sinon les décrire comme lien, proposition ou non vérifié.

Si un contrôle échoue, corriger le livrable dans le mandat, puis vérifier le delta. Une correction de code déclenche les revues obligatoires du projet. Si l'obstacle exige une décision produit ou un accès, isoler le blocage et terminer les éléments indépendants. Conserver un FAIL au lieu de remplacer son reçu par un succès inventé.

## Publication, transmission et learning

Une préparation ne lance aucun commit/push, site public, achat de domaine, message, soumission ou installation. Réutiliser une autorisation explicite si elle couvre l'action exacte, et vérifier les conditions du projet avant l'écriture. Sur une demande « avant chaque push », préparer le contrôle et le readback de la version qui serait publiée ; ne pas installer de hook automatique. Un dépôt privé n'est accessible au jury que si cet accès a été réellement reçu.

La réception est suffisante quand tous les éléments demandés sont présents et contrôlés, ou identifiés comme indisponibles avec leur conséquence et la prochaine action. Dire alors précisément ce qui est prêt et ce qui reste non vérifié. Ne pas qualifier de prêt à soumettre un package dont un critère obligatoire manque.

Conserver le reçu dans le dispositif du projet. Une leçon utile peut devenir un LearningCandidate générique via les méthodes existantes, après déduplication et évaluation ; les captures privées et données métier restent chez leur propriétaire. Ce skill ne promeut pas une méthode au Meta Brain et ne met aucun projet à niveau automatiquement.
