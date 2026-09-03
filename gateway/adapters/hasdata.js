// Adapter HasData. Confirma os paths exatos em https://docs.hasdata.com
// antes de rodar serio — endpoints podem variar por plano/versao.
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.hasdata.com/scrape";

const ENGINE_PATHS = {
  maps: "/google-maps/search",
  serp: "/google",
};

export class HasDataAdapter extends BaseAdapter {
  apiKeyEnv = "HASDATA_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();
    const path = ENGINE_PATHS[engine];
    if (!path) throw new ProviderError(`hasdata nao suporta engine '${engine}'`);

    const data = await this._get(BASE_URL + path, {
      headers: { "x-api-key": key },
      query: this._buildQuery(engine, params),
    });
    return this._normalize(engine, data);
  }

  _buildQuery(_engine, params) {
    // maps nao tem parametro de localizacao livre (so 'q' e 'll' lat/lng).
    // serp ate tem 'location', mas exige nome canonico exato do Google
    // (ex: "Sao Paulo, Brazil") — texto informal ("Santana Bahia") erra o
    // match e piora o resultado. Testado: fundir no proprio 'q' e' mais
    // confiavel pros dois casos, sem depender de formato canonico.
    if (params.location) {
      const { location, ...rest } = params;
      return { ...rest, q: `${params.q} ${location}` };
    }
    return params;
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
