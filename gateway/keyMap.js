// Mapa de quais variaveis de ambiente cada api precisa. Usado pelo dashboard
// pra desenhar o formulario de configuracao e checar status "configurada".
// docsUrl aponta pra onde pegar a credencial de cada campo.
export const KEY_MAP = {
  hasdata: [
    { envVar: "HASDATA_API_KEY", label: "API Key", docsUrl: "https://app.hasdata.com/dashboard/api-keys" },
  ],
  serpapi: [
    { envVar: "SERPAPI_API_KEY", label: "API Key", docsUrl: "https://serpapi.com/manage-api-key" },
  ],
  google_cse: [
    { envVar: "GOOGLE_CSE_API_KEY", label: "API Key", docsUrl: "https://console.cloud.google.com/apis/credentials" },
    { envVar: "GOOGLE_CSE_CX", label: "Search Engine ID (cx)", docsUrl: "https://programmablesearchengine.google.com/controlpanel/all" },
  ],
  bing: [
    { envVar: "BING_API_KEY", label: "API Key", docsUrl: "https://portal.azure.com/#create/Microsoft.BingSearch" },
  ],
  scraperapi: [
    { envVar: "SCRAPERAPI_API_KEY", label: "API Key", docsUrl: "https://www.scraperapi.com/dashboard" },
  ],
  outscraper: [
    { envVar: "OUTSCRAPER_API_KEY", label: "API Key", docsUrl: "https://app.outscraper.com/profile" },
  ],
  brave: [
    { envVar: "BRAVE_API_KEY", label: "API Key", docsUrl: "https://api.search.brave.com/app/keys" },
  ],
  scrapingbee: [
    { envVar: "SCRAPINGBEE_API_KEY", label: "API Key", docsUrl: "https://app.scrapingbee.com/account/manage" },
  ],
};

export const ALL_ENV_VARS = new Set(Object.values(KEY_MAP).flat().map((f) => f.envVar));
