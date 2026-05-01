import type Database from "better-sqlite3";
import type { Entity, PipelineStage, StageHistoryEntry } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface EntityRow {
  id: string;
  name: string;
  domain: string | null;
  pipeline_stage: PipelineStage;
  parked_until: string | null;
  stage_manual_override: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const rowToEntity = (r: EntityRow): Entity => ({
  id: r.id,
  name: r.name,
  domain: r.domain,
  pipelineStage: r.pipeline_stage,
  parkedUntil: r.parked_until,
  stageManualOverride: r.stage_manual_override === 1,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class EntitiesRepo {
  constructor(private readonly db: Database.Database) {}

  list(stage?: PipelineStage): Entity[] {
    const rows = stage
      ? this.db
          .prepare("SELECT * FROM entities WHERE pipeline_stage = ? ORDER BY updated_at DESC")
          .all(stage)
      : this.db.prepare("SELECT * FROM entities ORDER BY updated_at DESC").all();
    return (rows as EntityRow[]).map(rowToEntity);
  }

  get(id: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as
      | EntityRow
      | undefined;
    return row ? rowToEntity(row) : null;
  }

  findByDomain(domain: string): Entity | null {
    const row = this.db.prepare("SELECT * FROM entities WHERE domain = ?").get(domain) as
      | EntityRow
      | undefined;
    return row ? rowToEntity(row) : null;
  }

  create(input: Pick<Entity, "name"> & Partial<Entity>): Entity {
    const id = input.id ?? uuid();
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO entities (id, name, domain, pipeline_stage, parked_until, stage_manual_override, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.domain ?? null,
        input.pipelineStage ?? "new",
        input.parkedUntil ?? null,
        input.stageManualOverride ? 1 : 0,
        input.notes ?? null,
        now,
        now,
      );
    return this.get(id)!;
  }

  setStage(
    id: string,
    stage: PipelineStage,
    opts: { changedBy: "user" | "claude"; reason?: string; parkedUntil?: string | null },
  ): Entity {
    const current = this.get(id);
    if (!current) throw new Error(`entity ${id} not found`);
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE entities
           SET pipeline_stage = ?, parked_until = ?, stage_manual_override = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          stage,
          opts.parkedUntil ?? null,
          opts.changedBy === "user" ? 1 : current.stageManualOverride ? 1 : 0,
          nowIso(),
          id,
        );
      this.db
        .prepare(
          `INSERT INTO stage_history (id, entity_id, from_stage, to_stage, changed_by, reason, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(uuid(), id, current.pipelineStage, stage, opts.changedBy, opts.reason ?? null, nowIso());
    });
    tx();
    return this.get(id)!;
  }

  stageHistory(id: string): StageHistoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM stage_history WHERE entity_id = ? ORDER BY changed_at DESC")
      .all(id) as Array<{
      id: string;
      entity_id: string;
      from_stage: PipelineStage | null;
      to_stage: PipelineStage;
      changed_by: "user" | "claude";
      reason: string | null;
      changed_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      fromStage: r.from_stage,
      toStage: r.to_stage,
      changedBy: r.changed_by,
      reason: r.reason,
      changedAt: r.changed_at,
    }));
  }
}
