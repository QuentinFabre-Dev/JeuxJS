/**
 * Copies the worker files this app serves itself into `public/`.
 *
 * Nothing is fetched from a CDN at runtime: the app must keep working on a
 * machine with no outbound access, and a document being reviewed must not leak
 * a request to a third party. Run this after bumping `pdfjs-dist`.
 */
import { copyFileSync, mkdirSync } from 'node:fs';

const assets = [['node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdfjs/pdf.worker.min.mjs']];

mkdirSync('public/pdfjs', { recursive: true });
for (const [from, to] of assets) {
  copyFileSync(from, to);
  console.log(`✔ ${to}`);
}
