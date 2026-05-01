import { getDb } from "../db";
import { Settings } from "@shared/types";
import { nowIso } from "@shared/util";

const SETTINGS_KEY = "settings";

export const getSettings = (): Settings => {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings_kv WHERE key = ?").get(SETTINGS_KEY) as
    | { value: string }
    | undefined;
  if (!row) {
    const defaults = Settings.parse({});
    saveSettings(defaults);
    return defaults;
  }
  try {
    const parsed = Settings.parse(JSON.parse(row.value));
    return parsed;
  } catch {
    const defaults = Settings.parse({});
    saveSettings(defaults);
    return defaults;
  }
};

export const saveSettings = (settings: Settings): Settings => {
  const db = getDb();
  const valid = Settings.parse(settings);
  db.prepare(
    `INSERT INTO settings_kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SETTINGS_KEY, JSON.stringify(valid), nowIso());
  return valid;
};

export const updateSettings = (patch: Partial<Settings>): Settings => {
  const current = getSettings();
  const merged = Settings.parse({ ...current, ...patch });
  return saveSettings(merged);
};
