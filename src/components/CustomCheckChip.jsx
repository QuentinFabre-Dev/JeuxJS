import { Sparkles, X } from 'lucide-react';

/**
 * Pill representing a user-defined custom analysis check.
 * Always visually "selected" (since the user explicitly created it);
 * clicking the × removes it.
 */
export default function CustomCheckChip({ label, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5
                 text-xs font-medium bg-brand-50 text-brand-700
                 ring-1 ring-brand-200"
    >
      <Sparkles className="h-3 w-3" />
      {label}
      <button
        type="button"
        onClick={() => onRemove?.(label)}
        className="ml-0.5 rounded-full p-0.5 hover:bg-brand-100
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
