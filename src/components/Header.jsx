export default function Header({ children }) {
  return (
    <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-[1600px] px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Ryder
          </h1>
          <p className="text-xs text-slate-500 -mt-0.5">
            Document quality review
          </p>
        </div>

        <div className="flex items-center gap-2">
          {children}
          <span className="hidden sm:inline text-xs text-slate-400">v0.3</span>
        </div>
      </div>
    </header>
  );
}
