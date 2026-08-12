# QA locale du livrable avec Ollama

Chaîne de recette automatisée : le code de `MBUFFAproject/` est envoyé à un
modèle qui tourne **sur votre machine** via [Ollama](https://ollama.com), et le
résultat est un rapport de QA (Markdown, HTML et JSON).

Aucune dépendance npm, aucun appel à un service distant : Node 18+ et Ollama suffisent.

## 1. Installer Ollama et un modèle

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Le serveur tourne sur http://127.0.0.1:11434
ollama serve            # inutile si le service est déjà lancé

# Modèle recommandé pour de la revue de code (≈4,7 Go)
ollama pull qwen2.5-coder:7b
```

Autres modèles selon votre machine :

| Modèle | RAM conseillée | Usage |
| --- | --- | --- |
| `qwen2.5-coder:1.5b` | 4 Go | très rapide, revue superficielle |
| `qwen2.5-coder:7b` | 8–16 Go | **défaut, bon compromis** |
| `qwen2.5-coder:14b` | 16–32 Go | analyse plus fine, plus lent |
| `llama3.1:8b` | 8–16 Go | généraliste |

## 2. Vérifier le branchement

```bash
npm run qa:models   # liste les modèles installés
npm run qa:check    # teste connexion + modèle + réponse JSON
```

`qa:check` doit afficher `La chaîne de QA est prête.`

## 3. Lancer la QA

```bash
npm run qa
```

Déroulé : chaque fichier de `MBUFFAproject/` (`.js`, `.html`, `.css`, `.md`) est
audité individuellement, puis une synthèse globale est générée à partir de tous
les constats. Comptez environ 10 à 40 s par fichier avec un modèle 7B.

Les rapports sont écrits dans `qa-reports/` (ignoré par git) :

- `rapport-AAAA-MM-JJ-HH-mm.md` — rapport complet en Markdown
- `rapport-AAAA-MM-JJ-HH-mm.html` — même rapport à ouvrir dans le navigateur
- `rapport-AAAA-MM-JJ-HH-mm.json` — données brutes (exploitables en CI)
- `dernier-rapport.md` — copie du dernier passage

## 4. Options

```bash
npm run qa -- --model qwen2.5-coder:14b   # changer de modèle ponctuellement
npm run qa -- --only perso.js             # n'auditer que les fichiers correspondants
npm run qa -- --target MBUFFAproject/JS   # changer le dossier livrable
npm run qa -- --concurrency 2             # paralléliser (attention à la RAM)
npm run qa -- --no-synthesis              # sauter la synthèse globale
npm run qa -- --strict                    # code de sortie 2 si problème critique/majeur
npm run qa -- --host http://192.168.1.20:11434  # Ollama sur une autre machine
```

Variables d'environnement équivalentes : `OLLAMA_HOST`, `OLLAMA_MODEL`, `QA_TARGET`.

## 5. Configuration persistante

Éditez `qa.config.json` :

| Clé | Rôle |
| --- | --- |
| `host` | URL du serveur Ollama |
| `model` | modèle utilisé par défaut |
| `target` | dossier du livrable à auditer |
| `extensions` / `ignore` | fichiers pris en compte ou exclus |
| `maxFileBytes` | troncature des gros fichiers |
| `numCtx` | taille de contexte (à augmenter pour les gros fichiers) |
| `temperature` | 0.1 par défaut : réponses stables |
| `timeoutMs` | délai max par requête |
| `checklist` | grille de critères injectée dans le prompt |

## 6. Adapter les critères de QA

`qa/checklist.md` contient la grille appliquée par le modèle (correction
fonctionnelle, robustesse, lisibilité, HTML/CSS/accessibilité, documentation).
C'est un simple Markdown : ajoutez ou retirez des critères, ils sont repris tels
quels dans le prompt au passage suivant.

## 7. Jouer au jeu en local

```bash
npm run serve            # http://localhost:8080
npm run serve -- --port 3000
```

## Dépannage

| Symptôme | Cause probable | Correctif |
| --- | --- | --- |
| `Impossible de joindre Ollama` | serveur arrêté | `ollama serve` |
| `Le modèle "…" n'est pas installé` | modèle absent | `ollama pull <modèle>` |
| `Délai dépassé` | modèle trop lourd | modèle plus petit ou `timeoutMs` plus grand |
| `n'a pas renvoyé de JSON exploitable` | modèle non instruct | utiliser `qwen2.5-coder` ou `llama3.1` |
| Analyse tronquée | fichier > `maxFileBytes` | augmenter `maxFileBytes` **et** `numCtx` |
| Machine qui rame | parallélisme trop élevé | `concurrency: 1` |
