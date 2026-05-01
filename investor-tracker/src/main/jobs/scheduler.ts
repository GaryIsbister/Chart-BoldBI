import { getDb } from "../store/db";
import { SettingsRepo } from "../store/repositories/settings";
import { runPollOnce } from "./poller";
import { refreshRecentThreads } from "./threadRefresher";
import { runDailyClassifier } from "./dailyClassifier";

let pollTimer: NodeJS.Timeout | null = null;
let dailyTimer: NodeJS.Timeout | null = null;
let pollInFlight = false;

const safePoll = async (): Promise<void> => {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    await runPollOnce();
    await refreshRecentThreads(2);
  } catch (err) {
    console.error("poll cycle failed", err);
  } finally {
    pollInFlight = false;
  }
};

const msUntilNextDailyHour = (hour: number): number => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};

export const startScheduler = (): void => {
  stopScheduler();
  const settings = new SettingsRepo(getDb()).get();

  pollTimer = setInterval(
    () => {
      void safePoll();
    },
    Math.max(1, settings.pollIntervalMinutes) * 60 * 1000,
  );

  const scheduleDaily = (): void => {
    const wait = msUntilNextDailyHour(settings.dailyClassifierHourLocal);
    dailyTimer = setTimeout(async () => {
      try {
        await runDailyClassifier();
      } catch (err) {
        console.error("daily classifier failed", err);
      }
      scheduleDaily();
    }, wait);
  };
  scheduleDaily();
};

export const stopScheduler = (): void => {
  if (pollTimer) clearInterval(pollTimer);
  if (dailyTimer) clearTimeout(dailyTimer);
  pollTimer = null;
  dailyTimer = null;
};

export const triggerPollNow = (): Promise<void> => safePoll();
export const triggerDailyClassifierNow = (): Promise<void> => runDailyClassifier();
