# Plan d'implémentation — chantiers restants

Ce document couvre les quatre sujets retenus parmi ceux laissés de côté lors du
lot précédent : diff mot à mot, OCR, actions groupées, interface bilingue.

L'historique des analyses et la comparaison de versions ont été écartés : ils
supposaient de conserver le texte des documents et les findings sur le poste,
et le choix a été fait de ne rien stocker pour l'instant. À ce jour l'app ne
persiste que des préférences (réglages Ollama, playbooks) — aucun contenu de
document.

Chaque chantier est décrit pour être pris isolément : objectif, conception,
fichiers touchés, étapes, pièges connus, tests attendus.

## Contraintes qui cadrent tous les choix

1. **Tout reste local.** Aucune donnée de document ne sort de la machine.
   Cela interdit les CDN à l'exécution (polices, WASM, modèles OCR) : tout
   fichier nécessaire est servi depuis `public/`.
2. **Rien de lourd dans le bundle initial.** Les dépendances volumineuses sont
   chargées à la demande via `import()`, comme `pdfjs-dist`, `mammoth` et
   `exceljs` aujourd'hui.
3. **Le texte affiché vient du document, jamais du modèle.** Le mécanisme des
   identifiants de phrase (`p2s5`) est la garantie du surlignage ; aucun
   chantier ne doit le contourner.
4. **Aucune persistance du contenu des documents.** Ni texte extrait, ni
   findings, ni aperçu : tout disparaît à la fermeture de l'onglet. Seules les
   préférences de l'utilisateur sont conservées. Un chantier qui aurait besoin
   de stocker du contenu doit être rediscuté, pas contourné.
5. **Terminé = `npm test` vert, `npm run build` vert, parcours vérifié au
   navigateur.** Les fonctions pures ajoutées viennent avec leurs cas dans
   `tests/unit.mjs`.

## Séquencement recommandé

| Lot | Contenu | Effort | Pourquoi cet ordre |
| --- | --- | --- | --- |
| 1 | Diff mot à mot | ~0,5 j | Gain immédiat, sans dépendance, sans décision d'architecture |
| 2 | Actions groupées | ~1,5 j | Rend le triage praticable sur les gros documents |
| 3 | Interface FR/EN | ~2,5 j | Passe transversale : la faire une fois les écrans stabilisés par les lots 1 et 2 |
| 4 | OCR | ~2,5 j | Autonome, coûteux en poids ; peut être livré à part ou abandonné |

Total : environ 7 jours. Le seul ordre qui compte est de placer l'i18n après les
lots qui ajoutent des écrans : traduire ce qui va changer est du travail fait
deux fois.

---

## 1. Diff mot à mot

### Objectif

Dans une carte de finding, faire ressortir les mots qui changent entre
`original` et `suggestion`, au lieu d'obliger à comparer deux phrases entières
à l'œil.

### Conception

Nouveau module pur `src/services/wordDiff.js` :

```js
// tokenise en gardant les espaces, applique une LCS, renvoie des segments
diffWords(original, suggestion)
// → [{ type: 'equal' | 'removed' | 'added', text }]
```

- Tokenisation par `text.match(/\S+|\s+/g)` : conserver les espaces évite de
  recomposer la phrase à la main au rendu.
- Plus longue sous-séquence commune classique en programmation dynamique.
  Les phrases font quelques dizaines de mots, le coût O(n·m) est sans objet.
- **Garde-fou** : au-delà de ~400 tokens de chaque côté, renvoyer un segment
  unique `equal` — au-delà, un diff mot à mot n'aide plus personne et la
  matrice devient inutilement grosse.

Nouveau composant `src/components/DiffText.jsx` :

- `side="original"` rend les segments `equal` + `removed`, les retraits en
  `<del>` ;
- `side="suggestion"` rend `equal` + `added`, les ajouts en `<ins>`.
- Utiliser `<del>` / `<ins>` plutôt que des `<span>` ne coûte rien et donne la
  sémantique exacte de ce qui est rendu.

### Fichiers

- créer `src/services/wordDiff.js`, `src/components/DiffText.jsx` ;
- modifier `src/components/FindingCard.jsx` : remplacer `{finding.original}` et
  `{finding.suggestion}` par `<DiffText …>` (les deux blocs *Original* et
  *Suggestion*) ;
- `src/index.css` : styles `del` / `ins` (fond ambré et vert, pas de
  soulignement par défaut).

### Pièges

- Le modèle reformule parfois toute la phrase : le diff devient alors
  intégralement rouge/vert. C'est acceptable, mais mérite un repli visuel : si
  moins de 30 % des tokens sont communs, afficher les deux phrases sans
  surlignage.
- Ne pas casser l'état barré des findings rejetés déjà géré par la carte.

### Tests

`tests/unit.mjs` : phrases identiques, insertion seule, suppression seule,
remplacement d'un mot, chaîne vide, phrase très longue (repli), et vérification
que la concaténation des segments `equal + removed` redonne exactement
l'original (invariant le plus utile).

**Effort : S — une demi-journée.**

---

## 2. OCR des PDF scannés

### Objectif

Aujourd'hui un PDF scanné échoue avec « No text could be extracted ».
Proposer une reconnaissance de texte locale plutôt qu'un cul-de-sac.

### Conception

`tesseract.js`, **entièrement auto-hébergé** : le paquet télécharge sinon son
cœur WASM et ses données de langue depuis un CDN, ce qui violerait la promesse
de traitement local et casserait l'usage hors ligne.

- copier dans `public/tesseract/` : `tesseract-core-simd.wasm`, le worker, et
  les `traineddata` **fra** et **eng** (~15 Mo au total, à documenter) ;
- initialiser avec `workerPath`, `corePath`, `langPath` pointant sur ces
  fichiers.

Chaîne de traitement, dans `src/services/ocr.js` :

1. rendre la page PDF dans un `<canvas>` via pdf.js à l'échelle 2
   (`page.render({ canvasContext, viewport })`) ;
2. passer le canvas à `Tesseract.recognize` ;
3. renvoyer le texte, qui repart dans `textToBlocks` comme n'importe quelle
   page.

**Déclenchement** : dans `documentParser.js`, si une page PDF produit moins de
~40 caractères, la marquer `needsOcr`. Si la majorité des pages est concernée,
ne pas lancer l'OCR d'office : afficher une proposition explicite
(« Ce PDF semble scanné — lancer la reconnaissance de texte ? environ 20 à 40 s
par page »), avec progression par page et annulation.

Les pages issues de l'OCR sont marquées : les findings correspondants portent un
badge *OCR* et leur confiance est minorée de 0,1, parce qu'une faute peut venir
de la reconnaissance et non de l'auteur. Le prompt doit aussi le dire : la règle
« ignore les artefacts d'extraction » du prompt système existe déjà, elle sera
renforcée pour ces pages.

### Fichiers

- créer `src/services/ocr.js`, `src/components/OcrPrompt.jsx` ;
- modifier `src/services/documentParser.js` (détection + intégration),
  `src/services/analysisService.js` (mention OCR dans le prompt, confiance),
  `src/components/FindingCard.jsx` (badge), `vite.config.js` si un en-tête est
  nécessaire pour les workers, `README.md` (poids et durées).

### Pièges

- Le worker Tesseract et le WASM ne doivent pas finir dans le bundle : ce sont
  des ressources statiques de `public/`, référencées par URL.
- Ne jamais OCRiser un PDF qui contient déjà du texte : coût inutile et qualité
  inférieure.
- La segmentation en phrases est plus fragile sur du texte OCRisé (césures,
  colonnes) ; prévoir un nettoyage des tirets de fin de ligne, déjà amorcé dans
  `parsePdf`.
- Sur une machine modeste, l'OCR peut bloquer l'interface : le worker doit
  tourner hors du fil principal, ce que `tesseract.js` fait, à condition de ne
  pas l'appeler en boucle serrée.

### Tests

- `tests/unit.mjs` : détection `needsOcr` sur des pages vides ou quasi vides,
  nettoyage du texte OCR.
- Navigateur : PDF image généré pour l'occasion, OCR lancé, texte extrait,
  findings marqués OCR ; annulation en cours de route.

**Effort : L — 2,5 jours, dont une bonne part sur l'auto-hébergement.**

---

## 3. Actions groupées

### Objectif

Traiter quarante findings un par un est le vrai coût d'une revue. Permettre de
sélectionner puis d'accepter ou rejeter en une fois, avec annulation.

### Conception

- État `selectedIds` (`Set`) dans `App.jsx`, coche à gauche de chaque carte,
  plus une coche « tout sélectionner » qui agit sur les findings **visibles**
  (donc filtrés), jamais sur la totalité invisible.
- Barre d'actions groupées affichée dès qu'une sélection existe :
  *N sélectionnés — Accepter · Rejeter · Rouvrir · Vider la sélection*.
- Raccourcis cohérents avec l'existant : `x` coche/décoche le finding courant,
  `Maj+A` et `Maj+R` appliquent à la sélection.
- Actions rapides depuis la barre de filtres : *Rejeter tout sous 70 % de
  confiance*, *Accepter tout ce type* — ce sont les deux gestes réellement
  répétés.
- **Annulation obligatoire** : conserver un instantané de `reviewStates` avant
  chaque action groupée et proposer *Annuler* pendant quelques secondes.
  Rejeter quarante findings par erreur sans retour arrière est inacceptable.

### Fichiers

- créer `src/components/BulkActionsBar.jsx` ;
- modifier `src/App.jsx` (sélection, application groupée, pile d'annulation),
  `src/components/FindingCard.jsx` (coche), `src/components/FindingsList.jsx`
  (raccourcis, sélection multiple), `src/components/FindingsFilter.jsx`
  (actions rapides).

### Pièges

- La sélection doit être purgée quand les findings changent (nouvelle analyse,
  relance ciblée) sous peine d'appliquer une action à des identifiants disparus.
- Ne pas confondre sélection et triage : un finding sélectionné n'est pas encore
  traité.

### Tests

- `tests/unit.mjs` : application groupée sur un `Map` d'états, annulation qui
  restaure exactement l'état antérieur.
- Navigateur : sélection de trois findings, rejet groupé, annulation, filtre
  actif qui limite bien le « tout sélectionner ».

**Effort : M — 1,5 jour.**

---

## 4. Interface FR/EN

### Objectif

L'interface est en anglais alors que l'usage est francophone. La langue de
l'**interface** est indépendante de celle du **document**, déjà gérée.

### Conception

Internationalisation légère, sans bibliothèque : le besoin est un dictionnaire
et une interpolation, pas la gestion des pluriels de quinze langues.

- `src/i18n/fr.js` et `src/i18n/en.js` : objets plats, clés en `point.séparé`
  (`findings.filter.allTypes`).
- `src/i18n/index.jsx` : contexte React, hook `useT()` renvoyant
  `t(clé, valeurs)` avec interpolation `{count}`, repli sur l'anglais si une clé
  manque, et un avertissement en console en développement.
- Langue par défaut : `navigator.language`, surchargeable dans la modale de
  réglages, persistée dans `localStorage` à côté des réglages Ollama.
- Dates et nombres : `Intl.DateTimeFormat` / `toLocaleString` avec la locale de
  l'interface, ce qui corrige au passage les formats en dur.

**Migration** : de l'ordre de 80 à 120 chaînes sur 15 fichiers — un comptage
automatique en repère 63, mais il manque le texte réparti sur plusieurs lignes.
Les quatre écrans les plus chargés sont `OllamaSettings`, `AnalysisConfig`,
`FindingsFilter` et `TopBar` (une dizaine de chaînes chacun), auxquels s'ajoutent
les 21 libellés de `data/constants.js`. Procéder écran par écran, en finissant
chaque écran avant de passer au suivant : une interface à moitié traduite est
pire que l'anglais intégral. Ordre suggéré : `TopBar`,
`FindingCard`, `FindingsFilter`, `FindingsList`, `CleanDocumentState`,
`AnalysisProgress`, puis les écrans de configuration.

**Export Excel** : les en-têtes et libellés de statut suivent aussi la langue de
l'interface. `excelExport.js` reçoit `t` en paramètre — à prévoir dès le début
pour ne pas retoucher la signature deux fois.

### Fichiers

- créer `src/i18n/index.jsx`, `src/i18n/fr.js`, `src/i18n/en.js` ;
- modifier tous les composants de `src/components/`, `src/App.jsx`,
  `src/services/excelExport.js`, `src/data/review.js` (libellés de statut),
  `src/data/constants.js` (libellés des skills et types de documents).

### Pièges

- `constants.js` mélange identifiants et libellés : garder les `id` intacts (ils
  circulent dans les prompts et les données stockées) et ne traduire que les
  `label`. Traduire un `id` casserait les prompts envoyés au modèle.
- Les prompts envoyés au modèle restent en anglais : c'est la langue sur
  laquelle ces modèles sont les plus fiables, et `languageInstruction` gère déjà
  la langue de sortie. Ne pas confondre les deux.
- Prévoir un contrôle simple listant les chaînes littérales restantes dans le
  JSX, pour mesurer l'avancement.

### Tests

- `tests/unit.mjs` : `t` avec clé manquante (repli anglais), interpolation,
  parité des clés entre `fr.js` et `en.js` (test le plus utile : il empêche les
  oublis).
- Navigateur : bascule FR/EN, persistance après rechargement, export Excel dont
  les en-têtes suivent la langue.

**Effort : M/L — 2,5 jours.**

---

## Écarté pour l'instant

Ces sujets ont été identifiés puis mis de côté. Ils sont listés ici pour qu'un
choix assumé ne se transforme pas en oubli.

- **Historique des analyses et comparaison de versions.** Supposait de conserver
  le texte des documents et les findings sur le poste ; incompatible avec la
  contrainte de non-persistance ci-dessus.
- **Piège de focus des boîtes de dialogue.** L'accessibilité n'est pas une
  priorité à ce stade. Pour mémoire, le défaut concret : la modale de réglages
  ouverte, `Tab` finit par sortir du dialogue et parcourir la page derrière, et
  le focus n'est pas rendu au bouton d'origine à la fermeture. Correctif estimé
  à une demi-journée (`useFocusTrap`, `aria-labelledby`, fond inerte) le jour où
  le sujet remonte.

## Points à trancher avant de commencer

1. **OCR** : embarquer les 15 Mo de données de langue dans le dépôt, ou fournir
   un script de récupération à l'installation ? Un dépôt propre plaide pour le
   script, l'usage hors ligne immédiat pour l'embarquement.
2. **i18n** : traduit-on aussi le contenu produit par le modèle dans l'export,
   ou seulement l'ossature de l'interface ? Les explications sont déjà dans la
   langue du document, ce qui peut donner un classeur bilingue.
