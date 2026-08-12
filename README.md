# Ryder — document QA with a local AI model

React + Vite app that audits a document (PDF, DOCX, TXT, MD) and returns
categorised, prioritised findings. The analysis runs on a **local Ollama
model**: the file is parsed in the browser and the text is sent only to
`localhost`. Nothing leaves the machine.

The old ZombieLand game lives in [`legacy/MBUFFAproject`](legacy/MBUFFAproject).

## Quick start

```bash
# 1. Install Ollama and a model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b

# 2. Run the app
npm install
npm run dev          # http://localhost:5173
```

The badge in the header shows the connection state. Green (`Local model`) means
you can upload a document and hit **Analyse**.

## How it works

1. **Parsing (browser).** `src/services/documentParser.js` extracts text with
   `pdfjs-dist` (PDF), `mammoth` (DOCX) or plain read (TXT/MD), splits it into
   sentences and pages, and builds the model shown in the preview panel.
2. **Analysis (local).** `src/services/analysisService.js` sends the document
   page batch by page batch to `/api/chat` with `format: "json"`. Every sentence
   carries an id (`p2s5`); the model answers with those ids, so the sentence
   displayed and highlighted is always the exact one extracted from the file,
   even when the model paraphrases.
3. **Streaming.** The NDJSON response is scanned as it arrives, so findings pop
   into the list one by one instead of all at the end.
4. **Rendering.** Findings are normalised (unknown ids, unknown skills,
   suggestions identical to the original and duplicates are dropped), then fed to
   the existing UI: score, priority distribution, per-type counts and the
   clickable document preview.

## Configuration

Everything is editable at runtime from the header badge — engine, model,
endpoint, temperature, context size, pages per request. The choice is stored in
`localStorage`.

| Setting | Default | Notes |
| --- | --- | --- |
| Engine | `Ollama (local)` | `Demo data` replays the mocked findings, useful for a client demo without a model |
| Model | `llama3.1:8b` | The dropdown lists what is actually installed |
| Endpoint | `/ollama` | Goes through the Vite proxy — no CORS setup |
| Temperature | `0.2` | Low = stable, repeatable reviews |
| Context | `8192` | Raise it for dense pages |
| Pages / call | `2` | Fewer pages = more requests, better accuracy |

Server-side defaults live in `.env` (copy `.env.example`):

```bash
OLLAMA_HOST=http://127.0.0.1:11434   # proxy target, see vite.config.js
```

To call Ollama directly instead of through the proxy, set the endpoint to
`http://localhost:11434` in the settings dialog and start the server with
`OLLAMA_ORIGINS=* ollama serve`.

## Custom checks

Beyond the five built-in skills (grammar, spelling, consistency, clarity, tone),
type any requirement in **Add a custom check** — "GDPR compliance", "no client
name in the body", "figures must match the appendix". It is injected into the
prompt and produces findings tagged with that label.

## Model choice

| Model | RAM | Profile |
| --- | --- | --- |
| `llama3.1:8b` | 8–16 GB | Default, good balance |
| `qwen2.5:14b` | 16–32 GB | Stricter reviews, slower |
| `mistral:7b` | 8 GB | Fast, lighter on nuance |
| `llama3.2:3b` | 4–8 GB | Small machines, expect misses |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot reach Ollama` | Start `ollama serve`, then restart `npm run dev` |
| `Model "…" is not installed` | `ollama pull <model>`, then hit **Retest** |
| No text extracted from a PDF | Scanned document — run OCR first |
| Analysis is slow | Smaller model, or raise **Pages / call** |
| Findings look shallow | Larger model, lower temperature, fewer pages per call |
