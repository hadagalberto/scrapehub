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

Ordem padrao de fallback (edita na tela de Configurações, com ↑↓):

| Engine     | Cadeia de fallback (1º → último) | Params principais |
|------------|-----------------------------------|--------------------|
| maps       | HasData → SerpApi → Outscraper | `q`, `location?` |
| serp       | HasData → SerpApi → Brave → ScraperAPI → ScrapingBee → Bing → Google CSE | `q`, `location?`, `gl?`, `hl?` |
| web        | Google CSE → Brave → SerpApi → Bing → ScraperAPI → ScrapingBee | `q`, `location?` |
| fetch      | ScraperAPI → ScrapingBee | `url`, `render?` (HTML cru) |
| instagram  | HasData → SerpApi → Outscraper* | `handle` (perfil + posts recentes) |
| youtube    | HasData → SerpApi | `mode`: `search` (`q`), `video` (`v`), `channel` (`channelId`) |
| amazon     | HasData → SerpApi → ScraperAPI | `q` (busca) ou `asin` (produto), `domain?` (ex: `www.amazon.com.br`) |
| shopify    | HasData | `url` da loja |

\* best-effort, sem chave pra validar. Todo o resto foi testado ao vivo.

**Uso/quota e' contado por conta (api), nao por linha** — `serpapi_maps` e
`serpapi_serp` gastam da mesma cota de 100/mes da conta SerpApi. Se voce
cadastrar 2 chaves de uma api, ajusta a quota das linhas dela pra somar.

**Rotacao de chave**: se uma chave responde 429 ou "sem credito", o router
tenta as outras chaves da mesma api antes de cair pro proximo provider.

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

## O que foi validado ao vivo

Todos os engines do HasData, SerpApi (maps/serp/instagram/youtube/amazon),
ScraperAPI (fetch/serp/amazon) e `outscraper_maps` foram testados ao vivo com chave
real. **`outscraper_instagram`, ScrapingBee serp/web, Brave, Bing e Google CSE sao best-effort**
— sem chave configurada pra testar; confirma contra a doc oficial de cada um
antes de depender.
