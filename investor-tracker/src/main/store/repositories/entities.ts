import type Database from "better-sqlite3";
import type { Entity, PipelineStage, StageHistoryEntry } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

type Row = {
  id: string;
  name: string;
  domain: string | null;
  pipeline_stage: PipelineStage;
  parked_until: string | null;
  stage_manual_override: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const toEntity = (r: Row): Entity => ({
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

  list(): Entity[] {
    const rows = this.db
      .prepare("SELECT * FROM entities ORDER BY updated_at DESC")
      .all() as Row[];
    return rows.map(toEntity);
  }

  get(id: string): Entity | null {
    const r = this.db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as
      | Row
      | undefined;
    return r ? toEntity(r) : null;
  }

  findByDomain(domain: string): Entity | null {
    const r = this.db
      .prepare("SELECT * FROM entities WHERE domain = ? LIMIT 1")
      .get(domain.toLowerCase()) as Row | undefined;
    return r ? toEntity(r) : null;
  }

  findByName(name: string): Entity | null {
    const r = this.db
      .prepare("SELECT * FROM entities WHERE LOWER(name) = LOWER(?) LIMIT 1")
      .get(name) as Row | undefined;
    return r ? toEntity(r) : null;
  }

  create(input: {
    name: string;
    domain: string | null;
    notes?: string | null;
  }): Entity {
    const now = nowIso();
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO entities(id, name, domain, pipeline_stage, parked_until, stage_manual_override, notes, created_at, updated_at)
         VALUES (?, ?, ?, 'new', NULL, 0, ?, ?, ?)`,
      )
      .run(id, input.name, input.domain, input.notes ?? null, now, now);
    return this.get(id)!;
  }

  setStage(
    id: string,
    toStage: PipelineStage,
    changedBy: "user" | "claude",
    reason: string | null,
  ): Entity {
    const current = this.get(id);
    if (!current) throw new Error(`entity ${id} not found`);
    if (current.pipelineStage === toStage) return current;
    const now = nowIso();
    const manualOverride =
      changedBy === "user" ? 1 : current.stageManualOverride ? 1 : 0;
    this.db
      .prepare(
        "UPDATE entities SET pipeline_stage = ?, stage_manual_override = ?, updated_at = ? WHERE id = ?",
      )
      .run(toStage, manualOverride, now, id);
    this.db
      .prepare(
        `INSERT INTO stage_history(id, entity_id, from_stage, to_stage, changed_by, reason, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(uuid(), id, current.pipelineStage, toStage, changedBy, reason, now);
    return this.get(id)!;
  }

  setNotes(id: string, notes: string | null): Entity {
    this.db
      .prepare("UPDATE entities SET notes = ?, updated_at = ? WHERE id = ?")
      .run(notes, nowIso(), id);
    return this.get(id)!;
  }

  park(id: string, until: string | null): Entity {
    const stage: PipelineStage = until ? "parked" : "new";
    const current = this.get(id);
    if (!current) throw new Error(`entity ${id} not found`);
    this.db
      .prepare(
        "UPDATE entities SET parked_until = ?, pipeline_stage = ?, updated_at = ? WHERE id = ?",
      )
      .run(until, stage, nowIso(), id);
    if (current.pipelineStage !== stage) {
      this.db
        .prepare(
          `INSERT INTO stage_history(id, entity_id, from_stage, to_stage, changed_by, reason, changed_at)
           VALUES (?, ?, ?, ?, 'user', ?, ?)`,
        )
        .run(uuid(), id, current.pipelineStage, stage, until ? `parked until ${until}` : "unparked", nowIso());
    }
    return this.get(id)!;
  }

  history(entityId: string): StageHistoryEntry[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM stage_history WHERE entity_id = ? ORDER BY changed_at DESC",
      )
      .all(entityId) as {
      id: string;
      entity_id: string;
      from_stage: PipelineStage | null;
      to_stage: PipelineStage;
      changed_by: "user" | "claude";
      reason: string | null;
      changed_at: string;
    }[];
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
