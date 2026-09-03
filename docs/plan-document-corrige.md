# Plan — régénérer le document corrigé

## L'histoire

Je relis les findings, j'accepte ceux qui sont justes, je rejette les autres.
Je clique sur un bouton et je récupère **mon document**, dans son format, avec
sa mise en page, ses styles, ses images et ses en-têtes — et uniquement les
corrections que j'ai acceptées appliquées au texte.

Formats visés : **TXT/MD, DOCX, PPTX**. **Pas de PDF** pour l'instant.

Le triage existe déjà (`accepted` / `rejected` / `pending`) : cette histoire
n'ajoute pas d'étape à l'utilisateur, elle donne une sortie à celle qui existe.

## Le problème central : le fichier d'origine est perdu

Aujourd'hui, `parseDocument` extrait le texte puis **jette le fichier**. Pour un
DOCX, ce qu'il garde (`source.html`) est la sortie de `mammoth`, une conversion
à sens unique et volontairement appauvrie : elle sert le visualiseur, elle ne
permet pas de reconstruire un `.docx`.

Reconstruire un document depuis le texte extrait est donc **exclu d'emblée** :
on rendrait un fichier qui a le bon contenu et plus rien de la mise en forme —
exactement ce que l'histoire interdit.

La seule voie qui tienne : **garder les octets d'origine et les modifier sur
place**. Un DOCX et un PPTX sont des archives ZIP de XML ; `jszip` est déjà une
dépendance, et `pptxParser.js` ouvre déjà ces archives. Le socle est là.

## Comment corriger sans casser la mise en forme

C'est le point qui décide de la faisabilité, et je l'ai prototypé avant
d'écrire ce plan plutôt qu'après.

**Le piège.** Dans un vrai document Word, une phrase n'est pas dans un nœud de
texte : elle est éclatée sur plusieurs `<w:t>`, parce que Word coupe à chaque
changement de formatage, à chaque passage du correcteur, à chaque marque de
révision. Une phrase de dix mots peut occuper cinq runs. Un simple
« chercher-remplacer » sur le XML ne trouve donc rien.

**La mécanique.** On construit une carte des offsets — où chaque run commence
dans le texte du paragraphe —, on localise la phrase dans le texte reconstitué,
puis on réécrit les runs qu'elle couvre.

**Le raffinement qui change tout.** Réécrire la phrase entière dans le premier
run fonctionne, mais vide les suivants : sur mon échantillon, **3 runs vidés sur
4**, et tout le formatage interne de la phrase disparaît. En rognant d'abord le
préfixe et le suffixe communs entre la phrase d'origine et sa correction, on ne
touche que ce qui change réellement :

| Approche | Runs touchés | Gras interne | Italique interne |
| --- | --- | --- | --- |
| Réécrire la phrase entière | 4 sur 5 | perdu | perdu |
| **Rogner au segment modifié** | **1 sur 5** | **conservé** | **conservé** |

Sur `« Nous recomandons… » → « Nous recommandons… »`, le segment réellement
modifié est un seul caractère. C'est cette version qui part en implémentation.

**La limite qui reste**, et qu'il faut annoncer : quand la correction porte sur
un passage qui change lui-même de formatage en son milieu, le formatage du
premier run touché s'applique à tout le segment réécrit. Une réécriture de
clarté qui traverse un mot en gras perdra ce gras. Rare sur de l'orthographe,
possible sur du style — le rapport de sortie doit le signaler plutôt que de le
laisser découvrir.

## Retrouver la phrase : la vraie difficulté

Le texte que l'analyse a vu ne sort pas de la même porte que le texte du XML.
`mammoth` normalise les espaces, fusionne des blocs, insère des sauts. La
concaténation brute des `<w:t>` ne lui est **pas** identique — donc un
`indexOf` de la phrase échouera sur des documents parfaitement ordinaires.

Deux options, et je retiens la seconde :

1. Ré-extraire le texte d'analyse directement depuis l'OOXML. Cohérent, mais
   cela change la source des findings et rejoue tout le risque de régression
   sur l'ancrage et le visualiseur.
2. **Une recherche tolérante**, sur une forme normalisée, avec une carte
   d'offsets qui ramène la position trouvée vers le texte réel. C'est exactement
   ce que fait déjà `normaliseWithMap` dans `textBlocks.js` pour l'OCR et le
   PDF. On réutilise plutôt que d'inventer.

Une phrase introuvable **n'est jamais ignorée en silence**. Elle sort dans le
rapport de fin, nommée : *« 11 corrections appliquées, 1 non appliquée — la
phrase p3s2 n'a pas été retrouvée dans le fichier »*. Un document présenté comme
corrigé qui ne l'est qu'aux trois quarts est pire qu'un document non corrigé.

## Par format

| Format | Où vit le texte | Difficulté | Piège propre au format |
| --- | --- | --- | --- |
| **TXT / MD** | le fichier lui-même | faible | aucun : remplacement direct sur la chaîne d'origine |
| **DOCX** | `word/document.xml`, nœuds `<w:t>` | moyenne | runs éclatés ; en-têtes, pieds de page et notes vivent dans d'autres parties du ZIP |
| **PPTX** | `ppt/slides/slideN.xml`, nœuds `<a:t>` | moyenne | **PowerPoint ne reflue pas** : une phrase rallongée déborde de sa zone |
| **PDF** | hors périmètre | — | le texte y est positionné caractère par caractère ; corriger un mot déplace tout ce qui suit sur la ligne |

Le débordement PowerPoint mérite un traitement explicite : quand une correction
rallonge sensiblement le texte d'une forme, l'interface le dit avant le
téléchargement. Le corriger vraiment demanderait de recalculer la mise en page,
ce qui n'est pas cette histoire.

## Deux findings sur la même phrase

Cas réel : l'orthographe et la clarté tombent sur la même phrase, et les deux
sont acceptées. La deuxième correction ne retrouvera plus son texte d'origine,
puisque la première l'a modifié.

Les corrections sont donc **groupées par phrase** et appliquées en chaîne,
chacune cherchant dans l'état courant du texte. Si l'une ne s'y retrouve plus,
elle part au rapport de non-application — jamais appliquée à l'aveugle.

## Où ça tourne

**Dans le navigateur, entièrement.** `jszip` est déjà là, le fichier d'origine
est déjà en mémoire, et rien n'oblige à le renvoyer au serveur pour y remplacer
des chaînes. Le document ne quitte pas la machine pour cette fonctionnalité —
ce qui est à la fois plus rapide, moins cher, et un argument à afficher.

## Le suivi des modifications Word — la version qui impressionne

Option à trancher, et je la recommande pour un livrable client.

Plutôt que de réécrire le texte, on peut poser de vraies **marques de révision**
Word (`<w:ins>` / `<w:del>`, auteur « Ryder », horodatées). Le relecteur ouvre le
document et voit chaque correction en révision, qu'il accepte ou rejette dans
Word, avec ses propres outils.

- **Pour** : rien n'est modifié à l'insu de personne, l'associé garde le dernier
  mot dans l'outil qu'il utilise déjà, et le document porte la trace de ce qui a
  été touché.
- **Contre** : plus délicat à écrire — il faut scinder les runs et poser deux
  éléments là où le mode simple en modifie un. Et cela ne vaut que pour Word :
  PowerPoint n'a pas d'équivalent.

Je propose de livrer le mode simple d'abord et d'ajouter les révisions comme
**une case à cocher** au moment du téléchargement, une fois le socle éprouvé.

## Architecture

```
src/services/rewrite/
  index.js            corrections acceptées + fichier d'origine → nouveau fichier
  locate.js           recherche tolérante d'une phrase dans un texte (offsets)
  span.js             rognage préfixe/suffixe : le segment réellement modifié
  text.js             TXT / MD
  docx.js             word/document.xml et les parties annexes
  pptx.js             ppt/slides/*.xml
  report.js           appliquées, non appliquées, débordements possibles
src/components/
  RewriteButton.jsx   « Télécharger le document corrigé (12 corrections) »
  RewriteReport.jsx   ce qui a été appliqué, et ce qui ne l'a pas été
```

Un changement en amont conditionne tout le reste : `parseDocument` doit
**conserver les octets d'origine** (`source.bytes`) pour DOCX, PPTX et texte.
C'est une ligne, mais c'est la ligne sans laquelle rien de ce qui précède
n'existe.

## Risques

| Risque | Traitement |
| --- | --- |
| La phrase n'est pas retrouvée dans le XML | Recherche tolérante sur forme normalisée ; ce qui échoue est nommé dans le rapport, jamais tu |
| Formatage perdu au milieu d'une réécriture | Rognage au segment modifié (mesuré : 1 run sur 5 au lieu de 4) ; le rapport signale les corrections qui traversent un changement de style |
| Texte débordant d'une forme PowerPoint | Détection sur l'allongement, avertissement avant téléchargement |
| Deux corrections sur une même phrase | Groupement par phrase, application en chaîne sur l'état courant |
| En-têtes, pieds de page, notes, zones de texte Word | Le lot DOCX les traite comme des parties supplémentaires du ZIP ; le banc vérifie qu'une correction en en-tête est appliquée |
| Document corrompu en sortie | Aucune écriture hors des nœuds de texte ; le banc rouvre chaque fichier produit avec le parseur du projet, et un fichier illisible fait échouer le lot |
| L'utilisateur croit le document relu | Le bouton dit le nombre de corrections appliquées, le rapport dit ce qui ne l'a pas été |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **1** ✔ | Octets d'origine conservés (DOCX, PPTX) ; `span.js`, `merge.js`, `locate.js`, `text.js` avec leurs tests ; TXT/MD de bout en bout ; bouton, compteur, rapport | *fait* |
| **2** ✔ | **DOCX** : carte d'offsets des runs, application, parties annexes (en-têtes, pieds de page, notes), chaînage multi-corrections, aller-retour testé | *fait* |
| **3** | **PPTX** : nœuds `<a:t>`, détection de débordement, avertissement | ~1,5 j |
| **4** | Banc de non-régression : corpus de vrais documents, chaque fichier produit rouvert et comparé | ~1 j |
| **5** | *(optionnel)* Suivi des modifications Word en case à cocher | ~2 j |

**≈ 6,5 jours** pour les quatre premiers, 8,5 avec les révisions Word.

## Vérification

- `npm test` — fonctions pures : rognage au segment modifié, recherche
  tolérante (espaces multiples, insécables, apostrophes typographiques),
  chaînage de deux corrections sur une phrase, carte d'offsets sur runs
  éclatés.
- Corpus de documents produits par de vrais outils — Word, Google Docs export,
  LibreOffice — parce que chacun découpe ses runs différemment et que c'est
  précisément là que ce genre de code casse.
- **Aller-retour** : chaque fichier corrigé est rouvert par `parseDocument`, et
  l'on vérifie que les phrases corrigées le sont, que les autres sont
  identiques au caractère près, et qu'aucun bloc n'a disparu.
- Parcours navigateur : analyser l'exemple, accepter trois findings, en rejeter
  deux, télécharger, rouvrir dans Word et constater que **seules** les trois
  acceptées sont là.

## Ce que le lot 1 a appris

**Le resserrement ne sert pas qu'à Word.** En texte brut aussi, remplacer la
phrase entière détruit ce qu'elle traverse : un titre réparti sur deux lignes
est revenu sur une seule, la correction juste et la présentation perdue. Le
même `changedSpan` qui protège le gras d'un run protège le saut de ligne d'un
fichier texte. `locate` trouve la phrase, `changedSpan` la resserre, et seuls
les caractères qui changent sont réécrits.

**Tous les findings n'ont pas de correction à proposer.** « Cet acronyme est
défini deux sections plus loin », « ces deux montants divergent » : ces
findings désignent quelque chose à regarder, pas un mot à remplacer — le bon
correctif est une décision que seul l'auteur peut prendre.

`normaliseFinding` les jetait, parce qu'il refusait toute suggestion identique
à la phrase d'origine. **Trois des cinq findings du document d'exemple
n'arrivaient donc jamais à l'écran**, et personne ne l'avait vu : les contrôles
étaient testés isolément, jamais à travers le normaliseur. Ils existent
désormais comme findings *consultatifs* — affichés, triables, sans bloc de
remplacement, et sans effet sur le document régénéré. Les accepter vaut
« noté », pas « réécris ».

## Ce que le lot 2 a appris

**La mécanique tient sur un vrai fichier.** L'aller-retour est désormais un
test du dépôt : on fabrique un `.docx` reproduisant ce qui casse en vrai — une
phrase éclatée sur plusieurs runs, du gras au milieu du mot corrigé, un style
de titre, du texte en en-tête —, on corrige, on rouvre avec `mammoth` et on
vérifie quatorze choses. Gras, italique, style de titre, feuille de styles et
parties de l'archive survivent tous ; la phrase que personne n'a corrigée est
identique au caractère près.

**Un bug d'un caractère, et ce qu'il enseigne.** La deuxième correction
ressortait en `« Les testsonta été »`. Appliquer une correction déplace tous
les offsets qui la suivent : je reconstruisais la carte des segments après
chaque application, mais pas le texte auquel ces offsets se rapportent. Un
caractère de décalage suffit à écrire une absurdité. La carte **et** le texte
sont maintenant relus ensemble, et un test le verrouille en interdisant
explicitement `testsonta`.

**Une correction ne peut pas traverser une fin de paragraphe.** Une marque de
paragraphe est de la structure, pas des caractères : aucune modification d'un
nœud de texte ne l'exprime. Ces corrections sont écartées et **nommées dans le
rapport** plutôt qu'approximées.

## Décisions à acter

1. **Suivi des modifications Word** : livrable dès le lot 2 en option, ou
   après le socle ? Je propose après.
2. **Que faire des findings `pending`** — ni acceptés ni rejetés au moment du
   clic ? Je propose de ne pas les appliquer et de le dire dans le bouton, la
   règle étant que le silence ne vaut pas accord sur un livrable client.
3. ~~**Nom du fichier produit**~~ — acté : `rapport_RyderReviewed.docx`.
