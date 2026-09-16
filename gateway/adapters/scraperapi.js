// ScraperAPI — fetch generico (HTML cru) + endpoints estruturados (Google
// Search, Amazon). Engine 'fetch' confirmado pela doc; os estruturados sao
// best-effort ate ter chave pra testar ao vivo:
// https://docs.scraperapi.com/making-requests/structured-data-collection-method
import { BaseAdapter, ProviderError } from "./base.js";

const BASE = "https://api.scraperapi.com";

export class ScraperApiAdapter extends BaseAdapter {
  apiKeyEnv = "SCRAPERAPI_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();

    switch (engine) {
      case "fetch": {
        if (!params.url) throw new ProviderError("scraperapi fetch precisa de params.url");
        const html = await this._getText(BASE, {
          query: { api_key: key, url: params.url, render: params.render ?? "false" },
        });
        return [{ title: null, url: params.url, snippet: null, extra: { html } }];
      }

      case "serp":
      case "web": {
        const query = params.location ? `${params.q} ${params.location}` : params.q;
        const data = await this._get(`${BASE}/structured/google/search`, {
          query: { api_key: key, query, country_code: params.gl },
        });
        return (data.organic_results || []).map((r) => ({
          title: r.title,
          url: r.link || r.url,
          snippet: r.snippet,
          extra: r,
        }));
      }

      case "amazon": {
        const tld = this._amazonTld(params.domain);
        if (params.asin) {
          const p = await this._get(`${BASE}/structured/amazon/product`, {
            query: { api_key: key, asin: params.asin, tld },
          });
          return [{
            title: p.name || p.title,
            url: p.url || `https://www.amazon.${tld}/dp/${params.asin}`,
            snippet: p.pricing || p.price || null,
            extra: p,
          }];
        }
        if (!params.q) throw new ProviderError("scraperapi amazon precisa de params.q ou params.asin");
        const data = await this._get(`${BASE}/structured/amazon/search`, {
          query: { api_key: key, query: params.q, tld },
        });
        return (data.results || []).map((r) => ({
          title: r.name || r.title,
          url: r.url,
          snippet: r.price_string || r.price || null,
          extra: r,
        }));
      }

      default:
        throw new ProviderError(`scraperapi nao suporta engine '${engine}'`);
    }
  }

  // nosso param 'domain' segue o estilo hasdata ("www.amazon.com.br");
  // scraperapi quer so o tld ("com.br")
  _amazonTld(domain) {
    if (!domain) return "com";
    return domain.replace(/^www\.amazon\./, "").replace(/^amazon\./, "");
  }
}
