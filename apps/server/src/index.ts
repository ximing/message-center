import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { startDeliveryLoop } from './delivery/loop.js';

const app = await buildApp();
const stopDelivery = startDeliveryLoop();
await app.listen({ port: config.PORT, host: '0.0.0.0' });
app.log.info(`server listening on :${String(config.PORT)}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    app.log.info(`server received ${sig}, shutting down`);
    stopDelivery();
    void app
      .close()
      .then(async () => {
        await pool.end();
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}
