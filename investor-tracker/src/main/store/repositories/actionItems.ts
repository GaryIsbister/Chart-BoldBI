import type Database from "better-sqlite3";
import type {
  ActionItem,
  ActionItemOwner,
  ActionItemStatus,
} from "@shared/types";
import { nowIso, uuid } from "@shared/util";

type Row = {
  id: string;
  entity_id: string;
  thread_id: string | null;
  source_message_id: string | null;
  owner_side: ActionItemOwner;
  description: string;
  due_date: string | null;
  status: ActionItemStatus;
  resolved_at: string | null;
  resolved_by_message_id: string | null;
  created_at: string;
  updated_at: string;
};

const toActionItem = (r: Row): ActionItem => ({
  id: r.id,
  entityId: r.entity_id,
  threadId: r.thread_id,
  sourceMessageId: r.source_message_id,
  ownerSide: r.owner_side,
  description: r.description,
  dueDate: r.due_date,
  status: r.status,
  resolvedAt: r.resolved_at,
  resolvedByMessageId: r.resolved_by_message_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type ActionItemInput = {
  entityId: string;
  threadId: string | null;
  sourceMessageId: string | null;
  ownerSide: ActionItemOwner;
  description: string;
  dueDate: string | null;
};

export class ActionItemsRepo {
  constructor(private readonly db: Database.Database) {}

  get(id: string): ActionItem | null {
    const r = this.db
      .prepare("SELECT * FROM action_items WHERE id = ?")
      .get(id) as Row | undefined;
    return r ? toActionItem(r) : null;
  }

  listOpen(): ActionItem[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM action_items WHERE status IN ('open', 'in_progress') ORDER BY due_date IS NULL, due_date ASC, created_at DESC",
      )
      .all() as Row[];
    return rows.map(toActionItem);
  }

  listForEntity(entityId: string): ActionItem[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM action_items WHERE entity_id = ? ORDER BY status, due_date IS NULL, due_date",
      )
      .all(entityId) as Row[];
    return rows.map(toActionItem);
  }

  listOpenForThread(threadId: string): ActionItem[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM action_items WHERE thread_id = ? AND status IN ('open', 'in_progress')",
      )
      .all(threadId) as Row[];
    return rows.map(toActionItem);
  }

  countOpen(): number {
    const r = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM action_items WHERE status IN ('open', 'in_progress')",
      )
      .get() as { c: number };
    return r.c;
  }

  insert(input: ActionItemInput): ActionItem {
    const id = uuid();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO action_items(
          id, entity_id, thread_id, source_message_id, owner_side,
          description, due_date, status, resolved_at, resolved_by_message_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        input.entityId,
        input.threadId,
        input.sourceMessageId,
        input.ownerSide,
        input.description,
        input.dueDate,
        now,
        now,
      );
    return this.get(id)!;
  }

  setStatus(
    id: string,
    status: ActionItemStatus,
    resolvedByMessageId: string | null = null,
  ): ActionItem {
    const now = nowIso();
    const resolvedAt = status === "done" || status === "cancelled" ? now : null;
    this.db
      .prepare(
        "UPDATE action_items SET status = ?, resolved_at = ?, resolved_by_message_id = ?, updated_at = ? WHERE id = ?",
      )
      .run(status, resolvedAt, resolvedByMessageId, now, id);
    return this.get(id)!;
  }
}
