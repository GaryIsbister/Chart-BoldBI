import { getDb } from "../db";
import type { Message, SourceKind, Thread } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface MessageRow {
  id: string;
  source: string;
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
  is_new: number;
  raw: string | null;
}

interface ThreadRow {
  id: string;
  external_conversation_id: string;
  source: string;
  entity_id: string | null;
  subject: string | null;
  last_message_at: string;
  last_analyzed_at: string | null;
  summary: string | null;
}

const rowToMessage = (row: MessageRow): Message => ({
  id: row.id,
  source: row.source as SourceKind,
  externalId: row.external_id,
  threadId: row.thread_id,
  contactId: row.contact_id,
  entityId: row.entity_id,
  fromEmail: row.from_email,
  fromName: row.from_name,
  toEmails: JSON.parse(row.to_emails) as string[],
  subject: row.subject,
  bodyPreview: row.body_preview,
  receivedAt: row.received_at,
  isFromUs: row.is_from_us === 1,
  isNew: row.is_new === 1,
  raw: row.raw ? JSON.parse(row.raw) : undefined,
});

const rowToThread = (row: ThreadRow): Thread => ({
  id: row.id,
  externalConversationId: row.external_conversation_id,
  source: row.source as SourceKind,
  entityId: row.entity_id,
  subject: row.subject,
  lastMessageAt: row.last_message_at,
  lastAnalyzedAt: row.last_analyzed_at,
  summary: row.summary,
});

export const getThreadLastAnalyzedAt = (threadId: string): string | null => {
  const db = getDb();
  const row = db
    .prepare("SELECT last_analyzed_at FROM threads WHERE id = ?")
    .get(threadId) as { last_analyzed_at: string | null } | undefined;
  return row?.last_analyzed_at ?? null;
};

export const setThreadLastAnalyzedAt = (
  threadId: string,
  iso: string,
): void => {
  const db = getDb();
  db.prepare("UPDATE threads SET last_analyzed_at = ? WHERE id = ?").run(
    iso,
    threadId,
  );
};

export const findMessageByExternalId = (
  source: SourceKind,
  externalId: string,
): Message | null => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM messages WHERE source = ? AND external_id = ?")
    .get(source, externalId) as MessageRow | undefined;
  return row ? rowToMessage(row) : null;
};

export interface UpsertThreadInput {
  source: SourceKind;
  externalConversationId: string;
  subject: string | null;
  lastMessageAt: string;
  entityId?: string | null;
}

export const upsertThread = (input: UpsertThreadInput): Thread => {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT * FROM threads WHERE source = ? AND external_conversation_id = ?",
    )
    .get(input.source, input.externalConversationId) as ThreadRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE threads
       SET subject = COALESCE(?, subject),
           last_message_at = MAX(last_message_at, ?),
           entity_id = COALESCE(?, entity_id)
       WHERE id = ?`,
    ).run(input.subject, input.lastMessageAt, input.entityId ?? null, existing.id);
    return rowToThread(
      db.prepare("SELECT * FROM threads WHERE id = ?").get(existing.id) as ThreadRow,
    );
  }
  const id = uuid();
  db.prepare(
    `INSERT INTO threads (id, external_conversation_id, source, entity_id, subject, last_message_at, summary)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    id,
    input.externalConversationId,
    input.source,
    input.entityId ?? null,
    input.subject,
    input.lastMessageAt,
  );
  return rowToThread(
    db.prepare("SELECT * FROM threads WHERE id = ?").get(id) as ThreadRow,
  );
};

export interface InsertMessageInput {
  source: SourceKind;
  externalId: string;
  threadId: string | null;
  contactId: string | null;
  entityId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  subject: string | null;
  bodyPreview: string;
  receivedAt: string;
  isFromUs: boolean;
  isNew?: boolean;
  raw?: unknown;
}

export const insertMessage = (input: InsertMessageInput): Message => {
  const existing = findMessageByExternalId(input.source, input.externalId);
  if (existing) return existing;
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO messages
     (id, source, external_id, thread_id, contact_id, entity_id, from_email, from_name, to_emails, subject, body_preview, received_at, is_from_us, is_new, raw)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.source,
    input.externalId,
    input.threadId,
    input.contactId,
    input.entityId,
    input.fromEmail,
    input.fromName,
    JSON.stringify(input.toEmails),
    input.subject,
    input.bodyPreview,
    input.receivedAt,
    input.isFromUs ? 1 : 0,
    input.isNew ? 1 : 0,
    input.raw ? JSON.stringify(input.raw) : null,
  );
  return findMessageByExternalId(input.source, input.externalId)!;
};

export const markEntityMessagesAsRead = (entityId: string): number => {
  const db = getDb();
  const res = db
    .prepare(`UPDATE messages SET is_new = 0 WHERE entity_id = ? AND is_new = 1`)
    .run(entityId);
  return res.changes;
};

export const markMessageReadState = (id: string, isNew: boolean): number => {
  const db = getDb();
  const res = db
    .prepare(`UPDATE messages SET is_new = ? WHERE id = ?`)
    .run(isNew ? 1 : 0, id);
  return res.changes;
};

export const markAllMessagesAsRead = (): number => {
  const db = getDb();
  const res = db.prepare(`UPDATE messages SET is_new = 0 WHERE is_new = 1`).run();
  return res.changes;
};

export const countNewMessagesPerEntity = (): Map<string, number> => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT entity_id, COUNT(*) AS cnt FROM messages
       WHERE is_new = 1 AND entity_id IS NOT NULL
       GROUP BY entity_id`,
    )
    .all() as Array<{ entity_id: string; cnt: number }>;
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.entity_id, r.cnt);
  return map;
};

export const updateMessageEntity = (id: string, entityId: string | null): void => {
  const db = getDb();
  db.prepare("UPDATE messages SET entity_id = ? WHERE id = ?").run(entityId, id);
};

export const updateMessageContact = (id: string, contactId: string | null): void => {
  const db = getDb();
  db.prepare("UPDATE messages SET contact_id = ? WHERE id = ?").run(contactId, id);
};

export const updateThreadEntity = (id: string, entityId: string | null): void => {
  const db = getDb();
  db.prepare("UPDATE threads SET entity_id = ? WHERE id = ?").run(entityId, id);
};

export const updateThreadSummary = (id: string, summary: string | null): void => {
  const db = getDb();
  db.prepare("UPDATE threads SET summary = ? WHERE id = ?").run(summary, id);
};

export const listThreadsForEntity = (entityId: string): Thread[] => {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM threads WHERE entity_id = ? ORDER BY last_message_at DESC")
      .all(entityId) as ThreadRow[]
  ).map(rowToThread);
};

export const listMessagesForThread = (threadId: string): Message[] => {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM messages WHERE thread_id = ? ORDER BY received_at ASC")
      .all(threadId) as MessageRow[]
  ).map(rowToMessage);
};

export const listMessagesByEmail = (email: string, limit = 50): Message[] => {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT * FROM messages WHERE LOWER(from_email) = LOWER(?) ORDER BY received_at DESC LIMIT ?",
      )
      .all(email, limit) as MessageRow[]
  ).map(rowToMessage);
};

export const backfillMessagesByEmail = (
  email: string,
  entityId: string,
  contactId: string,
): { messages: number; threads: number } => {
  const db = getDb();
  const msgRes = db
    .prepare(
      `UPDATE messages
       SET entity_id = ?, contact_id = ?
       WHERE LOWER(from_email) = LOWER(?)`,
    )
    .run(entityId, contactId, email);
  const threadRes = db
    .prepare(
      `UPDATE threads
       SET entity_id = ?
       WHERE entity_id IS NULL
         AND id IN (
           SELECT DISTINCT thread_id FROM messages
           WHERE LOWER(from_email) = LOWER(?) AND thread_id IS NOT NULL
         )`,
    )
    .run(entityId, email);
  return {
    messages: msgRes.changes,
    threads: threadRes.changes,
  };
};

export const backfillMessagesByDomain = (
  domain: string,
  entityId: string,
): { messages: number; threads: number } => {
  const db = getDb();
  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");
  const likePattern = `%@${cleanDomain}`;

  const msgRes = db
    .prepare(
      `UPDATE messages
       SET entity_id = ?
       WHERE entity_id IS NULL
         AND LOWER(from_email) LIKE ?`,
    )
    .run(entityId, likePattern);

  const threadRes = db
    .prepare(
      `UPDATE threads
       SET entity_id = ?
       WHERE entity_id IS NULL
         AND id IN (
           SELECT DISTINCT thread_id FROM messages
           WHERE LOWER(from_email) LIKE ? AND thread_id IS NOT NULL
         )`,
    )
    .run(entityId, likePattern);

  return {
    messages: msgRes.changes,
    threads: threadRes.changes,
  };
};

export interface SenderCandidate {
  email: string;
  displayName: string | null;
  messageCount: number;
  lastSeen: string;
}

export const findSendersByName = (query: string, limit = 20): SenderCandidate[] => {
  if (!query.trim()) return [];
  const db = getDb();
  const like = `%${query.trim()}%`;
  const rows = db
    .prepare(
      `SELECT
         from_email AS email,
         from_name AS display_name,
         COUNT(*) AS message_count,
         MAX(received_at) AS last_seen
       FROM messages
       WHERE (from_name LIKE ? COLLATE NOCASE OR from_email LIKE ? COLLATE NOCASE)
         AND from_email IS NOT NULL
         AND is_from_us = 0
       GROUP BY from_email
       ORDER BY message_count DESC, last_seen DESC
       LIMIT ?`,
    )
    .all(like, like, limit) as Array<{
    email: string;
    display_name: string | null;
    message_count: number;
    last_seen: string;
  }>;
  return rows.map((r) => ({
    email: r.email,
    displayName: r.display_name,
    messageCount: r.message_count,
    lastSeen: r.last_seen,
  }));
};

export const listRecentUnclassifiedMessages = (limit = 200): Message[] => {
  const db = getDb();
  return (
    db
      .prepare(
        "SELECT * FROM messages WHERE entity_id IS NULL AND is_from_us = 0 ORDER BY received_at DESC LIMIT ?",
      )
      .all(limit) as MessageRow[]
  ).map(rowToMessage);
};

