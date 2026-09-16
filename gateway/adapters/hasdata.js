// Adapter HasData. Paths e schemas abaixo confirmados ao vivo com chave real
// (nao confiar so na doc — ver historico do commit pra detalhes do que ja
// deu 404/comportamento errado).
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://api.hasdata.com/scrape";

export class HasDataAdapter extends BaseAdapter {
  apiKeyEnv = "HASDATA_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();
    const { path, query } = this._resolveRequest(engine, params);

    const data = await this._get(BASE_URL + path, {
      headers: { "x-api-key": key },
      query,
    });
    return this._normalize(engine, params, data);
  }

  _resolveRequest(engine, params) {
    switch (engine) {
      case "maps":
        return { path: "/google-maps/search", query: this._foldLocation(params) };

      case "serp":
        return { path: "/google", query: this._foldLocation(params) };

      case "instagram": {
        if (!params.handle) throw new ProviderError("instagram precisa de params.handle (usuario, sem @)");
        return { path: "/instagram/profile", query: { handle: params.handle } };
      }

      case "youtube": {
        const mode = params.mode || (params.v ? "video" : params.channelId ? "channel" : "search");
        if (mode === "video") {
          if (!params.v) throw new ProviderError("youtube modo 'video' precisa de params.v (video id)");
          return { path: "/youtube/video", query: { v: params.v } };
        }
        if (mode === "channel") {
          if (!params.channelId) throw new ProviderError("youtube modo 'channel' precisa de params.channelId");
          return { path: "/youtube/channel", query: { channelId: params.channelId, tab: params.tab } };
        }
        if (!params.q) throw new ProviderError("youtube modo 'search' precisa de params.q");
        return { path: "/youtube/search", query: { q: params.q, sortBy: params.sortBy } };
      }

      case "amazon": {
        if (params.asin) return { path: "/amazon/product", query: { asin: params.asin, domain: params.domain } };
        if (!params.q) throw new ProviderError("amazon precisa de params.q (busca) ou params.asin (produto)");
        return { path: "/amazon/search", query: { q: params.q, domain: params.domain, sortBy: params.sortBy } };
      }

      case "shopify": {
        if (!params.url) throw new ProviderError("shopify precisa de params.url (ex: https://loja.myshopify.com)");
        return { path: "/shopify/products", query: { url: params.url, collection: params.collection, limit: params.limit } };
      }

      default:
        throw new ProviderError(`hasdata nao suporta engine '${engine}'`);
    }
  }

  _foldLocation(params) {
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

  _normalize(engine, params, data) {
    switch (engine) {
      case "maps": {
        const items = data.localResults || data.results || [];
        return items.map((item) => ({
          title: item.title || item.name,
          url: item.website || item.url,
          snippet: item.address,
          extra: item,
        }));
      }

      case "serp": {
        const items = data.organicResults || data.organic_results || [];
        return items.map((item) => ({
          title: item.title,
          url: item.link || item.url,
          snippet: item.snippet,
          extra: item,
        }));
      }

      case "instagram": {
        const profile = {
          title: data.fullName || data.username,
          url: `https://instagram.com/${data.username}`,
          snippet: `${data.followersCount ?? "?"} seguidores · ${data.biography ?? ""}`.trim(),
          extra: data,
        };
        const posts = (data.latestPosts || []).map((p) => ({
          title: p.caption ? p.caption.slice(0, 80) : `Post de @${p.ownerUsername}`,
          url: p.url,
          snippet: p.type,
          extra: p,
        }));
        return [profile, ...posts];
      }

      case "youtube": {
        if (data.channelInfo) {
          // subscribers/videosCount ja vem formatado com unidade
          // (ex: "2.28M subscribers", "639 videos") — nao duplica sufixo
          const c = data.channelInfo;
          return [{
            title: c.name,
            url: c.channelUrl,
            snippet: `${c.subscribers ?? "?"} · ${c.videosCount ?? "?"}`,
            extra: c,
          }];
        }
        if (data.videoId || data.title) {
          // views ja vem formatado com "views" no texto; likes nao tem sufixo
          const c = data.channel;
          return [{
            title: data.title,
            url: `https://www.youtube.com/watch?v=${data.videoId ?? params.v}`,
            snippet: `${data.views ?? "?"} · ${data.likes ?? "?"} likes${c ? ` · ${c.name}` : ""}`,
            extra: data,
          }];
        }
        const items = data.videoResults || [];
        return items.map((item) => ({
          title: item.title,
          url: item.link,
          snippet: `${item.viewsOriginal ?? ""} · ${item.length ?? ""}`.trim(),
          extra: item,
        }));
      }

      case "amazon": {
        if (data.product) {
          const p = data.product;
          return [{
            title: p.title,
            url: p.url,
            snippet: p.price ? `${p.price.symbol ?? ""}${p.price.currentPrice ?? ""}` : null,
            extra: p,
          }];
        }
        const items = data.productResults || [];
        return items.map((item) => ({
          title: item.title,
          url: item.url,
          snippet: item.price ? `${item.price.symbol ?? ""}${item.price.currentPrice ?? ""}` : null,
          extra: item,
        }));
      }

      case "shopify": {
        // testado ao vivo contra allbirds.com (loja shopify real) — shape
        // bate com o /products.json padrao do proprio Shopify
        const items = data.products || [];
        return items.map((item) => ({
          title: item.title,
          url: item.handle ? `${params.url.replace(/\/$/, "")}/products/${item.handle}` : null,
          snippet: item.vendor,
          extra: item,
        }));
      }

      default:
        return [];
    }
  }
}
