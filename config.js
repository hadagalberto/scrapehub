// Config do usuario, sempre lido fresco do disco em ~/.scrapehub/config.json.
// No primeiro uso, copia o template bundled no pacote (config.default.json).
import { existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { USER_CONFIG_PATH, DEFAULT_CONFIG_PATH } from "./gateway/paths.js";

function ensureUserConfig() {
  if (existsSync(USER_CONFIG_PATH)) return;
  mkdirSync(dirname(USER_CONFIG_PATH), { recursive: true });
  copyFileSync(DEFAULT_CONFIG_PATH, USER_CONFIG_PATH);
}

export function loadConfig() {
  ensureUserConfig();
  return JSON.parse(readFileSync(USER_CONFIG_PATH, "utf-8"));
}

export const CONFIG_PATH = USER_CONFIG_PATH;

export default loadConfig();
