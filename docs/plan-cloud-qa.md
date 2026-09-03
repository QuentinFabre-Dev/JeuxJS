# Plan — revue cloud, sélection des contrôles, latence maîtrisée

## Décisions actées

| Sujet | Décision |
| --- | --- |
| Jugement rédactionnel | **Claude Opus 5** (`claude-opus-5`), 5 $ / 25 $ par million de jetons |
| Orthographe et grammaire | **Claude Haiku 4.5** (`claude-haiku-4-5`), 1 $ / 5 $ par million |
| Terminologie, chiffres, exigences à motif | **JavaScript**, dans un worker du navigateur |
| Découpage | **Un lot = une page**, pour maximiser le parallélisme |
| Cadre applicatif | **Next.js**, déployé sur Vercel |
| Framework d'orchestration | **Aucun** — SDK Anthropic officiel, ni LangChain ni LangGraph |
| Infrastructure hors Vercel | **Aucune** |

### Pourquoi LanguageTool a été écarté

Il figurait dans la version précédente de ce plan, pour de bonnes raisons :
gratuit à la requête, déterministe, excellent en français. Le chiffrage l'a
disqualifié.

| Poste, sur une revue de 10 pages | Coût |
| --- | --- |
| Orthographe + grammaire en LanguageTool | 0 $ |
| Les mêmes en Haiku 4.5 | 0,03 $ |
| Le reste de la revue (Opus 5) | ~0,42 $ |

LanguageTool économise **trois centimes sur une revue qui en coûte quarante‑cinq**.
Le conteneur qui l'héberge coûte 5 à 10 $ par mois : il faut ~250 documents
mensuels rien que pour le rembourser, et à mille documents il fait gagner 30 $
sur une facture Opus de 450 $. Pour ce gain, on ajoutait un second hébergeur,
une sonde de santé et un service à redémarrer — sur un projet qui n'a par
ailleurs aucune infrastructure à exploiter.

Ce que la bascule coûte, dit honnêtement : une revue « orthographe seule » passe
de 2 s et gratuite à ~6 s et 0,03 $, et le résultat n'est plus strictement
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
| Exigences client « mécaniques » (« aucun nom de client hors page de garde ») | Une recherche de motif | **JS, navigateur** |
| Orthographe, grammaire, accords | Une relecture attentive, sans finesse rédactionnelle | **Haiku 4.5** |
| Clarté, ton | Jugement rédactionnel | **Opus 5** |
| Cohérence inter‑pages | Contradictions, dérive terminologique | **Opus 5**, portée document |
| Exigences client sémantiques (« les conclusions avant leur justification ») | Jugement | **Opus 5** |

Les trois premiers restent **gratuits et instantanés**, sans infrastructure :
c'est du JavaScript dans un Web Worker. La distinction qui compte n'est donc pas
« local contre cloud », c'est **quel contrôle mérite quel moteur** — et sur les
sept, trois n'ont besoin d'aucun modèle et un seul n'a pas besoin d'Opus.

L'abstraction retenue est le **contrôle** (`check`), déclaratif :

```ts
{
  id: 'mechanical',
  label: 'Orthographe et grammaire',
  skills: ['spelling', 'grammar'],
  engine: 'llm',
  model: 'fast',               // → claude-haiku-4-5
  scope: 'batch',              // 1 page
  prompt: 'mechanical.md',
}

{
  id: 'clarity-tone',
  skills: ['clarity', 'tone'],
  engine: 'llm',
  model: 'main',               // → claude-opus-5
  scope: 'batch',
  prompt: 'clarity-tone.md',
  effort: 'low',
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
| **L2** | Modèle étagé : Haiku pour la passe mécanique, Opus pour le jugement | 5× moins cher et plus rapide sur un tiers des appels |
| **L3** | **Fan‑out total** : toutes les tâches partent ensemble, dans la limite de concurrence | 3 vagues → 2, ≈ ×1,5 |
| **L4** | **Lots d'une page** | Le temps est dominé par la sortie : moitié moins de sortie par appel, deux fois plus d'appels en parallèle |
| **L5** | La passe « cohérence » ne dépend d'aucun lot : elle part à t = 0 | Retire ~15 s de la fin |
| **L6** | Critique pipeliné, lot par lot, au lieu d'une phase finale | Retire ~10 s |
| **L7** | `output_config: { effort: 'low' }` et `max_tokens` borné | **Point de vigilance sur Opus 5** : la réflexion est active par défaut et facturée en sortie. À effort `high`, la sortie peut tripler — en durée comme en coût |
| **L8** | Préfixe de prompt stable → cache (`cache_read` à 0,1×) | TTFT plus court, entrée moins chère |
| **L9** | Streaming vers l'interface | Latence *perçue* : premier finding à ~1 s |

L4 inverse une intuition héritée d'Ollama : là‑bas, de gros lots réduisaient le
nombre d'appels sérialisés. Avec une API parallèle, c'est l'inverse — plus de
lots, plus petits, tous en même temps.

Sur L7, une précision qui compte : la réflexion d'Opus 5 ne se **désactive** pas
(cela dégrade l'appel d'outil et laisse fuir des balises internes dans la
réponse). On la laisse adaptative et on baisse `effort` à `low`, ce qui coupe le
coût sans les effets de bord.

## Durée et coût, par sélection

Hypothèses : 10 pages ≈ 4 000 mots ≈ 5 500 jetons, lots d'une page → 10 lots,
Opus 5 à effort `low`, concurrence 12.

| Sélection | Appels | **Durée** | **Coût** |
| --- | --- | --- | --- |
| Terminologie, chiffres, motifs | 0 | **< 0,5 s** | 0 $ |
| Orthographe + grammaire | 10 (Haiku) | **≈ 6 s** | ≈ 0,03 $ |
| Clarté + ton | 10 (Opus) | **≈ 10 s** | ≈ 0,17 $ |
| Déterministes + mécanique + clarté + ton + cohérence | 21 | **≈ 16 s** | ≈ 0,25 $ |
| Tout, exigences sémantiques comprises | 31 | **≈ 20 s** | ≈ 0,42 $ |
| Tout + critique `uncertain` | ~34 | **≈ 22 s** | ≈ 0,49 $ |

Pour référence : Opus 5 sur la passe mécanique aussi porterait la revue complète
à ~0,63 $ pour une qualité que rien ne distingue sur de l'orthographe. Le
réglage tient en une ligne si la mesure du lot F dit le contraire.

Deux remarques honnêtes :

- **Opus 5 est le poste de coût**, à ~85 % de la facture. À 0,49 $ le document,
  mille revues par mois coûtent 490 $ — chiffre à mettre en face du prix de vente
  avant d'ouvrir le service.
- **Le mode rapide existe** (`speed: 'fast'`, recherche préliminaire, Opus 5) :
  jusqu'à 2,5× de débit en sortie, donc la revue complète autour de 12 s, au prix
  fort (10 $ / 50 $ le million). À réserver à une offre premium, pas au défaut.

Premier résultat affiché : ~0,5 s (déterministe), ~4 s (premier lot Haiku).

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
- **LangChain** — son intérêt était d'abstraire le fournisseur. Le fournisseur
  est fixé, et ce qu'on veut d'Opus 5 est précisément ce qu'une couche
  d'abstraction rabote : `output_config.effort`, les sorties structurées
  (`output_config.format`), le contrôle du cache, le mode rapide. Le SDK officiel
  `@anthropic-ai/sdk` est plus direct et mieux typé.

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
    registry.js               les contrôles, leur moteur, leur skill
    runner.js                 exécution d'une tâche, back-off, usage
    merge.js                  dédoublonnage phrase × critère
    local/
      terminology.js  figures.js  patterns.js
    llm/
      mechanical.md  clarity-tone.md  consistency.md  requirements.md  critic.md
src/                          composants React actuels
```

Répartition d'exécution :

- **Navigateur** — extraction (`documentParser.js`, `mammoth`, `pdfjs`, OCR) et
  les contrôles déterministes en JS, dans un Web Worker.
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
  par le SDK Anthropic côté serveur. Ollama disparaît du chemin nominal.
- Interface — moteur et estimation par contrôle avant lancement ; progression par
  contrôle, les déterministes passant au vert immédiatement.
- Export Excel — deux colonnes : contrôle d'origine, statut de vérification.

## Risques

| Risque | Traitement |
| --- | --- |
| Coût d'Opus 5 sur du volume | Effort `low`, modèle étagé, cache sur le préfixe, budget affiché par revue et plafond configurable ; le tableau de coût est **mesuré** au lot F, pas supposé |
| Réflexion active par défaut qui gonfle la sortie | `effort: 'low'` et `max_tokens` borné ; jamais désactivée (effets de bord documentés), seulement réduite |
| Haiku moins fin qu'Opus sur la grammaire | Le lot F compare les deux sur le même corpus annoté ; si l'écart est réel, le réglage bascule en une ligne |
| Non‑reproductibilité d'une revue à l'autre | Température basse, prompts figés et versionnés ; le triage déjà en place absorbe les variations résiduelles |
| Limites de débit sur le fan‑out | Concurrence plafonnée et réglable, back‑off sur 429, dégradation en durée et non en échec |
| Confidentialité | Le texte transite par notre backend puis Anthropic ; confirmation explicite au premier envoi, aucun stockage serveur, contrôles déterministes marqués comme ne sortant pas du navigateur |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **0** ✔ | Migration Next.js, `/api/analyze` en SSE, authentification, fan‑out borné, planificateur | *fait* |
| **A** | Registre de contrôles, branchement du sélecteur de skills, streaming vers l'interface, estimation durée + coût avant lancement | ~2 j |
| **B** | Contrôles déterministes en JS dans un worker : terminologie et acronymes, chiffres et unités, exigences à motif. **Gratuits et instantanés** | ~1,5 j |
| **C** | Contrôles modèles en `.md` (mécanique en Haiku, clarté + ton, cohérence, exigences en Opus), SDK Anthropic, sorties structurées, effort `low`, comptabilisation de l'`usage` | ~2 j |
| **D** | Critique pipeliné, provenance, colonnes Excel | ~1,5 j |
| **E** | Packs métier : glossaires, motifs, contrôles propres au métier | ~1 j |
| **F** | Banc d'évaluation : latence, précision, rappel et coût **mesurés** par sélection ; comparaison Haiku / Opus sur la passe mécanique ; garde‑fous de budget | ~1,5 j |

Reste ≈ **9,5 jours**.

## Vérification

- `npm test` — contrôles déterministes (jeux de phrases fautives attendues),
  planificateur (sélection → nombre exact de tâches), fusion, politiques,
  transport et fan‑out (déjà couverts).
- Fausse API Anthropic : nombre d'appels par sélection, concurrence effective,
  respect du back‑off sur 429, comportement quand un contrôle échoue.
- Mesure de latence **et de coût réel** (`usage.input_tokens`,
  `cache_read_input_tokens`, `output_tokens`) sur un `.docx` de 10 pages, pour
  chaque ligne du tableau. Ce sont ces mesures qui font foi ; le tableau sera
  corrigé, pas défendu.
- Parcours navigateur : « orthographe + grammaire » seule, puis revue complète
  avec critique et export Excel.
