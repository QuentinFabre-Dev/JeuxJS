import { useState } from 'react';
import { BookmarkPlus, Plus, Trash2 } from 'lucide-react';

import { DOC_TYPES, SERVICE_LINES, SKILLS } from '../data/constants.js';
import { LANGUAGES, languageLabel } from '../services/languageDetect.js';
import SkillChip from './SkillChip.jsx';
import CustomCheckChip from './CustomCheckChip.jsx';
import ReviewEstimate from './ReviewEstimate.jsx';

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
  language,
  onLanguageChange,
  detectedLanguage,
  playbooks = [],
  onApplyPlaybook,
  onSavePlaybook,
  onDeletePlaybook,
  pageCount,
}) {
  const [draft, setDraft] = useState('');
  const [playbookName, setPlaybookName] = useState('');

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

        {/* What this selection costs, next to the switch that changes it. */}
        <div className="mt-3">
          <ReviewEstimate
            skills={selectedSkills}
            customChecks={customChecks}
            pageCount={pageCount}
          />
        </div>
      </section>

      {/* Playbooks */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Playbooks</h3>
          <span className="text-xs text-slate-400">
            {playbooks.length} saved
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {playbooks.map((playbook) => (
            <span
              key={playbook.id}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1
                         text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            >
              <button
                type="button"
                onClick={() => onApplyPlaybook?.(playbook)}
                className="hover:text-brand-600"
                title={playbook.checks.join(' · ')}
              >
                {playbook.name}
                <span className="ml-1 text-slate-400">
                  ({playbook.checks.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDeletePlaybook?.(playbook.id)}
                className="text-slate-300 hover:text-rose-500"
                aria-label={`Delete playbook ${playbook.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
          {playbooks.length === 0 && (
            <p className="text-[11px] text-slate-400">
              No playbook yet — save your custom checks to reuse them later.
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={playbookName}
            onChange={(e) => setPlaybookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (!playbookName.trim() || !customChecks.length) return;
              onSavePlaybook?.(playbookName);
              setPlaybookName('');
            }}
            placeholder="Name this set of custom checks"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5
                       text-xs text-slate-700 shadow-soft placeholder:text-slate-400
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={() => {
              onSavePlaybook?.(playbookName);
              setPlaybookName('');
            }}
            disabled={!playbookName.trim() || customChecks.length === 0}
            className="btn-ghost ring-1 ring-slate-200 !px-3 !py-1.5 !text-xs"
            title={
              customChecks.length === 0
                ? 'Add at least one custom check first'
                : 'Save these custom checks as a playbook'
            }
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </section>

      {/* Language */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Document language
        </h3>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2
                     text-sm font-medium text-slate-700 shadow-soft
                     focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {LANGUAGES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.id === 'auto' && detectedLanguage
                ? `Auto-detect (${languageLabel(detectedLanguage)})`
                : entry.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-slate-400">
          Suggestions and explanations are written in this language.
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
