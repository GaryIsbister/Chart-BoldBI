import type Database from "better-sqlite3";
import { Settings } from "@shared/types";

const KEY = "settings";

export class SettingsRepo {
  constructor(private readonly db: Database.Database) {}

  get(): Settings {
    const r = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(KEY) as { value: string } | undefined;
    if (!r) return Settings.parse({});
    try {
      return Settings.parse(JSON.parse(r.value));
    } catch {
      return Settings.parse({});
    }
  }

  update(patch: Partial<Settings>): Settings {
    const next = Settings.parse({ ...this.get(), ...patch });
    this.db
      .prepare(
        `INSERT INTO settings(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(KEY, JSON.stringify(next));
    return next;
  }
}

export class DemandBookRepo {
  constructor(private readonly db: Database.Database) {}

  insertImport(
    importId: string,
    entries: { entityName: string; contactNames: string[]; contactEmails: string[]; ticketSize: string | null; notes: string | null }[],
  ): void {
    const insert = this.db.prepare(
      `INSERT INTO demand_book_entries(id, import_id, entity_name, contact_names, contact_emails, ticket_size, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      for (const e of entries) {
        insert.run(
          globalThis.crypto.randomUUID(),
          importId,
          e.entityName,
          JSON.stringify(e.contactNames),
          JSON.stringify(e.contactEmails.map((x) => x.toLowerCase())),
          e.ticketSize,
          e.notes,
        );
      }
    });
    tx();
  }

  findByContactEmail(email: string): { entityName: string; ticketSize: string | null; notes: string | null } | null {
    const lower = email.toLowerCase();
    const rows = this.db
      .prepare(
        "SELECT entity_name, ticket_size, notes, contact_emails FROM demand_book_entries",
      )
      .all() as { entity_name: string; ticket_size: string | null; notes: string | null; contact_emails: string }[];
    for (const r of rows) {
      const emails = JSON.parse(r.contact_emails) as string[];
      if (emails.includes(lower)) {
        return { entityName: r.entity_name, ticketSize: r.ticket_size, notes: r.notes };
      }
    }
    return null;
  }

  findByDomain(domain: string): { entityName: string; ticketSize: string | null; notes: string | null } | null {
    const lower = domain.toLowerCase();
    const rows = this.db
      .prepare(
        "SELECT entity_name, ticket_size, notes, contact_emails FROM demand_book_entries",
      )
      .all() as { entity_name: string; ticket_size: string | null; notes: string | null; contact_emails: string }[];
    for (const r of rows) {
      const emails = JSON.parse(r.contact_emails) as string[];
      if (emails.some((e) => e.endsWith(`@${lower}`))) {
        return { entityName: r.entity_name, ticketSize: r.ticket_size, notes: r.notes };
      }
    }
    return null;
  }

  listAll(): { entityName: string; contactEmails: string[] }[] {
    const rows = this.db
      .prepare("SELECT entity_name, contact_emails FROM demand_book_entries")
      .all() as { entity_name: string; contact_emails: string }[];
    return rows.map((r) => ({
      entityName: r.entity_name,
      contactEmails: JSON.parse(r.contact_emails) as string[],
    }));
  }
}
