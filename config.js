// Config carregado sempre fresco do disco — dashboard escreve em config.json
// direto, e o router le antes de cada busca.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.json");

export function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

export { CONFIG_PATH };

export default loadConfig();
