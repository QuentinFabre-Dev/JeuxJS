#!/usr/bin/env node
/**
 * Petit serveur statique sans dépendance, pour ouvrir le jeu dans le navigateur.
 * Usage : npm run serve [-- --port 8080 --dir MBUFFAproject]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const port = Number(arg("port", 8080));
const dir = path.resolve(ROOT, arg("dir", "MBUFFAproject"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const target = path.join(dir, urlPath === "/" ? "index.html" : urlPath);

    // Empêche la sortie du dossier servi (../../etc/passwd).
    if (!target.startsWith(dir)) {
      res.writeHead(403).end("403 Forbidden");
      return;
    }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream" });
    fs.createReadStream(target).pipe(res);
  })
  .listen(port, () => {
    console.log(`Jeu servi depuis ${path.relative(ROOT, dir)} → http://localhost:${port}`);
  });
