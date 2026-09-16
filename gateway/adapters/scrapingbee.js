// ScrapingBee — fetch com renderizacao JS + Google Search API estruturada.
// 'fetch' segue a doc; 'serp'/'web' via /store/google e' best-effort ate ter
// chave pra testar: https://www.scrapingbee.com/documentation/google/
import { BaseAdapter, ProviderError } from "./base.js";

const BASE = "https://app.scrapingbee.com/api/v1";

export class ScrapingBeeAdapter extends BaseAdapter {
  apiKeyEnv = "SCRAPINGBEE_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();

    switch (engine) {
      case "fetch": {
        if (!params.url) throw new ProviderError("scrapingbee fetch precisa de params.url");
        const html = await this._getText(BASE, {
          query: { api_key: key, url: params.url, render_js: params.render ?? "false" },
        });
        return [{ title: null, url: params.url, snippet: null, extra: { html } }];
      }

      case "serp":
      case "web": {
        const search = params.location ? `${params.q} ${params.location}` : params.q;
        const data = await this._get(`${BASE}/store/google`, {
          query: { api_key: key, search, country_code: params.gl, language: params.hl },
        });
        return (data.organic_results || []).map((r) => ({
          title: r.title,
          url: r.url || r.link,
          snippet: r.description || r.snippet,
          extra: r,
        }));
      }

      default:
        throw new ProviderError(`scrapingbee nao suporta engine '${engine}'`);
    }
  }
}
