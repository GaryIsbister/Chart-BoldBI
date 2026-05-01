import type Database from "better-sqlite3";
import type { Message, SourceKind, Thread } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface MessageRow {
  id: string;
  source: SourceKind;
  external_id: string;
  thread_id: string | null;
  contact_id: string | null;
  entity_id: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string;
  subject: string | null;
  body_preview: string;
  received_at: string;
  is_from_us: number;
  raw: string | null;
}

const rowTo = (r: MessageRow): Message => ({
  id: r.id,
  source: r.source,
  externalId: r.external_id,
  threadId: r.thread_id,
  contactId: r.contact_id,
  entityId: r.entity_id,
  fromEmail: r.from_email,
  fromName: r.from_name,
  toEmails: JSON.parse(r.to_emails),
  subject: r.subject,
  bodyPreview: r.body_preview,
  receivedAt: r.received_at,
  isFromUs: r.is_from_us === 1,
});

interface ThreadRow {
  id: string;
  external_conversation_id: string;
  source: SourceKind;
  entity_id: string | null;
  subject: string | null;
  last_message_at: string;
  summary: string | null;
}

const threadRowTo = (r: ThreadRow): Thread => ({
  id: r.id,
  externalConversationId: r.external_conversation_id,
  source: r.source,
  entityId: r.entity_id,
  subject: r.subject,
  lastMessageAt: r.last_message_at,
  summary: r.summary,
});

export class MessagesRepo {
  constructor(private readonly db: Database.Database) {}

  upsertThread(input: {
    source: SourceKind;
    externalConversationId: string;
    subject?: string | null;
    lastMessageAt: string;
    entityId?: string | null;
  }): Thread {
    const existing = this.db
      .prepare("SELECT * FROM threads WHERE source = ? AND external_conversation_id = ?")
      .get(input.source, input.externalConversationId) as ThreadRow | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE threads
           SET subject = COALESCE(?, subject),
               last_message_at = CASE WHEN ? > last_message_at THEN ? ELSE last_message_at END,
               entity_id = COALESCE(?, entity_id)
           WHERE id = ?`,
        )
        .run(
          input.subject ?? null,
          input.lastMessageAt,
          input.lastMessageAt,
          input.entityId ?? null,
          existing.id,
        );
      return threadRowTo(
        this.db.prepare("SELECT * FROM threads WHERE id = ?").get(existing.id) as ThreadRow,
      );
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO threads (id, external_conversation_id, source, entity_id, subject, last_message_at, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.externalConversationId,
        input.source,
        input.entityId ?? null,
        input.subject ?? null,
        input.lastMessageAt,
        null,
      );
    return threadRowTo(this.db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as ThreadRow);
  }

  upsertMessage(input: Omit<Message, "id"> & { id?: string }): Message {
    const existing = this.db
      .prepare("SELECT * FROM messages WHERE source = ? AND external_id = ?")
      .get(input.source, input.externalId) as MessageRow | undefined;
    if (existing) return rowTo(existing);

    const id = input.id ?? uuid();
    this.db
      .prepare(
        `INSERT INTO messages (id, source, external_id, thread_id, contact_id, entity_id, from_email, from_name, to_emails, subject, body_preview, received_at, is_from_us, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.source,
        input.externalId,
        input.threadId,
        input.contactId,
        input.entityId,
        input.fromEmail.toLowerCase(),
        input.fromName,
        JSON.stringify(input.toEmails),
        input.subject,
        input.bodyPreview,
        input.receivedAt,
        input.isFromUs ? 1 : 0,
        input.raw ? JSON.stringify(input.raw) : null,
      );
    return rowTo(this.db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow);
  }

  listForThread(threadId: string): Message[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY received_at ASC")
      .all(threadId) as MessageRow[];
    return rows.map(rowTo);
  }

  listThreadsForEntity(entityId: string): Thread[] {
    const rows = this.db
      .prepare("SELECT * FROM threads WHERE entity_id = ? ORDER BY last_message_at DESC")
      .all(entityId) as ThreadRow[];
    return rows.map(threadRowTo);
  }

  newSendersSince(since: string): Array<{ email: string; displayName: string | null; messageCount: number }> {
    const rows = this.db
      .prepare(
        `SELECT m.from_email AS email, MAX(m.from_name) AS display_name, COUNT(*) AS message_count
         FROM messages m
         WHERE m.is_from_us = 0
           AND m.received_at >= ?
           AND m.entity_id IS NULL
           AND m.from_email NOT IN (SELECT email FROM ignored_senders)
           AND m.from_email NOT IN (SELECT email FROM pending_reviews WHERE decision IS NULL OR decision = 'snooze')
         GROUP BY m.from_email`,
      )
      .all(since) as Array<{ email: string; display_name: string | null; message_count: number }>;
    return rows.map((r) => ({
      email: r.email,
      displayName: r.display_name,
      messageCount: r.message_count,
    }));
  }

  recentMessagesFromSender(email: string, limit = 10): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE from_email = ? ORDER BY received_at DESC LIMIT ?",
      )
      .all(email.toLowerCase(), limit) as MessageRow[];
    return rows.map(rowTo);
  }

  attachToEntity(messageIds: string[], entityId: string): void {
    const update = this.db.prepare("UPDATE messages SET entity_id = ? WHERE id = ?");
    const tx = this.db.transaction((ids: string[]) => {
      for (const id of ids) update.run(entityId, id);
    });
    tx(messageIds);
  }
}
