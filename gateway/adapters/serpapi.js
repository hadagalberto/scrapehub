// SerpApi — cobre quase todos os engines. Nomes de parametro confirmados
// no schema oficial (MCP serpapi://engines/<engine>); shape de resposta
// segue a doc publica, mas sem chave configurada pra validar ao vivo.
import { BaseAdapter, ProviderError } from "./base.js";

const BASE_URL = "https://serpapi.com/search";

export class SerpApiAdapter extends BaseAdapter {
  apiKeyEnv = "SERPAPI_API_KEY";

  async search(engine, params) {
    const key = this._requireKey();
    const { serpEngine, query } = this._resolve(engine, params);
    const data = await this._get(BASE_URL, {
      query: { engine: serpEngine, api_key: key, ...query },
    });
    if (data.error) throw new ProviderError(`serpapi: ${data.error}`);
    return this._normalize(engine, params, data);
  }

  // 'location' do SerpApi exige nome canonico do Google (a doc diz "pega o
  // mais popular se ambiguo") — texto informal erra o match. Fundir no
  // termo de busca e' mais previsivel pra digitacao livre.
  _fold(params) {
    return params.location ? `${params.q} ${params.location}` : params.q;
  }

  _resolve(engine, params) {
    switch (engine) {
      case "serp":
      case "web":
        return { serpEngine: "google", query: { q: this._fold(params), gl: params.gl, hl: params.hl } };

      case "maps":
        return { serpEngine: "google_maps", query: { q: this._fold(params), type: "search", hl: params.hl } };

      case "instagram":
        if (!params.handle) throw new ProviderError("serpapi instagram precisa de params.handle");
        return { serpEngine: "instagram_profile", query: { profile_id: params.handle } };

      case "youtube": {
        const mode = params.mode || (params.v ? "video" : params.channelId ? "channel" : "search");
        if (mode === "video") return { serpEngine: "youtube_video", query: { v: params.v } };
        if (mode === "channel") {
          return { serpEngine: "youtube_channel", query: { channel_id: String(params.channelId).replace(/^@/, ""), tab: params.tab } };
        }
        return { serpEngine: "youtube", query: { search_query: params.q } };
      }

      case "amazon": {
        const amazon_domain = (params.domain || "amazon.com").replace(/^www\./, "");
        if (params.asin) return { serpEngine: "amazon_product", query: { asin: params.asin, amazon_domain } };
        if (!params.q) throw new ProviderError("serpapi amazon precisa de params.q ou params.asin");
        return { serpEngine: "amazon", query: { k: params.q, amazon_domain } };
      }

      default:
        throw new ProviderError(`serpapi nao suporta engine '${engine}'`);
    }
  }

  _normalize(engine, params, data) {
    switch (engine) {
      case "serp":
      case "web":
        return (data.organic_results || []).map((r) => ({
          title: r.title, url: r.link, snippet: r.snippet, extra: r,
        }));

      case "maps":
        return (data.local_results || []).map((r) => ({
          title: r.title,
          url: r.website || r.link,
          snippet: r.address,
          extra: r,
        }));

      case "instagram": {
        // shape confirmado ao vivo: { profile_results: { username, full_name,
        // followers, biography, external_url, posts: [{ shortcode, ... }] } }
        const p = data.profile_results || {};
        const username = p.username || params.handle;
        const profile = {
          title: p.full_name || username,
          url: `https://instagram.com/${username}`,
          snippet: `${p.followers ?? "?"} seguidores · ${p.biography ?? ""}`.trim(),
          extra: p,
        };
        const posts = (p.posts || []).map((m) => ({
          title: (m.accessibility_caption || "").slice(0, 80) || `Post de @${username}`,
          url: m.shortcode ? `https://www.instagram.com/p/${m.shortcode}/` : null,
          snippet: m.is_video ? "Video" : "Image",
          extra: m,
        }));
        return [profile, ...posts];
      }

      case "youtube": {
        // busca tambem traz channel_results — branch por mode, nao por shape
        const mode = params.mode || (params.v ? "video" : params.channelId ? "channel" : "search");
        if (mode === "channel") {
          // shape confirmado ao vivo: channel_results { title, handle, link,
          // subscribers_text ("20.5M subscribers"), videos_text, video_count }
          const c = data.channel_results || {};
          return [{
            title: c.title || params.channelId,
            url: c.link,
            snippet: `${c.subscribers_text ?? c.subscribers ?? "?"} · ${c.videos_text ?? c.video_count ?? "?"}`,
            extra: { ...c, videos: data.videos_results },
          }];
        }
        if (mode === "video") {
          return [{
            title: data.title,
            url: `https://www.youtube.com/watch?v=${params.v}`,
            snippet: `${data.views ?? "?"} views · ${data.likes ?? "?"} likes${data.channel?.name ? ` · ${data.channel.name}` : ""}`,
            extra: data,
          }];
        }
        return (data.video_results || []).map((v) => ({
          title: v.title,
          url: v.link,
          snippet: `${v.views ?? ""} views · ${v.length ?? ""}`.trim(),
          extra: v,
        }));
      }

      case "amazon": {
        if (data.product_result) {
          const p = data.product_result;
          return [{
            title: p.title,
            url: p.link || `https://www.amazon.com/dp/${params.asin}`,
            snippet: p.price?.raw ?? p.price ?? null,
            extra: p,
          }];
        }
        return (data.organic_results || []).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.price?.raw ?? r.price ?? null,
          extra: r,
        }));
      }

      default:
        return [];
    }
  }
}
