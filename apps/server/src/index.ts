import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { startDeliveryLoop } from './delivery/loop.js';

const app = await buildApp();
const stopDelivery = startDeliveryLoop();
await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info(`server listening on :${String(config.PORT)}`);

let shuttingDown = false;

async function shutdown(): Promise<void> {
  try {
    await stopDelivery();
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown failed');
    process.exit(1);
  }
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`server received ${sig}, shutting down`);
    void shutdown();
  });
}
