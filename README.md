# Ryder — document QA with a local AI model

React + Vite app that audits a document (PDF, DOCX, PPTX, TXT, MD) and returns
categorised, prioritised findings, highlighted at their exact place in the
document.

Two engines: a **local Ollama model** (nothing leaves the machine) or the
**DeepSeek API** as a fallback when the local model is unavailable or too weak. The analysis runs on a **local Ollama
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
npm run dev          # http://localhost:3000
```

The app is a Next.js application: the document is still parsed in the browser,
but the model key lives in the server process and never reaches the client. Set `SITE_PASSWORD` to put the whole site behind a
shared password; leave it empty in local development and there is no login at
all. The plan for the cloud review pipeline is in
[`docs/plan-cloud-qa.md`](docs/plan-cloud-qa.md).

The badge in the header shows the connection state. Green (`Local model`) means
you can upload a document and hit **Analyse**.

## Reviewing a document

1. **Scanned PDF? Run recognition.** A PDF with no extractable text is a scan.
   The app says so and offers to read it locally with Tesseract — engine, WASM
   and language data are all served from `public/tesseract/`, nothing is fetched
   from a CDN. English and French are installed. Findings coming from a
   recognised page carry an `OCR` badge and a slightly lower confidence, because
   what looks like a typo may be a misread character.
2. **See it in the document.** The right-hand panel shows the real file — actual
   PDF pages, Word layout, PowerPoint slides — with each finding highlighted
   where it sits. Click a highlight to select the finding, click a finding to
   scroll to it. Zoom, and widen the panel when the document deserves the room.
   The viewer is read-only: corrections are made in your own editor.
3. **Triage each finding.** Accept (the correction is right) or reject (the model
   is wrong). Only open findings weigh on the quality score, so the score
   reflects what is genuinely left to fix. `j` / `k` move through the list,
   `a` accepts, `r` rejects.
4. **Sort and filter.** Document order by default, or by priority / confidence.
   The confidence slider hides the calls the model was unsure about — useful
   with smaller models.
5. **Export to Excel.** One workbook with a *Summary* sheet (score, counts,
   context), a *Findings* sheet (filterable, with a status dropdown and an empty
   reviewer-comment column) and a *By type* breakdown.

## How it works

1. **Parsing (browser).** `src/services/documentParser.js` extracts text with
   `pdfjs-dist` (PDF), `mammoth` (DOCX), `jszip` + the OOXML parts (PPTX) or a
   plain read (TXT/MD), splits it into sentences and pages, and keeps where each
   sentence sits: rectangles on the page for PDF, shape geometry for PPTX. Those
   anchors are what the viewer highlights.
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
5. **Viewing.** Each format gets the most faithful rendering available: real
   pages drawn with pdf.js, Word layout converted to HTML, PowerPoint shapes
   positioned from the geometry in the file (including placeholder geometry
   inherited from the slide layout). Pages render as they approach the viewport,
   so a long document does not render eagerly.
6. **Rendering the findings.** Findings are normalised (unknown ids, unknown skills,
   suggestions identical to the original and duplicates are dropped), then fed to
   the existing UI: score, priority distribution, per-type counts and the
   clickable document preview.

The document language is detected on upload and injected into the prompt, so a
French document gets French suggestions and French-language conventions. Override
it in the analysis panel if the detection is wrong.

The quality score is normalised by document length: 20 findings in a 2-page memo
and 20 findings in a 100-page report are not the same defect density.

## Using DeepSeek instead of the local model

Put the key in a `.env` file at the root (copy `.env.example`):

```bash
DEEPSEEK_API_KEY=sk-...
```

Then restart `npm run dev` and pick **DeepSeek (cloud)** in the engine badge.

The key is read by the Next.js server and injected into the `/deepseek` route
on the way out — it never reaches the browser. It is deliberately **not**
prefixed `NEXT_PUBLIC_`: those variables are inlined into the bundle and would
be public to anyone opening the devtools. The route also sidesteps CORS, which
OpenAI-compatible APIs do not open to browsers.

Because the document text does leave the machine, the app asks for an explicit
confirmation before each cloud run, and the header badge turns orange for as
long as a cloud engine is selected. Do not use it for confidential deliverables.

## Configuration

Everything is editable at runtime from the header badge — engine, model,
endpoint, temperature, context size, pages per request. The choice is stored in
`localStorage`.

| Setting | Default | Notes |
| --- | --- | --- |
| Engine | `Ollama (local)` | `Demo data` replays the mocked findings, useful for a client demo without a model |
| Model | `llama3.1:8b` | The dropdown lists what is actually installed |
| Endpoint | `/ollama` | Goes through the app's own route — no CORS setup |
| Temperature | `0.2` | Low = stable, repeatable reviews |
| Context | `8192` | Raise it for dense pages |
| Pages / call | `2` | Fewer pages = more requests, better accuracy |

Server-side defaults live in `.env` (copy `.env.example`):

```bash
OLLAMA_HOST=http://127.0.0.1:11434   # target of the /ollama route
```

To call Ollama directly instead of through the proxy, set the endpoint to
`http://localhost:11434` in the settings dialog and start the server with
`OLLAMA_ORIGINS=* ollama serve`.

## Checking a deliverable against its statement of work

Drop the signed SoW in the panel below the analysis settings and hit **Check**.
The review reads the contract, lists what it commits the firm to — deliverables,
scope, exclusions, constraints, formats, dates — then checks each commitment
against the deliverable and reports it as honoured, partial, missing or
contradicted, citing the sentences that decide it.

The verdict at the top is not an average: one contradicted commitment, or one
missing commitment marked critical, reads *do not send as is* however green the
rest is. A deliverable covering a subject the SoW explicitly excluded is a
different problem from a thin one, and averaging them away would defeat the
point.

## Measuring the review

```bash
npm run bench                 # deterministic checks: no key, no cost, no network
npm run bench -- --model      # the full review; asks before spending
npm run bench -- --tier nano  # replay the mechanical pass on another tier
```

The bench scores the review against annotated documents in `bench/corpus/`:
precision, recall, F1, duration and the real cost read back from the API. Every
duration and price quoted in `docs/plan-cloud-qa.md` is an estimate until this
has run — its job is to correct them, not to confirm them.

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
| `gemma3:12b` | 16–24 GB | Strong on written style; multimodal |
| `gemma3:4b` | 8 GB | Fast; expect more false positives |
| `qwen2.5:14b` | 16–32 GB | Stricter reviews, slower |
| `mistral:7b` | 8 GB | Fast, lighter on nuance |

Gemma's chat template has no system turn, so the client folds the review rules
into the user message for that family (`buildMessages` in
`services/ollamaClient.js`). Without it, a silently dropped system prompt would
cost every instruction the review depends on.

## Next steps

Reviewing inside the document and OCR are in place. What remains: word-level
diff, bulk actions and a French/English interface. Two separate tracks are
designed but not started: moving the analysis to specialised agents with a
bounded verification loop and per-service-line packs
([docs/plan-agentique.md](docs/plan-agentique.md)), and deploying the app on
Vercel behind a shared password with DeepSeek as the cloud fallback when Ollama
isn't reachable ([docs/plan-deepseek-deploy.md](docs/plan-deepseek-deploy.md)).
Each one is specified in
[docs/plan-implementation.md](docs/plan-implementation.md): design, files to
touch, known pitfalls, expected tests and effort.

Nothing about a document is persisted: the extracted text, the findings and the
review live in the tab and are gone when it closes. Only preferences (Ollama
settings, playbooks) are stored locally.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Recognition finds nothing | Scan too low-resolution, or a language other than English/French |
| `Cannot reach Ollama` | Start `ollama serve`, then restart `npm run dev` |
| `Model "…" is not installed` | `ollama pull <model>`, then hit **Retest** |
| Analysis is slow | Smaller model, or raise **Pages / call** |
| Findings look shallow | Larger model, lower temperature, fewer pages per call |
