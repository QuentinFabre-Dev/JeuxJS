import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  host: "http://127.0.0.1:11434",
  model: "qwen2.5-coder:7b",
  target: "MBUFFAproject",
  outDir: "qa-reports",
  extensions: [".js", ".html", ".css", ".md"],
  ignore: [".git", "node_modules", "qa-reports", "images", "sound_src"],
  maxFileBytes: 60000,
  concurrency: 1,
  temperature: 0.1,
  numCtx: 8192,
  timeoutMs: 300000,
  retries: 2,
  checklist: "qa/checklist.md",
  // Drapeaux positionnés par la ligne de commande
  mode: "run", // run | check | models
  strict: false,
  only: null, // sous-chaîne filtrant les fichiers analysés
  noSynthesis: false,
};

const NUMERIC_KEYS = new Set([
  "maxFileBytes",
  "concurrency",
  "temperature",
  "numCtx",
  "timeoutMs",
  "retries",
]);

function readConfigFile(file) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(abs)) return {};
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    throw new Error(`Fichier de configuration illisible (${abs}) : ${err.message}`);
  }
}

function readEnv() {
  const env = {};
  if (process.env.OLLAMA_HOST) env.host = process.env.OLLAMA_HOST;
  if (process.env.OLLAMA_MODEL) env.model = process.env.OLLAMA_MODEL;
  if (process.env.QA_TARGET) env.target = process.env.QA_TARGET;
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=");
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    if (key === "check") { args.mode = "check"; continue; }
    if (key === "models") { args.mode = "models"; continue; }
    if (key === "strict") { args.strict = true; continue; }
    if (key === "noSynthesis") { args.noSynthesis = true; continue; }

    let value = inlineValue;
    if (value === undefined) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`L'option --${rawKey} attend une valeur.`);
      }
      value = next;
      i++;
    }
    if (NUMERIC_KEYS.has(key)) {
      const num = Number(value);
      if (!Number.isFinite(num)) throw new Error(`--${rawKey} doit être un nombre (reçu "${value}").`);
      value = num;
    }
    args[key] = value;
  }
  return args;
}

export function loadConfig(argv = process.argv.slice(2)) {
  const cli = parseArgs(argv);
  const configFile = cli.config ?? "qa.config.json";
  const cfg = { ...DEFAULTS, ...readConfigFile(configFile), ...readEnv(), ...cli };

  cfg.host = String(cfg.host).replace(/\/+$/, "");
  cfg.targetDir = path.isAbsolute(cfg.target) ? cfg.target : path.join(ROOT, cfg.target);
  cfg.outPath = path.isAbsolute(cfg.outDir) ? cfg.outDir : path.join(ROOT, cfg.outDir);
  cfg.checklistPath = path.isAbsolute(cfg.checklist) ? cfg.checklist : path.join(ROOT, cfg.checklist);
  cfg.concurrency = Math.max(1, Math.trunc(cfg.concurrency));

  if (cfg.mode === "run" && !fs.existsSync(cfg.targetDir)) {
    throw new Error(`Dossier à analyser introuvable : ${cfg.targetDir}`);
  }
  return cfg;
}
