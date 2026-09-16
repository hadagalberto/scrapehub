// Roteador: escolhe o provider certo pra um engine, respeita quota,
// cai pro proximo em erro, usa cache quando disponivel.
import dotenv from "dotenv";
import { loadConfig } from "../config.js";
import { ADAPTERS } from "./adapters/index.js";
import { ProviderError } from "./adapters/base.js";
import { GatewayStore } from "./store.js";
import { USER_ENV_PATH, USER_STORE_PATH } from "./paths.js";

dotenv.config({ path: USER_ENV_PATH });

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
    this.store = new GatewayStore(USER_STORE_PATH);
  }

  _loadFresh() {
    const cfg = loadConfig();
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

  // Se a chave atual deu 429/sem credito, tenta as outras chaves do mesmo
  // provider (round-robin ja avanca sozinho no _requireKey) antes de cair
  // pro proximo provider — igual OmniRoute faz com chaves de LLM.
  async _searchWithKeyRotation(provider, engine, params) {
    const adapter = this._adapterFor(provider.api);
    const attempts = Math.max(1, adapter.keyCount());
    const keyErrors = [];

    for (let i = 0; i < attempts; i++) {
      try {
        return await adapter.search(engine, params);
      } catch (e) {
        if (!(e instanceof ProviderError) || !e.retryNextKey || i === attempts - 1) {
          if (keyErrors.length) keyErrors.push(`chave ${i + 1}: ${e.message}`);
          throw keyErrors.length ? new ProviderError(keyErrors.join("; ")) : e;
        }
        keyErrors.push(`chave ${i + 1}: ${e.message}`);
      }
    }
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

      const used = this.store.getUsage(provider.api, provider.period);
      if (used >= provider.quota) {
        errors.push(`${provider.name}: quota esgotada (${used}/${provider.quota})`);
        continue;
      }

      let results;
      try {
        results = await this._searchWithKeyRotation(provider, engine, params);
      } catch (e) {
        errors.push(`${provider.name}: ${e.message}`);
        continue;
      }

      this.store.incrementUsage(provider.api, provider.period);
      if (useCache && cacheTtl) this.store.setCached(cacheKey, provider.name, results);
      this.store.logRequest({ engine, provider: provider.name, cached: false, ok: true, query: params.q ?? null, count: results.length });

      return { provider: provider.name, cached: false, results };
    }

    const errorMessage = `todos os providers falharam para engine '${engine}': ` + errors.join(" | ");
    this.store.logRequest({ engine, provider: null, cached: false, ok: false, query: params.q ?? null, error: errorMessage });
    throw new ProviderError(errorMessage);
  }
}
