import { buildApp } from './app.js';
import { env } from './config/env.js';

/**
 * PaaS providers (Railway, Render, Fly, Heroku) inject the port to bind to
 * via the standard `PORT` env var. Our `API_PORT` is what you can use to
 * override locally without touching that ecosystem. Resolution order:
 *   1. PORT (PaaS-injected, wins automatically when deployed)
 *   2. API_PORT (developer override / Zod default = 4000)
 */
function resolvePort(): number {
  const raw = process.env.PORT;
  if (raw && /^\d+$/.test(raw)) return parseInt(raw, 10);
  return env.API_PORT;
}

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ host: env.API_HOST, port: resolvePort() });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
