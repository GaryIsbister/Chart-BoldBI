import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import type {
  Contact,
  Entity,
  Message,
  SyncCursor,
  Thread,
} from "../../shared/types.js";

const now = (): string => new Date().toISOString();

type EntityRow = {
  id: string;
  name: string;
  domains_json: string;
  classification: string;
  classification_reason: string | null;
  classified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToEntity(r: EntityRow): Entity {
  return {
    id: r.id,
    name: r.name,
    domains: JSON.parse(r.domains_json) as string[],
    classification: r.classification as Entity["classification"],
    classificationReason: r.classification_reason,
    classifiedAt: r.classified_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const entityRepo = {
  list(classification?: string): Entity[] {
    const db = getDb();
    const rows = classification
      ? (db
          .prepare("SELECT * FROM entities WHERE classification = ? ORDER BY name")
          .all(classification) as EntityRow[])
      : (db
          .prepare("SELECT * FROM entities ORDER BY name")
          .all() as EntityRow[]);
    return rows.map(rowToEntity);
  },
  get(id: string): Entity | null {
    const row = getDb()
      .prepare("SELECT * FROM entities WHERE id = ?")
      .get(id) as EntityRow | undefined;
    return row ? rowToEntity(row) : null;
  },
  findByDomain(domain: string): Entity | null {
    const rows = getDb()
      .prepare("SELECT * FROM entities")
      .all() as EntityRow[];
    for (const r of rows) {
      const domains = JSON.parse(r.domains_json) as string[];
      if (domains.includes(domain.toLowerCase())) return rowToEntity(r);
    }
    return null;
  },
  upsert(input: {
    id?: string;
    name: string;
    domains?: string[];
    classification?: Entity["classification"];
    classificationReason?: string | null;
    notes?: string | null;
  }): Entity {
    const db = getDb();
    const id = input.id ?? randomUUID();
    const ts = now();
    const existing = input.id ? this.get(input.id) : null;
    if (existing) {
      const merged: Entity = {
        ...existing,
        name: input.name,
        domains: input.domains ?? existing.domains,
        classification: input.classification ?? existing.classification,
        classificationReason:
          input.classificationReason ?? existing.classificationReason,
        notes: input.notes ?? existing.notes,
        updatedAt: ts,
      };
      db.prepare(
        `UPDATE entities SET name=?, domains_json=?, classification=?,
         classification_reason=?, notes=?, updated_at=? WHERE id=?`,
      ).run(
        merged.name,
        JSON.stringify(merged.domains),
        merged.classification,
        merged.classificationReason,
        merged.notes,
        merged.updatedAt,
        id,
      );
      return merged;
    }
    const e: Entity = {
      id,
      name: input.name,
      domains: input.domains ?? [],
      classification: input.classification ?? "uncertain",
      classificationReason: input.classificationReason ?? null,
      classifiedAt: null,
      notes: input.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    db.prepare(
      `INSERT INTO entities (id, name, domains_json, classification,
       classification_reason, classified_at, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      e.id,
      e.name,
      JSON.stringify(e.domains),
      e.classification,
      e.classificationReason,
      e.classifiedAt,
      e.notes,
      e.createdAt,
      e.updatedAt,
    );
    return e;
  },
  setClassification(
    id: string,
    classification: string,
    reason: string | null,
  ): Entity {
    const ts = now();
    getDb()
      .prepare(
        `UPDATE entities SET classification=?, classification_reason=?,
         classified_at=?, updated_at=? WHERE id=?`,
      )
      .run(classification, reason, ts, ts, id);
    const updated = this.get(id);
    if (!updated) throw new Error(`entity ${id} not found`);
    return updated;
  },
};

type ContactRow = {
  id: string;
  entity_id: string | null;
  display_name: string;
  email: string | null;
  teams_user_id: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

function rowToContact(r: ContactRow): Contact {
  return {
    id: r.id,
    entityId: r.entity_id,
    displayName: r.display_name,
    email: r.email,
    teamsUserId: r.teams_user_id,
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
  };
}

export const contactRepo = {
  list(entityId?: string): Contact[] {
    const db = getDb();
    const rows = entityId
      ? (db
          .prepare(
            "SELECT * FROM contacts WHERE entity_id = ? ORDER BY display_name",
          )
          .all(entityId) as ContactRow[])
      : (db
          .prepare("SELECT * FROM contacts ORDER BY display_name")
          .all() as ContactRow[]);
    return rows.map(rowToContact);
  },
  findByEmail(email: string): Contact | null {
    const row = getDb()
      .prepare("SELECT * FROM contacts WHERE email = ?")
      .get(email.toLowerCase()) as ContactRow | undefined;
    return row ? rowToContact(row) : null;
  },
  findByTeamsId(teamsUserId: string): Contact | null {
    const row = getDb()
      .prepare("SELECT * FROM contacts WHERE teams_user_id = ?")
      .get(teamsUserId) as ContactRow | undefined;
    return row ? rowToContact(row) : null;
  },
  upsertByEmail(input: {
    email: string;
    displayName: string;
    seenAt: string;
  }): Contact {
    const db = getDb();
    const email = input.email.toLowerCase();
    const existing = this.findByEmail(email);
    if (existing) {
      db.prepare(
        "UPDATE contacts SET display_name=?, last_seen_at=? WHERE id=?",
      ).run(input.displayName, input.seenAt, existing.id);
      return { ...existing, displayName: input.displayName, lastSeenAt: input.seenAt };
    }
    const c: Contact = {
      id: randomUUID(),
      entityId: null,
      displayName: input.displayName,
      email,
      teamsUserId: null,
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
    };
    db.prepare(
      `INSERT INTO contacts (id, entity_id, display_name, email, teams_user_id,
       first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(c.id, c.entityId, c.displayName, c.email, c.teamsUserId, c.firstSeenAt, c.lastSeenAt);
    return c;
  },
  upsertByTeamsId(input: {
    teamsUserId: string;
    displayName: string;
    email: string | null;
    seenAt: string;
  }): Contact {
    const db = getDb();
    const existing = this.findByTeamsId(input.teamsUserId);
    if (existing) {
      db.prepare(
        "UPDATE contacts SET display_name=?, last_seen_at=? WHERE id=?",
      ).run(input.displayName, input.seenAt, existing.id);
      return { ...existing, displayName: input.displayName, lastSeenAt: input.seenAt };
    }
    const c: Contact = {
      id: randomUUID(),
      entityId: null,
      displayName: input.displayName,
      email: input.email?.toLowerCase() ?? null,
      teamsUserId: input.teamsUserId,
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
    };
    db.prepare(
      `INSERT INTO contacts (id, entity_id, display_name, email, teams_user_id,
       first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(c.id, c.entityId, c.displayName, c.email, c.teamsUserId, c.firstSeenAt, c.lastSeenAt);
    return c;
  },
  assignToEntity(contactId: string, entityId: string | null): Contact {
    getDb()
      .prepare("UPDATE contacts SET entity_id = ? WHERE id = ?")
      .run(entityId, contactId);
    const row = getDb()
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(contactId) as ContactRow | undefined;
    if (!row) throw new Error(`contact ${contactId} not found`);
    return rowToContact(row);
  },
  unclassified(limit = 200): Contact[] {
    const rows = getDb()
      .prepare(
        `SELECT c.* FROM contacts c
         LEFT JOIN entities e ON e.id = c.entity_id
         WHERE c.entity_id IS NULL OR e.classification = 'uncertain'
         ORDER BY c.last_seen_at DESC LIMIT ?`,
      )
      .all(limit) as ContactRow[];
    return rows.map(rowToContact);
  },
};

type ThreadRow = {
  id: string;
  source: string;
  external_id: string;
  subject: string | null;
  entity_id: string | null;
  last_message_at: string;
  unread_count: number;
};

function rowToThread(r: ThreadRow): Thread {
  return {
    id: r.id,
    source: r.source as Thread["source"],
    externalId: r.external_id,
    subject: r.subject,
    entityId: r.entity_id,
    lastMessageAt: r.last_message_at,
    unreadCount: r.unread_count,
  };
}

export const threadRepo = {
  list(entityId?: string): Thread[] {
    const db = getDb();
    const rows = entityId
      ? (db
          .prepare(
            "SELECT * FROM threads WHERE entity_id = ? ORDER BY last_message_at DESC",
          )
          .all(entityId) as ThreadRow[])
      : (db
          .prepare("SELECT * FROM threads ORDER BY last_message_at DESC LIMIT 500")
          .all() as ThreadRow[]);
    return rows.map(rowToThread);
  },
  upsert(input: {
    source: Thread["source"];
    externalId: string;
    subject: string | null;
    entityId: string | null;
    lastMessageAt: string;
  }): Thread {
    const db = getDb();
    const existing = db
      .prepare(
        "SELECT * FROM threads WHERE source = ? AND external_id = ?",
      )
      .get(input.source, input.externalId) as ThreadRow | undefined;
    if (existing) {
      db.prepare(
        `UPDATE threads SET subject=?, entity_id=COALESCE(?, entity_id),
         last_message_at=? WHERE id=?`,
      ).run(input.subject, input.entityId, input.lastMessageAt, existing.id);
      return rowToThread({
        ...existing,
        subject: input.subject,
        entity_id: input.entityId ?? existing.entity_id,
        last_message_at: input.lastMessageAt,
      });
    }
    const t: Thread = {
      id: randomUUID(),
      source: input.source,
      externalId: input.externalId,
      subject: input.subject,
      entityId: input.entityId,
      lastMessageAt: input.lastMessageAt,
      unreadCount: 0,
    };
    db.prepare(
      `INSERT INTO threads (id, source, external_id, subject, entity_id,
       last_message_at, unread_count) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    ).run(t.id, t.source, t.externalId, t.subject, t.entityId, t.lastMessageAt);
    return t;
  },
};

type MessageRow = {
  id: string;
  thread_id: string;
  source: string;
  external_id: string;
  from_contact_id: string | null;
  from_address: string | null;
  body: string;
  body_preview: string;
  received_at: string;
  is_outbound: number;
};

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    threadId: r.thread_id,
    source: r.source as Message["source"],
    externalId: r.external_id,
    fromContactId: r.from_contact_id,
    fromAddress: r.from_address,
    body: r.body,
    bodyPreview: r.body_preview,
    receivedAt: r.received_at,
    isOutbound: r.is_outbound === 1,
  };
}

export const messageRepo = {
  byThread(threadId: string): Message[] {
    const rows = getDb()
      .prepare(
        "SELECT * FROM messages WHERE thread_id = ? ORDER BY received_at ASC",
      )
      .all(threadId) as MessageRow[];
    return rows.map(rowToMessage);
  },
  upsert(input: {
    threadId: string;
    source: Message["source"];
    externalId: string;
    fromContactId: string | null;
    fromAddress: string | null;
    body: string;
    bodyPreview: string;
    receivedAt: string;
    isOutbound: boolean;
  }): Message {
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM messages WHERE source = ? AND external_id = ?")
      .get(input.source, input.externalId) as MessageRow | undefined;
    if (existing) return rowToMessage(existing);
    const m: Message = {
      id: randomUUID(),
      threadId: input.threadId,
      source: input.source,
      externalId: input.externalId,
      fromContactId: input.fromContactId,
      fromAddress: input.fromAddress,
      body: input.body,
      bodyPreview: input.bodyPreview,
      receivedAt: input.receivedAt,
      isOutbound: input.isOutbound,
    };
    db.prepare(
      `INSERT INTO messages (id, thread_id, source, external_id, from_contact_id,
       from_address, body, body_preview, received_at, is_outbound)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      m.id,
      m.threadId,
      m.source,
      m.externalId,
      m.fromContactId,
      m.fromAddress,
      m.body,
      m.bodyPreview,
      m.receivedAt,
      m.isOutbound ? 1 : 0,
    );
    return m;
  },
};

export const cursorRepo = {
  get(source: SyncCursor["source"], scope: string): SyncCursor | null {
    const row = getDb()
      .prepare(
        "SELECT source, scope, delta_link, last_synced_at FROM sync_cursors WHERE source = ? AND scope = ?",
      )
      .get(source, scope) as
      | { source: string; scope: string; delta_link: string | null; last_synced_at: string | null }
      | undefined;
    if (!row) return null;
    return {
      source: row.source as SyncCursor["source"],
      scope: row.scope,
      deltaLink: row.delta_link,
      lastSyncedAt: row.last_synced_at,
    };
  },
  set(c: SyncCursor): void {
    getDb()
      .prepare(
        `INSERT INTO sync_cursors (source, scope, delta_link, last_synced_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source, scope) DO UPDATE SET
           delta_link = excluded.delta_link,
           last_synced_at = excluded.last_synced_at`,
      )
      .run(c.source, c.scope, c.deltaLink, c.lastSyncedAt);
  },
};
