# Plan — revue cloud, sélection des contrôles, latence maîtrisée

## Contexte

Trois directives closent les arbitrages laissés ouverts par
`docs/plan-agentique.md` :

1. **Le cloud est acté.** L'analyse tourne sur une API (GPT‑5.x). Ollama reste
   possible en développement local, il n'est plus le cas nominal.
2. **La latence est le critère numéro un.** Une revue doit rendre la main en
   dizaines de secondes, pas en minutes.
3. **L'utilisateur choisit ses contrôles.** « Juste l'orthographe », ou
   « orthographe + clarté », doit coûter ce que ça vaut — pas le prix d'une revue
   complète.

Et une ouverture : **Next.js est accepté**, ce qui lève la contrainte du SPA sans
backend.

## L'unité de travail n'est pas l'agent, c'est le contrôle

C'est le point central de ce plan, et il corrige la trajectoire des deux
documents précédents.

Un « agent » suppose qu'on délègue une décision à un modèle. Or sur les cinq
critères existants, seuls trois relèvent réellement du jugement :

| Critère | Ce qu'il faut vraiment | Moteur |
| --- | --- | --- |
| Orthographe | Un mot est dans le dictionnaire, ou il n'y est pas | **Local** — `nspell` + `dictionary-fr` / `dictionary-en`, augmenté du glossaire métier |
| Terminologie, acronymes | Le terme est‑il celui du glossaire ? l'acronyme est‑il défini avant usage ? | **Local** — table de correspondance, première occurrence |
| Chiffres, unités, devises, dates | Deux occurrences du même montant divergent‑elles ? | **Local** — extraction + comparaison |
| Exigences client « mécaniques » (« aucun nom de client hors page de garde ») | Une recherche | **Local** — motif déclaré avec l'exigence |
| Grammaire | Accord, structure, temps | **LLM** (petit modèle suffit) |
| Clarté, ton | Jugement rédactionnel | **LLM** |
| Cohérence inter‑pages | Contradictions, dérive terminologique | **LLM**, portée document |
| Exigences client sémantiques (« les conclusions avant leur justification ») | Jugement | **LLM** |

Une revue « orthographe seule » ne devrait donc **appeler aucune API**. Elle
tourne dans un *worker* du navigateur, en moins d'une seconde, gratuitement, et
sans que le document quitte la machine. C'est le plus gros gain de latence de
tout ce plan, et il ne s'obtient qu'en cessant de traiter chaque critère comme un
agent.

L'abstraction retenue est donc le **contrôle** (`check`), déclaratif :

```js
{
  id: 'spelling',
  label: 'Orthographe',
  skill: 'spelling',        // rattachement au filtre « By type » existant
  engine: 'local',          // 'local' | 'llm'
  scope: 'document',        // 'batch' | 'document'
  run: (ctx) => findings,   // moteur local : une fonction pure
}

{
  id: 'clarity-tone',
  skill: ['clarity', 'tone'],
  engine: 'llm',
  scope: 'batch',
  model: 'main',
  prompt: 'clarity-tone.md',   // le gabarit reste un fichier Markdown
}
```

Le sélecteur de skills de l'interface pilote directement le plan : les contrôles
non sélectionnés ne produisent aucune tâche, donc aucun appel. La relation est
linéaire et lisible par l'utilisateur — un skill décoché, c'est du temps et de
l'argent en moins, visible dans l'estimation affichée avant de lancer.

## Les leviers de latence, par ordre d'effet

| # | Levier | Effet sur une revue de 10 pages |
| --- | --- | --- |
| **L1** | **Moteurs locaux** pour ce qui n'a pas besoin d'un modèle | Supprime 1 contrôle sur 3, et 100 % des appels sur un run « orthographe » |
| **L2** | **Fan‑out total** : toutes les tâches partent en une vague, pas un pool à 6 | 3 vagues → 1 vague, ≈ ×3 |
| **L3** | **Lots plus petits** (1 page au lieu de 2) | Le temps est dominé par la sortie : moitié moins de sortie par appel, deux fois plus d'appels en parallèle → ≈ ×1,7 |
| **L4** | **La passe « cohérence » ne dépend pas des lots** : elle part à t = 0, en parallèle | Retire ~15 s de la fin |
| **L5** | **Critique pipeliné** : chaque lot est vérifié dès son retour, pas en phase finale | Retire ~10 s |
| **L6** | `reasoning_effort: minimal`, `max_output_tokens` borné, sortie en identifiants de phrase (déjà le cas) | Évite le facteur 3 à 5 du raisonnement |
| **L7** | **Préfixe de prompt stable** → cache côté API | TTFT plus court, entrée à 0,1× |
| **L8** | **Streaming vers l'interface** | Latence *perçue* : premier finding à ~1 s (local) / ~4 s (LLM) |

L3 mérite un mot, car il inverse une intuition : avec Ollama, augmenter la taille
des lots réduisait le nombre d'appels sérialisés, donc le temps total. Avec une
API parallèle, c'est l'inverse — plus de lots, plus petits, tous en même temps.
Le coût d'entrée augmente (l'en‑tête est répété), mais L7 l'absorbe en grande
partie. Le seuil bas est fixé par le contexte utile : la clarté et le ton
supportent une page, la cohérence a besoin du document entier.

## Durée et coût, par sélection

Hypothèses : 10 pages ≈ 4 000 mots ≈ 5 500 jetons, lots de 1 page → 10 lots,
`gpt-5-mini` pour la grammaire, `gpt-5` pour clarté/ton/cohérence, fan‑out total.

| Sélection | Appels LLM | **Durée bout en bout** | Coût |
| --- | --- | --- | --- |
| Orthographe seule | 0 | **< 1 s** | 0 $ |
| Orthographe + terminologie + chiffres | 0 | **< 1 s** | 0 $ |
| Grammaire seule | 10 | **≈ 8 s** | ≈ 0,01 $ |
| Clarté + ton | 10 | **≈ 12 s** | ≈ 0,06 $ |
| Orthographe + clarté + ton | 10 | **≈ 12 s** | ≈ 0,06 $ |
| Tout, sans critique | 21 | **≈ 15 s** | ≈ 0,09 $ |
| Tout, critique `uncertain` | 21 + ~3 | **≈ 22 s** | ≈ 0,11 $ |
| Tout, critique, en `gpt-5-mini` partout | 24 | **≈ 15 s** | **≈ 0,02 $** |

Pour référence : le plan précédent (pool à 6, lots de 2 pages, phases
séquentielles) donnait 60 à 90 s pour la revue complète. **Les leviers L1 à L5
ramènent cela sous 25 s**, sans changer de modèle.

Premier résultat affiché : ~1 s en local, ~4 s dès qu'un lot LLM revient.

Limites de débit : 21 requêtes simultanées dépassent le palier d'entrée de
l'API. Le fan‑out est donc **borné par un réglage** (défaut 12), avec back‑off
sur 429 — une revue ne doit jamais échouer parce qu'on a poussé trop fort, juste
finir un peu plus tard.

## Ce que deviennent LangChain et LangGraph

- **LangChain : conservé, pour la couche modèle uniquement.** Une interface pour
  OpenAI, Anthropic et Ollama, la sortie structurée contrainte par schéma (qui
  supprime `extractJson` et `scanCompleteObjects`), les retries et le back‑off.
  C'est un gain net et sans engagement architectural.
- **LangGraph : écarté pour l'instant.** Le graphe cible s'est aplati : un
  planificateur, un fan‑out, une fusion. Il n'y a plus de boucle, plus de
  décision d'arrêt, plus d'état partagé complexe — un pool borné et un générateur
  asynchrone font le travail en ~150 lignes testables. LangGraph redeviendra
  pertinent le jour où le triage humain entrera dans le graphe (`interrupt`) ou
  si la relance des candidats rejetés devient itérative. La forme déclarative des
  contrôles laisse cette porte ouverte : ce sont les mêmes unités qui
  deviendraient des nœuds.

Autrement dit : ta remarque est juste, ce ne sont pas des agents, et le
framework d'agents n'a plus grand‑chose à orchestrer.

## Architecture — Next.js

Next.js est justifié ici pour trois raisons concrètes : une clé d'API qui doit
rester serveur, une route qui streame (SSE) pendant plusieurs dizaines de
secondes, et un déploiement Vercel sans configuration.

```
app/
  page.tsx                    l'app actuelle ('use client')
  login/page.tsx              mot de passe partagé (repris de plan-deepseek-deploy.md)
  api/
    analyze/route.ts          POST → SSE : plan, exécution, findings au fil de l'eau
    models/route.ts           liste des modèles disponibles
middleware.ts                 cookie de session sur tout sauf /login
lib/
  checks/
    registry.ts               les contrôles disponibles, leur moteur, leur skill
    planner.ts                skills sélectionnés + document → liste de tâches
    runner.ts                 fan-out borné, back-off, streaming des résultats
    merge.ts                  dédoublonnage phrase × critère
    local/
      spelling.ts  terminology.ts  figures.ts  patterns.ts
    llm/
      grammar.md  clarity-tone.md  consistency.md  requirements.md
src/                          composants React actuels, déplacés tels quels
```

Répartition d'exécution :

- **Navigateur** — extraction (`documentParser.js`, `mammoth`, `pdfjs`, OCR) et
  **tous les contrôles locaux**, dans un Web Worker. Le dictionnaire (~1 à 3 Mo)
  est chargé à la demande, seulement si l'orthographe est cochée.
- **Serveur** — les contrôles LLM uniquement, derrière `/api/analyze`.

Conséquence agréable : une revue « orthographe + terminologie » ne fait **aucun
aller‑retour réseau** et fonctionne hors ligne. La promesse de confidentialité
survit partiellement au passage au cloud, ce qui est un argument commercial
réel — à afficher dans l'interface, contrôle par contrôle : un cadenas sur ceux
qui restent locaux, un nuage sur ceux qui partent.

### Migration depuis Vite

Peu risquée, mais pas gratuite :

- Les composants React se déplacent tels quels, sous `'use client'`.
- `pdfjs-dist`, `mammoth`, `tesseract.js` sont strictement navigateur → import
  dynamique avec `ssr: false`.
- Les proxies `vite.config.js` (`/ollama`, `/deepseek`) deviennent des route
  handlers.
- Tailwind, PostCSS, `@fontsource/inter` : configuration équivalente.
- `tests/unit.mjs` continue de tourner : les fonctions pures (planificateur,
  fusion, moteurs locaux) n'ont aucune dépendance au framework.

Compter **1,5 jour**, dont la moitié en vérification que rien n'a bougé.

## Impacts sur l'existant

**Inchangé** : extraction et découpage, ancres et surlignage, visualiseurs, OCR,
triage, score, structure de l'export Excel.

**Modifié** :

- `analysisService.js` — se scinde : les prompts partent en `.md`, la boucle
  d'appels devient `runner.ts`, la normalisation reste et gagne les champs de
  provenance (`check`, `engine`, `verified`).
- `ollamaClient.js` / `deepseekClient.js` / `services/providers.js` — remplacés
  par la couche modèle LangChain.
- Interface — le sélecteur de skills affiche désormais, pour chaque contrôle, son
  moteur (local / cloud) et une **estimation de durée et de coût avant
  lancement** ; la progression devient une liste de contrôles, les locaux passant
  au vert immédiatement.
- Export Excel — deux colonnes : contrôle d'origine, statut de vérification.

## Risques

| Risque | Traitement |
| --- | --- |
| Le correcteur local crie au loup sur le jargon métier | Le glossaire du pack métier alimente le dictionnaire ; les noms propres et les mots en majuscules sont ignorés par défaut ; seuil de confiance plus bas sur les pages issues de l'OCR (déjà en place) |
| Taille du dictionnaire au chargement | Chargé à la demande et mis en cache par le navigateur, uniquement si l'orthographe est cochée |
| Limites de débit sur le fan‑out | Concurrence plafonnée et réglable, back‑off sur 429, dégradation en durée et non en échec |
| Timeout serverless (300 s en Vercel Pro) | Une revue de 10 pages tient en ~25 s ; le budget est vérifié au lot F et le découpage par reprise reste en réserve pour les documents très longs |
| Confidentialité | Marquage explicite local / cloud par contrôle, confirmation au premier envoi cloud, aucun stockage serveur |
| Régression au passage Next.js | Les fonctions pures sont testées avant migration ; comparaison de findings sur les mêmes fixtures avant / après |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **0** | Migration Next.js, route `/api/analyze` en SSE, authentification, clé serveur | ~1,5 j |
| **A** | Registre de contrôles, planificateur piloté par la sélection de skills, runner à fan‑out borné, streaming vers l'interface, estimation avant lancement | ~2 j |
| **B** | Moteurs locaux dans un worker : orthographe, terminologie et acronymes, chiffres et unités, exigences à motif. **Livrable utilisable dès la fin de ce lot** : une revue instantanée et gratuite | ~2 j |
| **C** | Contrôles LLM en `.md` (grammaire, clarté + ton, cohérence, exigences sémantiques), couche modèle LangChain, sortie structurée | ~1,5 j |
| **D** | Critique pipeliné optionnel, provenance, colonnes Excel | ~1,5 j |
| **E** | Packs métier (Audit / Cyber / Finance / Tax) : glossaires, motifs, contrôles propres au métier | ~1 j |
| **F** | Banc d'évaluation : latence, précision, rappel et coût par sélection ; garde‑fous de budget et de concurrence | ~1,5 j |

Total ≈ **11 jours**, dont **5,5 jours** (lots 0, A, B) pour une première version
qui rend l'orthographe instantanée et gratuite.

## Vérification

- `npm test` — moteurs locaux (jeux de phrases fautives attendues), planificateur
  (sélection de skills → nombre exact de tâches), fusion, application des
  politiques.
- Fausse API OpenAI : on vérifie le nombre d'appels par sélection, la concurrence
  effective, le respect du back‑off sur 429.
- Mesure de latence sur un `.docx` de 10 pages pour chaque ligne du tableau
  ci‑dessus. Ce sont ces mesures qui font foi ; le tableau sera corrigé, pas
  défendu.
- Parcours navigateur : sélection « orthographe seule » sans réseau (mode avion),
  puis revue complète avec critique et export Excel.

## Décisions à acter

1. **Modèle par défaut** — `gpt-5-mini` partout (≈ 0,02 $ et 15 s) ou `gpt-5` sur
   les contrôles rédactionnels (≈ 0,11 $ et 22 s) ? Réglable, mais il faut un
   défaut.
2. **Correcteur local** — `nspell` + dictionnaires Hunspell (léger, embarqué) ou
   un LanguageTool auto‑hébergé (bien meilleur en grammaire, mais c'est un
   service Java à exploiter). Le plan retient `nspell` et laisse la grammaire au
   LLM.
3. **Lots de 1 page** — gain de latence net, coût d'entrée un peu supérieur.
   À confirmer au lot F sur un vrai corpus.
