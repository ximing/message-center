import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDeliveryLoop } from './loop.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('startDeliveryLoop', () => {
  const stops: Array<() => Promise<void>> = [];

  function start(intervalMs: number, run: () => Promise<void>): () => Promise<void> {
    const stop = startDeliveryLoop(intervalMs, run);
    stops.push(stop);
    return stop;
  }

  afterEach(async () => {
    const pending = stops.splice(0);
    for (const stop of pending) await stop();
  });

  it('does not finish stop until the in-flight round is released', async () => {
    const gate = deferred();
    const started = deferred();
    let calls = 0;
    const stop = start(30, async () => {
      calls += 1;
      started.resolve();
      await gate.promise;
    });

    try {
      await started.promise;
      let settled = false;
      const pendingStop = stop().then(() => {
        settled = true;
      });
      await delay(50);
      expect(settled).toBe(false);
      expect(calls).toBe(1);
      gate.resolve();
      await pendingStop;
      expect(settled).toBe(true);
    } finally {
      gate.resolve();
    }
  });

  it('logs worker_failed with the error message and keeps the timer alive', async () => {
    const original = console.error;
    const lines: string[] = [];
    console.error = (...args: unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(' '));
    };
    let calls = 0;
    try {
      start(30, async () => {
        calls += 1;
        if (calls === 1) throw new Error('relay exploded');
      });
      await vi.waitFor(() => {
        expect(calls).toBeGreaterThanOrEqual(2);
      });
      const line = lines.find((entry) => entry.includes('worker_failed'));
      expect(line).toBeDefined();
      if (!line) return;
      expect(line).toContain('relay exploded');
      expect(JSON.parse(line)).toEqual({
        scope: 'delivery',
        errorCode: 'worker_failed',
        name: 'Error',
        message: 'relay exploded',
      });
    } finally {
      console.error = original;
    }
  });

  it('runs another round after the fake run finishes', async () => {
    let calls = 0;
    start(30, async () => {
      calls += 1;
    });
    await vi.waitFor(() => {
      expect(calls).toBeGreaterThanOrEqual(2);
    });
  });

  it('logs unknown for a non-Error rejection and does not print the thrown value', async () => {
    const original = console.error;
    const lines: string[] = [];
    console.error = (...args: unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(' '));
    };
    let calls = 0;
    try {
      start(30, async () => {
        calls += 1;
        if (calls === 1) throw { authorization: 'secret-token' };
      });
      await vi.waitFor(() => {
        expect(calls).toBeGreaterThanOrEqual(2);
        expect(lines.some((entry) => entry.includes('worker_failed'))).toBe(true);
      });
      const line = lines.find((entry) => entry.includes('worker_failed'));
      if (!line) throw new Error('missing worker_failed log');
      expect(line).not.toContain('secret-token');
      expect(JSON.parse(line)).toEqual({
        scope: 'delivery',
        errorCode: 'worker_failed',
        name: 'Error',
        message: 'unknown',
      });
    } finally {
      console.error = original;
    }
  });
});
