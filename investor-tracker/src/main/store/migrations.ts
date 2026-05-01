import type Database from "better-sqlite3";

type Migration = { version: number; sql: string };

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT,
        pipeline_stage TEXT NOT NULL DEFAULT 'new',
        parked_until TEXT,
        stage_manual_override INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_entities_domain ON entities(domain);
      CREATE INDEX idx_entities_stage ON entities(pipeline_stage);

      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        title TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_contacts_entity ON contacts(entity_id);

      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        external_conversation_id TEXT NOT NULL,
        source TEXT NOT NULL,
        entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
        subject TEXT,
        last_message_at TEXT NOT NULL,
        summary TEXT,
        UNIQUE(source, external_conversation_id)
      );
      CREATE INDEX idx_threads_entity ON threads(entity_id);
      CREATE INDEX idx_threads_last_message ON threads(last_message_at);

      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        external_id TEXT NOT NULL,
        thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
        contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        to_emails TEXT NOT NULL,
        subject TEXT,
        body_preview TEXT NOT NULL,
        received_at TEXT NOT NULL,
        is_from_us INTEGER NOT NULL DEFAULT 0,
        raw TEXT,
        UNIQUE(source, external_id)
      );
      CREATE INDEX idx_messages_thread ON messages(thread_id);
      CREATE INDEX idx_messages_entity ON messages(entity_id);
      CREATE INDEX idx_messages_received ON messages(received_at);
      CREATE INDEX idx_messages_from ON messages(from_email);

      CREATE TABLE action_items (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        thread_id TEXT REFERENCES threads(id) ON DELETE SET NULL,
        source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        owner_side TEXT NOT NULL,
        description TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        resolved_at TEXT,
        resolved_by_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_action_items_entity ON action_items(entity_id);
      CREATE INDEX idx_action_items_status ON action_items(status);

      CREATE TABLE pending_reviews (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT,
        domain TEXT,
        proposed_entity_name TEXT NOT NULL,
        proposed_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
        confidence REAL NOT NULL,
        reasoning TEXT NOT NULL,
        matched_demand_book_entry TEXT,
        evidence_message_ids TEXT NOT NULL,
        created_at TEXT NOT NULL,
        decision TEXT,
        decided_at TEXT
      );
      CREATE INDEX idx_pending_reviews_decision ON pending_reviews(decision);

      CREATE TABLE stage_history (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        from_stage TEXT,
        to_stage TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        reason TEXT,
        changed_at TEXT NOT NULL
      );
      CREATE INDEX idx_stage_history_entity ON stage_history(entity_id);

      CREATE TABLE demand_book_entries (
        id TEXT PRIMARY KEY,
        import_id TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        contact_names TEXT NOT NULL,
        contact_emails TEXT NOT NULL,
        ticket_size TEXT,
        notes TEXT
      );
      CREATE INDEX idx_demand_book_import ON demand_book_entries(import_id);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE cursors (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export const runMigrations = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((r) => (r as { version: number }).version),
  );
  const insert = db.prepare(
    "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.version, new Date().toISOString());
    })();
  }
};
