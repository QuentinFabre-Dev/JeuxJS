# Plan — passage à une architecture agentique

> **Statut : partiellement remplacé.** Le refus de LangChain / LangGraph acté
> plus bas partait d'un moteur local (Ollama) et d'un pipeline linéaire. Avec
> une API cloud, une sélection de contrôles et une exigence de latence,
> l'arbitrage change :
> voir [`plan-cloud-qa.md`](plan-cloud-qa.md). Le reste
> du document — forme d'un agent, boucle bornée, contrat du critique, packs
> métier — reste valable.

## Contexte

L'analyse actuelle est un enchaînement d'appels plats. Pour chaque lot de pages,
`runOllamaAnalysis` construit **un** prompt qui demande au modèle de traiter les
cinq critères d'un coup — grammaire, orthographe, cohérence, clarté, ton — puis
lance une passe finale de cohérence inter-pages. Le modèle ne décide de rien, ne
revient jamais sur sa réponse, et la *service line* choisie dans l'interface
n'est qu'une ligne de contexte dans le prompt : elle ne change ni les critères,
ni la sévérité, ni rien de structurel.

Trois limites en découlent :

1. **Attention diluée.** Un modèle local à qui l'on demande cinq analyses
   simultanées en fait cinq à moitié. C'est particulièrement vrai en 4B.
2. **Aucune vérification.** La première réponse est la réponse finale. Les faux
   positifs arrivent tels quels dans la liste, et c'est le relecteur qui fait le
   tri — c'est précisément le coût que l'outil devrait supprimer.
3. **Aucune spécialisation métier.** Un livrable Cyber et un livrable Finance
   passent exactement la même revue.

L'objectif de ce chantier : des **agents spécialisés** exécutés en parallèle, une
**boucle de vérification** bornée qui challenge les résultats avant de les
afficher, et des **packs métier** qui rendent la service line réellement
signifiante.

## Ce que « agentique » veut dire ici — et ce que ça ne veut pas dire

Un agent, dans ce projet, est **une définition déclarative** : un prompt
spécialisé, son modèle, ses paramètres, son analyseur de réponse, sa portée
(lot de pages ou document entier). Un sous-agent = un appel indépendant à
Ollama, pas un processus ni un acteur.

Ce que le plan n'introduit pas, volontairement :

- **Pas de framework** (LangChain, LangGraph). Un orchestrateur maison de
  ~200 lignes reste lisible, débogable et testable ; un graphe générique
  n'apporterait ici que de l'indirection.
- **Pas de tool calling.** Les agents ne peuvent rien invoquer. Ils reçoivent du
  texte, ils renvoient du JSON. Cela reste vrai après ce chantier.
- **Pas de boucle non bornée.** Le modèle ne décide pas quand s'arrêter : le
  nombre de passes est fixé par la politique, pas par le modèle. Une boucle
  libre sur un modèle local, c'est quarante minutes brûlées sans garantie.

## Le coût, à regarder en face

Cinq agents au lieu d'un prompt multiplient les appels par cinq. Sur un document
de 40 pages en lots de 2, on passe de 20 appels à 100, plus la vérification.
À 20 s l'appel, 7 minutes deviennent 35.

**Le parallélisme ne sauve pas cela.** Ollama sérialise les requêtes au-delà de
`OLLAMA_NUM_PARALLEL`, et deux requêtes concurrentes sur un 12B se disputent la
même VRAM. Le parallélisme côté client est une commodité d'ordonnancement, pas
un gain de débit garanti.

Quatre leviers, à implémenter dès le lot A :

| Levier | Effet |
| --- | --- |
| **Modèles étagés** — orthographe/grammaire sur `gemma3:4b`, clarté/ton/cohérence sur `gemma3:12b` | Les agents mécaniques coûtent 3 à 4× moins cher |
| **Groupement par modèle** | Ollama décharge et recharge un modèle à chaque changement : alterner 4b/12b appel après appel provoque un va-et-vient permanent. Les tâches sont donc triées par modèle |
| **Taille de lot par agent** | L'orthographe se juge phrase par phrase : elle avale 6 pages d'un coup. Le ton demande du contexte : il en prend 2 |
| **Pré-filtres locaux** | Un agent peut déclarer un `preFilter(sentences)` qui réduit ce qu'on envoie (exemple : ne soumettre à l'orthographe que les phrases contenant un mot hors dictionnaire) |

Le gain visé n'est **pas** la vitesse : c'est la précision. Le plan l'assume, et
le lot D le mesure au lieu de le supposer.

## Architecture cible

```
src/agents/
  types.js            forme d'un agent + validation
  registry.js         agents disponibles selon les critères et le pack métier
  builtins/
    mechanical.js       orthographe + grammaire (modèle rapide)
    editorial.js        clarté + ton (modèle principal)
    consistency.js      portée document
    custom.js           checks personnalisés de l'utilisateur
  critic.js           agent de vérification
  domains/
    audit.js  cyber.js  finance.js  tax.js      packs métier
src/services/
  orchestrator.js     plan → exécution → vérification → consolidation
  scheduler.js        pool borné, groupement par modèle, retries
  analysisService.js  conservé : prompts de base, normalisation, score
```

### Forme d'un agent

```js
{
  id: 'spelling',
  label: 'Spelling',
  skill: 'spelling',            // rattachement au filtre « By type » existant
  scope: 'batch',               // 'batch' | 'document'
  model: 'fast',                // 'fast' | 'main' — résolu par les réglages
  pagesPerBatch: 6,
  temperature: 0.1,
  preFilter: (sentences) => …,  // optionnel
  buildPrompt: (ctx) => string, // ctx : phrases, langue, type de doc, glossaire
  parse: (raw) => candidates,   // défaut : le schéma actuel { findings: [...] }
}
```

`consistency` devient un agent de portée `document` : il reprend tel quel
`selectConsistencyCandidates` et `buildConsistencyPrompt`
(`analysisService.js`), sans réécriture.

### Boucle de raisonnement

```
1. PLAN        agents retenus × lots → liste de tâches, triées par modèle
2. EXÉCUTION   pool borné ; chaque tâche streame ses candidats (scanCompleteObjects)
3. FUSION      dédoublonnage par phrase + critère ; deux agents sur la même
               phrase = un seul finding, confiance renforcée
4. VÉRIFICATION un appel critique par paquet de ~12 candidats :
               garder / écarter / ajuster, avec justification
5. RELANCE     optionnelle et bornée à un tour : uniquement les candidats
               écartés avec une justification faible
6. DOCUMENT    agents de portée document (cohérence inter-pages)
7. FINAL       score, tri, provenance
```

Les étapes 3 à 5 sont la boucle de raisonnement. Elle est **bornée par
construction** : un tour de vérification, un tour de relance au maximum.

### Contrat du critique

Le critique reçoit le candidat *et la phrase d'origine*, jamais le raisonnement
de l'agent — sinon il l'approuve par mimétisme.

```json
{ "verdicts": [ { "id": "c12", "verdict": "keep|drop|adjust",
                  "priority": "low|medium|high", "confidence": 0.0,
                  "reason": "une phrase" } ] }
```

Politiques disponibles, réglables dans l'interface :

- `off` — pas de vérification (comportement actuel)
- `uncertain` *(défaut)* — vérifie sous 0,8 de confiance et tout ce qui est `high`
- `all` — vérifie tout, le plus coûteux

### Packs métier

Un pack = une composition, pas un nouveau moteur :

```js
{
  id: 'cyber',
  label: 'Cyber Security',
  agents: ['grammar', 'spelling', 'clarity', 'consistency', 'cyber-severity',
           'cyber-evidence'],
  glossary: ['CVE', 'CVSS', 'SOC', 'EDR', 'IOC'],   // jamais signalés comme fautes
  severityPolicy: { unsupportedClaim: 'high' },
  systemAddendum: '…contexte propre au métier…',
}
```

Exemples d'agents propres à un pack :

- **Cyber** — `cyber-severity` : une criticité annoncée doit être justifiée par
  un score ou un impact ; `cyber-evidence` : toute affirmation de vulnérabilité
  doit citer une preuve.
- **Finance** — `finance-figures` : cohérence des montants, unités, devises,
  périodes ; `finance-hedging` : repérer les affirmations non nuancées là où la
  prudence est requise.

Le sélecteur *Service line* déjà présent dans `TopBar` et `AnalysisConfig`
devient le sélecteur de pack : plus une décoration.

## Impacts sur l'existant

- **Findings** : trois champs de provenance — `agent`, `verified`, `verdict`,
  plus `confidenceBefore` quand le critique a ajusté. `normaliseFinding` reste
  la porte d'entrée unique et gagne ces champs.
- **Interface** : la progression devient une matrice agent × lot (`Spelling ✓`,
  `Grammar 3/8`, `Tone en attente`) ; un badge sur la carte indique l'agent et
  la vérification ; le panneau « By type » et la relance par critère survivent,
  un critère correspondant à un agent.
- **Export Excel** : deux colonnes de plus, agent et statut de vérification.
- **Réglages** : politique de vérification, concurrence, modèle rapide et modèle
  principal.
- **Rien à changer** côté extraction, visualiseur, ancres, OCR, triage.

## Risques

| Risque | Traitement |
| --- | --- |
| Temps d'analyse multiplié | Modèles étagés, pré-filtres, lots par agent, mesure au lot D |
| Va-et-vient de modèles dans Ollama | Tâches groupées par modèle ; documenter `OLLAMA_MAX_LOADED_MODELS` |
| Critique complaisant qui ne rejette jamais | Le taux de rejet est affiché ; un critique à 0 % est un critique inutile, on le voit tout de suite |
| Régressions invisibles (sorties non déterministes) | Le faux serveur de tests rejoue des réponses enregistrées ; les fonctions de fusion et de politique sont pures et testées |
| Fenêtre de contexte des agents « document » | Les candidats sont déjà plafonnés à 120 phrases par `selectConsistencyCandidates` |

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **A** | Abstraction d'agent, registre, ordonnanceur (pool borné, groupement par modèle), portage des 5 critères actuels en agents. **Objectif : aucun changement de comportement**, vérifié en rejouant les mêmes fixtures | ~2,5 j |
| **B** | Boucle de vérification : agent critique, politiques, fusion, provenance, badges, colonnes Excel, progression par agent | ~2 j |
| **C** | Packs métier : structure, packs Audit / Cyber / Finance / Tax, branchement du sélecteur de service line, glossaires | ~2 j |
| **D** | Banc d'évaluation : petit corpus annoté, script mesurant précision, rappel et durée par configuration ; réglage des couples agent/modèle | ~1,5 j |

Total ≈ 8 jours. Le lot A ne doit rien changer aux résultats : c'est ce qui rend
les lots suivants mesurables.

## Vérification

- `npm test` — fonctions pures ajoutées : sélection des tâches, groupement par
  modèle, fusion des doublons, application des politiques de vérification,
  parsing des verdicts.
- Faux serveur Ollama (`scratchpad/fake-ollama.js`) étendu pour répondre
  différemment selon l'agent détecté dans le prompt, et journaliser les appels :
  on vérifie l'ordre, le groupement par modèle et le respect de la concurrence.
- Parcours navigateur : analyse complète avec vérification active, progression
  par agent, badges de provenance, export Excel contenant les deux colonnes.
- Comparaison lot A : même document, même fixture, findings identiques avant et
  après le refactor.

## Décisions actées

1. **Granularité : deux agents groupés.** Un agent « mécanique » (orthographe +
   grammaire) sur le modèle rapide, un agent « rédactionnel » (clarté + ton) sur
   le modèle principal, plus la cohérence en portée document — soit 3 appels par
   lot au lieu de 5. Le dégroupage reste possible sans refonte : la forme d'agent
   accepte déjà plusieurs `skills`, et le lot D dira s'il apporte quelque chose.

2. **Vérification : `uncertain` par défaut.** Le critique revoit les findings
   sous 0,8 de confiance et tous ceux marqués `high`. Les politiques `off` et
   `all` restent accessibles dans les réglages.

3. **Packs métier : figés dans le code**, dans `src/agents/domains/*.js`. Ils sont
   versionnés, relus en revue de code, et ne stockent rien — conforme à la règle
   de non-persistance. Ajouter un pack passe par une modification de code.
