# JeuxJS

Dépôt du projet **ZombieLand** (`MBUFFAproject/`) et de son outillage de QA locale.

## Lancer le jeu

```bash
npm run serve   # puis http://localhost:8080
```

## QA du livrable avec un modèle Ollama local

```bash
npm run qa:check   # vérifie qu'Ollama et le modèle répondent
npm run qa         # audite le livrable et écrit le rapport dans qa-reports/
```

Guide complet (installation d'Ollama, choix du modèle, options, dépannage) :
[docs/QA-OLLAMA.md](docs/QA-OLLAMA.md).

## Structure

| Chemin | Rôle |
| --- | --- |
| `MBUFFAproject/` | le jeu (HTML/CSS/JS vanilla, canvas) |
| `qa/` | chaîne de QA : client Ollama, collecte, prompts, rapports |
| `qa/checklist.md` | grille de critères appliquée par le modèle |
| `qa.config.json` | configuration (hôte, modèle, cible, seuils) |
| `tools/serve.js` | serveur statique sans dépendance |
| `qa-reports/` | rapports générés (ignoré par git) |
