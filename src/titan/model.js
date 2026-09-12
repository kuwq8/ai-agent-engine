const DEFAULT_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3-coder:30b';

class LocalModel {
  constructor() {
    this.baseUrl = DEFAULT_URL.replace(/\/$/, '');
    this.model = DEFAULT_MODEL;
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS || 120000);
  }

  async chat(messages, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: options.model || this.model,
          messages,
          stream: false,
          options: { temperature: options.temperature ?? 0.2 }
        }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Local model HTTP ${response.status}`);
      const content = data.message?.content;
      if (!content) throw new Error('Local model returned an empty response.');
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  async json(messages, options = {}) {
    const text = await this.chat(messages, options);
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(cleaned); } catch (err) {
      throw new Error(`Model returned invalid JSON: ${err.message}\n${text.slice(0, 1000)}`);
    }
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    return response.ok;
  }
}

module.exports = LocalModel;
