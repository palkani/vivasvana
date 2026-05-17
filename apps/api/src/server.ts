import { buildApp } from './app.js';
import { env } from './config/env.js';

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
