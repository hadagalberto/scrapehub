// Le/escreve o .env preservando linhas existentes — usado pela tela de
// configuracao de chaves do dashboard, pra nao precisar editar o arquivo na mao.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const lines = readFileSync(path, "utf-8").split("\n");
  const map = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

export function upsertEnvVar(path, key, value) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = existsSync(path) ? readFileSync(path, "utf-8").split("\n") : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1].trim() !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  writeFileSync(path, next.join("\n"));
}
