import { outboundFetch } from '../http/outbound.js';
import { deliverQueued } from './deliver.js';

export function startDeliveryLoop(intervalMs = 5_000): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void deliverQueued({ fetch: outboundFetch })
      .catch(() => {
        console.error(JSON.stringify({ scope: 'delivery', errorCode: 'worker_failed' }));
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  return () => clearInterval(timer);
}
