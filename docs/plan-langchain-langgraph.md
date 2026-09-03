# Plan — orchestration multi-agents avec LangChain / LangGraph et une API OpenAI

## Contexte

`docs/plan-agentique.md` décrivait des agents spécialisés orchestrés par un
moteur maison de ~200 lignes, sur Ollama, et écartait explicitement LangChain et
LangGraph. Deux paramètres ont changé depuis :

1. **Le moteur devient une API cloud.** Le goulot d'étranglement d'Ollama — un
   modèle en VRAM, les requêtes sérialisées — disparaît. Le parallélisme entre
   agents devient réel, et c'est ce qui rend un graphe d'exécution intéressant.
2. **Les agents doivent être éditables sans toucher au code**, sous forme de
   fichiers `.md`. Un registre déclaratif en JavaScript ne suffit plus : il faut
   un format de fichier, un chargeur, une validation.

Ce document analyse la solution demandée, chiffre le coût et la durée d'une revue
de dix pages Word, et propose un plan d'implémentation par lots.

## Point de vocabulaire, à lever avant le lot A

« API ChatGPT Opus » mélange deux fournisseurs : **Opus** est un modèle
Anthropic (Claude), **ChatGPT / GPT‑5.x** est OpenAI. Le plan ci‑dessous est
chiffré sur **OpenAI GPT‑5.x**, qui est l'hypothèse la plus probable. Ce choix
n'est pas structurant : LangChain expose les deux derrière la même interface
(`initChatModel('openai:gpt-5-mini')` / `initChatModel('anthropic:claude-opus-…')`),
et la seule chose à changer serait une chaîne de caractères et une clé d'API. Les
tableaux de coût sont donnés pour OpenAI ; s'il s'agit bien de Claude Opus, il
faut compter environ un ordre de grandeur au‑dessus par jeton.

## Ce que LangChain apporte, ce que LangGraph apporte

Les deux ne se justifient pas au même moment. Il faut les séparer.

**LangChain — oui, dès le premier lot.** Il remplace trois morceaux de code
maison qui existent aujourd'hui et qui coûtent de la maintenance :

| Existant | Remplacé par |
| --- | --- |
| `ollamaClient.js` + `deepseekClient.js` + `providers.js` (deux parsings de flux : NDJSON et SSE) | `ChatOpenAI` / `ChatOllama` / `ChatDeepSeek`, une interface, un `.stream()` |
| `extractJson` et `scanCompleteObjects` (récupération d'un JSON dans une sortie bavarde) | `withStructuredOutput(schema)` : le schéma est contraint côté API, plus de JSON tronqué à rattraper |
| Retries, timeouts, back‑off écrits à la main | `maxRetries`, `timeout` intégrés |

**LangGraph — seulement à partir du lot où la boucle critique existe.** Sur un
pipeline linéaire, il n'ajoute que de l'indirection : le reproche du plan
précédent reste valable. Il devient payant quand le graphe cible comporte du
map‑reduce, une boucle bornée et une reprise :

- **`Send`** : un nœud « plan » émet dynamiquement N tâches (agent × lot) que le
  runtime exécute en parallèle et dont il agrège les résultats. C'est exactement
  la forme du problème, et c'est le seul morceau réellement pénible à écrire à la
  main correctement (concurrence bornée, erreurs partielles, agrégation).
- **`streamEvents`** : la progression agent × lot attendue par l'interface tombe
  gratuitement, au lieu d'un système d'événements maison.
- **Checkpointer** : une analyse interrompue (timeout serverless, onglet fermé)
  reprend là où elle s'est arrêtée au lieu de tout repayer.
- **`interrupt`** : le triage humain (accepter / rejeter) peut, plus tard,
  devenir un nœud du graphe plutôt qu'une étape hors moteur.

Verdict : **LangChain tout de suite, LangGraph au lot C**. Et si le lot C montre
que le graphe reste linéaire, on s'arrête à LangChain sans avoir rien perdu.

## Le point dur : il faut un backend

C'est l'impact le plus lourd, et il n'a rien à voir avec la qualité de l'analyse.

LangGraph est une bibliothèque **Node**. L'application est aujourd'hui un SPA
100 % navigateur qui parle à un proxy Vite. Trois conséquences :

1. **La clé OpenAI ne peut pas vivre dans le navigateur.** Déjà acté pour
   DeepSeek dans `docs/plan-deepseek-deploy.md` : le proxy `api/chat.js` reste le
   modèle. Le graphe s'exécute donc côté serveur, pas dans l'onglet.
2. **Le texte du document doit monter au serveur.** Aujourd'hui le parsing est
   fait dans le navigateur et seul le texte part vers l'API. Cela reste vrai,
   mais il transite désormais par *notre* backend. La promesse « rien ne quitte
   la machine » ne vaut plus que pour le mode Ollama local — à écrire noir sur
   blanc dans l'interface, pas seulement dans le README.
3. **Le timeout serverless est une contrainte de conception.** Une fonction
   Vercel plafonne (60 s en Hobby, jusqu'à 300 s en Pro/Fluid). Une revue de dix
   pages tient dans 300 s (voir plus bas) ; une revue de quarante pages, non.

Trois façons de traiter le point 3, par ordre de préférence :

| Option | Principe | Verdict |
| --- | --- | --- |
| **A — un endpoint SSE qui streame le graphe** | `POST /api/analyze` exécute le graphe et pousse les événements au fil de l'eau | **Retenu.** Simple, la progression arrive en direct, tient jusqu'à ~300 s |
| B — le client pilote nœud par nœud | Un appel HTTP par étape, l'état fait l'aller‑retour | Rejeté : on réécrit l'ordonnanceur côté client, LangGraph ne sert plus à rien |
| C — runtime long (Railway / Fly / LangGraph Platform) | Le graphe tourne dans un process durable, le client suit un `thread_id` | À garder en réserve pour les documents longs. Coût d'infra en plus |

Le plan retient **A**, avec un checkpointer en mémoire et une reprise par
`thread_id`, ce qui rend le passage ultérieur à **C** peu coûteux.

## Les agents en fichiers Markdown

Format proposé : front‑matter YAML pour la configuration, corps Markdown pour le
prompt. Un consultant métier peut écrire un agent sans ouvrir un fichier `.js`.

```markdown
---
id: requirements
label: Conformité aux exigences
skills: [custom]
scope: batch              # batch | document
model: fast               # fast | main — résolu par les réglages
pagesPerBatch: 3
temperature: 0.1
glossary: [CVE, CVSS, EDR]
---

Tu vérifies que chaque phrase respecte les exigences ci‑dessous.
Une exigence non respectée est un finding ; une exigence hors sujet
pour la phrase n'en est pas un.

Exigences :
{{requirements}}
```

Décisions à acter sur ce format :

- **Les fichiers sont commités dans le dépôt** (`src/agents/*.md`), pas
  téléversés par l'utilisateur. Un prompt est du code : il passe en revue de
  code. Cela ferme aussi la porte à l'injection de prompt par un fichier déposé.
- **Chargement au build** côté serveur (`import.meta.glob('...*.md', { as: 'raw' })`
  ou lecture disque), **validation par un schéma Zod** au démarrage : un agent mal
  formé fait échouer le build, pas l'analyse en production.
- **Le corps est un gabarit**, pas un prompt final : quelques variables
  (`{{sentences}}`, `{{language}}`, `{{requirements}}`, `{{glossary}}`) sont
  substituées. Pas de logique, pas de conditionnelles — sinon on réinvente un
  langage de template.
- **Le schéma de sortie reste en JavaScript**, partagé par tous les agents
  (`{ findings: [...] }` en Zod). Un agent choisit son prompt, pas sa forme de
  réponse : c'est ce qui garde `normaliseFinding` comme porte d'entrée unique.

## Graphe cible

```
                    ┌──────────┐
                    │  plan    │  agents retenus × lots → tâches
                    └────┬─────┘
                    Send │ (map, concurrence bornée)
        ┌────────────────┼────────────────┐
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │mécanique│      │rédaction│      │exigences│   (batch, N lots chacun)
   └────┬────┘      └────┬────┘      └────┬────┘
        └────────────────┼────────────────┘
                    ┌────▼─────┐
                    │  fusion  │  dédoublonnage phrase × critère
                    └────┬─────┘
                    ┌────▼─────┐
                    │ critique │  keep / drop / adjust — politique `uncertain`
                    └────┬─────┘
                    ┌────▼─────┐
                    │cohérence │  portée document (une passe)
                    └────┬─────┘
                    ┌────▼─────┐
                    │  final   │  score, tri, provenance
                    └──────────┘
```

L'état du graphe est un objet unique (`documentModel`, `tasks`, `candidates`,
`verdicts`, `findings`), les nœuds de fan‑out n'écrivant que dans `candidates`
via un réducteur de concaténation. La boucle reste **bornée par construction** :
une passe de critique, une relance optionnelle, pas de décision d'arrêt laissée
au modèle. Ce point du plan précédent ne change pas.

## Estimation — un document Word de 10 pages

### Hypothèses

| Paramètre | Valeur |
| --- | --- |
| Volume | 10 pages × ~400 mots ≈ 4 000 mots ≈ **5 500 jetons**, ~250 phrases |
| Lots | 2 pages par lot → **5 lots** (réglage actuel `pagesPerBatch: 2`) |
| Agents de portée lot | 3 : mécanique (orthographe + grammaire), rédactionnel (clarté + ton), exigences |
| Agents de portée document | 1 : cohérence inter‑pages |
| Critique | politique `uncertain`, ~12 candidats par appel → ~3 appels |
| Concurrence | 6 requêtes simultanées (limite de débit du palier OpenAI à vérifier) |

**Nombre d'appels : 3 × 5 + 1 + 3 = 19.**

### Durée

Le temps est dominé par les jetons de **sortie** (~450 par appel : du JSON
structuré, pas de prose).

| Configuration | Latence par appel | Vagues | **Durée bout en bout** |
| --- | --- | --- | --- |
| `gpt-5-mini`, raisonnement minimal, concurrence 6 | ~8 s | 3 + 1 + 1 | **≈ 60–90 s** |
| `gpt-5`, raisonnement minimal, concurrence 6 | ~15 s | 3 + 1 + 1 | **≈ 2–3 min** |
| Mixte : mécanique en `mini`, rédactionnel/critique en `gpt-5` | 8–15 s | idem | **≈ 90 s–2 min** |
| Séquentiel (concurrence 1), `gpt-5-mini` | ~8 s | 19 | **≈ 3 min** |
| `gpt-5` avec raisonnement `medium` | 30–60 s | 3 + 1 + 1 | **5–8 min** ⚠️ |

À comparer à la situation actuelle : un prompt unique par lot sur un modèle local
de 8 à 12 B, c'est ~20 s par appel **sérialisés** par Ollama, soit ~2 min pour les
mêmes 10 pages — avec une seule passe, aucune vérification et aucune
spécialisation. **Le passage au cloud multiplie les appels par cinq sans allonger
le temps perçu**, parce que le parallélisme y est réel. C'est le vrai argument de
ce changement d'architecture, davantage que LangGraph lui‑même.

Le parsing du `.docx` (mammoth, en navigateur) reste sous la seconde et
n'intervient pas dans ce budget.

⚠️ Le piège à éviter : les jetons de raisonnement sont facturés en sortie **et**
comptent dans la latence. Le plan fixe `reasoning_effort: minimal` par défaut sur
les agents mécaniques et ne l'ouvre que pour le critique.

### Coût

Volumes pour un document de 10 pages : chaque lot est envoyé à 3 agents, donc le
texte est payé ~3 fois.

- Entrée : 15 × ~1 900 + 6 000 (cohérence) + 3 × ~2 500 (critique) ≈ **42 000 jetons**
- Sortie : 19 × ~450 ≈ **8 500 jetons**

| Modèle | Entrée | Sortie | **Coût par document** |
| --- | --- | --- | --- |
| `gpt-5-nano` | 0,05 $/M | 0,40 $/M | **≈ 0,005 $** |
| `gpt-5-mini` | 0,25 $/M | 2,00 $/M | **≈ 0,03 $** |
| Mixte mini + `gpt-5` | — | — | **≈ 0,08 $** |
| `gpt-5` | 1,25 $/M | 10,00 $/M | **≈ 0,14 $** |
| `gpt-5.2` | 1,75 $/M | 14,00 $/M | **≈ 0,19 $** |

Tarifs relevés sur la page de prix OpenAI en septembre 2026 ; à revérifier avant
tout engagement commercial. Le cache de prompt (0,1× sur l'entrée) s'applique aux
en‑têtes système et aux instructions d'agent, répétés à chaque appel : compter
**−20 à −30 % sur l'entrée** une fois les prompts ordonnés préfixe‑stable.

Extrapolation linéaire : un document de 40 pages ≈ 4× (≈ 0,12 $ en `mini`,
4–6 min) — et là, le timeout serverless de 300 s devient le facteur limitant, pas
le coût.

## Impacts sur l'existant

**Inchangé** : extraction et découpage (`documentParser.js`), ancres et
surlignage, visualiseurs, OCR, triage, score, export Excel dans sa structure.

**Modifié** :

- `analysisService.js` — devient l'assembleur des prompts et le normaliseur ; la
  boucle d'appels et le parsing de flux partent dans le graphe.
- `ollamaClient.js` / `deepseekClient.js` / `services/providers.js` — remplacés
  par la couche modèle de LangChain. Ollama reste disponible via `ChatOllama`,
  donc le mode local ne meurt pas.
- Findings — trois champs de provenance (`agent`, `verified`, `verdict`) plus
  `confidenceBefore`, comme prévu au plan précédent, et deux colonnes Excel.
- Interface — progression en matrice agent × lot, alimentée par `streamEvents`.
- Nouveau : `api/analyze.js` (SSE), `src/agents/*.md`, `src/agents/loader.js`,
  `src/graph/`.

## Risques

| Risque | Traitement |
| --- | --- |
| Timeout serverless sur les documents longs | Checkpointer + `thread_id`, reprise côté client ; option C (runtime long) documentée et prête |
| Confidentialité : le texte transite par notre backend puis OpenAI | Bandeau de confirmation explicite (déjà prévu pour DeepSeek), aucun stockage côté serveur, mode Ollama conservé pour les documents sensibles |
| Limites de débit OpenAI au palier bas | Concurrence configurable, back‑off intégré de LangChain, dégradation propre (l'analyse finit plus lentement, elle n'échoue pas) |
| Explosion de coût par raisonnement non maîtrisé | `reasoning_effort: minimal` par défaut, budget jetons journalisé et affiché en fin d'analyse |
| Dépendance à un framework qui bouge vite | Versions épinglées (`@langchain/langgraph` 1.4, `@langchain/openai` 1.5, Node ≥ 22) ; la surface utilisée reste étroite : modèles, sortie structurée, `StateGraph`, `Send` |
| Agents `.md` mal formés | Validation Zod au build : le build casse, pas l'analyse |
| Régressions invisibles | Le lot A ne change rien au comportement et se vérifie en rejouant les fixtures existantes |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **0** | Décisions actées (modèle, hébergement, confidentialité) ; `api/analyze.js` en SSE, authentification réutilisée de `plan-deepseek-deploy.md` ; Node ≥ 22 | ~1 j |
| **A** | Socle LangChain : couche modèle unifiée (OpenAI + Ollama), sortie structurée Zod à la place de `extractJson`. **Aucun changement de comportement**, mêmes fixtures, mêmes findings | ~2 j |
| **B** | Agents en `.md` : format, chargeur, validation, registre ; portage des critères actuels en trois agents | ~1,5 j |
| **C** | Graphe LangGraph : `plan` → `Send` → fusion → critique → cohérence → final ; `streamEvents` vers l'interface, progression agent × lot, provenance et colonnes Excel | ~2,5 j |
| **D** | Packs métier (Audit / Cyber / Finance / Tax) en `.md` avec glossaires ; le sélecteur de service line devient signifiant | ~1,5 j |
| **E** | Banc d'évaluation (corpus annoté, précision / rappel / durée / coût par configuration), observabilité LangSmith, garde‑fous de budget | ~1,5 j |

Total ≈ **10 jours**. Le lot A est le plus important à tenir strictement : sans
iso‑comportement vérifié, aucun des lots suivants n'est mesurable.

## Vérification

- `npm test` — fonctions pures : chargement et validation des agents `.md`,
  construction du plan de tâches, fusion des doublons, application de la politique
  de vérification, parsing des verdicts.
- Faux serveur OpenAI (dans `scratchpad/`) répondant selon l'agent détecté et
  journalisant les appels : on vérifie le nombre d'appels, la concurrence
  effective et l'ordre des nœuds.
- Comparaison lot A : même document, même fixture, findings identiques avant et
  après le portage.
- Parcours navigateur : `.docx` de 10 pages, analyse complète avec critique
  active, progression par agent, badges de provenance, export Excel.
- Mesure réelle de la durée et du coût au lot E, à confronter au tableau
  ci‑dessus : c'est ce tableau qu'il faudra corriger, pas l'inverse.

## Décisions à acter avant de commencer

1. **Fournisseur et modèle** : OpenAI GPT‑5.x (chiffré ici) ou Anthropic Claude
   Opus ? Cela ne change que le coût, pas l'architecture.
2. **Hébergement** : Vercel Pro (300 s) suffit jusqu'à ~30 pages. Au‑delà, il
   faut trancher entre le découpage par reprise et un runtime long.
3. **Confidentialité** : le mode cloud est‑il autorisé sur des livrables clients,
   et sous quelles conditions d'affichage ?
