// Outscraper — Maps/reviews e Instagram. Path/schema do maps confirmado ao
// vivo (ver README). Instagram e' best-effort — sem chave configurada pra
// testar, confirma contra https://app.outscraper.com/api-docs antes de
// depender disso.
import { BaseAdapter, ProviderError } from "./base.js";

export class OutscraperAdapter extends BaseAdapter {
  apiKeyEnv = "OUTSCRAPER_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();

    if (engine === "maps") {
      // outscraper nao tem parametro de localizacao separado — o termo de
      // busca e' o unico jeito de localizar (ex: "pizzaria, Santana - BA")
      const { q, location, ...rest } = params;
      const query = location ? `${q}, ${location}` : q;

      const data = await this._get("https://api.outscraper.cloud/maps/search-v3", {
        headers: { "X-API-KEY": key },
        query: { query, ...rest },
      });
      return this._normalizeMaps(data);
    }

    if (engine === "instagram") {
      if (!params.handle) throw new ProviderError("outscraper instagram precisa de params.handle");
      const data = await this._get("https://api.outscraper.cloud/instagram/profiles", {
        headers: { "X-API-KEY": key },
        query: { query: params.handle, async: false },
      });
      return this._normalizeInstagram(data);
    }

    throw new ProviderError(`outscraper nao suporta engine '${engine}'`);
  }

  _flattenGroups(data) {
    const groups = Array.isArray(data?.data) ? data.data : [];
    const items = [];
    for (const group of groups) {
      if (Array.isArray(group)) items.push(...group);
      else items.push(group);
    }
    return items;
  }

  _normalizeMaps(data) {
    return this._flattenGroups(data).map((item) => ({
      title: item.name,
      url: item.site,
      snippet: item.full_address || item.address,
      extra: item,
    }));
  }

  _normalizeInstagram(data) {
    return this._flattenGroups(data).map((item) => ({
      title: item.full_name || item.username,
      url: item.external_url || `https://instagram.com/${item.username}`,
      snippet: `${item.followers ?? "?"} seguidores · ${item.biography ?? ""}`.trim(),
      extra: item,
    }));
  }
}
