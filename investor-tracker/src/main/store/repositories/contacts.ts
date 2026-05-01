import type Database from "better-sqlite3";
import type { Contact } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

type Row = {
  id: string;
  entity_id: string;
  email: string;
  display_name: string | null;
  title: string | null;
  created_at: string;
};

const toContact = (r: Row): Contact => ({
  id: r.id,
  entityId: r.entity_id,
  email: r.email,
  displayName: r.display_name,
  title: r.title,
  createdAt: r.created_at,
});

export class ContactsRepo {
  constructor(private readonly db: Database.Database) {}

  findByEmail(email: string): Contact | null {
    const r = this.db
      .prepare("SELECT * FROM contacts WHERE LOWER(email) = LOWER(?)")
      .get(email) as Row | undefined;
    return r ? toContact(r) : null;
  }

  listForEntity(entityId: string): Contact[] {
    const rows = this.db
      .prepare("SELECT * FROM contacts WHERE entity_id = ? ORDER BY created_at")
      .all(entityId) as Row[];
    return rows.map(toContact);
  }

  upsert(input: {
    entityId: string;
    email: string;
    displayName: string | null;
    title?: string | null;
  }): Contact {
    const existing = this.findByEmail(input.email);
    if (existing) {
      this.db
        .prepare(
          "UPDATE contacts SET entity_id = ?, display_name = COALESCE(?, display_name), title = COALESCE(?, title) WHERE id = ?",
        )
        .run(input.entityId, input.displayName, input.title ?? null, existing.id);
      return this.findByEmail(input.email)!;
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO contacts(id, entity_id, email, display_name, title, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.entityId, input.email.toLowerCase(), input.displayName, input.title ?? null, nowIso());
    return this.findByEmail(input.email)!;
  }
}
