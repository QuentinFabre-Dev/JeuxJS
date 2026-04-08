import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-[1600px] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-600 grid place-items-center shadow-soft">
            <span className="text-white font-bold text-sm tracking-tight">R</span>
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              Ryder
            </h1>
            <p className="text-xs text-slate-500 -mt-0.5">
              AI-powered document audit
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Sparkles className="h-3.5 w-3.5" />
            Demo
          </span>
          <span className="text-xs text-slate-400">v0.2</span>
        </div>
      </div>
    </header>
  );
}
