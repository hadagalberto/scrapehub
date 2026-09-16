# ScrapeHub

Gateway multi-provider de scraping/SERP com dashboard de monitoramento —
estilo OpenRouter/OmniRoute, so que pra APIs de scraping em vez de LLMs.
Um ponto de entrada, varios providers por tras, fallback automatico quando
quota esgota ou provider falha, cache local, e um painel web pra configurar
chaves, ver uso e testar buscas sem editar arquivo nenhum.

Node puro, sem sqlite/build nativo.

## Instalar

```bash
npm install -g scrapehub
scrapehub
```

Sobe o dashboard e abre no navegador. Na primeira vez cria `~/.scrapehub/`
(config, `.env`, cache) — nada fica dentro da pasta do pacote.

### Rodando a partir do codigo-fonte

```bash
git clone https://github.com/hadagalberto/scrapehub.git
cd scrapehub
npm install
npm link      # registra o comando `scrapehub` global apontando pra este clone
scrapehub
```

Ou sem instalar global:

```bash
npm run dashboard
```

Dashboard em `http://localhost:4545`.

## Dashboard

- **Overview** — stats das ultimas 24h + tabela de providers com uso em tempo real
- **Playground** — testa uma busca na hora, direto do navegador
- **Analytics** — timeline de requests por hora, sucesso vs falha, uso por engine
- **Histórico** — log das ultimas requests (filtra por engine)
- **Configurações** — cola as chaves de API por ali (sem editar `.env` na mao),
  ativa/desativa provider, edita prioridade e quota

Chave salva na tela de Configurações grava no `.env` e aplica na hora, sem
precisar reiniciar o processo.

## MCP — usar com agentes de IA

Expoe a busca como tool MCP (stdio), pra Claude Code, Claude Desktop, Cursor,
etc chamarem direto, sem passar por HTTP.

**Claude Code:**

```bash
claude mcp add scrapehub -- scrapehub-mcp
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "scrapehub": {
      "command": "scrapehub-mcp"
    }
  }
}
```

Tools expostas:

- `scrapehub_search` — `{ engine, q?, url?, location?, handle?, mode?, v?, channelId?, asin?, useCache? }`
  (campos usados dependem do `engine` — ver tabela de Providers abaixo)
- `scrapehub_list_providers` — lista providers configurados e status

Usa as mesmas chaves/config de `~/.scrapehub/` do dashboard — configura por
la e o MCP ja usa.

## API HTTP

Com o dashboard rodando, tambem da pra chamar via REST:

```bash
curl -X POST http://localhost:4545/api/search \
  -H "Content-Type: application/json" \
  -d '{"engine":"maps","q":"pizzaria","location":"Sao Paulo, BR"}'
```

## Uso via CLI

```bash
node main.js maps "pizzaria" --location "Sao Paulo, BR"
node main.js serp "melhores agencias de marketing SP"
node main.js web "python asyncio tutorial"
```

## Uso em codigo (pros bots)

```js
import { search } from "./gateway/client.js";

const r = await search("maps", { q: "pizzaria", location: "Sao Paulo, BR" });
for (const item of r.results) console.log(item.title, item.url);
```

## Providers configurados

| Engine     | Providers | Params principais |
|------------|-----------|--------------------|
| maps       | HasData, Outscraper | `q`, `location?` |
| serp       | HasData, SerpApi, Brave, Bing | `q`, `location?` |
| web        | Google CSE, Brave | `q`, `location?` |
| fetch      | ScraperAPI, ScrapingBee | `url` (HTML cru, JS opcional) |
| instagram  | HasData, Outscraper* | `handle` (perfil + posts recentes) |
| youtube    | HasData | `mode`: `search` (`q`), `video` (`v`), `channel` (`channelId`) |
| amazon     | HasData | `q` (busca) ou `asin` (produto especifico) |
| shopify    | HasData | `url` da loja (testado ao vivo com allbirds.com) |

## Como adicionar um provider novo

1. Cria `gateway/adapters/novo.js` com classe `NovoAdapter extends BaseAdapter`,
   implementa `search(engine, params)` retornando lista normalizada
   `{ title, url, snippet, extra }`.
2. Registra em `gateway/adapters/index.js`.
3. Adiciona entrada em `config.default.json` com `engine`, `api`, quota e
   `priority` (usuarios ja instalados editam pela tela de Configurações, que
   grava em `~/.scrapehub/config.json`).
4. Adiciona o campo de chave em `gateway/keyMap.js` (aparece automatico no
   dashboard, tela de Configurações).

## Onde fica o dado do usuario

Tudo em `~/.scrapehub/` (ou `$SCRAPEHUB_HOME`, se definida): `config.json`,
`.env`, `data/store.json` (quota + cache + log). Nada e escrito dentro da
pasta do pacote — importante pra instalacao global, que pode ser
somente-leitura ou sumir num `npm update`.

## Quota e cache

- Quota rastreada em `~/.scrapehub/data/store.json`, reset automatico por
  dia/mes conforme `dailyQuota`/`monthlyQuota` no config.
- Cache por hash da query, TTL configuravel na tela de Configurações
  (`cache.ttlSeconds`).
- `--no-cache` no CLI, `{ useCache: false }` no client, ou o checkbox no
  Playground pra forcar busca nova.

## Nota sobre HasData/Outscraper

Todos os engines do HasData e o `outscraper_maps` foram testados ao vivo com
chave real (ver historico de commits). **`outscraper_instagram` e' best-effort**
— sem chave configurada pra testar, confirma contra
https://app.outscraper.com/api-docs antes de depender disso.
