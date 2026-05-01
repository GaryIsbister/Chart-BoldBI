import { getDb } from "../db";
import type {
  ActionItem,
  ActionItemOwner,
  ActionItemStatus,
} from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface ActionItemRow {
  id: string;
  entity_id: string;
  thread_id: string | null;
  source_message_id: string | null;
  owner_side: string;
  description: string;
  due_date: string | null;
  status: string;
  resolved_at: string | null;
  resolved_by_message_id: string | null;
  created_at: string;
  updated_at: string;
  source_date: string | null;
}

const rowToActionItem = (row: ActionItemRow): ActionItem => ({
  id: row.id,
  entityId: row.entity_id,
  threadId: row.thread_id,
  sourceMessageId: row.source_message_id,
  ownerSide: row.owner_side as ActionItemOwner,
  description: row.description,
  dueDate: row.due_date,
  status: row.status as ActionItemStatus,
  resolvedAt: row.resolved_at,
  resolvedByMessageId: row.resolved_by_message_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sourceDate: row.source_date,
});

const SELECT_WITH_SOURCE = `
  SELECT a.*,
    COALESCE(m.received_at, t.last_message_at) AS source_date
  FROM action_items a
  LEFT JOIN messages m ON a.source_message_id = m.id
  LEFT JOIN threads t ON a.thread_id = t.id
`;

export interface CreateActionItemInput {
  entityId: string;
  threadId: string | null;
  sourceMessageId: string | null;
  ownerSide: ActionItemOwner;
  description: string;
  dueDate?: string | null;
}

export const createActionItem = (input: CreateActionItemInput): ActionItem => {
  const db = getDb();
  const id = uuid();
  const now = nowIso();
  db.prepare(
    `INSERT INTO action_items
     (id, entity_id, thread_id, source_message_id, owner_side, description, due_date, status, resolved_at, resolved_by_message_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, ?)`,
  ).run(
    id,
    input.entityId,
    input.threadId,
    input.sourceMessageId,
    input.ownerSide,
    input.description,
    input.dueDate ?? null,
    now,
    now,
  );
  return getActionItem(id)!;
};

export const getActionItem = (id: string): ActionItem | null => {
  const db = getDb();
  const row = db
    .prepare(`${SELECT_WITH_SOURCE} WHERE a.id = ?`)
    .get(id) as ActionItemRow | undefined;
  return row ? rowToActionItem(row) : null;
};

export const listActionItems = (filter?: {
  entityId?: string;
  status?: ActionItemStatus;
}): ActionItem[] => {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.entityId) {
    clauses.push("a.entity_id = ?");
    params.push(filter.entityId);
  }
  if (filter?.status) {
    clauses.push("a.status = ?");
    params.push(filter.status);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `${SELECT_WITH_SOURCE} ${where} ORDER BY a.created_at DESC`;
  return (db.prepare(sql).all(...params) as ActionItemRow[]).map(rowToActionItem);
};

export const updateActionItemStatus = (
  id: string,
  status: ActionItemStatus,
  resolvedByMessageId: string | null = null,
): ActionItem | null => {
  const db = getDb();
  const resolvedAt = status === "done" || status === "cancelled" ? nowIso() : null;
  db.prepare(
    `UPDATE action_items
     SET status = ?, resolved_at = ?, resolved_by_message_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(status, resolvedAt, resolvedByMessageId, nowIso(), id);
  return getActionItem(id);
};

export const listOpenActionItemsForEntity = (entityId: string): ActionItem[] =>
  listActionItems({ entityId, status: "open" });
