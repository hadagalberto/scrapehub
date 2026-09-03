import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.bing.microsoft.com/v7.0/search";

export class BingAdapter extends BaseAdapter {
  apiKeyEnv = "BING_API_KEY";

  async search(engine, params) {
    if (engine !== "serp") throw new ProviderError("bing adapter aqui so suporta engine 'serp'");
    const key = this._requireKey();
    const data = await this._get(BASE_URL, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      query: params,
    });
    return this._normalize(data);
  }

  _normalize(data) {
    const items = data.webPages?.value || [];
    return items.map((item) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      extra: item,
    }));
  }
}
