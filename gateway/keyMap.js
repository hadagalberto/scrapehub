// Mapa de quais variaveis de ambiente cada api precisa. Usado pelo dashboard
// pra desenhar o formulario de configuracao e checar status "configurada".
export const KEY_MAP = {
  hasdata: [{ envVar: "HASDATA_API_KEY", label: "API Key" }],
  serpapi: [{ envVar: "SERPAPI_API_KEY", label: "API Key" }],
  google_cse: [
    { envVar: "GOOGLE_CSE_API_KEY", label: "API Key" },
    { envVar: "GOOGLE_CSE_CX", label: "Search Engine ID (cx)" },
  ],
  bing: [{ envVar: "BING_API_KEY", label: "API Key" }],
  scraperapi: [{ envVar: "SCRAPERAPI_API_KEY", label: "API Key" }],
  outscraper: [{ envVar: "OUTSCRAPER_API_KEY", label: "API Key" }],
  brave: [{ envVar: "BRAVE_API_KEY", label: "API Key" }],
  scrapingbee: [{ envVar: "SCRAPINGBEE_API_KEY", label: "API Key" }],
};

export const ALL_ENV_VARS = new Set(Object.values(KEY_MAP).flat().map((f) => f.envVar));
