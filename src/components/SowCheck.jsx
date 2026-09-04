'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  FileSignature,
  Loader2,
  MinusCircle,
  Play,
  X,
} from 'lucide-react';

import { parseDocument } from '../services/documentParser.js';
import { loadSample } from '../services/sampleDocuments.js';
import { runSowCheck } from '../services/sowService.js';
import { rollupLabel } from '../../lib/checks/sow.js';
import { actualCost, formatCost } from '../../lib/checks/estimate.js';

const STATUS = {
  met: {
    label: 'Honoured',
    Icon: CheckCircle2,
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  partial: {
    label: 'Partial',
    Icon: MinusCircle,
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  missing: {
    label: 'Missing',
    Icon: CircleSlash,
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  },
  contradicted: {
    label: 'Contradicted',
    Icon: AlertTriangle,
    chip: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300',
  },
  unchecked: {
    label: 'Not checked',
    Icon: MinusCircle,
    chip: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  },
};

const OUTCOME = {
  compliant: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  gaps: 'bg-amber-50 text-amber-900 ring-amber-200',
  breach: 'bg-rose-50 text-rose-900 ring-rose-200',
};

// A missing commitment sorts above an honoured one: the panel exists for what
// is wrong, and burying three gaps under twenty green rows defeats it.
const RANK = { contradicted: 0, missing: 1, partial: 2, unchecked: 3, met: 4 };

/**
 * Does this deliverable honour the signed statement of work?
 *
 * A separate panel from the quality findings, because it answers a different
 * question: a quality finding points at a sentence that is wrong, a contract
 * gap points at a sentence that is missing — and there is nothing to highlight
 * for that.
 */
export default function SowCheck({ documentModel, language }) {
  const [sowFile, setSowFile] = useState(null);
  const [sowModel, setSowModel] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | running | done
  const [commitments, setCommitments] = useState([]);
  const [verdicts, setVerdicts] = useState(new Map());
  const [summary, setSummary] = useState(null);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: false,
    onDrop: (files) => {
      if (files[0]) accept(files[0]);
    },
  });

  const accept = async (file) => {
    setStatus('parsing');
    setError(null);
    try {
      const parsed = await parseDocument(file);
      setSowFile(file);
      setSowModel(parsed);
    } catch (parseError) {
      setError(parseError.message);
    } finally {
      setStatus('idle');
    }
  };

  const useSample = async () => {
    setError(null);
    try {
      await accept(await loadSample('sow'));
    } catch (sampleError) {
      setError(sampleError.message);
    }
  };

  const reset = () => {
    setSowFile(null);
    setSowModel(null);
    setCommitments([]);
    setVerdicts(new Map());
    setSummary(null);
    setUsage(null);
    setError(null);
    setStatus('idle');
  };

  const run = async () => {
    if (!sowModel || !documentModel) return;
    setStatus('running');
    setError(null);
    setCommitments([]);
    setVerdicts(new Map());
    setSummary(null);

    try {
      const result = await runSowCheck({
        documentModel,
        sowModel,
        language,
        onCommitments: setCommitments,
        onVerdict: (verdict) =>
          setVerdicts((current) => new Map(current).set(verdict.id, verdict)),
        onError: (message) => setError(message),
      });
      setSummary(result?.compliance ?? null);
      setUsage(result?.usage ?? null);
    } catch (runError) {
      setError(runError.message);
    } finally {
      setStatus('done');
    }
  };

  const rows = commitments
    .map((commitment) => ({
      commitment,
      verdict: verdicts.get(commitment.id) ?? null,
    }))
    .sort(
      (a, b) =>
        RANK[a.verdict?.status ?? 'unchecked'] - RANK[b.verdict?.status ?? 'unchecked']
    );

  const running = status === 'running';

  return (
    <section className="card p-4">
      {!sowFile ? (
        <div
          {...getRootProps()}
          className={[
            'flex items-center gap-3 rounded-lg px-1 py-0.5 cursor-pointer transition',
            isDragActive ? 'bg-brand-50/60' : 'hover:bg-slate-50',
          ].join(' ')}
        >
          <input {...getInputProps()} />
          <FileSignature className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-800">
              {status === 'parsing' ? 'Reading the SoW…' : 'Check against the signed SoW'}
            </p>
            <p className="text-[11px] text-slate-400">
              Drop it here, or{' '}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  useSample();
                }}
                className="font-medium text-brand-600 hover:underline"
              >
                use the sample
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <FileSignature className="h-4 w-4 shrink-0 text-brand-600" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{sowFile.name}</p>
            <p className="text-[11px] text-slate-500">
              {sowModel?.pages?.length ?? 0} page
              {(sowModel?.pages?.length ?? 0) > 1 ? 's' : ''} · signed statement of work
            </p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running || !documentModel}
            className="btn-primary !px-3 !py-1.5 !text-xs"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            {running ? 'Checking…' : 'Check'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-slate-300 hover:text-rose-500"
            aria-label="Remove the statement of work"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

      {summary && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ring-1 ${
            OUTCOME[summary.outcome] ?? OUTCOME.gaps
          }`}
        >
          {rollupLabel(summary)}
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map(({ commitment, verdict }) => {
            const style = STATUS[verdict?.status ?? 'unchecked'];
            const { Icon } = style;
            return (
              <li
                key={commitment.id}
                className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200"
              >
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800">{commitment.text}</p>
                    {verdict?.explanation && (
                      <p className="mt-1 text-[11px] text-slate-500">{verdict.explanation}</p>
                    )}
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                      <span className={`chip ${style.chip} !text-[10px]`}>{style.label}</span>
                      <span className="uppercase tracking-wide">{commitment.kind}</span>
                      {commitment.critical && (
                        <span className="font-semibold text-rose-600">critical</span>
                      )}
                      {verdict?.evidence?.length > 0 && (
                        <span>· evidence: {verdict.evidence.join(', ')}</span>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {usage && Object.keys(usage).length > 0 && (
        <p className="mt-3 text-[10px] text-slate-400">
          Contract check cost {formatCost(actualCost(usage).dollars)}.
        </p>
      )}
    </section>
  );
}
