// Uso: node main.js maps "pizzaria" --location "Sao Paulo, BR"
import { search } from "./gateway/client.js";

function parseArgs(argv) {
  const [engine, query, ...rest] = argv;
  const options = { q: query };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--location") options.location = rest[++i];
    if (rest[i] === "--no-cache") options.useCache = false;
  }
  return { engine, options };
}

async function main() {
  const { engine, options } = parseArgs(process.argv.slice(2));
  if (!engine || !options.q) {
    console.error('Uso: node main.js <maps|serp|web> "query" [--location "..."] [--no-cache]');
    process.exit(1);
  }

  try {
    const result = await search(engine, options);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Erro:", e.message);
    process.exit(1);
  }
}

main();
