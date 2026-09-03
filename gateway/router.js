// Roteador: escolhe o provider certo pra um engine, respeita quota,
// cai pro proximo em erro, usa cache quando disponivel.
import "dotenv/config";
import { loadConfig } from "../config.js";
import { ADAPTERS } from "./adapters/index.js";
import { ProviderError } from "./adapters/base.js";
import { GatewayStore } from "./store.js";

function parseProvider(p) {
  const period = "dailyQuota" in p ? "daily" : "monthly";
  const quota = p.dailyQuota ?? p.monthlyQuota ?? Number.MAX_SAFE_INTEGER;
  return {
    name: p.name, engine: p.engine, api: p.api,
    priority: p.priority ?? 100, quota, period,
    enabled: p.enabled !== false,
  };
}

export class Router {
  constructor() {
    this._adapterInstances = {};
    this.store = null; // criado no primeiro loadConfig, filePath pode ser reconfigurado
  }

  _loadFresh() {
    const cfg = loadConfig();
    if (!this.store) this.store = new GatewayStore(cfg.cache?.filePath ?? "gateway/data/store.json");
    return {
      providers: cfg.providers.map(parseProvider),
      cacheTtl: cfg.cache?.ttlSeconds ?? 0,
    };
  }

  _adapterFor(apiName) {
    if (!this._adapterInstances[apiName]) {
      const Cls = ADAPTERS[apiName];
      if (!Cls) throw new ProviderError(`nenhum adapter registrado para api '${apiName}'`);
      this._adapterInstances[apiName] = new Cls();
    }
    return this._adapterInstances[apiName];
  }

  async search(engine, { useCache = true, ...params } = {}) {
    const { providers, cacheTtl } = this._loadFresh();
    const candidates = providers
      .filter((p) => p.engine === engine && p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (candidates.length === 0) throw new ProviderError(`nenhum provider ativo para engine '${engine}'`);

    const errors = [];
    for (const provider of candidates) {
      const cacheKey = GatewayStore.cacheKey(engine, provider.name, params);

      if (useCache && cacheTtl) {
        const cached = this.store.getCached(cacheKey, cacheTtl);
        if (cached !== null) {
          this.store.logRequest({ engine, provider: provider.name, cached: true, ok: true, query: params.q ?? null });
          return { provider: provider.name, cached: true, results: cached };
        }
      }

      const used = this.store.getUsage(provider.name, provider.period);
      if (used >= provider.quota) {
        errors.push(`${provider.name}: quota esgotada (${used}/${provider.quota})`);
        continue;
      }

      let results;
      try {
        const adapter = this._adapterFor(provider.api);
        results = await adapter.search(engine, params);
      } catch (e) {
        errors.push(`${provider.name}: ${e.message}`);
        continue;
      }

      this.store.incrementUsage(provider.name, provider.period);
      if (useCache && cacheTtl) this.store.setCached(cacheKey, provider.name, results);
      this.store.logRequest({ engine, provider: provider.name, cached: false, ok: true, query: params.q ?? null, count: results.length });

      return { provider: provider.name, cached: false, results };
    }

    const errorMessage = `todos os providers falharam para engine '${engine}': ` + errors.join(" | ");
    this.store.logRequest({ engine, provider: null, cached: false, ok: false, query: params.q ?? null, error: errorMessage });
    throw new ProviderError(errorMessage);
  }
}
