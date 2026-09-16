// Contrato comum: todo adapter recebe (engine, params) e devolve lista
// normalizada de resultados no schema {title, url, snippet, extra}.
import { parseKeyList } from "../envFile.js";

export class ProviderError extends Error {
  constructor(message, { retryNextKey = false, status = null } = {}) {
    super(message);
    this.retryNextKey = retryNextKey;
    this.status = status;
  }
}

// indice de rotacao por env var — em memoria, reseta a cada restart do
// processo, o que e' aceitavel: so faz round-robin entre chaves da mesma
// env var pra somar quota de varias contas do mesmo provider.
const rotationIndex = new Map();

// sinais de "essa chave esgotou, tenta a proxima" — cada provider escreve
// diferente, entao casa por palavra no corpo da resposta
const KEY_EXHAUSTED_PATTERN = /credit|quota|limit|exhaust|exceed|insufficient|balance|plan/i;

export class BaseAdapter {
  apiKeyEnv = "";

  keyCount() {
    return parseKeyList(process.env[this.apiKeyEnv]).length;
  }

  _requireKey() {
    const keys = parseKeyList(process.env[this.apiKeyEnv]);
    if (keys.length === 0) throw new ProviderError(`${this.apiKeyEnv} nao configurada no .env`);
    const next = (rotationIndex.get(this.apiKeyEnv) ?? -1) + 1;
    rotationIndex.set(this.apiKeyEnv, next);
    return keys[next % keys.length];
  }

  async search(_engine, _params) {
    throw new Error("nao implementado");
  }

  _classifyHttpError(status, text) {
    const exhausted = status === 429 || ((status === 402 || status === 403 || status === 401) && KEY_EXHAUSTED_PATTERN.test(text));
    return new ProviderError(`http ${status}: ${text.slice(0, 200)}`, { retryNextKey: exhausted, status });
  }

  async _fetchRaw(url, { headers = {}, query = {}, timeoutMs = 25000 } = {}) {
    const fullUrl = new URL(url);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) fullUrl.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp;
    try {
      resp = await fetch(fullUrl, { headers, signal: controller.signal });
    } catch (e) {
      throw new ProviderError(`erro de rede: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (resp.status >= 400) {
      const text = await resp.text();
      throw this._classifyHttpError(resp.status, text);
    }
    return resp;
  }

  async _get(url, opts) {
    const resp = await this._fetchRaw(url, opts);
    return resp.json();
  }

  async _getText(url, opts) {
    const resp = await this._fetchRaw(url, opts);
    return resp.text();
  }
}
