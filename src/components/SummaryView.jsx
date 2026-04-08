import { PRIORITIES, SKILLS, SKILL_STYLES } from '../data/constants.js';

export default function SummaryView({ findings }) {
  // Compteurs par priorité
  const byPriority = Object.values(PRIORITIES).map((p) => ({
    ...p,
    count: findings.filter((f) => f.priority === p.id).length,
  }));

  // Compteurs par skill
  const bySkill = SKILLS.map((s) => ({
    ...s,
    count: findings.filter((f) => f.skill === s.id).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
        Résumé
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {byPriority.map((p) => (
          <div
            key={p.id}
            className="rounded-xl bg-slate-50/80 ring-1 ring-slate-100 p-3"
          >
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {p.label}
              </span>
            </div>
            <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">
              {p.count}
            </p>
          </div>
        ))}
      </div>

      {bySkill.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">
            Par catégorie
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bySkill.map((s) => (
              <span
                key={s.id}
                className={`chip ${SKILL_STYLES[s.id]}`}
              >
                {s.label}
                <span className="ml-1 font-semibold tabular-nums">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
