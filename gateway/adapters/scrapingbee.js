// ScrapingBee — fetch com renderizacao JS. Como o ScraperAPI, devolve HTML
// cru — engine 'fetch' generico, nao SERP estruturado.
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://app.scrapingbee.com/api/v1";

export class ScrapingBeeAdapter extends BaseAdapter {
  apiKeyEnv = "SCRAPINGBEE_API_KEY";

  async search(engine, params) {
    if (engine !== "fetch") throw new ProviderError("scrapingbee so suporta engine 'fetch' (params: { url })");
    const key = this._requireKey();
    if (!params.url) throw new ProviderError("scrapingbee precisa de params.url");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const fullUrl = new URL(BASE_URL);
    fullUrl.searchParams.set("api_key", key);
    fullUrl.searchParams.set("url", params.url);
    fullUrl.searchParams.set("render_js", params.render ?? "false");

    let resp;
    try {
      resp = await fetch(fullUrl, { signal: controller.signal });
    } catch (e) {
      throw new ProviderError(`erro de rede: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
    if (resp.status === 429) throw new ProviderError("rate limited (429)");
    if (resp.status >= 400) throw new ProviderError(`http ${resp.status}`);

    const html = await resp.text();
    return [{ title: null, url: params.url, snippet: null, extra: { html } }];
  }
}
