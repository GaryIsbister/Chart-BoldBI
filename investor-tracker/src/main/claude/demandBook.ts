import { getDb } from "../store/db";
import type { DemandBookEntry } from "@shared/types";
import { uuid } from "@shared/util";

interface DemandBookRow {
  id: string;
  import_id: string;
  entity_name: string;
  contact_names: string;
  contact_emails: string;
  ticket_size: string | null;
  notes: string | null;
}

const rowToEntry = (row: DemandBookRow): DemandBookEntry => ({
  id: row.id,
  importId: row.import_id,
  entityName: row.entity_name,
  contactNames: JSON.parse(row.contact_names) as string[],
  contactEmails: JSON.parse(row.contact_emails) as string[],
  ticketSize: row.ticket_size,
  notes: row.notes,
});

export const listDemandBookEntries = (): DemandBookEntry[] => {
  const db = getDb();
  return (db.prepare("SELECT * FROM demand_book_entries").all() as DemandBookRow[]).map(rowToEntry);
};

export interface ImportDemandBookInput {
  entries: Array<{
    entityName: string;
    contactNames: string[];
    contactEmails: string[];
    ticketSize?: string | null;
    notes?: string | null;
  }>;
}

export const importDemandBook = (input: ImportDemandBookInput): { importId: string; count: number } => {
  const db = getDb();
  const importId = uuid();
  const insert = db.prepare(
    `INSERT INTO demand_book_entries (id, import_id, entity_name, contact_names, contact_emails, ticket_size, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  db.transaction(() => {
    for (const e of input.entries) {
      insert.run(
        uuid(),
        importId,
        e.entityName,
        JSON.stringify(e.contactNames),
        JSON.stringify(e.contactEmails),
        e.ticketSize ?? null,
        e.notes ?? null,
      );
    }
  })();
  return { importId, count: input.entries.length };
};

export const buildDemandBookContext = (limit = 80): string => {
  const entries = listDemandBookEntries().slice(0, limit);
  if (entries.length === 0) return "";
  return entries
    .map(
      (e) =>
        `- ${e.entityName} | contacts: ${e.contactEmails.join(", ") || "(no emails)"} | ticket: ${e.ticketSize ?? "?"}`,
    )
    .join("\n");
};

export const findDemandBookMatchByEmail = (email: string): DemandBookEntry | null => {
  const lower = email.toLowerCase();
  for (const entry of listDemandBookEntries()) {
    if (entry.contactEmails.some((c) => c.toLowerCase() === lower)) return entry;
  }
  return null;
};
