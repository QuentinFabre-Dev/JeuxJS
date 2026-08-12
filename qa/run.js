#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config.js";
import { collectFiles } from "./collect.js";
import { chatJson, ensureModel, listModels, OllamaError } from "./ollama.js";
import { buildFilePrompt, buildSynthesisPrompt, PROJECT_CONTEXT, SYSTEM_PROMPT } from "./prompts.js";
import { buildHtml, buildMarkdown, countBySeverity } from "./report.js";

const SEVERITIES = ["critique", "majeur", "mineur", "info"];

function log(message = "") {
  process.stdout.write(`${message}\n`);
}

function clampScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 50;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

/** Le modèle reste un modèle : on normalise sa sortie avant de l'exploiter. */
function normalizeFileResult(raw, file) {
  const problemes = toArray(raw?.problemes)
    .filter((p) => p && (p.titre || p.description))
    .map((p) => {
      const gravite = String(p.gravite ?? "info").toLowerCase().trim();
      const ligne = Number(p.ligne);
      return {
        titre: String(p.titre ?? "Problème").trim(),
        gravite: SEVERITIES.includes(gravite) ? gravite : "info",
        ligne: Number.isInteger(ligne) && ligne > 0 && ligne <= file.lines ? ligne : null,
        description: String(p.description ?? "").trim(),
        correction: String(p.correction ?? "Non précisée.").trim(),
      };
    });

  return {
    path: file.path,
    lines: file.lines,
    truncated: file.truncated,
    score: clampScore(raw?.score),
    resume: String(raw?.resume ?? "").trim() || "Pas de résumé fourni par le modèle.",
    points_forts: toArray(raw?.points_forts).map((s) => String(s).trim()).filter(Boolean),
    problemes,
  };
}

function normalizeSynthesis(raw, results) {
  if (!raw) return null;
  const fallbackScore = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;
  const verdict = String(raw.verdict ?? "").toLowerCase().trim();
  return {
    synthese: String(raw.synthese ?? "").trim() || "Synthèse non fournie par le modèle.",
    score_global: clampScore(raw.score_global ?? fallbackScore),
    verdict: ["conforme", "à corriger", "a corriger", "non conforme"].includes(verdict)
      ? verdict.replace("a corriger", "à corriger")
      : "à corriger",
    risques_majeurs: toArray(raw.risques_majeurs).map((s) => String(s).trim()).filter(Boolean),
    plan_action: toArray(raw.plan_action)
      .filter(Boolean)
      .map((step, i) => ({
        priorite: Number.isFinite(Number(step.priorite)) ? Number(step.priorite) : i + 1,
        action: String(step.action ?? "").trim(),
        fichiers: toArray(step.fichiers).map((f) => String(f).trim()).filter(Boolean),
      }))
      .filter((step) => step.action)
      .sort((a, b) => a.priorite - b.priorite),
  };
}

/** Exécute `worker` sur chaque élément avec au plus `limit` tâches simultanées. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function cmdModels(cfg) {
  const models = await listModels(cfg);
  if (!models.length) {
    log(`Aucun modèle installé sur ${cfg.host}. Lancez : ollama pull ${cfg.model}`);
    return 1;
  }
  log(`Modèles disponibles sur ${cfg.host} :`);
  for (const model of models) {
    const size = model.size ? ` (${(model.size / 1e9).toFixed(1)} Go` : " (";
    log(`  - ${model.name}${size}${model.parameterSize ? `, ${model.parameterSize}` : ""})`);
  }
  return 0;
}

async function cmdCheck(cfg) {
  log(`Hôte Ollama : ${cfg.host}`);
  const models = await listModels(cfg);
  log(`✔ Ollama répond (${models.length} modèle(s) installé(s)).`);
  const resolved = await ensureModel(cfg);
  log(`✔ Modèle "${resolved}" disponible.`);
  const probe = await chatJson(cfg, {
    system: SYSTEM_PROMPT,
    user: 'Réponds exactement par : {"ok": true}',
  });
  log(`✔ Réponse JSON reçue en ${probe.durationMs} ms : ${JSON.stringify(probe.data)}`);
  log("");
  log("La chaîne de QA est prête. Lancez : npm run qa");
  return 0;
}

async function cmdRun(cfg) {
  const startedAt = Date.now();

  await ensureModel(cfg);
  const files = collectFiles(cfg);
  if (!files.length) {
    log(`Aucun fichier à analyser dans ${cfg.targetDir}${cfg.only ? ` (filtre "${cfg.only}")` : ""}.`);
    return 1;
  }

  const checklist = fs.existsSync(cfg.checklistPath)
    ? fs.readFileSync(cfg.checklistPath, "utf8")
    : "Applique une revue de code JavaScript standard.";

  log(`QA de ${cfg.target} — ${files.length} fichier(s), modèle ${cfg.model}`);
  log("");

  const errors = [];
  let done = 0;

  const analysed = await pool(files, cfg.concurrency, async (file) => {
    try {
      const answer = await chatJson(cfg, {
        system: SYSTEM_PROMPT,
        user: buildFilePrompt({ file, checklist, projectContext: PROJECT_CONTEXT }),
      });
      const result = normalizeFileResult(answer.data, file);
      done++;
      log(
        `  [${done}/${files.length}] ${file.path} — ${result.score}/100, ` +
          `${result.problemes.length} problème(s) (${(answer.durationMs / 1000).toFixed(1)}s)`,
      );
      return result;
    } catch (err) {
      done++;
      log(`  [${done}/${files.length}] ${file.path} — échec : ${err.message}`);
      errors.push({ path: file.path, message: err.message });
      return null;
    }
  });

  const results = analysed.filter(Boolean);
  if (!results.length) {
    throw new OllamaError("Aucun fichier n'a pu être analysé.", {
      hint: "Vérifiez le modèle choisi (`npm run qa:check`) et la taille de num_ctx.",
    });
  }

  let synthesis = null;
  if (!cfg.noSynthesis) {
    log("");
    log("  Synthèse globale en cours…");
    try {
      const answer = await chatJson(cfg, {
        system: SYSTEM_PROMPT,
        user: buildSynthesisPrompt({ results, checklist, projectContext: PROJECT_CONTEXT }),
      });
      synthesis = normalizeSynthesis(answer.data, results);
    } catch (err) {
      log(`  Synthèse indisponible : ${err.message}`);
    }
  }

  const report = {
    meta: {
      target: cfg.target,
      host: cfg.host,
      model: cfg.model,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      fileCount: results.length,
    },
    synthesis,
    results,
    errors,
  };

  fs.mkdirSync(cfg.outPath, { recursive: true });
  const stamp = new Date(startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const base = path.join(cfg.outPath, `rapport-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${base}.md`, buildMarkdown(report));
  fs.writeFileSync(`${base}.html`, buildHtml(report));
  fs.writeFileSync(path.join(cfg.outPath, "dernier-rapport.md"), buildMarkdown(report));

  const counts = countBySeverity(results);
  log("");
  log("── Résultat ─────────────────────────────");
  if (synthesis) log(`Verdict : ${synthesis.verdict} (${synthesis.score_global}/100)`);
  log(
    `Problèmes : ${counts.critique} critique(s), ${counts.majeur} majeur(s), ` +
      `${counts.mineur} mineur(s), ${counts.info} info(s)`,
  );
  log(`Rapport  : ${path.relative(process.cwd(), `${base}.md`)}`);
  log(`HTML     : ${path.relative(process.cwd(), `${base}.html`)}`);

  if (cfg.strict && (counts.critique > 0 || counts.majeur > 0)) return 2;
  return 0;
}

async function main() {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    log(`Erreur de configuration : ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    if (cfg.mode === "models") process.exitCode = await cmdModels(cfg);
    else if (cfg.mode === "check") process.exitCode = await cmdCheck(cfg);
    else process.exitCode = await cmdRun(cfg);
  } catch (err) {
    log("");
    log(`✘ ${err.message}`);
    if (err instanceof OllamaError && err.hint) log(`  → ${err.hint}`);
    process.exitCode = 1;
  }
}

main();
