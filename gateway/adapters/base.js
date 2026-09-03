// Contrato comum: todo adapter recebe (engine, params) e devolve lista
// normalizada de resultados no schema {title, url, snippet, extra}.

export class ProviderError extends Error {}

export class BaseAdapter {
  apiKeyEnv = "";

  _requireKey() {
    const key = process.env[this.apiKeyEnv];
    if (!key) throw new ProviderError(`${this.apiKeyEnv} nao configurada no .env`);
    return key;
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
