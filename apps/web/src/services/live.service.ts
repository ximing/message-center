import { Service } from "@rabjs/react";
import { readLive, type LiveFeed } from "@/api/live";
import { ApiError } from "@/api/http";
import { nextCursor, nextPollDelayMs } from "@/lib/live-plan";

type LiveListener = () => boolean | Promise<boolean>;

function usable(value: LiveFeed | undefined): value is LiveFeed {
  return (
    !!value &&
    typeof value.revision === "string" &&
    /^(?:0|[1-9]\d{0,18})$/.test(value.revision) &&
    typeof value.changed === "boolean"
  );
}

/** Polls a revision. Pages reload only when it moves. Hidden tabs pause. */
export class LiveService extends Service {
  active = false;
  degraded = false;

  private revision: string | null = null;
  private listeners: LiveListener[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight = false;
  private failures = 0;
  private started = false;
  private stopped = false;

  subscribe(listener: LiveListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("online", this.onOnline);
    this.requestTick();
  }

  stop(): void {
    this.started = false;
    this.stopped = true;
    this.revision = null;
    this.failures = 0;
    this.degraded = false;
    this.clearTimer();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("online", this.onOnline);
    this.setActive(false);
  }

  private onVisibility = (): void => {
    if (!this.started || this.stopped) return;
    if (document.hidden) {
      this.clearTimer();
      return;
    }
    this.requestTick();
  };

  private onOnline = (): void => {
    if (!this.started || this.stopped) return;
    this.requestTick();
  };

  private requestTick(): void {
    if (this.stopped || this.inflight || document.hidden) return;
    void this.poll();
  }

  private async poll(): Promise<void> {
    this.inflight = true;
    try {
      const res = await readLive(this.revision);
      if (this.stopped) return;
      if (!usable(res)) throw new Error("live response");
      this.failures = 0;
      this.degraded = false;
      this.setActive(true);
      const applied =
        this.revision !== null && res.changed ? await this.notifyListeners() : true;
      if (this.stopped) return;
      this.revision = nextCursor(this.revision, res.revision, res.changed, applied);
    } catch (err) {
      if (!this.stopped) this.fail(err);
    } finally {
      this.inflight = false;
      if (!this.stopped) this.arm();
    }
  }

  private async notifyListeners(): Promise<boolean> {
    if (this.listeners.length === 0) return true;
    const results = await Promise.all(this.listeners.map((listener) => listener()));
    return results.every((ok) => ok !== false);
  }

  private fail(err: unknown): void {
    if (err instanceof ApiError && err.status === 401) {
      this.stop();
      return;
    }
    this.failures += 1;
    if (this.failures >= 3) {
      this.degraded = true;
      this.setActive(false);
    }
  }

  private arm(): void {
    this.clearTimer();
    if (this.stopped || document.hidden) return;
    this.timer = setTimeout(() => this.requestTick(), nextPollDelayMs(this.failures));
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
  }
}
