/**
 * services/codexService.ts
 * Serviço simples para chamar a API de Responses da OpenAI (uso server-side apenas).
 * - NÃO exponha `OPENAI_API_KEY` no frontend. Use este módulo em rotas/funcões server-side.
 */

type GenOptions = {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  store?: boolean;
};

const DEFAULT_OPTIONS: GenOptions = {
  model: 'gpt-4o-mini-code',
  max_tokens: 512,
  temperature: 0.2,
  store: false,
};

function getApiKey(): string {
  // Prefer server-side env var. Do NOT use this in browser bundles.
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
  if (!key) throw new Error('OPENAI_API_KEY not configured (set in server env)');
  return key;
}

export async function generateWithCodex(prompt: string, opts?: GenOptions) {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const payload = {
    model: options.model,
    input: prompt,
    max_tokens: options.max_tokens,
    temperature: options.temperature,
    store: options.store,
  } as Record<string, unknown>;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${txt}`);
  }

  const data = await res.json();

  // Responses API may return structured output; extract a sensible text fallback
  if (data.output && Array.isArray(data.output) && data.output.length > 0) {
    return data.output.map((o: any) => o.content?.[0]?.text || o.content?.[0]?.type || JSON.stringify(o)).join('\n');
  }

  // fallback: return full response
  return data;
}

export default { generateWithCodex };
