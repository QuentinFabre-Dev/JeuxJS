import { Check } from 'lucide-react';

/**
 * Compact toggleable pill for an analysis skill.
 * Hovering the chip reveals the description in a small floating tooltip.
 */
export default function SkillChip({ skill, checked, onToggle }) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onToggle?.(skill.id)}
        aria-pressed={checked}
        className={[
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5',
          'text-xs font-medium transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
          checked
            ? 'bg-brand-600 text-white shadow-soft hover:bg-brand-700'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'grid place-items-center h-3.5 w-3.5 rounded-full transition-colors',
            checked ? 'bg-white/20' : 'bg-slate-100',
          ].join(' ')}
          aria-hidden
        >
          {checked && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
        </span>
        {skill.label}
      </button>

      {/* Tooltip */}
      <div
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2
                   rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg
                   opacity-0 translate-y-0.5 transition-all duration-150
                   group-hover:opacity-100 group-hover:translate-y-0
                   group-focus-within:opacity-100 group-focus-within:translate-y-0"
      >
        {skill.description}
        <span
          className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"
          aria-hidden
        />
      </div>
    </div>
  );
}
