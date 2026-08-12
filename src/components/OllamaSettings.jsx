import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Check,
  Cpu,
  Loader2,
  RefreshCw,
  Settings2,
  WifiOff,
  X,
} from 'lucide-react';

import { PROXY_BASE_URL } from '../config/ollama.js';

const STATUS_STYLES = {
  checking: {
    label: 'Connecting…',
    chip: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
    Icon: Loader2,
    spin: true,
  },
  ready: {
    label: 'Local model',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    Icon: Check,
  },
  'missing-model': {
    label: 'Model missing',
    chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    Icon: AlertTriangle,
  },
  offline: {
    label: 'Ollama offline',
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    Icon: WifiOff,
  },
};

const formatSize = (bytes) => (bytes ? `${(bytes / 1e9).toFixed(1)} GB` : '');

/**
 * Connection badge + settings dialog for the local Ollama server.
 */
export default function OllamaSettings({
  settings,
  onChange,
  status,
  models,
  error,
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(settings.baseUrl);

  useEffect(() => setDraftUrl(settings.baseUrl), [settings.baseUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const isDemo = settings.engine === 'demo';
  const style = isDemo
    ? {
        label: 'Demo data',
        chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
        Icon: Cpu,
      }
    : (STATUS_STYLES[status] ?? STATUS_STYLES.checking);

  const { Icon } = style;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`chip ${style.chip} hover:brightness-95 transition`}
        title={
          isDemo
            ? 'Running on mocked findings'
            : `${settings.model} · ${settings.baseUrl}`
        }
      >
        <Icon className={`h-3.5 w-3.5 ${style.spin ? 'animate-spin' : ''}`} />
        {style.label}
        {!isDemo && status === 'ready' && (
          <span className="text-emerald-600/70 font-normal">
            · {settings.model}
          </span>
        )}
        <Settings2 className="h-3 w-3 opacity-50" />
      </button>

      {/* Rendered in a portal: the header uses backdrop-blur, and a filtered
          ancestor becomes the containing block of `fixed` children. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm grid place-items-center p-4"
            onClick={() => setOpen(false)}
            role="presentation"
          >
            <div
              className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Ollama settings"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Local AI engine
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Documents never leave your machine.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-ghost !px-2 !py-2"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Engine switch */}
              <div className="flex gap-2 mb-5">
                {[
                  { id: 'ollama', label: 'Ollama (local)' },
                  { id: 'demo', label: 'Demo data' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange({ engine: option.id })}
                    className={[
                      'flex-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
                      settings.engine === option.id
                        ? 'bg-brand-50 text-brand-700 ring-brand-200'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Status */}
              <div
                className={`rounded-xl px-3.5 py-3 mb-5 text-xs ${
                  status === 'ready'
                    ? 'bg-emerald-50 text-emerald-800'
                    : status === 'checking'
                      ? 'bg-slate-50 text-slate-600'
                      : 'bg-amber-50 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {status === 'ready'
                      ? `Connected · ${models.length} model(s) installed`
                      : (error?.message ?? 'Checking the connection…')}
                  </span>
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="inline-flex items-center gap-1 font-medium hover:underline shrink-0"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retest
                  </button>
                </div>
                {error?.hint && <p className="mt-1 opacity-80">{error.hint}</p>}
              </div>

              {/* Model */}
              <label className="block mb-4">
                <span className="text-xs font-medium text-slate-700">
                  Model
                </span>
                {models.length > 0 ? (
                  <select
                    value={
                      models.some((model) => model.name === settings.model)
                        ? settings.model
                        : ''
                    }
                    onChange={(event) =>
                      onChange({ model: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    {!models.some((model) => model.name === settings.model) && (
                      <option value="">{settings.model} (not installed)</option>
                    )}
                    {models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                        {model.parameterSize ? ` · ${model.parameterSize}` : ''}
                        {model.size ? ` · ${formatSize(model.size)}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={settings.model}
                    onChange={(event) =>
                      onChange({ model: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder="llama3.1:8b"
                  />
                )}
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Recommended: llama3.1:8b (general) or qwen2.5:14b (sharper,
                  slower).
                </span>
              </label>

              {/* Endpoint */}
              <label className="block mb-4">
                <span className="text-xs font-medium text-slate-700">
                  Endpoint
                </span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={draftUrl}
                    onChange={(event) => setDraftUrl(event.target.value)}
                    onBlur={() => onChange({ baseUrl: draftUrl })}
                    onKeyDown={(event) =>
                      event.key === 'Enter' && onChange({ baseUrl: draftUrl })
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-brand-400"
                    placeholder={PROXY_BASE_URL}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftUrl(PROXY_BASE_URL);
                      onChange({ baseUrl: PROXY_BASE_URL });
                    }}
                    className="btn-ghost !px-3 text-xs"
                  >
                    Reset
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  <code>{PROXY_BASE_URL}</code> goes through the dev proxy (no
                  CORS setup). A direct URL such as{' '}
                  <code>http://localhost:11434</code> requires starting Ollama
                  with <code>OLLAMA_ORIGINS=*</code>.
                </span>
              </label>

              {/* Tuning */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    key: 'temperature',
                    label: 'Temperature',
                    step: 0.1,
                    min: 0,
                    max: 1,
                  },
                  {
                    key: 'numCtx',
                    label: 'Context',
                    step: 1024,
                    min: 2048,
                    max: 32768,
                  },
                  {
                    key: 'pagesPerBatch',
                    label: 'Pages / call',
                    step: 1,
                    min: 1,
                    max: 10,
                  },
                ].map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-xs font-medium text-slate-700">
                      {field.label}
                    </span>
                    <input
                      type="number"
                      value={settings[field.key]}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      onChange={(event) =>
                        onChange({ [field.key]: Number(event.target.value) })
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </label>
                ))}
              </div>

              <p className="text-[11px] text-slate-400 mt-4">
                Fewer pages per call = more requests but higher accuracy on long
                documents.
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
