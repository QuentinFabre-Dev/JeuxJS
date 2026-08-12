import { withLineNumbers } from "./collect.js";

export const SYSTEM_PROMPT = `Tu es un ingénieur QA senior spécialisé en JavaScript front-end (jeux Canvas, sans framework ni build).
Tu réalises la revue de qualité d'un livrable étudiant.

Règles absolues :
- Tu réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.
- Tu écris en français.
- Tu ne signales que des problèmes que tu peux justifier par le code fourni. Aucune invention.
- Chaque problème doit être actionnable : ce qui ne va pas, où, et comment le corriger.
- Si le fichier est correct, renvoie une liste de problèmes vide plutôt que d'inventer des remarques.`;

const FILE_SCHEMA = `{
  "resume": "une à deux phrases sur le rôle et l'état du fichier",
  "score": 0-100,
  "points_forts": ["..."],
  "problemes": [
    {
      "titre": "court intitulé",
      "gravite": "critique | majeur | mineur | info",
      "ligne": numéro de ligne concerné ou null,
      "description": "ce qui ne va pas et pourquoi",
      "correction": "correction concrète à appliquer"
    }
  ]
}`;

export function buildFilePrompt({ file, checklist, projectContext }) {
  return `Contexte du projet :
${projectContext}

Grille de QA à appliquer :
---
${checklist}
---

Fichier à auditer : ${file.path} (${file.lines} lignes, ${file.bytes} octets)${
    file.truncated ? " — CONTENU TRONQUÉ, n'émets pas de conclusion sur la fin du fichier" : ""
  }

Le code est préfixé par des numéros de ligne (format "  12 | code"). Ces numéros
ne font pas partie du code : sers-t'en uniquement pour situer tes remarques.

\`\`\`
${withLineNumbers(file.content)}
\`\`\`

Réponds avec cet objet JSON exact :
${FILE_SCHEMA}`;
}

export function buildSynthesisPrompt({ results, checklist, projectContext }) {
  const digest = results
    .map((r) => {
      const issues = r.problemes
        .map((p) => `    - [${p.gravite}] ${p.titre}${p.ligne ? ` (ligne ${p.ligne})` : ""} : ${p.description}`)
        .join("\n");
      return `- ${r.path} (score ${r.score}) : ${r.resume}\n${issues || "    - aucun problème relevé"}`;
    })
    .join("\n");

  return `Contexte du projet :
${projectContext}

Grille de QA appliquée :
---
${checklist}
---

Voici les constats fichier par fichier issus de l'audit :
${digest}

Rédige la synthèse de recette de ce livrable. Regroupe les problèmes récurrents,
hiérarchise par impact réel sur le jeu, et propose un plan d'action ordonné.

Réponds avec cet objet JSON exact :
{
  "synthese": "3 à 6 phrases sur l'état global du livrable",
  "score_global": 0-100,
  "verdict": "conforme | à corriger | non conforme",
  "risques_majeurs": ["..."],
  "plan_action": [
    { "priorite": 1, "action": "...", "fichiers": ["chemin/fichier.js"] }
  ]
}`;
}

export const PROJECT_CONTEXT = `ZombieLand — jeu de survie 2D en JavaScript vanilla rendu dans un <canvas>.
Aucun bundler, aucun framework, aucune dépendance npm : tous les scripts de JS/
sont chargés par des balises <script> dans jeux.html et partagent le scope global.
Le joueur repousse des vagues de zombies, tire, recharge, ramasse des bonus.
Livrable étudiant évalué sur le fonctionnement, la robustesse et la lisibilité.`;
