#!/usr/bin/env node
// CLI de boot. `npm install -g scrapehub` registra o comando `scrapehub`,
// que na primeira vez cria ~/.scrapehub (config + .env) e sobe o dashboard,
// abrindo no navegador — igual ao fluxo `npm install -g omniroute && omniroute`.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import {
  PACKAGE_ROOT,
  USER_DIR,
  USER_ENV_PATH,
  USER_CONFIG_PATH,
  USER_DATA_DIR,
  DEFAULT_CONFIG_PATH,
  ENV_EXAMPLE_PATH,
} from "../gateway/paths.js";

function bootstrapUserDir() {
  mkdirSync(USER_DATA_DIR, { recursive: true });

  if (!existsSync(USER_CONFIG_PATH)) {
    copyFileSync(DEFAULT_CONFIG_PATH, USER_CONFIG_PATH);
  }
  if (!existsSync(USER_ENV_PATH)) {
    copyFileSync(ENV_EXAMPLE_PATH, USER_ENV_PATH);
    console.log(`Primeira vez rodando — configuracao criada em ${USER_DIR}`);
    console.log("Cole suas chaves de API pela tela de Configuracoes do dashboard.");
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
  bootstrapUserDir();

  const port = process.env.DASHBOARD_PORT || 4545;
  const url = `http://localhost:${port}`;

  const child = spawn(process.execPath, [join(PACKAGE_ROOT, "server.js")], {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  setTimeout(() => openBrowser(url), 800);

  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

main();
