import { getDb } from "../db";
import { nowIso } from "@shared/util";

export const getCursor = (key: string): string | null => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM cursors WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
};

export const setCursor = (key: string, value: string): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO cursors (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value, nowIso());
};
