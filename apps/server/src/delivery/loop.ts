import { outboundFetch } from '../http/outbound.js';
import { deliverQueued } from './deliver.js';

const ERROR_MESSAGE_MAX = 500;

function workerFailedLog(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      scope: 'delivery',
      errorCode: 'worker_failed',
      name: error.name,
      message: error.message.slice(0, ERROR_MESSAGE_MAX),
    });
  }
  return JSON.stringify({
    scope: 'delivery',
    errorCode: 'worker_failed',
    name: 'Error',
    message: 'unknown',
  });
}

export function startDeliveryLoop(
  intervalMs = 5_000,
  run: () => Promise<void> = () => deliverQueued({ fetch: outboundFetch }),
): () => Promise<void> {
  let stopped = false;
  let inflight: Promise<void> | null = null;

  const timer = setInterval(() => {
    if (stopped || inflight) return;
    const current = Promise.resolve()
      .then(run)
      .catch((error: unknown) => {
        console.error(workerFailedLog(error));
      })
      .finally(() => {
        if (inflight === current) inflight = null;
      });
    inflight = current;
  }, intervalMs);

  return async () => {
    clearInterval(timer);
    stopped = true;
    await inflight;
  };
}
