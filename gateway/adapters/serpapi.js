import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://serpapi.com/search";

export class SerpApiAdapter extends BaseAdapter {
  apiKeyEnv = "SERPAPI_API_KEY";

  async search(engine, params) {
    if (engine !== "serp") throw new ProviderError("serpapi adapter aqui so suporta engine 'serp'");
    const key = this._requireKey();

    // 'location' do SerpApi tambem exige nome canonico do Google (a doc
    // "pega o mais popular se ambiguo") — texto informal erra o match.
    // Fundir no 'q' e' mais previsivel pra digitacao livre (ver hasdata.js).
    const { location, ...rest } = params;
    const q = location ? `${params.q} ${location}` : params.q;

    const data = await this._get(BASE_URL, {
      query: { engine: "google", api_key: key, ...rest, q },
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
