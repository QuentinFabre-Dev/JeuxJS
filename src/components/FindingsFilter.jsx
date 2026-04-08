import { Filter } from 'lucide-react';
import { PRIORITIES, SKILLS } from '../data/constants.js';

export default function FindingsFilter({
  skillFilter,
  onSkillFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  total,
  visible,
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
        className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5
                   font-medium text-slate-700 shadow-soft
                   focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      >
        <option value="all">All types</option>
        {SKILLS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={priorityFilter}
        onChange={(e) => onPriorityFilterChange(e.target.value)}
        className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5
                   font-medium text-slate-700 shadow-soft
                   focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      >
        <option value="all">All priorities</option>
        {Object.values(PRIORITIES).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label} priority
          </option>
        ))}
      </select>

      <span className="ml-auto text-xs text-slate-500 tabular-nums">
        {visible} / {total} finding{total > 1 ? 's' : ''}
      </span>
    </div>
  );
}
