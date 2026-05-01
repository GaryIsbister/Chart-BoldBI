import { getSettings } from "../store/repositories/settings";
import { runPoller } from "./poller";
import { runDailyClassifier } from "./dailyClassifier";
import { runThreadRefresher } from "./threadRefresher";

let pollTimer: NodeJS.Timeout | null = null;
let dailyTimer: NodeJS.Timeout | null = null;

export const startScheduler = (): void => {
  schedulePoller();
  scheduleDaily();
};

export const stopScheduler = (): void => {
  if (pollTimer) clearTimeout(pollTimer);
  if (dailyTimer) clearTimeout(dailyTimer);
  pollTimer = null;
  dailyTimer = null;
};

const schedulePoller = (): void => {
  const settings = getSettings();
  const intervalMs = Math.max(60_000, settings.pollIntervalMinutes * 60_000);
  const tick = async (): Promise<void> => {
    try {
      await runPoller();
    } catch (e) {
      console.error("poller failed:", e);
    } finally {
      pollTimer = setTimeout(tick, intervalMs);
    }
  };
  pollTimer = setTimeout(tick, intervalMs);
};

const scheduleDaily = (): void => {
  const settings = getSettings();
  const targetHour = settings.dailyClassifierHourLocal;
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next.getTime() - now.getTime();
  const tick = async (): Promise<void> => {
    try {
      await runDailyClassifier();
      await runThreadRefresher();
    } catch (e) {
      console.error("daily job failed:", e);
    } finally {
      dailyTimer = setTimeout(tick, 24 * 60 * 60 * 1000);
    }
  };
  dailyTimer = setTimeout(tick, delay);
};
