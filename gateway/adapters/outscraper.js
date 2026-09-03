// Outscraper — especializado em Google Maps/reviews. Confirma path/schema
// exatos em https://app.outscraper.com/api-docs antes de producao.
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.outscraper.cloud/maps/search-v3";

export class OutscraperAdapter extends BaseAdapter {
  apiKeyEnv = "OUTSCRAPER_API_KEY";

  async search(engine, params) {
    if (engine !== "maps") throw new ProviderError("outscraper adapter aqui so suporta engine 'maps'");
    const key = this._requireKey();
    const data = await this._get(BASE_URL, {
      headers: { "X-API-KEY": key },
      query: { query: params.q, ...params },
    });
    return this._normalize(data);
  }

  _normalize(data) {
    const groups = Array.isArray(data?.data) ? data.data : [];
    const results = [];
    for (const group of groups) {
      const items = Array.isArray(group) ? group : [group];
      for (const item of items) {
        results.push({
          title: item.name,
          url: item.site,
          snippet: item.full_address || item.address,
          extra: item,
        });
      }
    }
    return results;
  }
}
