// Quota tracking e cache persistidos em JSON. Sem sqlite/native deps —
// volume pessoal nao precisa de mais que isso.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

function periodKey(period) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  if (period === "daily") {
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${yyyy}-${mm}`;
}

export class GatewayStore {
  constructor(filePath) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    if (!existsSync(filePath)) {
      this._write({ usage: {}, cache: {}, logs: [] });
    }
  }

  _read() {
    return JSON.parse(readFileSync(this.filePath, "utf-8"));
  }

  _write(data) {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  // ---- quota ----

  getUsage(provider, period) {
    const data = this._read();
    const key = `${provider}:${periodKey(period)}`;
    return data.usage[key] || 0;
  }

  incrementUsage(provider, period) {
    const data = this._read();
    const key = `${provider}:${periodKey(period)}`;
    data.usage[key] = (data.usage[key] || 0) + 1;
    this._write(data);
  }

  resetUsage(provider) {
    const data = this._read();
    for (const key of Object.keys(data.usage)) {
      if (key.startsWith(`${provider}:`)) delete data.usage[key];
    }
    this._write(data);
  }

  resetAllUsage() {
    const data = this._read();
    data.usage = {};
    this._write(data);
  }

  // ---- cache ----

  static cacheKey(engine, provider, params) {
    const raw = JSON.stringify({ engine, provider, params }, Object.keys({ engine, provider, params }).sort());
    return createHash("sha256").update(raw).digest("hex");
  }

  getCached(key, ttlSeconds) {
    const data = this._read();
    const entry = data.cache[key];
    if (!entry) return null;
    if ((Date.now() - entry.createdAt) / 1000 > ttlSeconds) return null;
    return entry.response;
  }

  setCached(key, provider, response) {
    const data = this._read();
    data.cache[key] = { response, provider, createdAt: Date.now() };
    this._write(data);
  }

  clearCache() {
    const data = this._read();
    data.cache = {};
    this._write(data);
  }

  raw() {
    return this._read();
  }

  // ---- logs ----

  static MAX_LOGS = 300;

  logRequest(entry) {
    const data = this._read();
    if (!data.logs) data.logs = [];
    data.logs.unshift({ ...entry, at: Date.now() });
    if (data.logs.length > GatewayStore.MAX_LOGS) data.logs.length = GatewayStore.MAX_LOGS;
    this._write(data);
  }

  getLogs(limit = 50) {
    const data = this._read();
    return (data.logs || []).slice(0, limit);
  }
}
