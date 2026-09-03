import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.search.brave.com/res/v1/web/search";

export class BraveAdapter extends BaseAdapter {
  apiKeyEnv = "BRAVE_API_KEY";

  async search(engine, params) {
    if (engine !== "serp" && engine !== "web") throw new ProviderError("brave so suporta engine 'serp' ou 'web'");
    const key = this._requireKey();

    // Brave Search API nao tem parametro de localizacao livre (so 'country',
    // codigo de 2 letras) — location vira parte do termo de busca mesmo,
    // senao a API so ignora silenciosamente
    const { location, ...rest } = params;
    const q = location ? `${params.q} ${location}` : params.q;

    const data = await this._get(BASE_URL, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
      query: { ...rest, q },
    });
    return this._normalize(data);
  }

  _normalize(data) {
    const items = data?.web?.results || [];
    return items.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description,
      extra: item,
    }));
  }
}
