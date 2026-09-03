// Onde o scrapehub guarda dado de usuario (config, chaves, cache, uso).
// Fica em ~/.scrapehub, fora da pasta do pacote — necessario pra instalacao
// global via npm, onde a pasta do pacote pode ser somente-leitura ou sumir
// num update.
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const USER_DIR = process.env.SCRAPEHUB_HOME || join(homedir(), ".scrapehub");
export const USER_ENV_PATH = join(USER_DIR, ".env");
export const USER_CONFIG_PATH = join(USER_DIR, "config.json");
export const USER_DATA_DIR = join(USER_DIR, "data");
export const USER_STORE_PATH = join(USER_DATA_DIR, "store.json");

export const DEFAULT_CONFIG_PATH = join(PACKAGE_ROOT, "config.default.json");
export const ENV_EXAMPLE_PATH = join(PACKAGE_ROOT, ".env.example");
