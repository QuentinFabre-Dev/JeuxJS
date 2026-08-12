import fs from "node:fs";
import path from "node:path";

/** Parcourt le dossier livrable et renvoie les fichiers texte à analyser. */
export function collectFiles(cfg) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (cfg.ignore.includes(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!cfg.extensions.includes(path.extname(entry.name).toLowerCase())) continue;

      const rel = path.relative(cfg.targetDir, abs);
      if (cfg.only && !rel.toLowerCase().includes(String(cfg.only).toLowerCase())) continue;

      const raw = fs.readFileSync(abs, "utf8");
      const truncated = raw.length > cfg.maxFileBytes;
      const content = truncated ? raw.slice(0, cfg.maxFileBytes) : raw;
      files.push({
        path: rel.split(path.sep).join("/"),
        absPath: abs,
        ext: path.extname(entry.name).toLowerCase(),
        bytes: Buffer.byteLength(raw, "utf8"),
        lines: raw.split("\n").length,
        truncated,
        content,
      });
    }
  }

  walk(cfg.targetDir);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

/** Numérote les lignes pour que le modèle puisse citer des emplacements précis. */
export function withLineNumbers(content) {
  return content
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}
