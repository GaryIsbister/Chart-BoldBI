import { getDb } from "../db";
import type { Contact } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface ContactRow {
  id: string;
  entity_id: string;
  email: string;
  display_name: string | null;
  title: string | null;
  created_at: string;
}

const rowToContact = (row: ContactRow): Contact => ({
  id: row.id,
  entityId: row.entity_id,
  email: row.email,
  displayName: row.display_name,
  title: row.title,
  createdAt: row.created_at,
});

export const listContactsForEntity = (entityId: string): Contact[] => {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM contacts WHERE entity_id = ? ORDER BY created_at ASC")
      .all(entityId) as ContactRow[]
  ).map(rowToContact);
};

export const findContactByEmail = (email: string): Contact | null => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM contacts WHERE LOWER(email) = LOWER(?)")
    .get(email) as ContactRow | undefined;
  return row ? rowToContact(row) : null;
};

export interface UpsertContactInput {
  entityId: string;
  email: string;
  displayName?: string | null;
  title?: string | null;
}

export const upsertContact = (input: UpsertContactInput): Contact => {
  const db = getDb();
  const existing = findContactByEmail(input.email);
  if (existing) return existing;
  const id = uuid();
  db.prepare(
    `INSERT INTO contacts (id, entity_id, email, display_name, title, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.entityId, input.email, input.displayName ?? null, input.title ?? null, nowIso());
  return findContactByEmail(input.email)!;
};
