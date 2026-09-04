import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Play } from 'lucide-react';

import Header from './components/Header.jsx';
import UploadZone from './components/UploadZone.jsx';
import AnalysisConfig from './components/AnalysisConfig.jsx';
import AnalysisProgress from './components/AnalysisProgress.jsx';
import FindingsList from './components/FindingsList.jsx';
import FindingsFilter from './components/FindingsFilter.jsx';
import DocumentScore from './components/DocumentScore.jsx';
import ReviewCost from './components/ReviewCost.jsx';
import RewriteButton from './components/RewriteButton.jsx';
import SowCheck from './components/SowCheck.jsx';
import PriorityDistribution from './components/PriorityDistribution.jsx';
import SkillCounts from './components/SkillCounts.jsx';
import DocumentPreview from './components/DocumentPreview.jsx';
import TopBar from './components/TopBar.jsx';
import ProviderSettings from './components/ProviderSettings.jsx';
import CloudConfirmDialog from './components/CloudConfirmDialog.jsx';
import CleanDocumentState from './components/CleanDocumentState.jsx';
import OcrPrompt from './components/OcrPrompt.jsx';

import { runMockAnalysis } from './services/mockAnalysisService.js';
import { runCloudReview } from './services/reviewService.js';
import {
  computeDocumentScore,
  countSentences,
  readingOrder,
  runOllamaAnalysis,
} from './services/analysisService.js';
import { parseDocument } from './services/documentParser.js';
import { detectLanguage, documentSample, languageLabel } from './services/languageDetect.js';
import { exportToExcel } from './services/excelExport.js';
import { ocrLanguageFor, pagesNeedingOcr, runOcr } from './services/ocr.js';
import useProvider from './hooks/useProvider.js';
import { isCloudProvider } from './config/providers.js';
import { DOC_TYPES, SERVICE_LINES, SKILLS } from './data/constants.js';
import { REVIEW_STATES, stateOf, toggleState } from './data/review.js';
import {
  deletePlaybook,
  loadPlaybooks,
  savePlaybook,
} from './config/playbooks.js';

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id;

// App states: 'idle' | 'analyzing' | 'done'
export default function App() {
  const [file, setFile] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState(
    SKILLS.map((s) => s.id) // all enabled by default
  );
  const [customChecks, setCustomChecks] = useState([]);
  const [docType, setDocType] = useState('report');
  const [serviceLine, setServiceLine] = useState('audit');
  const [language, setLanguage] = useState('auto');
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [playbooks, setPlaybooks] = useState(loadPlaybooks);
  // 'off' | 'uncertain' | 'all' — how much of the review gets a second look.
  const [criticPolicy, setCriticPolicy] = useState('uncertain');

  const [documentModel, setDocumentModel] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [ocrPages, setOcrPages] = useState([]);
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [ocrProgress, setOcrProgress] = useState(null);
  const [isOcrRunning, setOcrRunning] = useState(false);
  const [issue, setIssue] = useState(null); // { message, hint }

  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ ratio: 0 });
  // What the review actually consumed, reported once it is over: the estimate
  // shown before the run is only worth something if the real figure follows.
  const [usage, setUsage] = useState(null);
  const [findings, setFindings] = useState([]);
  const [reviewStates, setReviewStates] = useState(() => new Map());
  const [wasStopped, setWasStopped] = useState(false);
  const [rerunningSkill, setRerunningSkill] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const [skillFilter, setSkillFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [sortMode, setSortMode] = useState('document');
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const [isViewerExpanded, setViewerExpanded] = useState(false);

  const abortRef = useRef(null);
  const ocrAbortRef = useRef(null);
  const provider = useProvider();
  const isDemoEngine = provider.engine === 'demo';
  const isCloudEngine = isCloudProvider(provider.engine);

  // Confirmation of sending the document to a cloud API, asked once per run.
  const [pendingCloudRun, setPendingCloudRun] = useState(null);

  // Settings as the analysis engine expects them: one flat model and endpoint.
  const analysisSettings = {
    ...provider.settings,
    model: provider.model,
    baseUrl: provider.baseUrl,
  };

  const effectiveLanguage =
    language === 'auto' ? (detectedLanguage ?? 'en') : language;

  // ── Handlers ───────────────────────────────────────────────

  /** Parses the dropped file so the preview shows the real content. */
  const handleFileChange = useCallback(async (nextFile) => {
    setFile(nextFile);
    setIssue(null);
    setDocumentModel(null);
    setDetectedLanguage(null);
    setOcrPages([]);
    setOcrProgress(null);
    if (!nextFile) return;

    setIsParsing(true);
    try {
      const parsed = await parseDocument(nextFile);
      setDocumentModel(parsed);
      const detected = detectLanguage(documentSample(parsed)).id;
      setDetectedLanguage(detected);

      // A PDF page without text is a scan: offer recognition rather than
      // analysing an empty document.
      if (parsed.kind === 'pdf') {
        const candidates = pagesNeedingOcr(parsed);
        setOcrPages(candidates);
        setOcrLanguage(ocrLanguageFor(detected));
      }
    } catch (error) {
      setIssue({ message: error.message, hint: error.hint });
    } finally {
      setIsParsing(false);
    }
  }, []);

  const toggleSkill = (id) => {
    setSelectedSkills((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    );
  };

  const addCustomCheck = (label) => {
    setCustomChecks((current) =>
      current.includes(label) ? current : [...current, label]
    );
  };

  const removeCustomCheck = (label) => {
    setCustomChecks((current) => current.filter((c) => c !== label));
  };

  const setReviewState = useCallback((id, target) => {
    setReviewStates((current) => toggleState(current, id, target));
  }, []);

  // ── OCR ────────────────────────────────────────────────────
  const handleRunOcr = async () => {
    if (!documentModel?.source?.data || !ocrPages.length) return;

    const controller = new AbortController();
    ocrAbortRef.current = controller;
    setOcrRunning(true);
    setOcrProgress({ done: 0, total: ocrPages.length, page: ocrPages[0] });
    setIssue(null);

    try {
      const recognised = await runOcr({
        pdfData: documentModel.source.data,
        pages: ocrPages,
        language: ocrLanguage,
        signal: controller.signal,
        onProgress: setOcrProgress,
      });

      setDocumentModel((current) => {
        if (!current) return current;
        const pages = current.pages.map((blocks, index) =>
          recognised.get(index + 1) ?? blocks
        );
        return {
          ...current,
          pages,
          charCount: pages
            .flat()
            .reduce((total, block) => total + block.text.length, 0),
        };
      });

      const remaining = ocrPages.filter(
        (page) => !(recognised.get(page)?.length > 0)
      );
      setOcrPages(remaining);
      if (remaining.length === ocrPages.length) {
        setIssue({
          message: 'Text recognition found nothing readable on these pages.',
          hint: 'The scan may be too low-resolution, or the language may not be one of the two installed.',
        });
      }
    } catch (error) {
      setIssue({ message: `Text recognition failed. ${error.message}`, hint: error.hint });
    } finally {
      setOcrRunning(false);
      setOcrProgress(null);
      ocrAbortRef.current = null;
    }
  };

  const handleCancelOcr = () => {
    if (isOcrRunning) ocrAbortRef.current?.abort();
    else setOcrPages([]);
  };

  // ── Playbooks ──────────────────────────────────────────────
  const applyPlaybook = (playbook) => {
    setCustomChecks((current) => [
      ...current,
      ...playbook.checks.filter((check) => !current.includes(check)),
    ]);
    if (playbook.serviceLine) setServiceLine(playbook.serviceLine);
  };

  const handleSavePlaybook = (name) => {
    if (!name?.trim() || customChecks.length === 0) return;
    setPlaybooks((current) =>
      savePlaybook(current, { name, serviceLine, checks: customChecks })
    );
  };

  const handleDeletePlaybook = (id) => {
    setPlaybooks((current) => deletePlaybook(current, id));
  };

  // ── Analysis ───────────────────────────────────────────────
  const isAnalyzing = status === 'analyzing';
  const showResults = status !== 'idle';

  // In Ollama mode we need a parsed document and a reachable model.
  const hasText = (documentModel?.charCount ?? 0) > 0;
  const canStart =
    !!file &&
    selectedSkills.length > 0 &&
    !isOcrRunning &&
    (isDemoEngine ||
      (!!documentModel && hasText && !isParsing && provider.status === 'ready'));

  /**
   * @param {Object} [options]
   * @param {string} [options.onlySkill] Re-run a single check, keeping the
   *   findings of every other check untouched.
   */
  /**
   * Gate in front of the analysis: sending a document to a cloud API is asked
   * for explicitly, once per run.
   */
  const handleStart = (options = {}) => {
    if (isCloudEngine && provider.status === 'ready') {
      setPendingCloudRun(options);
      return undefined;
    }
    return startAnalysis(options);
  };

  const startAnalysis = async (options = {}) => {
    const onlySkill = typeof options.onlySkill === 'string' ? options.onlySkill : null;
    if (!canStart || (onlySkill && isAnalyzing)) return;

    const skills = onlySkill ? [onlySkill] : selectedSkills;

    setIssue(null);
    setWasStopped(false);
    setProgress({ ratio: 0 });
    setUsage(null);

    if (onlySkill) {
      // Drop this check's previous findings, keep the rest of the review.
      setFindings((prev) => prev.filter((f) => f.skill !== onlySkill));
      setRerunningSkill(onlySkill);
    } else {
      setFindings([]);
      setReviewStates(new Map());
      setSkillFilter('all');
      setPriorityFilter('all');
      setStatusFilter('all');
      setSelectedFindingId(null);
    }
    setStatus('analyzing');

    const controller = new AbortController();
    abortRef.current = controller;

    const onFinding = (finding) => setFindings((prev) => [...prev, finding]);

    /**
     * The critic ruled on a finding already on screen: a `drop` removes the
     * card, an `adjust` moves its priority and confidence, a `keep` stamps it
     * as verified. Showing findings before verification is what keeps the
     * first result at four seconds instead of twenty.
     */
    const applyVerdict = (decision) =>
      setFindings((prev) =>
        prev.flatMap((finding) => {
          if (finding.ref !== decision.ref) return [finding];
          if (decision.verdict === 'drop') return [];
          if (decision.verdict === 'adjust') {
            return [
              {
                ...finding,
                verified: true,
                verdict: 'adjust',
                priority: decision.priority ?? finding.priority,
                confidence: decision.confidence ?? finding.confidence,
                confidenceBefore: decision.confidenceBefore,
              },
            ];
          }
          return [{ ...finding, verified: decision.verdict === 'keep', verdict: decision.verdict }];
        })
      );

    try {
      if (isDemoEngine) {
        await runMockAnalysis({
          file,
          skills,
          docType,
          customChecks,
          signal: controller.signal,
          onFinding,
          onProgress: (ratio) => setProgress({ ratio }),
          onComplete: () => setStatus('done'),
        });
        return;
      }

      if (provider.engine === 'openai') {
        const summary = await runCloudReview({
          documentModel,
          skills,
          customChecks,
          docType,
          serviceLine,
          language: effectiveLanguage,
          criticPolicy,
          signal: controller.signal,
          onFinding,
          onVerdict: applyVerdict,
          onProgress: setProgress,
          onCheckError: (message) =>
            setIssue({ message: 'A check could not run.', hint: message }),
        });
        setUsage(summary?.usage ?? null);
        setStatus('done');
        return;
      }

      const result = await runOllamaAnalysis({
        documentModel,
        skills,
        customChecks,
        docType,
        serviceLine,
        language: effectiveLanguage,
        settings: analysisSettings,
        signal: controller.signal,
        // A single-check re-run does not need the cross-page pass.
        crossPagePass: !onlySkill,
        onFinding,
        onProgress: setProgress,
        onBatchError: (error, pages) =>
          setIssue({
            message: `Pages ${pages.join(', ')} could not be analysed.`,
            hint: error.message,
          }),
      });

      if (result.aborted) setWasStopped(true);
      setStatus('done');
    } catch (error) {
      setIssue({ message: error.message, hint: error.hint });
      setStatus('done');
    } finally {
      setRerunningSkill(null);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setWasStopped(true);
    setStatus('done');
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setFile(null);
    setDocumentModel(null);
    setDetectedLanguage(null);
    setIssue(null);
    setStatus('idle');
    setFindings([]);
    setReviewStates(new Map());
    setProgress({ ratio: 0 });
    setWasStopped(false);
    setSkillFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setMinConfidence(0);
    setSelectedFindingId(null);
  };

  // Abort a running analysis if the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Filtering & sorting ────────────────────────────────────
  const filteredFindings = useMemo(() => {
    const kept = findings.filter((f) => {
      if (skillFilter !== 'all' && f.skill !== skillFilter) return false;
      if (priorityFilter !== 'all' && f.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && stateOf(reviewStates, f.id) !== statusFilter)
        return false;
      if (f.confidence < minConfidence) return false;
      return true;
    });

    const byDocument = (a, b) => readingOrder(a) - readingOrder(b);
    const sorters = {
      document: byDocument,
      priority: (a, b) =>
        (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
        byDocument(a, b),
      confidence: (a, b) => b.confidence - a.confidence || byDocument(a, b),
    };

    return kept.sort(sorters[sortMode] ?? byDocument);
  }, [
    findings,
    skillFilter,
    priorityFilter,
    statusFilter,
    minConfidence,
    sortMode,
    reviewStates,
  ]);

  // Only open findings weigh on the score: accepted ones are fixed,
  // rejected ones were false positives.
  const openFindings = useMemo(
    () => findings.filter((f) => stateOf(reviewStates, f.id) === REVIEW_STATES.PENDING),
    [findings, reviewStates]
  );

  const sentenceCount = useMemo(
    () => (isDemoEngine ? 0 : countSentences(documentModel)),
    [documentModel, isDemoEngine]
  );

  const currentScore = useMemo(
    () => computeDocumentScore(openFindings, { sentenceCount }),
    [openFindings, sentenceCount]
  );

  const hasCustomFindings = useMemo(
    () => findings.some((f) => f.skill === 'custom'),
    [findings]
  );

  const triagedCount = findings.length - openFindings.length;

  // A finished run with nothing to report is a good outcome, not an error.
  const isClean =
    showResults && !isAnalyzing && findings.length === 0 && !issue && !wasStopped;

  // ── Export ─────────────────────────────────────────────────
  const handleExport = async () => {
    if (!findings.length) return;
    setIsExporting(true);
    try {
      await exportToExcel({
        findings: [...findings].sort((a, b) => readingOrder(a) - readingOrder(b)),
        states: reviewStates,
        score: currentScore,
        meta: {
          fileName: file?.name ?? 'document',
          pageCount: documentModel?.pages.length ?? '—',
          docTypeLabel: labelOf(DOC_TYPES, docType),
          serviceLineLabel: labelOf(SERVICE_LINES, serviceLine),
          languageLabel: isDemoEngine ? '—' : languageLabel(effectiveLanguage),
          date: new Date().toLocaleString(),
          engine: isDemoEngine ? 'Demo data' : 'Ollama (local)',
          model: isDemoEngine ? '—' : provider.model,
          customChecks,
        },
      });
    } catch (error) {
      setIssue({
        message: 'The Excel export failed.',
        hint: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const issueBanner = issue && (
    <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-3 text-xs text-amber-900">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {issue.message}
      </p>
      {issue.hint && <p className="mt-1 opacity-80">{issue.hint}</p>}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {pendingCloudRun && (
        <CloudConfirmDialog
          providerLabel={provider.provider.label}
          fileName={file?.name}
          pageCount={documentModel?.pages.length}
          onCancel={() => setPendingCloudRun(null)}
          onConfirm={() => {
            const options = pendingCloudRun;
            setPendingCloudRun(null);
            startAnalysis(options);
          }}
        />
      )}

      <Header>
        <ProviderSettings
          settings={provider.settings}
          model={provider.model}
          engine={provider.engine}
          onChange={provider.updateSettings}
          status={provider.status}
          models={provider.models}
          error={provider.error}
          onRefresh={provider.refresh}
        />
      </Header>

      <main className="flex-1 mx-auto max-w-[1600px] w-full px-8 py-10">
        {!showResults ? (
          /* ─────────── IDLE STATE ─────────── */
          <>
            <section className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                Document quality analysis
              </h2>
              <p className="text-sm text-slate-500 mt-2 max-w-2xl">
                Upload a document, pick the checks you want to run and get
                categorised, prioritised improvement suggestions in seconds.
              </p>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <aside className="lg:col-span-5 space-y-6">
                <UploadZone file={file} onFileChange={handleFileChange} />

                {isParsing && (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Extracting the text from your document…
                  </p>
                )}

                {documentModel && !isParsing && hasText && (
                  <p className="text-xs text-slate-500">
                    {documentModel.pages.length} page(s) ·{' '}
                    {documentModel.charCount.toLocaleString()} characters ·{' '}
                    {languageLabel(effectiveLanguage)} · ready for analysis.
                  </p>
                )}

                {ocrPages.length > 0 && documentModel?.kind === 'pdf' && (
                  <OcrPrompt
                    pageCount={ocrPages.length}
                    totalPages={documentModel.pages.length}
                    language={ocrLanguage}
                    onLanguageChange={setOcrLanguage}
                    onRun={handleRunOcr}
                    onCancel={handleCancelOcr}
                    progress={ocrProgress}
                    isRunning={isOcrRunning}
                  />
                )}

                {/* Right under the document it checks: a contract question is
                    asked before the review, not scrolled to after it. */}
                {documentModel && !isParsing && (
                  <SowCheck
                    documentModel={documentModel}
                    language={effectiveLanguage}
                  />
                )}

                {issueBanner}

                <AnalysisConfig
                  selectedSkills={selectedSkills}
                  onToggleSkill={toggleSkill}
                  docType={docType}
                  onDocTypeChange={setDocType}
                  serviceLine={serviceLine}
                  onServiceLineChange={setServiceLine}
                  customChecks={customChecks}
                  onAddCustomCheck={addCustomCheck}
                  onRemoveCustomCheck={removeCustomCheck}
                  language={language}
                  onLanguageChange={setLanguage}
                  detectedLanguage={detectedLanguage}
                  playbooks={playbooks}
                  onApplyPlaybook={applyPlaybook}
                  onSavePlaybook={handleSavePlaybook}
                  onDeletePlaybook={handleDeletePlaybook}
                  pageCount={documentModel?.pages?.length ?? 0}
                  criticPolicy={criticPolicy}
                  onCriticPolicyChange={setCriticPolicy}
                />


                <button
                  type="button"
                  onClick={() => handleStart()}
                  disabled={!canStart}
                  className="btn-primary w-full"
                >
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                  {isDemoEngine
                    ? 'Start analysis (demo data)'
                    : `Analyse with ${provider.model}`}
                </button>

                {!isDemoEngine && provider.status !== 'ready' && (
                  <div className="text-xs text-slate-500 text-center space-y-1">
                    <p className="font-medium text-slate-600">
                      {provider.error?.message ?? 'Connecting to the model…'}
                    </p>
                    {provider.error?.hint && <p>{provider.error.hint}</p>}
                    <p>
                      Open the badge in the header to configure it, or switch to
                      demo data.
                    </p>
                  </div>
                )}
              </aside>

              <section className="lg:col-span-7">
                <div className="card p-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-brand-50 grid place-items-center mb-4">
                    <Play className="h-5 w-5 text-brand-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    Ready to analyze your document
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Upload a file and start the analysis to see findings stream
                    in, along with their exact location in the document.
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : (
          /* ─────────── ACTIVE STATE ─────────── */
          <div className="space-y-5">
            <TopBar
              file={file}
              onClearFile={() => handleFileChange(null)}
              selectedSkills={selectedSkills}
              onToggleSkill={toggleSkill}
              customChecks={customChecks}
              onRemoveCustomCheck={removeCustomCheck}
              docType={docType}
              onDocTypeChange={setDocType}
              serviceLine={serviceLine}
              onServiceLineChange={setServiceLine}
              isAnalyzing={isAnalyzing}
              onStart={() => handleStart()}
              onStop={handleStop}
              onReset={handleReset}
              onExport={handleExport}
              isExporting={isExporting}
              canExport={findings.length > 0}
              score={currentScore}
            />

            {isAnalyzing && (
              <AnalysisProgress progress={progress} count={findings.length} />
            )}

            {wasStopped && !isAnalyzing && findings.length > 0 && (
              <div className="rounded-xl bg-slate-100 ring-1 ring-slate-200 px-4 py-3 text-xs text-slate-700">
                Analysis stopped before the end — these results are partial.
              </div>
            )}

            {issueBanner}

            {isClean ? (
              <CleanDocumentState
                fileName={file?.name}
                skillCount={selectedSkills.length}
                customCheckCount={customChecks.length}
                onRerun={() => handleStart()}
              />
            ) : (
              <>
                {/* Summary row */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DocumentScore
                    findings={openFindings}
                    isAnalyzing={isAnalyzing}
                    resolvedCount={triagedCount}
                    score={currentScore}
                  />
                  <PriorityDistribution findings={openFindings} />
                  <SkillCounts
                    findings={openFindings}
                    onRerunSkill={
                      isDemoEngine
                        ? undefined
                        : (skill) => handleStart({ onlySkill: skill })
                    }
                    rerunningSkill={rerunningSkill}
                  />
                </section>

                <ReviewCost usage={usage} />

                {/* The output of the triage: the document, corrected. */}
                {!isAnalyzing && findings.length > 0 && (
                  <RewriteButton
                    file={file}
                    documentModel={documentModel}
                    findings={findings}
                    states={reviewStates}
                  />
                )}

                {/* Main row: findings + document preview */}
                <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div
                    className={`space-y-3 ${
                      isViewerExpanded ? 'xl:col-span-4' : 'xl:col-span-7'
                    }`}
                  >
                    <div className="card px-4 py-3">
                      <FindingsFilter
                        skillFilter={skillFilter}
                        onSkillFilterChange={setSkillFilter}
                        priorityFilter={priorityFilter}
                        onPriorityFilterChange={setPriorityFilter}
                        statusFilter={statusFilter}
                        onStatusFilterChange={setStatusFilter}
                        minConfidence={minConfidence}
                        onMinConfidenceChange={setMinConfidence}
                        sortMode={sortMode}
                        onSortModeChange={setSortMode}
                        total={findings.length}
                        visible={filteredFindings.length}
                        hasCustomFindings={hasCustomFindings}
                      />
                    </div>

                    <FindingsList
                      findings={filteredFindings}
                      isAnalyzing={isAnalyzing}
                      selectedFindingId={selectedFindingId}
                      onSelectFinding={setSelectedFindingId}
                      reviewStates={reviewStates}
                      onSetReviewState={setReviewState}
                    />
                  </div>

                  <aside
                    className={`xl:sticky xl:top-20 xl:self-start ${
                      isViewerExpanded ? 'xl:col-span-8' : 'xl:col-span-5'
                    }`}
                  >
                    <DocumentPreview
                      documentModel={isDemoEngine ? null : documentModel}
                      findings={findings}
                      selectedFindingId={selectedFindingId}
                      onSelectFinding={setSelectedFindingId}
                      reviewStates={reviewStates}
                      isExpanded={isViewerExpanded}
                      onToggleExpand={() => setViewerExpanded((value) => !value)}
                    />
                  </aside>
                </section>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/50 mt-10">
        <div className="mx-auto max-w-[1600px] px-8 py-4 text-xs text-slate-400 flex items-center justify-between">
          <span>
            Ryder ·{' '}
            {isDemoEngine
              ? 'demo mode (mocked findings)'
              : isCloudEngine
                ? `analysis via ${provider.provider.label} (${provider.model}) · document text leaves this machine`
                : `local analysis via Ollama (${provider.model}) · nothing leaves this machine`}
          </span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
