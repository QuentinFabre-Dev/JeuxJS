# Critères de QA — ZombieLand (MBUFFAproject)

Ce fichier est injecté tel quel dans le prompt envoyé au modèle local.
Modifiez-le pour adapter la QA à vos exigences de livrable.

## 1. Correction fonctionnelle

- Variables ou fonctions utilisées sans être déclarées ni définies (le projet
  charge tous les scripts dans le même scope global via `jeux.html`).
- Variables implicitement globales (affectation sans `var`/`let`/`const`).
- Erreurs de logique : conditions inversées, boucles hors bornes, comparaisons
  `==` là où `===` est attendu, opérations sur `undefined`/`null`.
- Collisions, calculs d'angles et de distances : formules cohérentes.
- Gestion des états du jeu : vagues, rechargement, mort du joueur, bonus.

## 2. Robustesse et fuites

- `setInterval` / `setTimeout` jamais nettoyés.
- Écouteurs d'événements ajoutés en boucle.
- Tableaux d'entités (`bullets`, `zombies`, `bonus`) qui grossissent sans purge.
- Suppression d'éléments pendant l'itération sur le même tableau.
- Ressources externes (images, sons) sans gestion d'erreur de chargement.

## 3. Qualité et lisibilité

- Nommage explicite, cohérence français/anglais.
- Code mort, code commenté laissé en place, valeurs magiques non nommées.
- Duplication qui devrait être factorisée.
- Découpage des fichiers et responsabilité unique par module.

## 4. HTML / CSS / accessibilité

- Structure HTML valide, balises fermées, attributs obligatoires.
- `alt` sur les images, contraste, navigation au clavier.
- Ressources chargées en `http://` sur une page servie en `https://`
  (contenu mixte bloqué par le navigateur).
- Dépendances à des URL externes qui peuvent disparaître.
- Ordre de chargement des scripts et `window.onload` unique.

## 5. Livrable et documentation

- README : installation, lancement, règles, répartition des rôles.
- Cohérence entre ce qui est annoncé dans le README et ce qui est implémenté.
- Fichiers inutiles ou absents.

## Barème de gravité

- `critique` : empêche le jeu de fonctionner ou provoque une erreur JS bloquante.
- `majeur` : bug visible, comportement faux, fuite mémoire, régression probable.
- `mineur` : qualité, lisibilité, maintenance.
- `info` : remarque ou suggestion d'amélioration.
