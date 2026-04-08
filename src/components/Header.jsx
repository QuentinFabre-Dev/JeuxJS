import { ScanSearch, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-600 grid place-items-center shadow-soft">
            <ScanSearch className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              QualiScan
            </h1>
            <p className="text-xs text-slate-500 -mt-0.5">
              Audit documentaire augmenté par l'IA
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="h-3.5 w-3.5" />
            Démo
          </span>
          <span className="text-xs text-slate-400">v0.1</span>
        </div>
      </div>
    </header>
  );
}
