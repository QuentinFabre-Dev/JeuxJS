import { useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';

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

import { runMockAnalysis } from './services/mockAnalysisService.js';
import { SKILLS } from './data/constants.js';

// App states: 'idle' | 'analyzing' | 'done'
export default function App() {
  const [file, setFile] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState(
    SKILLS.map((s) => s.id) // all enabled by default
  );
  const [docType, setDocType] = useState('report');

  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [findings, setFindings] = useState([]);

  const [skillFilter, setSkillFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedFindingId, setSelectedFindingId] = useState(null);

  const abortRef = useRef(null);

  // ── Handlers ───────────────────────────────────────────────
  const toggleSkill = (id) => {
    setSelectedSkills((current) =>
      current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id]
    );
  };

  const handleStart = async () => {
    if (!file || selectedSkills.length === 0) return;

    // Reset
    setFindings([]);
    setProgress(0);
    setSkillFilter('all');
    setPriorityFilter('all');
    setSelectedFindingId(null);
    setStatus('analyzing');

    const controller = new AbortController();
    abortRef.current = controller;

    await runMockAnalysis({
      file,
      skills: selectedSkills,
      docType,
      signal: controller.signal,
      onFinding: (finding) => {
        setFindings((prev) => [finding, ...prev]);
      },
      onProgress: (p) => setProgress(p),
      onComplete: () => setStatus('done'),
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStatus('done');
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setFile(null);
    setStatus('idle');
    setFindings([]);
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
      return true;
    });
  }, [findings, skillFilter, priorityFilter]);

  const isAnalyzing = status === 'analyzing';
  const showResults = status !== 'idle';

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

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
                <UploadZone file={file} onFileChange={setFile} />
                <AnalysisConfig
                  selectedSkills={selectedSkills}
                  onToggleSkill={toggleSkill}
                  docType={docType}
                  onDocTypeChange={setDocType}
                />
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!file || selectedSkills.length === 0}
                  className="btn-primary w-full"
                >
                  <Play className="h-4 w-4" strokeWidth={2.5} />
                  Start analysis
                </button>
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
              docType={docType}
              onDocTypeChange={setDocType}
              isAnalyzing={isAnalyzing}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
            />

            {/* Progress bar */}
            {isAnalyzing && (
              <AnalysisProgress
                progress={progress}
                count={findings.length}
              />
            )}

            {/* Summary row */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DocumentScore findings={findings} isAnalyzing={isAnalyzing} />
              <PriorityDistribution findings={findings} />
              <SkillCounts findings={findings} />
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
                  />
                </div>

                <FindingsList
                  findings={filteredFindings}
                  isAnalyzing={isAnalyzing}
                  selectedFindingId={selectedFindingId}
                  onSelectFinding={setSelectedFindingId}
                />
              </div>

              {/* Document preview (sticky) */}
              <aside className="xl:col-span-5 xl:sticky xl:top-20 xl:self-start">
                <DocumentPreview
                  findings={findings}
                  selectedFindingId={selectedFindingId}
                  onSelectFinding={setSelectedFindingId}
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
