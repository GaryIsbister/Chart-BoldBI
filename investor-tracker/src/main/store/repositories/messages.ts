import type Database from "better-sqlite3";
import type { Message, SourceKind, Thread } from "@shared/types";
import { uuid } from "@shared/util";

type MessageRow = {
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
};

type ThreadRow = {
  id: string;
  external_conversation_id: string;
  source: SourceKind;
  entity_id: string | null;
  subject: string | null;
  last_message_at: string;
  summary: string | null;
};

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  source: r.source,
  externalId: r.external_id,
  threadId: r.thread_id,
  contactId: r.contact_id,
  entityId: r.entity_id,
  fromEmail: r.from_email,
  fromName: r.from_name,
  toEmails: JSON.parse(r.to_emails) as string[],
  subject: r.subject,
  bodyPreview: r.body_preview,
  receivedAt: r.received_at,
  isFromUs: r.is_from_us === 1,
  raw: r.raw ? JSON.parse(r.raw) : undefined,
});

const toThread = (r: ThreadRow): Thread => ({
  id: r.id,
  externalConversationId: r.external_conversation_id,
  source: r.source,
  entityId: r.entity_id,
  subject: r.subject,
  lastMessageAt: r.last_message_at,
  summary: r.summary,
});

export type MessageInput = {
  source: SourceKind;
  externalId: string;
  externalConversationId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  subject: string | null;
  bodyPreview: string;
  receivedAt: string;
  isFromUs: boolean;
  raw?: unknown;
};

export class MessagesRepo {
  constructor(private readonly db: Database.Database) {}

  findByExternal(source: SourceKind, externalId: string): Message | null {
    const r = this.db
      .prepare("SELECT * FROM messages WHERE source = ? AND external_id = ?")
      .get(source, externalId) as MessageRow | undefined;
    return r ? toMessage(r) : null;
  }

  upsertThread(
    source: SourceKind,
    externalConversationId: string,
    subject: string | null,
    lastMessageAt: string,
  ): Thread {
    const existing = this.db
      .prepare(
        "SELECT * FROM threads WHERE source = ? AND external_conversation_id = ?",
      )
      .get(source, externalConversationId) as ThreadRow | undefined;
    if (existing) {
      if (lastMessageAt > existing.last_message_at) {
        this.db
          .prepare(
            "UPDATE threads SET last_message_at = ?, subject = COALESCE(?, subject) WHERE id = ?",
          )
          .run(lastMessageAt, subject, existing.id);
      }
      const r = this.db
        .prepare("SELECT * FROM threads WHERE id = ?")
        .get(existing.id) as ThreadRow;
      return toThread(r);
    }
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO threads(id, external_conversation_id, source, entity_id, subject, last_message_at, summary)
         VALUES (?, ?, ?, NULL, ?, ?, NULL)`,
      )
      .run(id, externalConversationId, source, subject, lastMessageAt);
    const r = this.db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(id) as ThreadRow;
    return toThread(r);
  }

  insertMessage(input: MessageInput): Message {
    const existing = this.findByExternal(input.source, input.externalId);
    if (existing) return existing;
    const thread = input.externalConversationId
      ? this.upsertThread(
          input.source,
          input.externalConversationId,
          input.subject,
          input.receivedAt,
        )
      : null;
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO messages(
          id, source, external_id, thread_id, contact_id, entity_id,
          from_email, from_name, to_emails, subject, body_preview,
          received_at, is_from_us, raw
        ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.source,
        input.externalId,
        thread?.id ?? null,
        input.fromEmail.toLowerCase(),
        input.fromName,
        JSON.stringify(input.toEmails.map((e) => e.toLowerCase())),
        input.subject,
        input.bodyPreview,
        input.receivedAt,
        input.isFromUs ? 1 : 0,
        input.raw ? JSON.stringify(input.raw) : null,
      );
    return this.findByExternal(input.source, input.externalId)!;
  }

  attachContactAndEntity(
    messageId: string,
    contactId: string | null,
    entityId: string | null,
  ): void {
    this.db
      .prepare(
        "UPDATE messages SET contact_id = ?, entity_id = ? WHERE id = ?",
      )
      .run(contactId, entityId, messageId);
    if (entityId) {
      const m = this.db
        .prepare("SELECT thread_id FROM messages WHERE id = ?")
        .get(messageId) as { thread_id: string | null } | undefined;
      if (m?.thread_id) {
        this.db
          .prepare("UPDATE threads SET entity_id = ? WHERE id = ?")
          .run(entityId, m.thread_id);
      }
    }
  }

  listUnclassified(limit = 200): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE entity_id IS NULL AND is_from_us = 0 ORDER BY received_at DESC LIMIT ?",
      )
      .all(limit) as MessageRow[];
    return rows.map(toMessage);
  }

  listForEntity(entityId: string, limit = 200): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE entity_id = ? ORDER BY received_at DESC LIMIT ?",
      )
      .all(entityId, limit) as MessageRow[];
    return rows.map(toMessage);
  }

  listForThread(threadId: string): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE thread_id = ? ORDER BY received_at ASC",
      )
      .all(threadId) as MessageRow[];
    return rows.map(toMessage);
  }

  listFromSender(email: string, limit = 50): Message[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM messages WHERE LOWER(from_email) = LOWER(?) ORDER BY received_at DESC LIMIT ?",
      )
      .all(email, limit) as MessageRow[];
    return rows.map(toMessage);
  }

  listThreadsForEntity(entityId: string): Thread[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM threads WHERE entity_id = ? ORDER BY last_message_at DESC",
      )
      .all(entityId) as ThreadRow[];
    return rows.map(toThread);
  }

  listRecentlyActiveThreads(sinceIso: string): Thread[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM threads WHERE last_message_at >= ? ORDER BY last_message_at DESC",
      )
      .all(sinceIso) as ThreadRow[];
    return rows.map(toThread);
  }

  setThreadSummary(threadId: string, summary: string): void {
    this.db
      .prepare("UPDATE threads SET summary = ? WHERE id = ?")
      .run(summary, threadId);
  }

  daysSinceLastMessage(entityId: string): number | null {
    const r = this.db
      .prepare(
        "SELECT MAX(received_at) as last FROM messages WHERE entity_id = ?",
      )
      .get(entityId) as { last: string | null } | undefined;
    if (!r?.last) return null;
    const ms = Date.now() - new Date(r.last).getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  }

  countByEntity(): Map<string, number> {
    const rows = this.db
      .prepare(
        "SELECT entity_id, COUNT(*) as c FROM messages WHERE entity_id IS NOT NULL GROUP BY entity_id",
      )
      .all() as { entity_id: string; c: number }[];
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.entity_id, r.c);
    return map;
  }
}
