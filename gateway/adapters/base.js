// Contrato comum: todo adapter recebe (engine, params) e devolve lista
// normalizada de resultados no schema {title, url, snippet, extra}.
import { parseKeyList } from "../envFile.js";

export class ProviderError extends Error {}

// indice de rotacao por env var — em memoria, reseta a cada restart do
// processo, o que e' aceitavel: so faz round-robin entre chaves da mesma
// env var pra somar quota de varias contas do mesmo provider.
const rotationIndex = new Map();

export class BaseAdapter {
  apiKeyEnv = "";

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

  async _get(url, { headers = {}, query = {}, timeoutMs = 15000 } = {}) {
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

    if (resp.status === 429) throw new ProviderError("rate limited (429)");
    if (resp.status >= 400) {
      const text = await resp.text();
      throw new ProviderError(`http ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp.json();
  }
}
