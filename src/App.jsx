import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Play } from 'lucide-react';

import Header from './components/Header.jsx';
import UploadZone from './components/UploadZone.jsx';
import AnalysisConfig from './components/AnalysisConfig.jsx';
import AnalysisProgress from './components/AnalysisProgress.jsx';
import FindingsList from './components/FindingsList.jsx';
import FindingsFilter from './components/FindingsFilter.jsx';
import DocumentScore from './components/DocumentScore.jsx';
import PriorityDistribution from './components/PriorityDistribution.jsx';
import SkillCounts from './components/SkillCounts.jsx';
import DocumentPreview from './components/DocumentPreview.jsx';
import TopBar from './components/TopBar.jsx';
import OllamaSettings from './components/OllamaSettings.jsx';

import { runMockAnalysis } from './services/mockAnalysisService.js';
import {
  computeDocumentScore,
  runOllamaAnalysis,
} from './services/analysisService.js';
import { parseDocument } from './services/documentParser.js';
import useOllama from './hooks/useOllama.js';
import { SKILLS } from './data/constants.js';

// App states: 'idle' | 'analyzing' | 'done'
export default function App() {
  const [file, setFile] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState(
    SKILLS.map((s) => s.id) // all enabled by default
  );
  const [customChecks, setCustomChecks] = useState([]);
  const [docType, setDocType] = useState('report');
  const [serviceLine, setServiceLine] = useState('audit');

  const [documentModel, setDocumentModel] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [issue, setIssue] = useState(null); // { message, hint }

  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [findings, setFindings] = useState([]);
  const [resolvedIds, setResolvedIds] = useState(() => new Set());

  const [skillFilter, setSkillFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showResolved, setShowResolved] = useState(true);
  const [selectedFindingId, setSelectedFindingId] = useState(null);

  const abortRef = useRef(null);
  const ollama = useOllama();
  const isDemoEngine = ollama.settings.engine === 'demo';

  // ── Handlers ───────────────────────────────────────────────

  /** Parses the dropped file so the preview shows the real content. */
  const handleFileChange = useCallback(
    async (nextFile) => {
      setFile(nextFile);
      setIssue(null);
      setDocumentModel(null);
      if (!nextFile) return;

      setIsParsing(true);
      try {
        setDocumentModel(await parseDocument(nextFile));
      } catch (error) {
        setIssue({ message: error.message, hint: error.hint });
      } finally {
        setIsParsing(false);
      }
    },
    []
  );

  const toggleSkill = (id) => {
    setSelectedSkills((current) =>
      current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id]
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

  const toggleResolved = (id) => {
    setResolvedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStart = async () => {
    if (!canStart) return;

    // Reset
    setFindings([]);
    setResolvedIds(new Set());
    setProgress(0);
    setSkillFilter('all');
    setPriorityFilter('all');
    setSelectedFindingId(null);
    setStatus('analyzing');

    setIssue(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const onFinding = (finding) => setFindings((prev) => [finding, ...prev]);

    try {
      if (isDemoEngine) {
        await runMockAnalysis({
          file,
          skills: selectedSkills,
          docType,
          customChecks,
          signal: controller.signal,
          onFinding,
          onProgress: setProgress,
          onComplete: () => setStatus('done'),
        });
        return;
      }

      const result = await runOllamaAnalysis({
        documentModel,
        skills: selectedSkills,
        customChecks,
        docType,
        serviceLine,
        settings: ollama.settings,
        signal: controller.signal,
        onFinding,
        onProgress: setProgress,
        onBatchError: (error, pages) =>
          setIssue({
            message: `Pages ${pages.join(', ')} could not be analysed.`,
            hint: error.message,
          }),
      });

      if (!result.aborted && result.findings.length === 0 && !result.errors?.length) {
        setIssue({
          message: 'No issue found in this document.',
          hint: 'Add custom checks or try a larger model for a stricter review.',
        });
      }
      setStatus('done');
    } catch (error) {
      setIssue({ message: error.message, hint: error.hint });
      setStatus('done');
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus('done');
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setFile(null);
    setDocumentModel(null);
    setIssue(null);
    setStatus('idle');
    setFindings([]);
    setResolvedIds(new Set());
    setProgress(0);
    setSkillFilter('all');
    setPriorityFilter('all');
    setSelectedFindingId(null);
  };

  // ── Filtering ──────────────────────────────────────────────
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (skillFilter !== 'all' && f.skill !== skillFilter) return false;
      if (priorityFilter !== 'all' && f.priority !== priorityFilter) return false;
      if (!showResolved && resolvedIds.has(f.id)) return false;
      return true;
    });
  }, [findings, skillFilter, priorityFilter, showResolved, resolvedIds]);

  // Unresolved findings drive score + distribution stats.
  const unresolvedFindings = useMemo(
    () => findings.filter((f) => !resolvedIds.has(f.id)),
    [findings, resolvedIds]
  );

  const currentScore = useMemo(
    () => computeDocumentScore(unresolvedFindings),
    [unresolvedFindings]
  );

  const hasCustomFindings = useMemo(
    () => findings.some((f) => f.skill === 'custom'),
    [findings]
  );

  const isAnalyzing = status === 'analyzing';
  const showResults = status !== 'idle';

  // In Ollama mode we need a parsed document and a reachable model.
  const canStart =
    !!file &&
    selectedSkills.length > 0 &&
    (isDemoEngine || (!!documentModel && !isParsing && ollama.status === 'ready'));

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Header>
        <OllamaSettings
          settings={ollama.settings}
          onChange={ollama.updateSettings}
          status={ollama.status}
          models={ollama.models}
          error={ollama.error}
          onRefresh={ollama.refresh}
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

                {documentModel && !isParsing && (
                  <p className="text-xs text-slate-500">
                    {documentModel.pages.length} page(s) ·{' '}
                    {documentModel.charCount.toLocaleString()} characters ready
                    for analysis.
                  </p>
                )}

                {issue && (
                  <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-3.5 py-3 text-xs text-amber-900">
                    <p className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {issue.message}
                    </p>
                    {issue.hint && <p className="mt-1 opacity-80">{issue.hint}</p>}
                  </div>
                )}
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
                />
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!canStart}
                  className="btn-primary w-full"
                >
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                  {isDemoEngine
                    ? 'Start analysis (demo data)'
                    : `Analyse with ${ollama.settings.model}`}
                </button>

                {!isDemoEngine && ollama.status !== 'ready' && (
                  <div className="text-xs text-slate-500 text-center space-y-1">
                    <p className="font-medium text-slate-600">
                      {ollama.error?.message ?? 'Connecting to the local model…'}
                    </p>
                    {ollama.error?.hint && <p>{ollama.error.hint}</p>}
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
                    Upload a file and start the analysis to see findings
                    stream in, along with their exact location in the
                    document.
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : (
          /* ─────────── ACTIVE STATE ─────────── */
          <div className="space-y-5">
            {/* Top bar */}
            <TopBar
              file={file}
              onClearFile={() => setFile(null)}
              selectedSkills={selectedSkills}
              onToggleSkill={toggleSkill}
              customChecks={customChecks}
              onRemoveCustomCheck={removeCustomCheck}
              docType={docType}
              onDocTypeChange={setDocType}
              serviceLine={serviceLine}
              onServiceLineChange={setServiceLine}
              isAnalyzing={isAnalyzing}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
              score={currentScore}
            />

            {/* Progress bar */}
            {isAnalyzing && (
              <AnalysisProgress
                progress={progress}
                count={findings.length}
              />
            )}

            {issue && (
              <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-xs text-amber-900">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {issue.message}
                </p>
                {issue.hint && <p className="mt-1 opacity-80">{issue.hint}</p>}
              </div>
            )}

            {/* Summary row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DocumentScore
                findings={unresolvedFindings}
                isAnalyzing={isAnalyzing}
                resolvedCount={resolvedIds.size}
              />
              <PriorityDistribution findings={unresolvedFindings} />
              <SkillCounts findings={unresolvedFindings} />
            </section>

            {/* Main row: findings + document preview */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Findings panel */}
              <div className="xl:col-span-7 space-y-3">
                <div className="card px-4 py-3">
                  <FindingsFilter
                    skillFilter={skillFilter}
                    onSkillFilterChange={setSkillFilter}
                    priorityFilter={priorityFilter}
                    onPriorityFilterChange={setPriorityFilter}
                    total={findings.length}
                    visible={filteredFindings.length}
                    hasCustomFindings={hasCustomFindings}
                    showResolved={showResolved}
                    onToggleShowResolved={setShowResolved}
                    resolvedCount={resolvedIds.size}
                  />
                </div>

                <FindingsList
                  findings={filteredFindings}
                  isAnalyzing={isAnalyzing}
                  selectedFindingId={selectedFindingId}
                  onSelectFinding={setSelectedFindingId}
                  resolvedIds={resolvedIds}
                  onToggleResolved={toggleResolved}
                />
              </div>

              {/* Document preview (sticky) */}
              <aside className="xl:col-span-5 xl:sticky xl:top-20 xl:self-start">
                <DocumentPreview
                  documentModel={isDemoEngine ? null : documentModel}
                  findings={findings}
                  selectedFindingId={selectedFindingId}
                  onSelectFinding={setSelectedFindingId}
                  resolvedIds={resolvedIds}
                />
              </aside>
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/50 mt-10">
        <div className="mx-auto max-w-[1600px] px-8 py-4 text-xs text-slate-400 flex items-center justify-between">
          <span>Ryder · client demo (mocked data)</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
