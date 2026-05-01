import { loadConfig } from "../config.js";
import { runPollerOnce } from "./poller.js";
import { runDailyClassifierOnce } from "./classifier.js";
import { hasClaudeKey } from "../claude/key-store.js";
import { getAuthStatus } from "../graph/auth.js";

let pollHandle: NodeJS.Timeout | null = null;
let dailyHandle: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  stopScheduler();
  const cfg = loadConfig();
  const pollMs = Math.max(1, cfg.polling.intervalMinutes) * 60_000;

  pollHandle = setInterval(() => {
    void safePoll();
  }, pollMs);
  setTimeout(() => void safePoll(), 5_000);

  dailyHandle = setTimeout(scheduleNextDaily, msUntilNext7am());
}

export function stopScheduler(): void {
  if (pollHandle) clearInterval(pollHandle);
  if (dailyHandle) clearTimeout(dailyHandle);
  pollHandle = null;
  dailyHandle = null;
}

async function safePoll(): Promise<void> {
  const status = await getAuthStatus();
  if (!status.signedIn) return;
  await runPollerOnce();
}

async function safeDaily(): Promise<void> {
  if (!(await hasClaudeKey())) return;
  const status = await getAuthStatus();
  if (!status.signedIn) return;
  try {
    await runDailyClassifierOnce();
  } catch (e) {
    console.error("Daily classifier failed:", e);
  }
}

function scheduleNextDaily(): void {
  void safeDaily().finally(() => {
    dailyHandle = setTimeout(scheduleNextDaily, msUntilNext7am());
  });
}

function msUntilNext7am(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(7, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
