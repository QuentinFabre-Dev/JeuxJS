/** @type {import('next').NextConfig} */
const nextConfig = {
  // The document parsers are browser-only (pdfjs paints on a canvas, tesseract
  // runs a WASM worker). They are loaded through a dynamic import with SSR
  // disabled, so nothing here needs a server-side shim.
  //
  // Excel export pulls a large dependency tree; keeping it external to the
  // server bundle keeps cold starts short.
  serverExternalPackages: ['exceljs'],

  // The prompts are Markdown files read from disk at runtime. Nothing imports
  // them, so the bundler cannot see them: they are traced explicitly, or the
  // review route ships without its prompts and fails on the first call.
  outputFileTracingIncludes: {
    '/api/analyze': ['./lib/checks/llm/*.md'],
  },
};

export default nextConfig;
