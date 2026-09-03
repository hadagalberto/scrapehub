import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.bing.microsoft.com/v7.0/search";

export class BingAdapter extends BaseAdapter {
  apiKeyEnv = "BING_API_KEY";

  async search(engine, params) {
    if (engine !== "serp") throw new ProviderError("bing adapter aqui so suporta engine 'serp'");
    const key = this._requireKey();

    // Bing v7 nao tem parametro de localizacao livre (so 'mkt', tipo
    // "pt-BR") — location vira parte do termo de busca mesmo, senao a API
    // so ignora silenciosamente
    const { location, ...rest } = params;
    const q = location ? `${params.q} ${location}` : params.q;

    const data = await this._get(BASE_URL, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      query: { ...rest, q },
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
