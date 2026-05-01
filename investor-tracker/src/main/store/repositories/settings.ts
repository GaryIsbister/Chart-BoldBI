import type Database from "better-sqlite3";
import { Settings } from "@shared/types";

export class SettingsRepo {
  constructor(private readonly db: Database.Database) {}

  get(): Settings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const raw: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        raw[r.key] = JSON.parse(r.value);
      } catch {
        raw[r.key] = r.value;
      }
    }
    return Settings.parse(raw);
  }

  update(patch: Partial<Settings>): Settings {
    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      );
      for (const [k, v] of Object.entries(patch)) {
        stmt.run(k, JSON.stringify(v));
      }
    });
    tx();
    return this.get();
  }

  getDemandBookContext(): string | null {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = 'demandBookContext'")
      .get() as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  }

  setDemandBookContext(text: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES ('demandBookContext', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(JSON.stringify(text));
  }
}
