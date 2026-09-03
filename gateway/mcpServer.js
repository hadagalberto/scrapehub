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
    "Busca via ScrapeHub — roteia entre providers configurados (SerpApi, HasData, Bing, Brave, Google CSE, Outscraper) com fallback automatico e cache. Engines: 'maps' (Google Maps/negocios), 'serp' (resultado de busca Google), 'web' (busca web generica), 'fetch' (baixa uma URL crua, precisa de 'url' em vez de 'q').",
    {
      engine: z.enum(["maps", "serp", "web", "fetch"]).describe("Tipo de busca"),
      q: z.string().optional().describe("Termo de busca (obrigatorio pra maps/serp/web)"),
      url: z.string().optional().describe("URL a buscar (obrigatorio pra engine 'fetch')"),
      location: z.string().optional().describe("Localizacao, ex: 'Sao Paulo, BR' (usado por maps/serp)"),
      useCache: z.boolean().optional().default(true).describe("Usa cache local se disponivel"),
    },
    async ({ engine, q, url, location, useCache }) => {
      try {
        const result = await router.search(engine, {
          useCache,
          ...(q ? { q } : {}),
          ...(url ? { url } : {}),
          ...(location ? { location } : {}),
        });
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
