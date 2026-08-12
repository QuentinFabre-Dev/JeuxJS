import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react';

import { DOC_TYPES, SERVICE_LINES, SKILLS } from '../data/constants.js';
import SkillChip from './SkillChip.jsx';
import CustomCheckChip from './CustomCheckChip.jsx';

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Horizontal configuration bar shown during and after analysis.
 * Lets the user tweak skills / doc type / service line and relaunch
 * the analysis without sacrificing vertical space.
 */
export default function TopBar({
  file,
  onClearFile,
  selectedSkills,
  onToggleSkill,
  customChecks,
  onRemoveCustomCheck,
  docType,
  onDocTypeChange,
  serviceLine,
  onServiceLineChange,
  isAnalyzing,
  onStart,
  onStop,
  onReset,
  onExport,
  isExporting,
  canExport,
  score,
}) {
  const readyToSend = typeof score === 'number' && score >= 80;

  return (
    <div className="card p-4 flex flex-wrap items-center gap-4">
      {/* File */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-brand-50 grid place-items-center shrink-0">
          <FileText className="h-4 w-4 text-brand-600" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 truncate max-w-[220px]">
              {file?.name ?? 'No document'}
            </p>
            {readyToSend && (
              <span
                className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
                           animate-fade-in-up"
                title={`Quality score: ${score}/100`}
              >
                <CheckCircle2 className="h-3 w-3" />
                Ready to send
              </span>
            )}
          </div>
          {file && (
            <p className="text-[11px] text-slate-500 -mt-0.5">
              {formatBytes(file.size)}
            </p>
          )}
        </div>
        {file && (
          <button
            type="button"
            onClick={onClearFile}
            className="btn-ghost !px-2 !py-1.5"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="h-8 w-px bg-slate-200 hidden md:block" />

      {/* Skills + custom */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
          Analysis
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SKILLS.map((skill) => (
            <SkillChip
              key={skill.id}
              skill={skill}
              checked={selectedSkills.includes(skill.id)}
              onToggle={onToggleSkill}
            />
          ))}
          {customChecks?.map((label) => (
            <CustomCheckChip
              key={label}
              label={label}
              onRemove={onRemoveCustomCheck}
            />
          ))}
        </div>
      </div>

      <div className="h-8 w-px bg-slate-200 hidden md:block" />

      {/* Doc type */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
          Type
        </span>
        <select
          value={docType}
          onChange={(e) => onDocTypeChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-soft
                     focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Service line */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
          Service
        </span>
        <select
          value={serviceLine}
          onChange={(e) => onServiceLineChange(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-soft
                     focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {SERVICE_LINES.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.label}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport || isExporting}
          className="btn-ghost ring-1 ring-slate-200"
          title="Export the review to Excel"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Excel
        </button>

        {isAnalyzing ? (
          <button
            type="button"
            onClick={onStop}
            className="btn-primary !bg-slate-900 hover:!bg-slate-800"
          >
            <Square className="h-4 w-4" strokeWidth={2.5} />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={!file || selectedSkills.length === 0}
            className="btn-primary"
          >
            <Play className="h-4 w-4" strokeWidth={2.5} />
            Re-run
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="btn-ghost"
          title="Reset"
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
