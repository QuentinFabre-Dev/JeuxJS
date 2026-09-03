/** @type {import('next').NextConfig} */
const nextConfig = {
  // The document parsers are browser-only (pdfjs paints on a canvas, tesseract
  // runs a WASM worker). They are loaded through a dynamic import with SSR
  // disabled, so nothing here needs a server-side shim.
  //
  // Excel export pulls a large dependency tree; keeping it external to the
  // server bundle keeps cold starts short.
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
