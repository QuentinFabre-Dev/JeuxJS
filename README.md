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

## Reviewing a document

1. **Triage each finding.** Accept (the correction is right) or reject (the model
   is wrong). Only open findings weigh on the quality score, so the score
   reflects what is genuinely left to fix. `j` / `k` move through the list,
   `a` accepts, `r` rejects.
2. **Sort and filter.** Document order by default, or by priority / confidence.
   The confidence slider hides the calls the model was unsure about — useful
   with smaller models.
3. **Export to Excel.** One workbook with a *Summary* sheet (score, counts,
   context), a *Findings* sheet (filterable, with a status dropdown and an empty
   reviewer-comment column) and a *By type* breakdown.

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
4. **Cross-page pass.** Per-batch prompts structurally cannot see that an
   acronym is defined twice or that a figure contradicts page 12. A final pass
   sends an index of the document's headings, figures and acronyms and asks only
   for cross-page inconsistencies.
5. **Rendering.** Findings are normalised (unknown ids, unknown skills,
   suggestions identical to the original and duplicates are dropped), then fed to
   the existing UI: score, priority distribution, per-type counts and the
   clickable document preview.

The document language is detected on upload and injected into the prompt, so a
French document gets French suggestions and French-language conventions. Override
it in the analysis panel if the detection is wrong.

The quality score is normalised by document length: 20 findings in a 2-page memo
and 20 findings in a 100-page report are not the same defect density.

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

## Custom checks and playbooks

Beyond the five built-in skills (grammar, spelling, consistency, clarity, tone),
type any requirement in **Add a custom check** — "GDPR compliance", "no client
name in the body", "figures must match the appendix". It is injected into the
prompt and produces findings tagged with that label.

Save a set of custom checks as a **playbook** to reuse it on the next document;
playbooks are stored locally and carry their service line with them.

Each built-in check can also be **re-run on its own** (the circular arrow in the
*By type* panel): tightening one criterion no longer costs a full re-analysis.

## Model choice

| Model | RAM | Profile |
| --- | --- | --- |
| `llama3.1:8b` | 8–16 GB | Default, good balance |
| `qwen2.5:14b` | 16–32 GB | Stricter reviews, slower |
| `mistral:7b` | 8 GB | Fast, lighter on nuance |
| `llama3.2:3b` | 4–8 GB | Small machines, expect misses |

## Next steps

The next milestone is reviewing **inside the document**: seeing each finding
highlighted at its exact place in the file, editing it there, and downloading a
corrected document (a true round-trip for DOCX; locate-and-annotate for PDF).
Then come word-level diff, bulk actions, a French/English interface and OCR for
scanned PDFs. Each one is specified in
[docs/plan-implementation.md](docs/plan-implementation.md): design, files to
touch, known pitfalls, expected tests and effort.

Nothing about a document is persisted: the extracted text, the findings and the
review live in the tab and are gone when it closes. Only preferences (Ollama
settings, playbooks) are stored locally.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot reach Ollama` | Start `ollama serve`, then restart `npm run dev` |
| `Model "…" is not installed` | `ollama pull <model>`, then hit **Retest** |
| No text extracted from a PDF | Scanned document — run OCR first |
| Analysis is slow | Smaller model, or raise **Pages / call** |
| Findings look shallow | Larger model, lower temperature, fewer pages per call |
