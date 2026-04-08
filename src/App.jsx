import { useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Square } from 'lucide-react';

import Header from './components/Header.jsx';
import UploadZone from './components/UploadZone.jsx';
import AnalysisConfig from './components/AnalysisConfig.jsx';
import AnalysisProgress from './components/AnalysisProgress.jsx';
import FindingsList from './components/FindingsList.jsx';
import FindingsFilter from './components/FindingsFilter.jsx';
import DocumentScore from './components/DocumentScore.jsx';
import SummaryView from './components/SummaryView.jsx';
import DocumentPreview from './components/DocumentPreview.jsx';

import { runMockAnalysis } from './services/mockAnalysisService.js';
import { SKILLS } from './data/constants.js';

// Étapes de l'app : 'idle' | 'analyzing' | 'done'
export default function App() {
  const [file, setFile] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState(
    SKILLS.map((s) => s.id) // tous activés par défaut
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

  // ── Filtrage ───────────────────────────────────────────────
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

      <main className="flex-1 mx-auto max-w-7xl w-full px-6 py-10">
        {/* Hero */}
        <section className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Analyse de qualité documentaire
          </h2>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Importez un document, sélectionnez les contrôles à appliquer et
            obtenez en quelques secondes des suggestions d'amélioration
            catégorisées et priorisées.
          </p>
        </section>

        {!showResults ? (
          /* ─── État INITIAL : 5 / 7 ─── */
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
                Lancer l'analyse
              </button>
            </aside>

            <section className="lg:col-span-7">
              <div className="card p-12 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-brand-50 grid place-items-center mb-4">
                  <Play className="h-5 w-5 text-brand-600" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Prêt à analyser votre document
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Importez un fichier puis lancez l'analyse pour voir
                  apparaître les findings en temps réel, ainsi que leur
                  emplacement dans le document.
                </p>
              </div>
            </section>
          </div>
        ) : (
          /* ─── État ACTIF : 3 / 5 / 4 ─── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Colonne 1 — Configuration compacte */}
            <aside className="lg:col-span-3 space-y-4">
              <UploadZone file={file} onFileChange={setFile} />
              <AnalysisConfig
                compact
                selectedSkills={selectedSkills}
                onToggleSkill={toggleSkill}
                docType={docType}
                onDocTypeChange={setDocType}
              />
              <div className="flex items-center gap-2">
                {isAnalyzing ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="btn-primary flex-1 !bg-slate-900 hover:!bg-slate-800"
                  >
                    <Square className="h-4 w-4" strokeWidth={2.5} />
                    Arrêter
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={!file || selectedSkills.length === 0}
                    className="btn-primary flex-1"
                  >
                    <Play className="h-4 w-4" strokeWidth={2.5} />
                    Relancer
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-ghost"
                  title="Réinitialiser"
                  aria-label="Réinitialiser"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </aside>

            {/* Colonne 2 — Document preview (sticky) */}
            <section className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
              <DocumentPreview
                findings={findings}
                selectedFindingId={selectedFindingId}
                onSelectFinding={setSelectedFindingId}
              />
            </section>

            {/* Colonne 3 — Analyse + findings */}
            <section className="lg:col-span-4 space-y-4">
              {isAnalyzing && (
                <AnalysisProgress
                  progress={progress}
                  count={findings.length}
                />
              )}

              {findings.length > 0 && (
                <>
                  <DocumentScore
                    findings={findings}
                    isAnalyzing={isAnalyzing}
                  />
                  <SummaryView findings={findings} />
                  <FindingsFilter
                    skillFilter={skillFilter}
                    onSkillFilterChange={setSkillFilter}
                    priorityFilter={priorityFilter}
                    onPriorityFilterChange={setPriorityFilter}
                    total={findings.length}
                    visible={filteredFindings.length}
                  />
                </>
              )}

              <FindingsList
                findings={filteredFindings}
                isAnalyzing={isAnalyzing}
                selectedFindingId={selectedFindingId}
                onSelectFinding={setSelectedFindingId}
              />
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200/70 bg-white/50">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-slate-400 flex items-center justify-between">
          <span>QualiScan · démo client (données fictives)</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
