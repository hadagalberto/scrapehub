// Dashboard web: monitoramento de quota/uso e edicao de config em tempo real.
import "dotenv/config";
import express from "express";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig, CONFIG_PATH } from "./config.js";
import { GatewayStore } from "./gateway/store.js";
import { Router } from "./gateway/router.js";
import { ADAPTERS } from "./gateway/adapters/index.js";
import { KEY_MAP, ALL_ENV_VARS } from "./gateway/keyMap.js";
import { upsertEnvVar } from "./gateway/envFile.js";

const router = new Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, ".env");
const PORT = process.env.DASHBOARD_PORT || 4545;

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

function periodKeyFor(period) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  if (period === "daily") return `${yyyy}-${mm}-${String(now.getDate()).padStart(2, "0")}`;
  return `${yyyy}-${mm}`;
}

function getStore() {
  const cfg = loadConfig();
  return new GatewayStore(cfg.cache?.filePath ?? "gateway/data/store.json");
}

app.get("/api/status", (_req, res) => {
  const cfg = loadConfig();
  const store = getStore();
  const raw = store.raw();

  const providers = cfg.providers.map((p) => {
    const period = "dailyQuota" in p ? "daily" : "monthly";
    const quota = p.dailyQuota ?? p.monthlyQuota ?? null;
    const usageKey = `${p.name}:${periodKeyFor(period)}`;
    const used = raw.usage[usageKey] || 0;
    return {
      ...p,
      period,
      quota,
      used,
      remaining: quota != null ? Math.max(quota - used, 0) : null,
      percent: quota ? Math.min(Math.round((used / quota) * 100), 100) : 0,
    };
  });

  res.json({
    providers,
    cache: { ttlSeconds: cfg.cache?.ttlSeconds ?? 0, entries: Object.keys(raw.cache).length },
  });
});

app.get("/api/config", (_req, res) => {
  res.json(loadConfig());
});

app.get("/api/keys", (_req, res) => {
  const status = Object.entries(KEY_MAP).map(([api, fields]) => ({
    api,
    fields: fields.map((f) => ({ ...f, configured: Boolean(process.env[f.envVar]) })),
    configured: fields.every((f) => Boolean(process.env[f.envVar])),
  }));
  res.json(status);
});

app.put("/api/keys", (req, res) => {
  const { envVar, value } = req.body || {};
  if (!envVar || !ALL_ENV_VARS.has(envVar)) {
    return res.status(400).json({ error: `envVar invalido: ${envVar}` });
  }
  upsertEnvVar(ENV_PATH, envVar, value ?? "");
  process.env[envVar] = value ?? "";
  res.json({ ok: true });
});

app.put("/api/config", (req, res) => {
  const cfg = req.body;
  if (!cfg || !Array.isArray(cfg.providers)) {
    return res.status(400).json({ error: "payload invalido: precisa de { providers: [...] , cache: {...} }" });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  res.json({ ok: true });
});

app.post("/api/providers/:name/toggle", (req, res) => {
  const cfg = loadConfig();
  const provider = cfg.providers.find((p) => p.name === req.params.name);
  if (!provider) return res.status(404).json({ error: "provider nao encontrado" });
  provider.enabled = req.body.enabled ?? !provider.enabled;
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  res.json({ ok: true, enabled: provider.enabled });
});

app.post("/api/providers/:name/reset-usage", (req, res) => {
  const store = getStore();
  store.resetUsage(req.params.name);
  res.json({ ok: true });
});

app.post("/api/usage/reset-all", (_req, res) => {
  getStore().resetAllUsage();
  res.json({ ok: true });
});

app.post("/api/cache/clear", (_req, res) => {
  const store = getStore();
  store.clearCache();
  res.json({ ok: true });
});

app.get("/api/logs", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json(getStore().getLogs(limit));
});

app.get("/api/stats", (_req, res) => {
  const store = getStore();
  const logs = store.getLogs(GatewayStore.MAX_LOGS);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = logs.filter((l) => l.at >= dayAgo);

  const byEngine = {};
  for (const l of last24h) {
    byEngine[l.engine] = byEngine[l.engine] || { total: 0, ok: 0, cached: 0 };
    byEngine[l.engine].total++;
    if (l.ok) byEngine[l.engine].ok++;
    if (l.cached) byEngine[l.engine].cached++;
  }

  const total = last24h.length;
  const cached = last24h.filter((l) => l.cached).length;
  const failed = last24h.filter((l) => !l.ok).length;

  res.json({
    total24h: total,
    cacheHitRate: total ? Math.round((cached / total) * 100) : 0,
    failed24h: failed,
    byEngine,
    availableEngines: [...new Set(loadConfig().providers.map((p) => p.engine))],
    availableApis: Object.keys(ADAPTERS),
  });
});

app.post("/api/search", async (req, res) => {
  const { engine, useCache = true, ...params } = req.body || {};
  if (!engine) return res.status(400).json({ error: "informe 'engine' no body" });
  try {
    const result = await router.search(engine, { useCache, ...params });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard rodando em http://localhost:${PORT}`);
});
