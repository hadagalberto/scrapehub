// Servidor MCP — expoe o gateway como tools pra agentes de IA (Claude Code,
// Claude Desktop, Cursor, etc) chamarem via stdio, sem precisar do dashboard
// nem falar HTTP diretamente.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Router } from "./router.js";
import { loadConfig } from "../config.js";

const router = new Router();

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message) {
  return { content: [{ type: "text", text: `Erro: ${message}` }], isError: true };
}

export function createServer() {
  const server = new McpServer({ name: "scrapehub", version: "1.0.0" });

  server.tool(
    "scrapehub_search",
    "Busca via ScrapeHub — roteia entre providers configurados com fallback automatico e cache. " +
      "Engines: 'maps' (Google Maps/negocios, usa q+location), 'serp' (busca Google, usa q+location), " +
      "'web' (busca web generica, usa q+location), 'fetch' (baixa HTML cru de uma URL, usa url), " +
      "'instagram' (perfil publico + posts recentes, usa handle sem @), " +
      "'youtube' (usa mode: 'search' com q, 'video' com v, ou 'channel' com channelId), " +
      "'amazon' (usa q pra busca ou asin pra produto especifico), " +
      "'shopify' (lista produtos de uma loja publica, usa url da loja).",
    {
      engine: z.enum(["maps", "serp", "web", "fetch", "instagram", "youtube", "amazon", "shopify"]).describe("Tipo de busca"),
      q: z.string().optional().describe("Termo de busca (maps/serp/web/youtube-search/amazon-search)"),
      url: z.string().optional().describe("URL alvo (fetch) ou URL da loja (shopify)"),
      location: z.string().optional().describe("Localizacao informal, ex: 'Sao Paulo, BR' (maps/serp/web)"),
      handle: z.string().optional().describe("Usuario do Instagram, sem @ (instagram)"),
      mode: z.enum(["search", "video", "channel"]).optional().describe("Modo do youtube"),
      v: z.string().optional().describe("ID do video do YouTube (youtube, mode='video')"),
      channelId: z.string().optional().describe("ID ou @handle do canal (youtube, mode='channel')"),
      asin: z.string().optional().describe("ASIN do produto Amazon (amazon, busca produto especifico)"),
      useCache: z.boolean().optional().default(true).describe("Usa cache local se disponivel"),
    },
    async ({ engine, useCache, ...rest }) => {
      try {
        const params = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
        const result = await router.search(engine, { useCache, ...params });
        return textResult(result);
      } catch (e) {
        return errorResult(e.message);
      }
    }
  );

  server.tool(
    "scrapehub_list_providers",
    "Lista os providers configurados no ScrapeHub, engine que cada um atende, e se esta ativo.",
    {},
    async () => {
      const cfg = loadConfig();
      return textResult(
        cfg.providers.map((p) => ({
          name: p.name,
          engine: p.engine,
          api: p.api,
          enabled: p.enabled !== false,
          priority: p.priority,
        }))
      );
    }
  );

  return server;
}

export async function startStdioServer() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
