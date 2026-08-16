import { useCallback, useEffect, useRef, useState } from 'react';

import {
  activeBaseUrl,
  activeModel,
  DEFAULT_SETTINGS,
  loadSettings,
  normaliseBaseUrl,
  PROVIDERS,
  saveSettings,
} from '../config/providers.js';
import { listModels } from '../services/providers.js';

/**
 * Holds the provider settings and the live connection status.
 *
 * status: 'checking' | 'ready' | 'missing-model' | 'offline'
 */
export default function useProvider() {
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState('checking');
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const engine = settings.engine;
  const model = activeModel(settings);
  const baseUrl = activeBaseUrl(settings);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // The demo engine needs no server at all.
    if (engine === 'demo') {
      setStatus('ready');
      setModels([]);
      setError(null);
      return;
    }

    setStatus('checking');
    setError(null);

    try {
      const installed = await listModels(engine, baseUrl, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setModels(installed);
      const names = installed.map((entry) => entry.name);

      // A cloud provider serves a fixed catalogue: any model it lists is usable,
      // and an unlisted one is a typo rather than something to install.
      const known = PROVIDERS[engine]?.knownModels ?? [];
      const hasModel = names.some(
        (name) => name === model || name.split(':')[0] === model.split(':')[0]
      );

      if (!installed.length && !known.length) {
        setStatus('missing-model');
        setError({
          message: 'The provider is reachable but exposes no model.',
          hint: `Run: ollama pull ${model}`,
        });
      } else if (!hasModel && !known.includes(model)) {
        setStatus('missing-model');
        setError({
          message: `Model "${model}" is not available.`,
          hint: names.length
            ? `Available: ${names.slice(0, 6).join(', ')}`
            : `Run: ollama pull ${model}`,
        });
      } else {
        setStatus('ready');
      }
    } catch (err) {
      if (controller.signal.aborted || err.name === 'AbortError') return;
      setModels([]);
      setStatus('offline');
      setError({ message: err.message, hint: err.hint });
    }
  }, [engine, baseUrl, model]);

  useEffect(() => {
    refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  const updateSettings = useCallback((patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (patch.baseUrl !== undefined) next.baseUrl = normaliseBaseUrl(patch.baseUrl);
      // A model choice belongs to the provider it was made for.
      if (patch.model !== undefined) {
        next.models = { ...current.models, [next.engine]: patch.model };
        delete next.model;
      }
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    settings,
    // Flattened for the callers: the active provider's model and endpoint.
    model,
    baseUrl,
    engine,
    provider: PROVIDERS[engine] ?? PROVIDERS.ollama,
    updateSettings,
    resetSettings,
    status,
    models,
    error,
    refresh,
  };
}
