/**
 * Client minimal pour l'API Ollama locale (aucune dépendance externe).
 * Documentation : https://github.com/ollama/ollama/blob/main/docs/api.md
 */

export class OllamaError extends Error {
  constructor(message, { cause, hint } = {}) {
    super(message, { cause });
    this.name = "OllamaError";
    this.hint = hint;
  }
}

async function request(cfg, endpoint, { method = "GET", body, timeoutMs } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? cfg.timeoutMs);
  const url = `${cfg.host}${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new OllamaError(`Délai dépassé (${(timeoutMs ?? cfg.timeoutMs) / 1000}s) sur ${url}`, {
        cause: err,
        hint: "Augmentez timeoutMs dans qa.config.json ou choisissez un modèle plus léger.",
      });
    }
    throw new OllamaError(`Impossible de joindre Ollama sur ${cfg.host}`, {
      cause: err,
      hint: "Vérifiez qu'Ollama tourne (`ollama serve`) et que l'hôte est correct.",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new OllamaError(`Ollama a répondu ${response.status} sur ${endpoint}. ${detail.trim()}`);
  }
  return response.json();
}

export async function listModels(cfg) {
  const data = await request(cfg, "/api/tags", { timeoutMs: 15000 });
  return (data.models ?? []).map((m) => ({
    name: m.name,
    size: m.size,
    family: m.details?.family,
    parameterSize: m.details?.parameter_size,
    quantization: m.details?.quantization_level,
  }));
}

export async function ensureModel(cfg) {
  const models = await listModels(cfg);
  const names = models.map((m) => m.name);
  // "qwen2.5-coder:7b" et "qwen2.5-coder" désignent le même modèle côté utilisateur.
  const found = names.find((n) => n === cfg.model || n.split(":")[0] === cfg.model.split(":")[0]);
  if (!found) {
    throw new OllamaError(`Le modèle "${cfg.model}" n'est pas installé.`, {
      hint: names.length
        ? `Modèles disponibles : ${names.join(", ")}. Ou installez-le : ollama pull ${cfg.model}`
        : `Aucun modèle installé. Lancez : ollama pull ${cfg.model}`,
    });
  }
  return found;
}

export async function chat(cfg, { system, user, json = false }) {
  const data = await request(cfg, "/api/chat", {
    method: "POST",
    body: {
      model: cfg.model,
      stream: false,
      format: json ? "json" : undefined,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      options: {
        temperature: cfg.temperature,
        num_ctx: cfg.numCtx,
      },
    },
  });
  return {
    content: data.message?.content ?? "",
    promptTokens: data.prompt_eval_count ?? 0,
    responseTokens: data.eval_count ?? 0,
    durationMs: Math.round((data.total_duration ?? 0) / 1e6),
  };
}

/**
 * Extrait un objet JSON d'une réponse de modèle, même si elle est entourée
 * de texte ou d'un bloc ```json.
 */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [text, fenced?.[1]].filter(Boolean);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      /* on tente ensuite une extraction par accolades */
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* candidat suivant */
      }
    }
  }
  throw new OllamaError("Le modèle n'a pas renvoyé de JSON exploitable.", {
    hint: `Début de la réponse : ${text.slice(0, 200)}`,
  });
}

/** Appelle le modèle et garantit une réponse JSON, avec relances. */
export async function chatJson(cfg, { system, user }) {
  let lastError;
  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    try {
      const result = await chat(cfg, { system, user, json: true });
      return { ...result, data: extractJson(result.content) };
    } catch (err) {
      lastError = err;
      const retryable = err instanceof OllamaError && /JSON/.test(err.message);
      if (!retryable || attempt === cfg.retries) throw err;
    }
  }
  throw lastError;
}
