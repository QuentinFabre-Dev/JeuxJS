# Plan d'implémentation — chantiers restants

Ce document couvre l'axe prioritaire — corriger directement dans le document —
puis les sujets retenus lors du lot précédent : diff mot à mot, OCR, actions
groupées, interface bilingue.

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
| Lot | Contenu | Effort | État |
| --- | --- | --- | --- |
| 1 | Ancres de position dans l'extraction | ~1,5 j | **fait** |
| 2 | Visualiseur fidèle + surlignage in situ (PDF, Word, PowerPoint) | ~2 j | **fait** |
| 3 | Support PPTX de bout en bout | ~1 j | **fait** |
| 4 | OCR des PDF scannés | ~2,5 j | à faire — prochain |
| 5 | Diff mot à mot | ~0,5 j | à faire |
| 6 | Actions groupées | ~1,5 j | à faire |
| 7 | Interface FR/EN | ~2,5 j | à faire, en dernier : elle traduit les écrans des lots précédents |

La correction en place et l'export d'un document corrigé ont été retirés : le
visualiseur sert à **voir** l'erreur à sa place, la correction se fait dans
l'éditeur d'origine.

---

## Lots 1 à 3 — Corriger directement dans le document (axe prioritaire)

### Objectif

Voir l'erreur **là où elle est dans le fichier**, et corriger vite. Aujourd'hui
la revue se fait dans une liste posée à côté d'une reconstruction textuelle du
document ; l'utilisateur doit faire lui-même le lien avec son fichier d'origine,
puis rouvrir Word et retrouver la phrase à la main.

Cible : la page du document telle qu'elle est, l'erreur surlignée dedans, la
correction applicable sur place, et un fichier corrigé récupérable à la fin.

### Ce qui bloque aujourd'hui

Deux limites, toutes deux dans `src/services/documentParser.js` :

1. **L'aperçu n'est pas le document.** `DocumentPreview` affiche des phrases
   reconstruites : ni mise en page, ni police, ni images, ni tableaux. Cliquer
   une phrase surligne un bloc de texte, pas un endroit du fichier.
2. **Les positions sont jetées à l'extraction.** pdf.js fournit pour chaque
   fragment de texte ses coordonnées (`transform`, `width`, `height`) : on ne
   garde que `item.str`. Côté DOCX, `mammoth.extractRawText` renvoie du texte
   plat, sans lien avec les paragraphes et les runs du fichier. Sans ces
   repères, il est impossible de désigner un emplacement dans le fichier
   d'origine, et encore moins d'y écrire.

L'ordre des lots découle de là : les ancres d'abord, l'affichage ensuite, la
correction en dernier.

### Lot 1 — Ancres de position

Étendre le modèle de document pour que chaque phrase porte son ancrage dans la
source :

```js
{
  kind: 'p',
  text: 'The sales and marketing teams needs to collaborate more closely.',
  anchor: {
    kind: 'pdf',   // rectangles à surligner sur la page rendue
    page: 3,
    rects: [{ x, y, width, height }],   // repère PDF, converti au rendu
  },
}
```

```js
  anchor: {
    kind: 'docx',  // chemin dans l'OOXML, pour écrire au bon endroit
    paragraph: 42,           // index du <w:p>
    runs: [{ index: 3, start: 12, end: 58 }],  // <w:r> traversés et décalages
  }
```

- **PDF** : conserver les `items` de `getTextContent()` avec leurs
  transformations, et associer chaque phrase aux fragments qui la composent.
  Une phrase couvre souvent plusieurs fragments et parfois plusieurs lignes,
  d'où un tableau de rectangles et non un seul.
- **DOCX** : abandonner `extractRawText` au profit d'une lecture directe de
  `word/document.xml` (l'archive est déjà décompressable, voir lot 3), en
  gardant l'indice de paragraphe et les décalages dans les runs. Word découpe
  fréquemment une phrase en plusieurs `<w:r>` — c'est le cas normal, pas
  l'exception.
- **TXT / MD** : décalage de caractères dans le fichier, trivial.

`normaliseFinding` recopie l'ancre de la phrase dans le finding, à côté de
`sentenceId`. Le mécanisme d'identifiants reste inchangé : l'ancre s'ajoute, ne
le remplace pas.

**Effort : ~1,5 j.**

### Lot 2 — Rendu fidèle et surlignage in situ

- **PDF** : rendre chaque page dans un `<canvas>` avec pdf.js
  (`page.render({ canvasContext, viewport })`), puis superposer une couche
  absolue de rectangles cliquables construits depuis les ancres. Les
  coordonnées PDF partent du bas de la page : la conversion passe par
  `viewport.convertToViewportRectangle`, à ne pas réimplémenter à la main.
  Rendu à la demande page par page, avec un cache : rendre cinquante pages
  d'avance est inutile et coûteux.
- **DOCX** : `mammoth.convertToHtml` au lieu de `extractRawText`, puis
  surlignage par enrobage des plages de texte correspondantes. On perd la
  pagination exacte de Word (elle n'existe pas dans le fichier, c'est un calcul
  de rendu), mais on gagne titres, listes, gras et tableaux.
- **TXT / MD** : l'aperçu actuel convient.

L'interaction reste celle d'aujourd'hui, dans les deux sens : cliquer un
finding fait défiler jusqu'à la zone dans le document, cliquer la zone
sélectionne le finding.

**Effort : ~2 j.**

### Lot 3 — Correction en place et export du document corrigé

L'écart entre formats est ici irréductible, et il faut l'assumer plutôt que de
promettre partout la même chose.

- **DOCX — aller-retour complet.** L'archive est ouverte avec JSZip,
  `word/document.xml` est modifié aux emplacements donnés par les ancres, puis
  l'archive est refermée et téléchargée. La mise en forme, les styles, les
  images et les en-têtes sont préservés puisque tout le reste du fichier est
  recopié tel quel. C'est le seul format qui permet de rendre à l'utilisateur
  *son* document corrigé.
  Cas à traiter : phrase répartie sur plusieurs runs (écrire dans le premier,
  vider les suivants, en conservant leurs propriétés `<w:rPr>`), et suivi des
  modifications éventuellement présent dans le fichier.
- **PDF — pas d'édition en place.** Réécrire du texte dans un PDF en conservant
  la mise en page n'est pas réalisable de façon fiable : la police peut ne pas
  être intégrée, la justification serait à recalculer. Deux sorties honnêtes :
  un **PDF annoté** (bulles de commentaire posées aux coordonnées des ancres,
  via `pdf-lib`), qui se relit dans n'importe quel lecteur, et le classeur Excel
  déjà en place. Le dire clairement dans l'interface plutôt que de laisser
  espérer une correction automatique.
- **TXT / MD** : réécriture directe, immédiate.

Côté interface : cliquer une zone surlignée ouvre un champ pré-rempli avec la
suggestion, modifiable avant application — la correction du modèle est un point
de départ, pas un verdict. Les corrections appliquées s'accumulent dans une
copie de travail en mémoire, et un bouton *Télécharger le document corrigé*
produit le fichier. Rien n'est écrit sur le fichier d'origine.

**Effort : ~3 j.**

### Pièges

- **Ne pas casser le mécanisme d'identifiants de phrase.** Le texte affiché doit
  continuer de venir du document. Les ancres localisent, elles ne remplacent pas
  la source.
- **La copie de travail reste en mémoire** : aucune persistance, conformément à
  la contrainte 4. Fermer l'onglet perd les corrections non téléchargées — le
  dire dans l'interface avant que l'utilisateur ne le découvre.
- **Le poids du rendu PDF** : pdf.js est déjà chargé, mais rendre les pages en
  canvas consomme de la mémoire. Limiter le cache à quelques pages autour de la
  position courante.
- **PPTX** (non traité aujourd'hui) suivrait naturellement ce modèle : une diapo
  = une page, texte dans `ppt/slides/slideN.xml`, et un aller-retour d'écriture
  du même type que DOCX.

### Tests

- `tests/unit.mjs` : construction des ancres sur une phrase répartie sur
  plusieurs fragments PDF et sur plusieurs runs DOCX ; réécriture d'un
  `document.xml` minimal, en vérifiant que seuls les runs visés changent et que
  leurs propriétés sont conservées ; conversion de coordonnées PDF.
- Navigateur : DOCX corrigé téléchargé puis relu, comparaison du texte et
  vérification que la mise en forme survit ; PDF annoté relu avec pdf.js ;
  clic sur une zone du document qui sélectionne le bon finding.

### Arbitrage recommandé

Commencer par **DOCX**. C'est le format qui permet le vrai aller-retour, donc
celui où l'objectif « corriger vite de notre côté » est réellement atteint ; le
PDF, lui, plafonnera toujours à « localiser et annoter ». Si les livrables à
réviser sont majoritairement des PDF, l'ordre s'inverse mais l'ambition doit
être revue en conséquence.

---

## Lot 4 — Diff mot à mot

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

## Lot 5 — Actions groupées

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

## Lot 6 — Interface FR/EN

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

## Lot 7 — OCR des PDF scannés

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

## Écarté pour l'instant

Ces sujets ont été identifiés puis mis de côté. Ils sont listés ici pour qu'un
choix assumé ne se transforme pas en oubli.

- **Historique des analyses et comparaison de versions.** Supposait de conserver
  le texte des documents et les findings sur le poste ; incompatible avec la
  contrainte de non-persistance ci-dessus.
- **Revue d'accessibilité au sens large** (contrastes, annonces, navigation
  complète au clavier hors liste de findings). Pas une priorité à ce stade.
  Le piège de focus des dialogues, lui, a finalement été corrigé : voir
  `src/hooks/useFocusTrap.js`.

## Points à trancher avant de commencer

1. **PPTX** : les decks PowerPoint ne sont pas traités aujourd'hui. Une diapo
   entrerait naturellement comme une page dans le modèle, et l'écriture suivrait
   le même chemin que DOCX (archive ZIP, texte dans `ppt/slides/slideN.xml`).
   À intégrer à l'axe prioritaire ou à laisser de côté selon la nature réelle
   des livrables à réviser.
2. **OCR** : embarquer les 15 Mo de données de langue dans le dépôt, ou fournir
   un script de récupération à l'installation ? Un dépôt propre plaide pour le
   script, l'usage hors ligne immédiat pour l'embarquement.
3. **i18n** : traduit-on aussi le contenu produit par le modèle dans l'export,
   ou seulement l'ossature de l'interface ? Les explications sont déjà dans la
   langue du document, ce qui peut donner un classeur bilingue.
