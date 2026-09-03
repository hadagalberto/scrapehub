import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://serpapi.com/search";

export class SerpApiAdapter extends BaseAdapter {
  apiKeyEnv = "SERPAPI_API_KEY";

  async search(engine, params) {
    if (engine !== "serp") throw new ProviderError("serpapi adapter aqui so suporta engine 'serp'");
    const key = this._requireKey();
    const data = await this._get(BASE_URL, {
      query: { engine: "google", api_key: key, ...params },
    });
    return this._normalize(data);
  }

  _normalize(data) {
    return (data.organic_results || []).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      extra: item,
    }));
  }
}
