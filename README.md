# ScrapeHub

Gateway multi-provider de scraping/SERP com dashboard de monitoramento —
estilo OpenRouter/OmniRoute, so que pra APIs de scraping em vez de LLMs.
Um ponto de entrada, varios providers por tras, fallback automatico quando
quota esgota ou provider falha, cache local, e um painel web pra configurar
chaves, ver uso e testar buscas sem editar arquivo nenhum.

Node puro, sem sqlite/build nativo.

## Instalar

```bash
npm install
npm link          # registra o comando `scrapehub` global
scrapehub          # sobe o dashboard e abre no navegador
```

Ou sem instalar global:

```bash
npm install
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

| Engine  | Providers                                    |
|---------|-----------------------------------------------|
| maps    | HasData, Outscraper                           |
| serp    | HasData, SerpApi, Brave, Bing                 |
| web     | Google CSE, Brave                             |
| fetch   | ScraperAPI, ScrapingBee (HTML cru, com JS opcional) |

## Como adicionar um provider novo

1. Cria `gateway/adapters/novo.js` com classe `NovoAdapter extends BaseAdapter`,
   implementa `search(engine, params)` retornando lista normalizada
   `{ title, url, snippet, extra }`.
2. Registra em `gateway/adapters/index.js`.
3. Adiciona entrada em `config.json` com `engine`, `api`, quota e `priority`.
4. Adiciona o campo de chave em `gateway/keyMap.js` (aparece automatico no
   dashboard, tela de Configurações).

## Quota e cache

- Quota rastreada em `gateway/data/store.json`, reset automatico por dia/mes
  conforme `dailyQuota`/`monthlyQuota` no config.
- Cache por hash da query, TTL configuravel em `config.json` (`cache.ttlSeconds`).
- `--no-cache` no CLI, `{ useCache: false }` no client, ou o checkbox no
  Playground pra forcar busca nova.

## Nota sobre HasData/Outscraper

Os paths em `gateway/adapters/hasdata.js` e `outscraper.js` sao best-effort —
confirma contra a documentacao oficial de cada um antes de rodar serio,
endpoints podem variar por plano.
