import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  normaliseBaseUrl,
  saveSettings,
} from '../config/ollama.js';
import { listModels } from '../services/ollamaClient.js';

/**
 * Holds the Ollama settings and the live connection status.
 *
 * status: 'checking' | 'ready' | 'missing-model' | 'offline'
 */
export default function useOllama() {
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState('checking');
  const [models, setModels] = useState([]);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('checking');
    setError(null);

    try {
      const installed = await listModels(settings.baseUrl, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setModels(installed);

      const names = installed.map((model) => model.name);
      const hasModel = names.some(
        (name) => name === settings.model || name.split(':')[0] === settings.model.split(':')[0]
      );

      if (!installed.length) {
        setStatus('missing-model');
        setError({
          message: 'Ollama is running but no model is installed.',
          hint: `Run: ollama pull ${settings.model}`,
        });
      } else if (!hasModel) {
        setStatus('missing-model');
        setError({
          message: `Model "${settings.model}" is not installed.`,
          hint: `Installed: ${names.join(', ')} — or run: ollama pull ${settings.model}`,
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
  }, [settings.baseUrl, settings.model]);

  useEffect(() => {
    refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  const updateSettings = useCallback((patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (patch.baseUrl !== undefined) next.baseUrl = normaliseBaseUrl(patch.baseUrl);
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return { settings, updateSettings, resetSettings, status, models, error, refresh };
}
