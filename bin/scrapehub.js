#!/usr/bin/env node
// CLI de instalacao/boot. `npm install -g .` (ou `npm link` local) registra
// o comando `scrapehub`, que sobe o dashboard e abre no navegador — igual
// ao fluxo `npm install -g omniroute && omniroute`.
import { spawn } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");

function ensureEnvFile() {
  if (!existsSync(ENV_PATH) && existsSync(ENV_EXAMPLE_PATH)) {
    copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
    console.log("Criado .env a partir do .env.example — configure as chaves pelo dashboard.");
  }
}

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    return;
  }
  const cmd = platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}

function main() {
  ensureEnvFile();

  const port = process.env.DASHBOARD_PORT || 4545;
  const url = `http://localhost:${port}`;

  const child = spawn(process.execPath, [join(ROOT, "server.js")], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  setTimeout(() => openBrowser(url), 800);

  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main();
