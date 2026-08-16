# Plan — API externe (DeepSeek) + déploiement Vercel protégé

## Contexte

L'app est aujourd'hui un SPA 100 % client (Vite, aucun backend) qui parle à
Ollama tournant sur la même machine, via le proxy de dev
(`vite.config.js` → `/ollama`). Ce modèle marche en local ; il ne survit pas
à un déploiement web :

- Une clé API DeepSeek ne peut **jamais** être envoyée au navigateur. Les
  variables `VITE_*` sont injectées dans le bundle JS livré au client — donc
  publiques. Une clé doit rester **côté serveur**, jamais préfixée `VITE_`.
- Ollama tourne sur *ta* machine. Un serveur Vercel distant ne peut pas
  l'atteindre. En production, DeepSeek devient donc le seul fournisseur —
  décidé.
- Le site va être exposé publiquement avec un service payant derrière : il
  faut une porte d'entrée avant que quiconque n'atteigne l'app.

Ce chantier ajoute donc trois choses qui n'existent pas dans le repo : un
**backend minimal** (fonctions serverless Vercel), une **couche
d'authentification** (mot de passe partagé), et une **abstraction fournisseur**
côté client pour parler à DeepSeek en plus d'Ollama.

## Décisions actées

1. **Hébergement : Vercel.** Pas de `.htaccess` (spécifique Apache) — Vercel
   sert des fonctions serverless Node.js et un middleware d'edge, sans accès à
   un vrai nginx/Apache. L'équivalent fonctionnel : `middleware.js` à la racine.
2. **Ollama : local-dev uniquement.** `npm run dev` sur ta machine continue
   d'utiliser Ollama comme aujourd'hui. Une fois déployé sur Vercel, seul
   DeepSeek est disponible.
3. **Authentification : mot de passe unique partagé.** Une variable d'env
   `SITE_PASSWORD`, une page de connexion, un cookie de session signé. Pas de
   compte, pas de base de données utilisateurs.

## Architecture cible

```
api/
  login.js         POST { password } → cookie de session signé, ou 401
  logout.js        efface le cookie
  chat.js           proxy vers DeepSeek, clé lue côté serveur uniquement
middleware.js       vérifie le cookie sur toutes les routes sauf /login*
public/
  login.html         page de connexion statique (hors bundle React)
  login.js
src/
  config/
    providers.js       liste des fournisseurs : ollama (local) | deepseek (cloud)
  services/
    providers/
      ollamaProvider.js    logique actuelle de ollamaClient.js, déplacée telle quelle
      deepseekProvider.js  nouveau : appelle /api/chat, parse le flux SSE OpenAI
  components/
    ProviderSettings.js    remplace/étend OllamaSettings.jsx : sélecteur de fournisseur
    ExternalApiNotice.jsx  bandeau + confirmation au premier lancement sur DeepSeek
vercel.json           réécritures SPA, exclusion de /api du fallback
.env.example           documente les variables attendues (jamais commit .env réel)
```

### Pourquoi une abstraction fournisseur

`analysisService.js` appelle aujourd'hui `chatJson(baseUrl, {...})` défini dans
`ollamaClient.js`. Le format de flux diffère entre les deux fournisseurs :

- **Ollama** : NDJSON, une ligne JSON par étape (`{"message":{"content":"…"}}`).
- **DeepSeek** (compatible OpenAI) : SSE, `data: {"choices":[{"delta":{"content":"…"}}]}\n\n`,
  terminé par `data: [DONE]`.

`ollamaProvider.js` et `deepseekProvider.js` exposent la même interface
(`listModels`, `chatJson`) ; seul le parsing du flux change. `analysisService.js`,
`scanCompleteObjects` et toute la logique d'analyse restent **inchangés** — ils
consomment déjà des tokens de texte au fil de l'eau, peu importe leur origine.

### Backend — `api/chat.js`

- Vérifie le cookie de session (défense en profondeur : le middleware protège
  déjà la route, mais une fonction invoquée directement doit se protéger
  elle-même).
- Lit `DEEPSEEK_API_KEY` dans `process.env` — jamais renvoyée au client.
- Transmet `{ model, messages, temperature, stream }` à
  `https://api.deepseek.com/chat/completions`, relaie le flux SSE tel quel.

### Authentification — `middleware.js` + `api/login.js`

- `middleware.js` (Edge Middleware Vercel) intercepte toutes les routes sauf
  `/login.html`, `/login.js`, `/api/login`, les assets statiques. Vérifie un
  cookie HMAC signé (`SESSION_SECRET`), `HttpOnly`, `Secure`, `SameSite=Strict`.
  Redirige vers `/login.html` si absent ou invalide.
- `login.html` est une page statique **hors du bundle React** : un visiteur non
  authentifié ne télécharge jamais l'app, juste ce formulaire.
- `api/login.js` : comparaison à temps constant du mot de passe
  (`crypto.timingSafeEqual`), pose le cookie signé si correct.

**Anti-brute-force** — un point à trancher techniquement à l'implémentation :
les fonctions Vercel sont sans état entre invocations, donc un compteur de
tentatives « en mémoire » ne protège rien de fiable. Deux options :

| Option | Protection | Coût |
| --- | --- | --- |
| **Vercel KV / Upstash Redis** (recommandé) | Vrai compteur partagé, verrouillage temporaire après N échecs | Ajoute une dépendance et un service (gratuit en petit volume) |
| **Délai fixe + comparaison à temps constant, sans stockage** | Ralentit le brute-force sans l'empêcher ; contournable en changeant d'IP | Zéro dépendance |

Je recommande Vercel KV — la mise en place est petite (un `kv.incr` avec TTL) et
c'est la seule option qui protège réellement. Décision à confirmer.

### Confidentialité — bandeau et confirmation

Dès que le fournisseur actif est DeepSeek :

- Un bandeau permanent (même emplacement que le badge « Local model » /
  « Demo data » actuel) indique « DeepSeek (cloud) » au lieu de « Local model ».
- Au premier lancement d'une analyse sur DeepSeek dans la session, une boîte de
  confirmation explicite : *« Le texte du document va être envoyé à DeepSeek
  (hors de cette machine). Continuer ? »*, avec un choix « ne plus demander pour
  cette session ».

### Ce qui ne change pas

`documentParser.js`, les visualiseurs, les ancres de position, l'OCR, le
triage, l'export Excel — rien ne dépend du fournisseur. Le pipeline d'analyse
(`runOllamaAnalysis` → à généraliser en `runAnalysis`) reste le même
enchaînement de lots et de prompts, juste routé vers l'un ou l'autre provider.

## Variables d'environnement

```bash
# .env.example — à documenter, jamais committer .env réel
DEEPSEEK_API_KEY=      # côté serveur uniquement, jamais VITE_*
SITE_PASSWORD=         # mot de passe partagé du site déployé
SESSION_SECRET=        # clé de signature des cookies de session (aléatoire, longue)
KV_URL=                # si Vercel KV retenu pour le rate limiting
```

Sur Vercel, ces variables se configurent dans le tableau de bord du projet
(Settings → Environment Variables), pas dans un fichier commité.

## Lots

| Lot | Contenu | Effort |
| --- | --- | --- |
| **A** | `api/login.js`, `api/logout.js`, `middleware.js`, `login.html` — authentification fonctionnelle, testable avec `vercel dev` | ~1 j |
| **B** | `api/chat.js`, `deepseekProvider.js`, généralisation de `analysisService.js` en multi-fournisseur, `ollamaProvider.js` (refactor sans changement de comportement) | ~1,5 j |
| **C** | UI : sélecteur de fournisseur, bandeau et confirmation de confidentialité, retrait du fournisseur DeepSeek de la sélection en dev local | ~0,5 j |
| **D** | Anti-brute-force (Vercel KV), `vercel.json`, `.env.example`, doc de déploiement | ~0,5 j |

Total ≈ 3,5 jours.

## Vérification

- `vercel dev` en local pour tester le couple middleware + login sans déployer.
- `npm test` — fonctions pures ajoutées : parsing SSE DeepSeek, validation de
  cookie signé (fonction séparée, testable hors requête HTTP).
- Parcours navigateur : accès sans cookie → redirection login ; mauvais mot de
  passe → 401 sans fuite d'info ; bon mot de passe → accès à l'app ; bascule
  Ollama ↔ DeepSeek dans les réglages ; bandeau de confidentialité affiché ;
  export Excel identique quel que soit le fournisseur.
- Vérifier au réseau (DevTools) qu'aucune clé n'apparaît jamais dans une
  requête émise par le navigateur.

## Restant à trancher

1. **Anti-brute-force** — Vercel KV (protection réelle, +1 dépendance) ou délai
   fixe sans stockage (protection partielle, zéro dépendance) ?
2. **Modèle DeepSeek** — `deepseek-chat` (généraliste) ou `deepseek-reasoner` (plus
   lent, raisonnement visible) ? Le premier est le choix par défaut naturel pour
   une tâche de relecture.
