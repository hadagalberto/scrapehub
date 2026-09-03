// Adapter HasData. Confirma os paths exatos em https://docs.hasdata.com
// antes de rodar serio — endpoints podem variar por plano/versao.
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.hasdata.com/scrape";

const ENGINE_PATHS = {
  maps: "/google-maps/search",
  serp: "/google-serp",
};

export class HasDataAdapter extends BaseAdapter {
  apiKeyEnv = "HASDATA_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();
    const path = ENGINE_PATHS[engine];
    if (!path) throw new ProviderError(`hasdata nao suporta engine '${engine}'`);

    const data = await this._get(BASE_URL + path, {
      headers: { "x-api-key": key },
      query: params,
    });
    return this._normalize(engine, data);
  }

  _normalize(engine, data) {
    if (engine === "maps") {
      const items = data.localResults || data.results || [];
      return items.map((item) => ({
        title: item.title || item.name,
        url: item.website || item.url,
        snippet: item.address,
        extra: item,
      }));
    }
    const items = data.organicResults || data.organic_results || [];
    return items.map((item) => ({
      title: item.title,
      url: item.link || item.url,
      snippet: item.snippet,
      extra: item,
    }));
  }
}
