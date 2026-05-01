interface ScheduledJob {
  name: string;
  intervalMs: number;
  fn: () => Promise<unknown>;
  timer: NodeJS.Timeout | null;
  running: boolean;
}

export class Scheduler {
  private jobs = new Map<string, ScheduledJob>();

  every(name: string, intervalMs: number, fn: () => Promise<unknown>): void {
    this.cancel(name);
    const job: ScheduledJob = { name, intervalMs, fn, timer: null, running: false };
    const tick = async (): Promise<void> => {
      if (job.running) return;
      job.running = true;
      try {
        await fn();
      } catch (e) {
        console.error(`[scheduler:${name}]`, e);
      } finally {
        job.running = false;
      }
    };
    job.timer = setInterval(tick, intervalMs);
    this.jobs.set(name, job);
    void tick();
  }

  // Schedule a single fire each day at the given local hour.
  daily(name: string, hourLocal: number, fn: () => Promise<unknown>): void {
    this.cancel(name);
    const scheduleNext = (): void => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hourLocal, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now.getTime();
      const timer = setTimeout(async () => {
        try {
          await fn();
        } catch (e) {
          console.error(`[scheduler:${name}]`, e);
        }
        scheduleNext();
      }, delay);
      this.jobs.set(name, { name, intervalMs: 0, fn, timer, running: false });
    };
    scheduleNext();
  }

  cancel(name: string): void {
    const existing = this.jobs.get(name);
    if (existing?.timer) clearInterval(existing.timer);
    this.jobs.delete(name);
  }

  cancelAll(): void {
    for (const j of this.jobs.values()) if (j.timer) clearInterval(j.timer);
    this.jobs.clear();
  }
}
