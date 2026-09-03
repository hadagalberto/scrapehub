// Ponto de entrada unico. Bots importam so isso.
import { Router } from "./router.js";

let router = null;

function getRouter() {
  if (!router) router = new Router();
  return router;
}

/**
 * engine: 'maps' | 'serp' | 'web'
 * options: { useCache?: boolean, ...params } — params vao direto pro provider
 *          (q, location, gl, hl, etc).
 * Retorna { provider, cached, results: [{ title, url, snippet, extra }] }.
 */
export function search(engine, options = {}) {
  return getRouter().search(engine, options);
}
