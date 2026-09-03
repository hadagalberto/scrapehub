// ScraperAPI — fetch generico com renderizacao opcional. Bom fallback pra
// paginas que nao sao SERP estruturado (ele devolve o HTML cru).
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.scraperapi.com";

export class ScraperApiAdapter extends BaseAdapter {
  apiKeyEnv = "SCRAPERAPI_API_KEY";

  async search(engine, params) {
    if (engine !== "fetch") throw new ProviderError("scraperapi so suporta engine 'fetch' (params: { url })");
    const key = this._requireKey();
    if (!params.url) throw new ProviderError("scraperapi precisa de params.url");

    const data = await this._getRaw(BASE_URL, { query: { api_key: key, url: params.url, render: params.render ?? "false" } });
    return [{ title: null, url: params.url, snippet: null, extra: { html: data } }];
  }

  async _getRaw(url, { query = {}, timeoutMs = 20000 } = {}) {
    const fullUrl = new URL(url);
    for (const [k, v] of Object.entries(query)) fullUrl.searchParams.set(k, v);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp;
    try {
      resp = await fetch(fullUrl, { signal: controller.signal });
    } catch (e) {
      throw new ProviderError(`erro de rede: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
    if (resp.status === 429) throw new ProviderError("rate limited (429)");
    if (resp.status >= 400) throw new ProviderError(`http ${resp.status}`);
    return resp.text();
  }
}
