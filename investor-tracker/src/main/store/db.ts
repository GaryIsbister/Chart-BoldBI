import Database from "better-sqlite3";
import path from "node:path";
import { dataDir } from "../config.js";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error("Store not initialized; call initStore() first.");
  return _db;
}

export function initStore(): void {
  if (_db) return;
  const file = path.join(dataDir(), "investor-tracker.sqlite");
  _db = new Database(file);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  applyMigrations(_db);
}

function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domains_json TEXT NOT NULL DEFAULT '[]',
      classification TEXT NOT NULL DEFAULT 'uncertain',
      classification_reason TEXT,
      classified_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL,
      email TEXT UNIQUE,
      teams_user_id TEXT UNIQUE,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_entity ON contacts(entity_id);

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      subject TEXT,
      entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
      last_message_at TEXT NOT NULL,
      unread_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source, external_id)
    );
    CREATE INDEX IF NOT EXISTS idx_threads_entity ON threads(entity_id);
    CREATE INDEX IF NOT EXISTS idx_threads_last ON threads(last_message_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      from_contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      from_address TEXT,
      body TEXT NOT NULL,
      body_preview TEXT NOT NULL,
      received_at TEXT NOT NULL,
      is_outbound INTEGER NOT NULL DEFAULT 0,
      UNIQUE(source, external_id)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, received_at);

    CREATE TABLE IF NOT EXISTS sync_cursors (
      source TEXT NOT NULL,
      scope TEXT NOT NULL,
      delta_link TEXT,
      last_synced_at TEXT,
      PRIMARY KEY (source, scope)
    );

    CREATE TABLE IF NOT EXISTS classification_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      contacts_seen INTEGER NOT NULL,
      entities_added INTEGER NOT NULL,
      classifications_changed INTEGER NOT NULL,
      input_tokens INTEGER,
      cached_input_tokens INTEGER,
      output_tokens INTEGER,
      error TEXT
    );
  `);
}
