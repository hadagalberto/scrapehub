import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://www.googleapis.com/customsearch/v1";

export class GoogleCseAdapter extends BaseAdapter {
  apiKeyEnv = "GOOGLE_CSE_API_KEY";

  async search(engine, params) {
    if (engine !== "web") throw new ProviderError("google_cse so suporta engine 'web'");
    const key = this._requireKey();
    const cx = process.env.GOOGLE_CSE_CX;
    if (!cx) throw new ProviderError("GOOGLE_CSE_CX nao configurada no .env");

    const data = await this._get(BASE_URL, { query: { key, cx, ...params } });
    return this._normalize(data);
  }

  _normalize(data) {
    return (data.items || []).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      extra: item,
    }));
  }
}
