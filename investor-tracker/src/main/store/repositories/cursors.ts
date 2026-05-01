import type Database from "better-sqlite3";
import { nowIso } from "@shared/util";

export class CursorsRepo {
  constructor(private readonly db: Database.Database) {}

  get(source: string): string | null {
    const row = this.db.prepare("SELECT cursor FROM poll_cursors WHERE source = ?").get(source) as
      | { cursor: string }
      | undefined;
    return row?.cursor ?? null;
  }

  set(source: string, cursor: string): void {
    this.db
      .prepare(
        "INSERT INTO poll_cursors (source, cursor, updated_at) VALUES (?, ?, ?) " +
          "ON CONFLICT(source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at",
      )
      .run(source, cursor, nowIso());
  }
}
