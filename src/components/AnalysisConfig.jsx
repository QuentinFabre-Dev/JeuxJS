import { SKILLS, DOC_TYPES } from '../data/constants.js';
import SkillChip from './SkillChip.jsx';

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
            Analysis types
          </h3>
          <span className="text-xs text-slate-400">
            {selectedSkills.length} selected
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
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Hover a type to see its description.
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
    </div>
  );
}
