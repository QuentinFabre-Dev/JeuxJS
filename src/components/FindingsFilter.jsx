import { Filter } from 'lucide-react';

import { PRIORITIES, SKILLS } from '../data/constants.js';
import { REVIEW_STATES, STATUS_LABELS } from '../data/review.js';

export const SORT_MODES = [
  { id: 'document', label: 'Document order' },
  { id: 'priority', label: 'Priority' },
  { id: 'confidence', label: 'Confidence' },
];

const selectClasses = `text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5
                       font-medium text-slate-700 shadow-soft
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30`;

export default function FindingsFilter({
  skillFilter,
  onSkillFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  statusFilter,
  onStatusFilterChange,
  minConfidence,
  onMinConfidenceChange,
  sortMode,
  onSortModeChange,
  total,
  visible,
  hasCustomFindings,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Filter className="h-3.5 w-3.5" />
        <span>Filters</span>
      </div>

      <select
        value={skillFilter}
        onChange={(e) => onSkillFilterChange(e.target.value)}
        className={selectClasses}
        aria-label="Filter by type"
      >
        <option value="all">All types</option>
        {SKILLS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
        {hasCustomFindings && <option value="custom">Custom</option>}
      </select>

      <select
        value={priorityFilter}
        onChange={(e) => onPriorityFilterChange(e.target.value)}
        className={selectClasses}
        aria-label="Filter by priority"
      >
        <option value="all">All priorities</option>
        {Object.values(PRIORITIES).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} priority
          </option>
        ))}
      </select>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className={selectClasses}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        {Object.values(REVIEW_STATES).map((state) => (
          <option key={state} value={state}>
            {STATUS_LABELS[state]}
          </option>
        ))}
      </select>

      <select
        value={sortMode}
        onChange={(e) => onSortModeChange(e.target.value)}
        className={selectClasses}
        aria-label="Sort findings"
      >
        {SORT_MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>
            Sort: {mode.label}
          </option>
        ))}
      </select>

      {/* A local model is not always sure of itself: hide the shaky calls. */}
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <span className="whitespace-nowrap">
          Min. confidence
          <span className="ml-1 font-semibold tabular-nums text-slate-800">
            {Math.round(minConfidence * 100)}%
          </span>
        </span>
        <input
          type="range"
          min="0"
          max="0.95"
          step="0.05"
          value={minConfidence}
          onChange={(e) => onMinConfidenceChange(Number(e.target.value))}
          className="w-24 accent-brand-600"
          aria-label="Minimum confidence"
        />
      </label>

      <span className="ml-auto text-xs text-slate-500 tabular-nums">
        {visible} / {total} finding{total > 1 ? 's' : ''}
      </span>
    </div>
  );
}
