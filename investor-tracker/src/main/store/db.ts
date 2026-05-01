import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { app } from "electron";
import { runMigrations } from "./migrations";

let dbInstance: Database.Database | null = null;

export const getDb = (): Database.Database => {
  if (dbInstance) return dbInstance;
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, "investor-tracker.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  dbInstance = db;
  return db;
};

export const closeDb = (): void => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};
