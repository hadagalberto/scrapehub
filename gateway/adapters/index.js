import { HasDataAdapter } from "./hasdata.js";
import { SerpApiAdapter } from "./serpapi.js";
import { GoogleCseAdapter } from "./google_cse.js";
import { BingAdapter } from "./bing.js";
import { ScraperApiAdapter } from "./scraperapi.js";
import { OutscraperAdapter } from "./outscraper.js";
import { BraveAdapter } from "./brave.js";
import { ScrapingBeeAdapter } from "./scrapingbee.js";

export const ADAPTERS = {
  hasdata: HasDataAdapter,
  serpapi: SerpApiAdapter,
  google_cse: GoogleCseAdapter,
  bing: BingAdapter,
  scraperapi: ScraperApiAdapter,
  outscraper: OutscraperAdapter,
  brave: BraveAdapter,
  scrapingbee: ScrapingBeeAdapter,
};
