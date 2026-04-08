import { Check } from 'lucide-react';
import { SKILLS, DOC_TYPES } from '../data/constants.js';

export default function AnalysisConfig({
  selectedSkills,
  onToggleSkill,
  docType,
  onDocTypeChange,
}) {
  return (
    <div className="card p-6 space-y-6">
      {/* Skills */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Types d'analyse
          </h3>
          <span className="text-xs text-slate-400">
            {selectedSkills.length} sélectionné{selectedSkills.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SKILLS.map((skill) => {
            const checked = selectedSkills.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => onToggleSkill(skill.id)}
                className={[
                  'group flex items-start gap-3 rounded-xl border p-3 text-left',
                  'transition-all',
                  checked
                    ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 h-4 w-4 rounded-md grid place-items-center transition-colors',
                    checked
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-slate-300',
                  ].join(' ')}
                  aria-hidden
                >
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-900">
                    {skill.label}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                    {skill.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Document type */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Type de document
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
    </div>
  );
}
