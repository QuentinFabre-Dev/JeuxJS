export default function Header({ children }) {
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

        <div className="flex items-center gap-2">
          {children}
          <span className="hidden sm:inline text-xs text-slate-400">v0.3</span>
        </div>
      </div>
    </header>
  );
}
