import type Database from "better-sqlite3";
import type { ActionItem, ActionItemOwner, ActionItemStatus } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface ActionItemRow {
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
}

const rowTo = (r: ActionItemRow): ActionItem => ({
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

export class ActionItemsRepo {
  constructor(private readonly db: Database.Database) {}

  list(filter: { entityId?: string; ownerSide?: ActionItemOwner; status?: ActionItemStatus } = {}): ActionItem[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.entityId) {
      clauses.push("entity_id = ?");
      params.push(filter.entityId);
    }
    if (filter.ownerSide) {
      clauses.push("owner_side = ?");
      params.push(filter.ownerSide);
    }
    if (filter.status) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM action_items ${where} ORDER BY created_at DESC`)
      .all(...params) as ActionItemRow[];
    return rows.map(rowTo);
  }

  upsert(input: Omit<ActionItem, "id" | "createdAt" | "updatedAt"> & { id?: string }): ActionItem {
    const id = input.id ?? uuid();
    const now = nowIso();
    const existing = this.db.prepare("SELECT * FROM action_items WHERE id = ?").get(id) as
      | ActionItemRow
      | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE action_items
           SET description = ?, due_date = ?, status = ?, resolved_at = ?, resolved_by_message_id = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          input.description,
          input.dueDate,
          input.status,
          input.resolvedAt,
          input.resolvedByMessageId,
          now,
          id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO action_items (id, entity_id, thread_id, source_message_id, owner_side, description, due_date, status, resolved_at, resolved_by_message_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.entityId,
          input.threadId,
          input.sourceMessageId,
          input.ownerSide,
          input.description,
          input.dueDate,
          input.status,
          input.resolvedAt,
          input.resolvedByMessageId,
          now,
          now,
        );
    }
    return rowTo(this.db.prepare("SELECT * FROM action_items WHERE id = ?").get(id) as ActionItemRow);
  }

  setStatus(id: string, status: ActionItemStatus, resolvedByMessageId?: string): ActionItem {
    const now = nowIso();
    const resolvedAt = status === "done" || status === "cancelled" ? now : null;
    this.db
      .prepare(
        "UPDATE action_items SET status = ?, resolved_at = ?, resolved_by_message_id = ?, updated_at = ? WHERE id = ?",
      )
      .run(status, resolvedAt, resolvedByMessageId ?? null, now, id);
    return rowTo(this.db.prepare("SELECT * FROM action_items WHERE id = ?").get(id) as ActionItemRow);
  }
}
