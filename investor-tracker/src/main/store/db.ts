import Database from "better-sqlite3";
import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "./migrations";

let instance: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (instance) return instance;
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "investor-tracker.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  instance = db;
  return db;
};

export const closeDb = (): void => {
  instance?.close();
  instance = null;
};
