# Plan — revue cloud, sélection des contrôles, latence maîtrisée

## Décisions actées

| Sujet | Décision |
| --- | --- |
| Jugement rédactionnel | **GPT‑5** (`gpt-5`), 1,25 $ / 10 $ par million de jetons |
| Orthographe et grammaire | **GPT‑5 mini** (`gpt-5-mini`), 0,25 $ / 2 $ par million |
| Terminologie, chiffres, exigences à motif | **JavaScript**, dans le navigateur |
| Découpage | **Un lot = une page**, pour maximiser le parallélisme |
| Cadre applicatif | **Next.js**, déployé sur Vercel |
| Framework d'orchestration | **Aucun** — SDK OpenAI officiel, ni LangChain ni LangGraph |
| Infrastructure hors Vercel | **Aucune** |

### Pourquoi LanguageTool a été écarté

Il figurait dans la version précédente de ce plan, pour de bonnes raisons :
gratuit à la requête, déterministe, excellent en français. Le chiffrage l'a
disqualifié.

| Poste, sur une revue de 10 pages | Coût |
| --- | --- |
| Orthographe + grammaire en LanguageTool | 0 $ |
| Les mêmes en GPT‑5 mini | 0,01 $ |
| Le reste de la revue (GPT‑5) | ~0,13 $ |

LanguageTool économise **un centime sur une revue qui en coûte quatorze**. Le
conteneur qui l'héberge coûte 5 à 10 $ par mois : il faut ~800 documents
mensuels rien que pour le rembourser. Pour ce gain, on ajoutait un second
hébergeur, une sonde de santé et un service à redémarrer — sur un projet qui n'a
par ailleurs aucune infrastructure à exploiter.

Ce que la bascule coûte, dit honnêtement : une revue « orthographe seule » passe
de 2 s et gratuite à ~4 s et 0,01 $, et le résultat n'est plus strictement
reproductible d'une exécution à l'autre — un moteur de règles rend toujours la
même chose, un modèle non. Sur un outil qu'on relance après correction, cela se
remarque. Cela ne vaut pas un service à posséder.

La porte n'est pas fermée : le registre de contrôles porte un champ `engine`, et
rebrancher un moteur déterministe plus tard ne demande qu'un contrôle de plus.
Ce sera justifié le jour où le volume, et non l'élégance, le réclamera.

## L'unité de travail n'est pas l'agent, c'est le contrôle

Un « agent » suppose qu'on délègue une décision à un modèle. Tous les critères
n'en sont pas là :

| Critère | Ce qu'il faut vraiment | Moteur |
| --- | --- | --- |
| Terminologie, acronymes | Le terme est‑il celui du glossaire ? l'acronyme est‑il défini avant usage ? | **JS, navigateur** |
| Chiffres, unités, devises, dates | Deux occurrences du même montant divergent‑elles ? | **JS, navigateur** |
| Exigences client « mécaniques » (« aucun nom de client hors page de garde : "Acme Corp" ») | Une recherche de motif | **JS, navigateur** |
| Orthographe, grammaire, accords | Une relecture attentive, sans finesse rédactionnelle | **GPT‑5 mini** |
| Clarté, ton | Jugement rédactionnel | **GPT‑5** |
| Cohérence inter‑pages | Contradictions, dérive terminologique | **GPT‑5**, portée document |
| Exigences client sémantiques (« les conclusions avant leur justification ») | Jugement | **GPT‑5** |

Les trois premiers restent **gratuits et instantanés**, sans infrastructure :
c'est du JavaScript sur le fil principal — mesuré à 30 ms pour un document de
200 pages, un worker n'apporterait qu'une étape de bundling et un protocole de
messages. Le banc du lot F garde ce chiffre honnête ; le jour où ce ne sont plus
des millisecondes, le worker est à un fichier de distance. La distinction qui compte n'est donc pas
« local contre cloud », c'est **quel contrôle mérite quel moteur** — et sur les
sept, trois n'ont besoin d'aucun modèle et un seul n'a pas besoin du gros.

L'abstraction retenue est le **contrôle** (`check`), déclaratif :

```ts
{
  id: 'mechanical',
  label: 'Orthographe et grammaire',
  skills: ['spelling', 'grammar'],
  engine: 'llm',
  model: 'fast',               // → gpt-5-mini
  scope: 'batch',              // 1 page
  prompt: 'mechanical.md',
}

{
  id: 'clarity-tone',
  skills: ['clarity', 'tone'],
  engine: 'llm',
  model: 'main',               // → gpt-5
  scope: 'batch',
  prompt: 'clarity-tone.md',
  effort: 'minimal',
}
```

Le sélecteur de skills de l'interface pilote directement le plan : un contrôle
non sélectionné ne produit aucune tâche, et une tâche est la seule chose qui
coûte du temps ou de l'argent. Un skill décoché, c'est une ligne en moins dans
l'estimation affichée avant lancement.

## Les leviers de latence

| # | Levier | Effet |
| --- | --- | --- |
| **L1** | Moteurs déterministes en JS pour ce qui n'a pas besoin d'un modèle | 3 contrôles sur 7 à coût et latence nuls |
| **L2** | Modèle étagé : le petit palier pour la passe mécanique, le gros pour le jugement | 5× moins cher et plus rapide sur un tiers des appels |
| **L3** | **Fan‑out total** : toutes les tâches partent ensemble, dans la limite de concurrence | 3 vagues → 2, ≈ ×1,5 |
| **L4** | **Lots d'une page** | Le temps est dominé par la sortie : moitié moins de sortie par appel, deux fois plus d'appels en parallèle |
| **L5** | La passe « cohérence » ne dépend d'aucun lot : elle part à t = 0 | Retire ~15 s de la fin |
| **L6** | Critique pipeliné, lot par lot, au lieu d'une phase finale | Retire ~10 s |
| **L7** | `reasoning: { effort: 'minimal' }` et `max_output_tokens` borné | **Le poste de dérive** : les jetons de raisonnement sont facturés en sortie et payés en latence. À effort élevé, la sortie peut tripler |
| **L8** | Instructions identiques d'un appel à l'autre → cache (0,1× sur l'entrée) | Gain réel mais modeste : le cache ne s'amorce qu'au‑delà d'une longueur de prompt, et ceux‑ci sont courts |
| **L9** | Streaming vers l'interface | Latence *perçue* : premier finding à ~1 s |

L4 inverse une intuition héritée d'Ollama : là‑bas, de gros lots réduisaient le
nombre d'appels sérialisés. Avec une API parallèle, c'est l'inverse — plus de
lots, plus petits, tous en même temps.

Sur L7, une précision qui compte : ces contrôles signalent des défauts au niveau
de la phrase. Réfléchir plus longtemps n'y achète rien de mesurable, et peut
tripler la facture comme la durée. `minimal` est donc le défaut, et le lot F est
là pour dire si un contrôle mérite mieux.

## Durée et coût, par sélection

Hypothèses : 10 pages ≈ 4 000 mots ≈ 5 500 jetons, lots d'une page → 10 lots,
raisonnement `minimal`, concurrence 12.

| Sélection | Appels | **Durée** | **Coût** |
| --- | --- | --- | --- |
| Terminologie, chiffres, motifs | 0 | **< 0,5 s** | 0 $ |
| Orthographe + grammaire | 10 (mini) | **≈ 4 s** | ≈ 0,01 $ |
| Clarté + ton | 10 | **≈ 9 s** | ≈ 0,06 $ |
| Déterministes + mécanique + clarté + ton + cohérence | 21 | **≈ 15 s** | ≈ 0,09 $ |
| Tout, exigences sémantiques comprises | 31 | **≈ 19 s** | ≈ 0,14 $ |
| Tout + critique `uncertain` | ~34 | **≈ 21 s** | ≈ 0,16 $ |

Ces chiffres sortent de `lib/checks/estimate.js`, pas d'un tableur : ce sont
ceux que l'interface affiche avant de lancer, et ils sont verrouillés par des
tests. Une variation de tarif qui ferait diverger le plan et le code casse la
suite.

Une remarque honnête : **le gros palier est le poste de coût**, à ~90 % de la
facture. À 0,14 $ le document, mille revues par mois coûtent 140 $ — chiffre à
mettre en face du prix de vente avant d'ouvrir le service. Passer la passe
mécanique sur `gpt-5-nano` diviserait encore son coût par cinq ; le lot F dira
si la qualité suit.

Premier résultat affiché : ~0,5 s (déterministe), ~4 s (premier lot du petit
palier).

Limites de débit : une revue complète pousse une trentaine de requêtes. Le
fan‑out est **borné par un réglage** (défaut 12) avec back‑off sur 429 — une
revue ne doit jamais échouer parce qu'on a poussé trop fort, seulement finir un
peu plus tard.

## Pourquoi ni LangChain ni LangGraph

- **LangGraph** — le graphe s'est aplati : un planificateur, un fan‑out, une
  fusion. Plus de boucle, plus de décision d'arrêt, plus d'état partagé complexe.
  Un pool borné et un générateur asynchrone font le travail en ~150 lignes
  testables — c'est ce que le lot 0 a livré. Il redeviendra pertinent si le
  triage humain entre dans le graphe.
- **LangChain** — son intérêt était d'abstraire le fournisseur. Or ce qu'on veut
  du modèle est précisément ce qu'une couche d'abstraction rabote :
  `reasoning.effort`, les sorties structurées strictes, la ventilation exacte de
  l'`usage` par palier. Le SDK officiel `openai` est plus direct et mieux typé —
  et c'est lui, pas une abstraction, qui a servi de source pour les noms de
  champs plutôt qu'une mémoire de leur forme.

Sorties structurées : le schéma des findings est déclaré une fois et contraint
côté API, ce qui supprime `extractJson` et `scanCompleteObjects` — la
récupération de JSON tronqué n'a plus lieu d'être.

## Architecture

```
app/
  page.tsx                    l'app actuelle ('use client')
  login/page.tsx              mot de passe partagé
  api/analyze/route.js        POST → SSE : plan, exécution, findings au fil de l'eau
proxy.js                      cookie de session sur tout sauf /login
lib/
  sse.js                      protocole d'événements                        ✔ lot 0
  checks/
    pool.js                   fan-out borné                                 ✔ lot 0
    planner.js                skills sélectionnés + document → tâches       ✔ lot 0
    registry.js               les sept contrôles, leur moteur, leur skill    ✔ lot A
    pricing.js                paliers de modèle, prix, débit                 ✔ lot A
    estimate.js               durée et coût d'une sélection, avant lancement ✔ lot A
    runner.js                 exécution d'une tâche, back-off, usage         ✔ lot C
    prompt.js                 chargement et rendu des gabarits .md           ✔ lot C
    schema.js                 la forme unique des findings                   ✔ lot C
    sentences.js              document → phrases, partagé client/serveur     ✔ lot C
    merge.js                  dédoublonnage phrase × critère
    local/
      terminology.js  figures.js  patterns.js  index.js         ✔ lot B
    llm/
      _system.md  mechanical.md  clarity-tone.md                     ✔ lot C
      consistency.md  requirements.md  critic.md
src/
  services/reviewStream.js    consommation du flux côté navigateur           ✔ lot A
  services/reviewService.js   déterministes puis modèles, une seule porte    ✔ lot C
  components/ReviewEstimate.jsx  l'estimation, sous le sélecteur de skills   ✔ lot A
  components/ReviewCost.jsx      le reçu, en fin de revue                    ✔ lot C
```

Répartition d'exécution :

- **Navigateur** — extraction (`documentParser.js`, `mammoth`, `pdfjs`, OCR) et
  les contrôles déterministes en JS.
- **Serveur** — les appels aux modèles, et eux seuls.

L'interface marque chaque contrôle par son moteur : instantané et gratuit, ou
modèle externe payant, avec son estimation. C'est une information que
l'utilisateur doit avoir **avant** de lancer, pas après.

## Impacts sur l'existant

**Inchangé** : extraction et découpage, ancres et surlignage, visualiseurs, OCR,
triage, score, structure de l'export Excel.

**Modifié** :

- `analysisService.js` — se scinde : prompts en `.md`, boucle d'appels en
  `runner.js`, la normalisation reste et gagne les champs de provenance
  (`check`, `model`, `verified`).
- `ollamaClient.js` / `deepseekClient.js` / `services/providers.js` — remplacés
  par le SDK OpenAI côté serveur. Ollama disparaît du chemin nominal.
- Interface — moteur et estimation par contrôle avant lancement ; progression par
  contrôle, les déterministes passant au vert immédiatement.
- Export Excel — deux colonnes : contrôle d'origine, statut de vérification.

## Risques

| Risque | Traitement |
| --- | --- |
| Coût du gros palier sur du volume | Effort `minimal`, modèle étagé, instructions cachables, budget affiché par revue et plafond configurable ; le tableau de coût est **mesuré** au lot F, pas supposé |
| Jetons de raisonnement qui gonflent la sortie | `reasoning: { effort: 'minimal' }` et `max_output_tokens` borné ; le reçu de fin de revue les expose |
| Le petit palier moins fin sur la grammaire | Le lot F compare les paliers sur le même corpus annoté ; si l'écart est réel, le réglage bascule en une variable d'environnement |
| Non‑reproductibilité d'une revue à l'autre | Température basse, prompts figés et versionnés ; le triage déjà en place absorbe les variations résiduelles |
| Limites de débit sur le fan‑out | Concurrence plafonnée et réglable, back‑off sur 429, dégradation en durée et non en échec |
| Confidentialité | Le texte transite par notre backend puis OpenAI ; confirmation explicite au premier envoi, aucun stockage serveur, contrôles déterministes marqués comme ne sortant pas du navigateur |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **0** ✔ | Migration Next.js, `/api/analyze` en SSE, authentification, fan‑out borné, planificateur | *fait* |
| **A** ✔ | Registre des sept contrôles, planificateur branché sur le sélecteur de skills, estimation durée + coût affichée avant lancement, client du flux SSE. Le branchement de la progression dans `App.jsx` part au lot C : il n'y a rien à streamer tant qu'aucun contrôle n'a de moteur | *fait* |
| **B** ✔ | Contrôles déterministes en JS : acronyme employé avant sa définition, variantes d'un terme du glossaire, deux écritures d'un même montant, formats de date mélangés, terme interdit trouvé. **Gratuits et instantanés** (30 ms sur 200 pages) | *fait* |
| **C** ✔ | Contrôles modèles en `.md` (mécanique sur le petit palier, clarté + ton, cohérence, exigences sur le gros), SDK OpenAI, sorties structurées strictes, raisonnement `minimal`, instructions cachables, `usage` par palier, reçu affiché en fin de revue, `App.jsx` branché sur le flux | *fait* |
| **D** | Critique pipeliné, provenance, colonnes Excel | ~1,5 j |
| **E** | Packs métier : glossaires, motifs, contrôles propres au métier | ~1 j |
| **F** | Banc d'évaluation : latence, précision, rappel et coût **mesurés** par sélection ; comparaison des paliers (`nano` / `mini` / `gpt-5`) sur la passe mécanique ; garde‑fous de budget | ~1,5 j |

Reste ≈ **4 jours**.

### Ce que « cohérence » veut dire, précisément

C'est un *skill*, pas un contrôle : le mot dans lequel l'utilisateur pense. Le
cocher en active trois, sur deux moteurs différents.

| Contrôle | Question | Moteur | Pourquoi |
| --- | --- | --- | --- |
| `terminology` | « CVSS » employé page 3, défini page 7 | navigateur | Un **fait**, pas un jugement : un index des premières occurrences |
| `figures` | « 4,2 M€ » page 2, « 4.2M€ » page 8 | navigateur | Extraire, normaliser, comparer. Aucune interprétation |
| `consistency` | Page 2 dit la migration terminée, page 9 la dit en cours | **GPT‑5** | Aucune règle ne repère ça : il faut comprendre les deux phrases |

Le navigateur ne fait pas « la cohérence ». Il fait la partie où la contradiction
est visible dans les caractères ; le modèle garde celle où elle est dans le sens.

Sur les chiffres, une limite assumée : savoir que deux nombres *devraient* être
égaux n'est pas toujours mécanique. Le contrôle local ne signale que les cas
francs — écritures divergentes d'un même montant, libellés identiques portant
des valeurs différentes. Les cas douteux ne sont pas inventés en local, ils
partent au modèle. Un contrôle déterministe qui bluffe est pire qu'un contrôle
absent.

Même principe sur les exigences client : une exigence **entre guillemets** est
une recherche (« pas de "Acme Corp" » — gratuite, instantanée), une exigence
sans guillemets demande un jugement et part au modèle. La convention est
explicite plutôt que devinée, et elle coûte à l'utilisateur une paire de
guillemets pour rendre gratuit un contrôle payant.

## Vérification

- `npm test` — contrôles déterministes (jeux de phrases fautives attendues),
  planificateur (sélection → nombre exact de tâches), fusion, politiques,
  transport et fan‑out (déjà couverts).
- Fausse API OpenAI : nombre d'appels par sélection, concurrence effective,
  respect du back‑off sur 429, comportement quand un contrôle échoue.
- Mesure de latence **et de coût réel** (`usage.input_tokens`,
  `cache_read_input_tokens`, `output_tokens`) sur un `.docx` de 10 pages, pour
  chaque ligne du tableau. Ce sont ces mesures qui font foi ; le tableau sera
  corrigé, pas défendu.
- Parcours navigateur : « orthographe + grammaire » seule, puis revue complète
  avec critique et export Excel.
