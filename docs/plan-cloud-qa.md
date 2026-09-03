# Plan — revue cloud, sélection des contrôles, latence maîtrisée

## Décisions actées

| Sujet | Décision |
| --- | --- |
| Moteur de jugement | **Claude Opus 5** (`claude-opus-5`), 5 $ / 25 $ par million de jetons (entrée / sortie), fenêtre de 1 M |
| Orthographe et grammaire | **LanguageTool**, auto‑hébergé — pas de LLM, pas de `nspell` |
| Découpage | **Un lot = une page**, pour maximiser le parallélisme |
| Cadre applicatif | **Next.js**, déployé sur Vercel |
| Framework d'orchestration | **Aucun** — SDK Anthropic officiel, ni LangChain ni LangGraph |

Les trois sections suivantes justifient ces choix ; le reste du document est le
plan d'implémentation qui en découle.

## L'unité de travail n'est pas l'agent, c'est le contrôle

Un « agent » suppose qu'on délègue une décision à un modèle. Sur les critères
existants, seuls trois relèvent réellement du jugement :

| Critère | Ce qu'il faut vraiment | Moteur |
| --- | --- | --- |
| Orthographe, grammaire, accords, typographie | Un moteur de règles, en français comme en anglais | **LanguageTool** |
| Terminologie, acronymes | Le terme est‑il celui du glossaire ? l'acronyme est‑il défini avant usage ? | **JS, navigateur** |
| Chiffres, unités, devises, dates | Deux occurrences du même montant divergent‑elles ? | **JS, navigateur** |
| Exigences client « mécaniques » (« aucun nom de client hors page de garde ») | Une recherche de motif | **JS, navigateur** |
| Clarté, ton | Jugement rédactionnel | **Opus 5** |
| Cohérence inter‑pages | Contradictions, dérive terminologique | **Opus 5**, portée document |
| Exigences client sémantiques (« les conclusions avant leur justification ») | Jugement | **Opus 5** |

Une revue « orthographe et grammaire » n'appelle donc **aucun modèle** : elle
coûte zéro et rend en une à deux secondes. C'est le plus gros gain de latence de
tout ce plan, et il ne s'obtient qu'en cessant de traiter chaque critère comme un
agent.

L'abstraction retenue est le **contrôle** (`check`), déclaratif :

```ts
{
  id: 'spelling-grammar',
  label: 'Orthographe et grammaire',
  skill: ['spelling', 'grammar'],
  engine: 'languagetool',      // 'local' | 'languagetool' | 'llm'
  scope: 'document',
}

{
  id: 'clarity-tone',
  skill: ['clarity', 'tone'],
  engine: 'llm',
  scope: 'batch',              // 1 page
  prompt: 'clarity-tone.md',   // le gabarit reste un fichier Markdown
  effort: 'low',
}
```

Le sélecteur de skills de l'interface pilote directement le plan : un contrôle
non sélectionné ne produit aucune tâche. La relation est linéaire et lisible —
un skill décoché, c'est du temps et de l'argent en moins, affichés dans
l'estimation avant lancement.

## LanguageTool : ce que ça donne, ce que ça coûte

**Ce que ça donne.** Orthographe, accords, conjugaison, ponctuation et une partie
du style, en français et en anglais, sans appel à un modèle. Les correspondances
reviennent avec `offset` et `length` dans le texte soumis, donc elles se
projettent directement sur les phrases et sur les rectangles d'ancrage déjà
extraits par `documentParser.js` : le surlignage fonctionne sans travail
supplémentaire. Le glossaire d'un pack métier s'injecte comme dictionnaire
utilisateur, ce qui règle le problème du jargon signalé comme faute.

**Ce que ça coûte.** LanguageTool est un service **Java** : il ne tourne ni dans
le navigateur ni dans une fonction Vercel. Il faut un conteneur
(`erikvl87/languagetool`, port 8010, endpoint `POST /v2/check`, 512 Mo de tas)
hébergé à côté — Fly.io, Railway ou Render, de l'ordre de 5 à 10 $ par mois. Deux
conséquences :

1. **La grammaire quitte le LLM.** Dix appels de modèle disparaissent du plan.
   C'est le meilleur échange du document : moins cher, plus rapide, plus
   déterministe, et reproductible d'une exécution à l'autre.
2. **La propriété « hors ligne » disparaît.** Une revue orthographique passe
   désormais par le réseau — mais vers *notre* conteneur, pas vers un tiers, et
   sans coût par requête. L'appel passe par `/api/lint` et non en direct : le
   service reste privé, authentifié et limité en débit.

Si le service est injoignable, les contrôles concernés sont marqués
**indisponibles** dans l'interface. Ils ne sont jamais silencieusement ignorés :
un rapport incomplet qui se présente comme complet est pire que pas de rapport.

## Les leviers de latence

| # | Levier | Effet |
| --- | --- | --- |
| **L1** | Moteurs déterministes pour ce qui n'a pas besoin d'un modèle | Supprime 2 contrôles sur 3, et 100 % des appels sur une revue orthographe + grammaire |
| **L2** | **Fan‑out total** : toutes les tâches partent en une vague | 3 vagues → 1, ≈ ×3 |
| **L3** | **Lots d'une page** | Le temps est dominé par la sortie : moitié moins de sortie par appel, deux fois plus d'appels en parallèle |
| **L4** | La passe « cohérence » ne dépend d'aucun lot : elle part à t = 0 | Retire ~15 s de la fin |
| **L5** | Critique pipeliné, lot par lot, au lieu d'une phase finale | Retire ~10 s |
| **L6** | `output_config: { effort: 'low' }` et `max_tokens` borné | **Critique sur Opus 5** : la réflexion est active par défaut et facturée en sortie. À effort `high`, la sortie peut tripler — en durée comme en coût |
| **L7** | Préfixe de prompt stable → cache (`cache_read` à 0,1×) | TTFT plus court, entrée moins chère |
| **L8** | Streaming vers l'interface | Latence *perçue* : premier finding à ~1 s |

L3 inverse une intuition héritée d'Ollama : là‑bas, de gros lots réduisaient le
nombre d'appels sérialisés. Avec une API parallèle, c'est l'inverse — plus de
lots, plus petits, tous en même temps. Le coût d'entrée monte un peu, L7
l'absorbe.

Sur L6, une précision qui compte : sur Opus 5 la réflexion est **active par
défaut**. On ne la désactive pas (cela dégrade l'appel d'outil et fait fuir des
balises internes dans la réponse) — on la laisse adaptative et on baisse
`effort` à `low`, ce qui coupe le coût sans les effets de bord.

## Durée et coût, par sélection

Hypothèses : 10 pages ≈ 4 000 mots ≈ 5 500 jetons, lots d'une page → 10 lots,
Opus 5 à effort `low`, fan‑out total.

| Sélection | Appels Opus 5 | **Durée** | **Coût** |
| --- | --- | --- | --- |
| Orthographe + grammaire | 0 | **≈ 2 s** | 0 $ |
| Terminologie, chiffres, motifs | 0 | **< 0,5 s** | 0 $ |
| Tous les contrôles déterministes | 0 | **≈ 2 s** | 0 $ |
| Clarté + ton | 10 | **≈ 10 s** | ≈ 0,17 $ |
| Déterministes + clarté + ton + cohérence | 11 | **≈ 12 s** | ≈ 0,19 $ |
| Tout, exigences sémantiques comprises | 21 | **≈ 14 s** | ≈ 0,38 $ |
| Tout + critique `uncertain` | ~24 | **≈ 18 s** | ≈ 0,45 $ |

Volumes correspondants pour la ligne « tout + critique » : ~40 000 jetons
d'entrée (dont une bonne part servie par le cache) et ~14 000 jetons de sortie.

Deux remarques honnêtes sur ce tableau :

- **Opus 5 est le poste de coût.** C'est un choix acté, pas une dérive : la même
  revue tourne à ~0,02 $ sur un petit modèle. À 0,45 $ le document, mille revues
  par mois coûtent 450 $ — chiffre à mettre en face du prix de vente avant
  d'ouvrir le service.
- **Le mode rapide existe** (`speed: 'fast'`, recherche préliminaire, Opus 5) :
  jusqu'à 2,5× de débit en sortie, donc la revue complète autour de 8 s, au prix
  fort (10 $ / 50 $ le million). À réserver à une éventuelle offre premium, pas
  au défaut.

Pour référence : le plan initial (pool à 6, lots de 2 pages, phases
séquentielles) donnait 60 à 90 s. Les leviers L1 à L5 ramènent la revue complète
sous 20 s.

Premier résultat affiché : ~1 s (déterministe), ~4 s (premier lot LLM).

Limites de débit : 21 requêtes simultanées peuvent dépasser le palier de
l'organisation. Le fan‑out est **borné par un réglage** (défaut 12) avec
back‑off sur 429 — une revue ne doit jamais échouer parce qu'on a poussé trop
fort, seulement finir un peu plus tard.

## Pourquoi ni LangChain ni LangGraph

Les deux ont été envisagés, les deux sortent du plan, pour des raisons
différentes :

- **LangGraph** — le graphe s'est aplati : un planificateur, un fan‑out, une
  fusion. Plus de boucle, plus de décision d'arrêt, plus d'état partagé complexe.
  Un pool borné et un générateur asynchrone font le travail en ~150 lignes
  testables. Il redeviendra pertinent si le triage humain entre dans le graphe.
- **LangChain** — son intérêt était d'abstraire le fournisseur. Le fournisseur
  est maintenant fixé, et ce qu'on veut d'Opus 5 est précisément ce qu'une couche
  d'abstraction rabote : `output_config.effort`, les sorties structurées
  (`output_config.format`), le contrôle fin du cache, le mode rapide. Le SDK
  officiel `@anthropic-ai/sdk` est plus direct et mieux typé pour cet usage.

Sorties structurées : le schéma des findings est déclaré une fois et contraint
côté API, ce qui supprime `extractJson` et `scanCompleteObjects` — la
récupération de JSON tronqué n'a plus lieu d'être.

## Architecture — Next.js

```
app/
  page.tsx                    l'app actuelle ('use client')
  login/page.tsx              mot de passe partagé (repris de plan-deepseek-deploy.md)
  api/
    analyze/route.ts          POST → SSE : plan, exécution, findings au fil de l'eau
    lint/route.ts             proxy authentifié vers LanguageTool
middleware.ts                 cookie de session sur tout sauf /login
lib/
  checks/
    registry.ts               les contrôles, leur moteur, leur skill
    planner.ts                skills sélectionnés + document → tâches
    runner.ts                 fan-out borné, back-off, streaming
    merge.ts                  dédoublonnage phrase × critère
    local/
      terminology.ts  figures.ts  patterns.ts
    languagetool/
      client.ts  map.ts       correspondances LT → findings ancrés
    llm/
      clarity-tone.md  consistency.md  requirements.md  critic.md
src/                          composants React actuels, déplacés tels quels
docker-compose.yml            LanguageTool en développement
```

Répartition d'exécution :

- **Navigateur** — extraction (`documentParser.js`, `mammoth`, `pdfjs`, OCR) et
  les contrôles déterministes en JS, dans un Web Worker.
- **Serveur** — Opus 5 et le proxy LanguageTool.

L'interface marque chaque contrôle par son moteur : instantané et gratuit,
service interne, ou modèle externe payant. C'est une information que l'utilisateur
doit avoir **avant** de lancer, pas après.

### Migration depuis Vite

- Les composants React se déplacent tels quels, sous `'use client'`.
- `pdfjs-dist`, `mammoth`, `tesseract.js` sont strictement navigateur → import
  dynamique avec `ssr: false`.
- Les proxies de `vite.config.js` deviennent des route handlers.
- Tailwind, PostCSS, `@fontsource/inter` : configuration équivalente.
- `tests/unit.mjs` continue de tourner : les fonctions pures n'ont aucune
  dépendance au framework.

Compter **1,5 jour**, dont la moitié à vérifier que rien n'a bougé.

## Impacts sur l'existant

**Inchangé** : extraction et découpage, ancres et surlignage, visualiseurs, OCR,
triage, score, structure de l'export Excel.

**Modifié** :

- `analysisService.js` — se scinde : prompts en `.md`, boucle d'appels en
  `runner.ts`, la normalisation reste et gagne les champs de provenance
  (`check`, `engine`, `verified`).
- `ollamaClient.js` / `deepseekClient.js` / `services/providers.js` — remplacés
  par le SDK Anthropic côté serveur. Ollama disparaît du chemin nominal.
- Interface — moteur et estimation par contrôle avant lancement ; progression par
  contrôle, les déterministes passant au vert immédiatement.
- Export Excel — deux colonnes : contrôle d'origine, statut de vérification.

## Risques

| Risque | Traitement |
| --- | --- |
| Coût d'Opus 5 sur du volume | Effort `low` par défaut, cache sur le préfixe, budget affiché par revue et plafond configurable ; le tableau de coût est mesuré au lot F, pas supposé |
| Réflexion active par défaut qui gonfle la sortie | `effort: 'low'` et `max_tokens` borné ; la réflexion n'est jamais désactivée (effets de bord documentés), seulement réduite |
| LanguageTool indisponible | Contrôles marqués indisponibles, jamais silencieusement ignorés ; conteneur redémarrable, sonde de santé |
| Faux positifs de LanguageTool sur le jargon | Glossaire du pack métier injecté comme dictionnaire utilisateur ; règles désactivables par pack |
| Limites de débit sur le fan‑out | Concurrence plafonnée et réglable, back‑off sur 429, dégradation en durée et non en échec |
| Confidentialité | Le texte transite par notre backend, LanguageTool reste privé, Anthropic ne reçoit que les contrôles de jugement ; confirmation explicite au premier envoi |
| Régression au passage Next.js | Fonctions pures testées avant migration, comparaison de findings sur les mêmes fixtures |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **0** | Migration Next.js, `/api/analyze` en SSE, authentification, clé serveur | ~1,5 j |
| **A** | Registre de contrôles, planificateur piloté par la sélection de skills, runner à fan‑out borné, streaming vers l'interface, estimation avant lancement | ~2 j |
| **B** | LanguageTool : conteneur, `/api/lint`, projection des correspondances sur les phrases et les ancres, dictionnaires ; contrôles déterministes en JS (terminologie, chiffres, motifs). **Livrable utilisable dès ce lot** : revue orthographe + grammaire en 2 s, gratuite | ~2,5 j |
| **C** | Contrôles Opus 5 en `.md` (clarté + ton, cohérence, exigences sémantiques), SDK Anthropic, sorties structurées, effort `low` | ~1,5 j |
| **D** | Critique pipeliné, provenance, colonnes Excel | ~1,5 j |
| **E** | Packs métier : glossaires LanguageTool, motifs, contrôles propres au métier | ~1 j |
| **F** | Banc d'évaluation : latence, précision, rappel et coût **mesurés** par sélection ; garde‑fous de budget et de concurrence | ~1,5 j |

Total ≈ **11,5 jours**, dont **6 jours** (lots 0, A, B) pour une première version
qui rend l'orthographe et la grammaire instantanées et gratuites.

## Vérification

- `npm test` — contrôles déterministes (jeux de phrases fautives attendues),
  planificateur (sélection → nombre exact de tâches), projection des
  correspondances LanguageTool sur les ancres, fusion, politiques.
- Fausse API Anthropic et faux LanguageTool : nombre d'appels par sélection,
  concurrence effective, respect du back‑off sur 429, comportement quand le
  service de correction est éteint.
- Mesure de latence **et de coût réel** (`usage.input_tokens`,
  `cache_read_input_tokens`, `output_tokens`) sur un `.docx` de 10 pages, pour
  chaque ligne du tableau. Ce sont ces mesures qui font foi ; le tableau sera
  corrigé, pas défendu.
- Parcours navigateur : « orthographe + grammaire » seule, puis revue complète
  avec critique et export Excel.
