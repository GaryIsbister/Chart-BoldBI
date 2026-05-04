import type Database from "better-sqlite3";
import { getDb } from "../db";
import type {
  Entity,
  EntityCategory,
  PipelineStage,
  StageHistoryEntry,
} from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface EntityRow {
  id: string;
  name: string;
  domain: string | null;
  use_domain_matching: number;
  category: string;
  pipeline_stage: string;
  parked_until: string | null;
  stage_manual_override: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const rowToEntity = (row: EntityRow): Entity => ({
  id: row.id,
  name: row.name,
  domain: row.domain,
  useDomainMatching: row.use_domain_matching === 1,
  category: (row.category as EntityCategory) ?? "investor",
  pipelineStage: row.pipeline_stage as PipelineStage,
  parkedUntil: row.parked_until,
  stageManualOverride: row.stage_manual_override === 1,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listEntities = (): Entity[] => {
  const db = getDb();
  return (db.prepare("SELECT * FROM entities ORDER BY updated_at DESC").all() as EntityRow[]).map(
    rowToEntity,
  );
};

export const getEntity = (id: string): Entity | null => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as EntityRow | undefined;
  return row ? rowToEntity(row) : null;
};

export const findEntityByDomain = (domain: string): Entity | null => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM entities WHERE domain = ? AND use_domain_matching = 1",
    )
    .get(domain) as EntityRow | undefined;
  return row ? rowToEntity(row) : null;
};

export const findEntityByName = (name: string): Entity | null => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM entities WHERE LOWER(name) = LOWER(?)")
    .get(name) as EntityRow | undefined;
  return row ? rowToEntity(row) : null;
};

export interface CreateEntityInput {
  name: string;
  domain: string | null;
  pipelineStage?: PipelineStage;
  category?: EntityCategory;
  notes?: string | null;
  useDomainMatching?: boolean;
}

export const createEntity = (input: CreateEntityInput): Entity => {
  const db = getDb();
  const now = nowIso();
  const id = uuid();
  const stage: PipelineStage = input.pipelineStage ?? "new";
  const category: EntityCategory = input.category ?? "investor";
  const useDomainMatching = input.useDomainMatching ?? Boolean(input.domain);
  db.prepare(
    `INSERT INTO entities
     (id, name, domain, use_domain_matching, category, pipeline_stage, parked_until, stage_manual_override, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.domain,
    useDomainMatching ? 1 : 0,
    category,
    stage,
    input.notes ?? null,
    now,
    now,
  );
  recordStageChange(db, {
    entityId: id,
    fromStage: null,
    toStage: stage,
    changedBy: "claude",
    reason: "entity created",
  });
  return getEntity(id)!;
};

export const updateEntityCategory = (
  id: string,
  category: EntityCategory,
): Entity | null => {
  const db = getDb();
  db.prepare(
    "UPDATE entities SET category = ?, updated_at = ? WHERE id = ?",
  ).run(category, nowIso(), id);
  return getEntity(id);
};

export const updateEntityUseDomainMatching = (
  id: string,
  useDomainMatching: boolean,
): Entity | null => {
  const db = getDb();
  db.prepare(
    "UPDATE entities SET use_domain_matching = ?, updated_at = ? WHERE id = ?",
  ).run(useDomainMatching ? 1 : 0, nowIso(), id);
  return getEntity(id);
};

export interface UpdateEntityStageInput {
  id: string;
  stage: PipelineStage;
  changedBy: "user" | "claude";
  reason?: string | null;
}

export const updateEntityStage = (input: UpdateEntityStageInput): Entity | null => {
  const db = getDb();
  const existing = getEntity(input.id);
  if (!existing) return null;
  const manualFlag = input.changedBy === "user" ? 1 : existing.stageManualOverride ? 1 : 0;
  db.prepare(
    `UPDATE entities
     SET pipeline_stage = ?, stage_manual_override = ?, updated_at = ?
     WHERE id = ?`,
  ).run(input.stage, manualFlag, nowIso(), input.id);
  recordStageChange(db, {
    entityId: input.id,
    fromStage: existing.pipelineStage,
    toStage: input.stage,
    changedBy: input.changedBy,
    reason: input.reason ?? null,
  });
  return getEntity(input.id);
};

export const updateEntityNotes = (id: string, notes: string): Entity | null => {
  const db = getDb();
  db.prepare("UPDATE entities SET notes = ?, updated_at = ? WHERE id = ?").run(
    notes,
    nowIso(),
    id,
  );
  return getEntity(id);
};

interface StageChangeInput {
  entityId: string;
  fromStage: PipelineStage | null;
  toStage: PipelineStage;
  changedBy: "user" | "claude";
  reason: string | null;
}

const recordStageChange = (db: Database.Database, input: StageChangeInput): void => {
  db.prepare(
    `INSERT INTO stage_history (id, entity_id, from_stage, to_stage, changed_by, reason, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(uuid(), input.entityId, input.fromStage, input.toStage, input.changedBy, input.reason, nowIso());
};

export const listStageHistory = (entityId: string): StageHistoryEntry[] => {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM stage_history WHERE entity_id = ? ORDER BY changed_at DESC")
    .all(entityId) as Array<{
    id: string;
    entity_id: string;
    from_stage: string | null;
    to_stage: string;
    changed_by: string;
    reason: string | null;
    changed_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    fromStage: (row.from_stage as PipelineStage | null) ?? null,
    toStage: row.to_stage as PipelineStage,
    changedBy: row.changed_by as "user" | "claude",
    reason: row.reason,
    changedAt: row.changed_at,
  }));
};
