// ---- helpers ----

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

function usageClass(percent) {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warn";
  return "";
}

function timeAgo(ts) {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s atras`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m atras`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h atras`;
}

// ---- router ----

const PAGES = ["overview", "playground", "analytics", "history", "settings"];
const PAGE_TITLES = {
  overview: "Overview",
  playground: "Playground",
  analytics: "Analytics",
  history: "Histórico",
  settings: "Configurações",
};

function currentPage() {
  const hash = location.hash.replace("#/", "");
  return PAGES.includes(hash) ? hash : "overview";
}

function renderPage() {
  const page = currentPage();
  document.getElementById("page-title").textContent = PAGE_TITLES[page];
  for (const p of PAGES) {
    document.getElementById(`page-${p}`).hidden = p !== page;
  }
  for (const a of document.querySelectorAll(".sidebar nav a")) {
    a.classList.toggle("active", a.dataset.nav === page);
  }
  loadPage(page);
}

window.addEventListener("hashchange", renderPage);

// ---- shared state ----

let cachedStatus = null;
let cachedKeys = null;
let cachedStats = null;
let cachedLogs = null;

async function refreshShared() {
  const [status, keys, stats, logs] = await Promise.all([
    fetchJson("/api/status"),
    fetchJson("/api/keys"),
    fetchJson("/api/stats"),
    fetchJson("/api/logs?limit=300"),
  ]);
  cachedStatus = status;
  cachedKeys = keys;
  cachedStats = stats;
  cachedLogs = logs;
  document.getElementById("cache-info").textContent =
    `Cache: ${status.cache.entries} entradas · TTL ${status.cache.ttlSeconds}s`;
}

async function loadPage(page) {
  await refreshShared();
  if (page === "overview") renderOverview();
  if (page === "playground") renderPlayground();
  if (page === "analytics") renderAnalytics();
  if (page === "history") renderHistory();
  if (page === "settings") renderSettings();
}

// ---- overview ----

function renderStatCards(container, cards) {
  container.innerHTML = cards
    .map((c) => `<div class="stat-card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`)
    .join("");
}

function keyPillFor(api) {
  const k = cachedKeys.find((x) => x.api === api);
  if (!k) return "";
  return k.configured ? '<span class="pill ok">configurada</span>' : '<span class="pill danger">faltando</span>';
}

function renderOverviewProviderRow(p) {
  const tr = document.createElement("tr");
  if (!p.enabled) tr.className = "disabled-row";
  const quotaLabel = p.quota != null ? `${p.used}/${p.quota} (${p.period})` : `${p.used} (sem limite)`;
  tr.innerHTML = `
    <td><button class="toggle ${p.enabled ? "on" : ""}" data-name="${p.name}"></button></td>
    <td class="provider-name">${p.name}</td>
    <td><span class="pill">${p.engine}</span></td>
    <td><span class="pill">${p.api}</span></td>
    <td>${keyPillFor(p.api)}</td>
    <td>
      <div class="usage-bar"><div class="usage-fill ${usageClass(p.percent)}" style="width:${p.percent}%"></div></div>
      <div class="usage-label">${quotaLabel}</div>
    </td>
  `;
  return tr;
}

function renderOverview() {
  renderStatCards(document.getElementById("stats-row"), [
    { label: "Requests 24h", value: cachedStats.total24h },
    { label: "Cache hit rate", value: `${cachedStats.cacheHitRate}%` },
    { label: "Falhas 24h", value: cachedStats.failed24h },
    { label: "Engines ativos", value: cachedStats.availableEngines.length },
  ]);

  const tbody = document.getElementById("providers-body");
  tbody.innerHTML = "";
  for (const p of cachedStatus.providers) tbody.appendChild(renderOverviewProviderRow(p));
}

document.getElementById("providers-body").addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest(".toggle");
  if (!toggleBtn) return;
  const name = toggleBtn.dataset.name;
  const enabling = !toggleBtn.classList.contains("on");
  await fetch(`/api/providers/${name}/toggle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: enabling }),
  });
  loadPage("overview");
});

// ---- playground ----

function renderPlayground() {
  const select = document.getElementById("pg-engine");
  if (!select.dataset.loaded) {
    select.innerHTML = cachedStats.availableEngines.map((e) => `<option value="${e}">${e}</option>`).join("");
    select.dataset.loaded = "1";
  }
}

document.getElementById("playground-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const resultBox = document.getElementById("pg-result");
  const engine = document.getElementById("pg-engine").value;
  const q = document.getElementById("pg-query").value;
  const location = document.getElementById("pg-location").value;
  const noCache = document.getElementById("pg-nocache").checked;

  resultBox.textContent = "Buscando...";
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engine, q, location: location || undefined, useCache: !noCache }),
    });
    const data = await res.json();
    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultBox.textContent = `Erro: ${err.message}`;
  }
});

// ---- analytics ----

function renderAnalytics() {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = cachedLogs.filter((l) => l.at >= dayAgo);

  renderStatCards(document.getElementById("analytics-stats-row"), [
    { label: "Requests 24h", value: cachedStats.total24h },
    { label: "Cache hit rate", value: `${cachedStats.cacheHitRate}%` },
    { label: "Falhas 24h", value: cachedStats.failed24h },
  ]);

  // timeline: buckets de 1h, ultimas 24h
  const buckets = new Array(24).fill(0);
  for (const l of last24h) {
    const hoursAgo = Math.floor((Date.now() - l.at) / (60 * 60 * 1000));
    if (hoursAgo >= 0 && hoursAgo < 24) buckets[23 - hoursAgo]++;
  }
  const max = Math.max(...buckets, 1);
  const timeline = document.getElementById("timeline-chart");
  timeline.innerHTML = buckets
    .map((count) => `<div class="timeline-bar" style="height:${Math.max((count / max) * 100, 2)}%" title="${count} requests"></div>`)
    .join("");

  // donut sucesso/falha
  const ok = last24h.filter((l) => l.ok).length;
  const failed = last24h.length - ok;
  const okPct = last24h.length ? Math.round((ok / last24h.length) * 100) : 0;
  const donut = document.getElementById("donut");
  donut.style.background = `conic-gradient(var(--ok) 0deg ${okPct * 3.6}deg, var(--danger) ${okPct * 3.6}deg 360deg)`;
  document.getElementById("donut-legend").innerHTML = `
    <div><span class="legend-dot" style="background:var(--ok)"></span>Sucesso: ${ok} (${okPct}%)</div>
    <div><span class="legend-dot" style="background:var(--danger)"></span>Falha: ${failed} (${100 - okPct}%)</div>
  `;

  // por engine
  const engineBars = document.getElementById("engine-bars");
  const entries = Object.entries(cachedStats.byEngine);
  const maxEngine = Math.max(...entries.map(([, v]) => v.total), 1);
  engineBars.innerHTML = entries.length
    ? entries
        .map(
          ([engine, v]) => `
      <div class="engine-bar-row">
        <span class="pill">${engine}</span>
        <div class="engine-bar-track"><div class="engine-bar-fill" style="width:${(v.total / maxEngine) * 100}%"></div></div>
        <span class="muted">${v.total}</span>
      </div>
    `
        )
        .join("")
    : '<span class="muted">Sem dados nas ultimas 24h.</span>';
}

// ---- history ----

function renderLogRow(l) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${timeAgo(l.at)}</td>
    <td><span class="pill">${l.engine}</span></td>
    <td>${l.provider ?? "-"}</td>
    <td>${l.query ?? "-"}</td>
    <td>${l.cached ? '<span class="pill ok">hit</span>' : '<span class="pill">miss</span>'}</td>
    <td>${l.ok ? '<span class="pill ok">ok</span>' : `<span class="pill danger" title="${l.error ?? ""}">falhou</span>`}</td>
  `;
  return tr;
}

function renderHistory() {
  const filterSelect = document.getElementById("history-filter");
  if (!filterSelect.dataset.loaded) {
    filterSelect.innerHTML =
      '<option value="">Todos engines</option>' +
      cachedStats.availableEngines.map((e) => `<option value="${e}">${e}</option>`).join("");
    filterSelect.dataset.loaded = "1";
  }

  const filter = filterSelect.value;
  const logs = filter ? cachedLogs.filter((l) => l.engine === filter) : cachedLogs;

  const tbody = document.getElementById("logs-body");
  tbody.innerHTML = "";
  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Nenhuma busca ainda.</td></tr>';
  } else {
    for (const l of logs.slice(0, 100)) tbody.appendChild(renderLogRow(l));
  }
}

document.getElementById("history-filter").addEventListener("change", renderHistory);

// ---- settings ----

function renderKeyField(f) {
  const rows = f.keys
    .map(
      (k) => `
    <div class="key-row">
      <span class="key-masked">${k.masked}</span>
      <button class="key-remove" data-remove-envvar="${f.envVar}" data-remove-index="${k.index}" title="Remover">✕</button>
    </div>
  `
    )
    .join("");

  return `
    <div class="key-field">
      <label>
        ${f.label}
        ${f.docsUrl ? `<a href="${f.docsUrl}" target="_blank" rel="noopener" class="docs-link">pegar chave ↗</a>` : ""}
      </label>
      ${rows || '<div class="key-row-empty muted">nenhuma chave cadastrada</div>'}
      <div class="key-field-row">
        <input type="password" data-envvar="${f.envVar}" placeholder="colar nova chave" />
        <button data-add="${f.envVar}">+ Adicionar</button>
      </div>
    </div>
  `;
}

function renderKeyCard(k) {
  const div = document.createElement("div");
  div.className = "key-card";
  const total = k.fields.reduce((sum, f) => sum + f.keys.length, 0);
  const statusPill = k.configured
    ? `<span class="pill ok">${total} chave${total === 1 ? "" : "s"}</span>`
    : '<span class="pill danger">faltando</span>';
  div.innerHTML = `
    <div class="key-card-header">
      <span class="api-name">${k.api}</span>
      ${statusPill}
    </div>
    ${k.fields.map(renderKeyField).join("")}
  `;
  return div;
}

function renderSettingsProviderRow(p) {
  const tr = document.createElement("tr");
  if (!p.enabled) tr.className = "disabled-row";
  tr.innerHTML = `
    <td><button class="toggle ${p.enabled ? "on" : ""}" data-name="${p.name}"></button></td>
    <td class="provider-name">${p.name}</td>
    <td><span class="pill">${p.engine}</span></td>
    <td><span class="pill">${p.api}</span></td>
    <td><input class="priority-input" type="number" min="1" value="${p.priority}" data-field="priority" data-name="${p.name}" /></td>
    <td><input class="quota-input" type="number" min="0" value="${p.quota ?? ""}" data-field="quota" data-name="${p.name}" /></td>
    <td><span class="pill">${p.period}</span></td>
    <td class="row-actions"><button data-reset="${p.name}">Zerar uso</button></td>
  `;
  return tr;
}

function renderSettings() {
  const grid = document.getElementById("keys-grid");
  grid.innerHTML = "";
  for (const k of cachedKeys) grid.appendChild(renderKeyCard(k));

  const tbody = document.getElementById("settings-providers-body");
  tbody.innerHTML = "";
  for (const p of cachedStatus.providers) tbody.appendChild(renderSettingsProviderRow(p));
}

document.getElementById("keys-grid").addEventListener("click", async (e) => {
  const addEnvVar = e.target.dataset.add;
  if (addEnvVar) {
    const input = document.querySelector(`input[data-envvar="${addEnvVar}"]`);
    const value = input.value.trim();
    if (!value) return;
    e.target.disabled = true;
    e.target.textContent = "...";
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envVar: addEnvVar, value }),
    });
    loadPage("settings");
    return;
  }

  const removeEnvVar = e.target.dataset.removeEnvvar;
  if (removeEnvVar !== undefined) {
    const index = e.target.dataset.removeIndex;
    await fetch(`/api/keys/${removeEnvVar}/${index}`, { method: "DELETE" });
    loadPage("settings");
  }
});

document.getElementById("keys-grid").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset.envvar) {
    e.preventDefault();
    document.querySelector(`button[data-add="${e.target.dataset.envvar}"]`)?.click();
  }
});

document.getElementById("settings-providers-body").addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest(".toggle");
  if (toggleBtn) {
    const name = toggleBtn.dataset.name;
    const enabling = !toggleBtn.classList.contains("on");
    await fetch(`/api/providers/${name}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: enabling }),
    });
    loadPage("settings");
    return;
  }
  const resetName = e.target.dataset.reset;
  if (resetName) {
    await fetch(`/api/providers/${resetName}/reset-usage`, { method: "POST" });
    loadPage("settings");
  }
});

document.getElementById("settings-providers-body").addEventListener("change", async (e) => {
  const field = e.target.dataset.field;
  const name = e.target.dataset.name;
  if (!field) return;

  const cfg = await fetchJson("/api/config");
  const provider = cfg.providers.find((p) => p.name === name);
  if (!provider) return;

  if (field === "priority") {
    provider.priority = Number(e.target.value) || provider.priority;
  } else if (field === "quota") {
    const value = Number(e.target.value) || 0;
    if ("dailyQuota" in provider) provider.dailyQuota = value;
    else provider.monthlyQuota = value;
  }

  await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  loadPage("settings");
});

document.getElementById("reset-all-usage").addEventListener("click", async () => {
  if (!confirm("Zerar o uso de TODOS os providers?")) return;
  await fetch("/api/usage/reset-all", { method: "POST" });
  loadPage("settings");
});

// ---- global actions ----

document.getElementById("refresh").addEventListener("click", () => loadPage(currentPage()));
document.getElementById("clear-cache").addEventListener("click", async () => {
  await fetch("/api/cache/clear", { method: "POST" });
  loadPage(currentPage());
});

// ---- boot ----

if (!location.hash) location.hash = "#/overview";
renderPage();
setInterval(() => {
  // settings recria o HTML dos inputs a cada load — auto-refresh no meio
  // de uma digitacao apaga o que a pessoa tava escrevendo
  if (currentPage() === "settings") return;
  loadPage(currentPage());
}, 8000);
