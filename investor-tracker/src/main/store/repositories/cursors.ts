import type Database from "better-sqlite3";
import { nowIso } from "@shared/util";

export class CursorsRepo {
  constructor(private readonly db: Database.Database) {}

  get(key: string): string | null {
    const r = this.db
      .prepare("SELECT value FROM cursors WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return r?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO cursors(key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, nowIso());
  }
}
