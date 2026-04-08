import { useState } from 'react';
import { Plus } from 'lucide-react';

import { DOC_TYPES, SERVICE_LINES, SKILLS } from '../data/constants.js';
import SkillChip from './SkillChip.jsx';
import CustomCheckChip from './CustomCheckChip.jsx';

export default function AnalysisConfig({
  selectedSkills,
  onToggleSkill,
  docType,
  onDocTypeChange,
  serviceLine,
  onServiceLineChange,
  customChecks,
  onAddCustomCheck,
  onRemoveCustomCheck,
}) {
  const [draft, setDraft] = useState('');

  const submitCustom = () => {
    const clean = draft.trim();
    if (!clean) return;
    if (customChecks.includes(clean)) {
      setDraft('');
      return;
    }
    onAddCustomCheck(clean);
    setDraft('');
  };

  return (
    <div className="card p-6 space-y-6">
      {/* Skills */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Analysis types
          </h3>
          <span className="text-xs text-slate-400">
            {selectedSkills.length + customChecks.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => (
            <SkillChip
              key={skill.id}
              skill={skill}
              checked={selectedSkills.includes(skill.id)}
              onToggle={onToggleSkill}
            />
          ))}
          {customChecks.map((label) => (
            <CustomCheckChip
              key={label}
              label={label}
              onRemove={onRemoveCustomCheck}
            />
          ))}
        </div>

        {/* Custom check input */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCustom();
              }
            }}
            placeholder="Add a custom check (e.g. GDPR compliance)"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5
                       text-xs text-slate-700 shadow-soft placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={submitCustom}
            disabled={!draft.trim()}
            className="btn-primary !px-3 !py-1.5 !text-xs"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Hover a type to see its description. Custom checks run on the
          same document.
        </p>
      </section>

      {/* Document type */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Document type
        </h3>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((type) => {
            const active = docType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onDocTypeChange(type.id)}
                className={[
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                  active
                    ? 'bg-slate-900 text-white shadow-soft'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Service line */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Service line
        </h3>
        <select
          value={serviceLine}
          onChange={(e) => onServiceLineChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2
                     text-sm font-medium text-slate-700 shadow-soft
                     focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {SERVICE_LINES.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-slate-400">
          Helps tailor the analysis to your practice context.
        </p>
      </section>
    </div>
  );
}
