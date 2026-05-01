import type Database from "better-sqlite3";
import type { PendingReview, PendingReviewDecision } from "@shared/types";
import { nowIso, uuid } from "@shared/util";

interface PendingReviewRow {
  id: string;
  email: string;
  display_name: string | null;
  domain: string | null;
  proposed_entity_name: string;
  proposed_entity_id: string | null;
  confidence: number;
  reasoning: string;
  matched_demand_book_entry: string | null;
  evidence_message_ids: string;
  created_at: string;
  decision: PendingReviewDecision | null;
  decided_at: string | null;
}

const rowTo = (r: PendingReviewRow): PendingReview => ({
  id: r.id,
  email: r.email,
  displayName: r.display_name,
  domain: r.domain,
  proposedEntityName: r.proposed_entity_name,
  proposedEntityId: r.proposed_entity_id,
  confidence: r.confidence,
  reasoning: r.reasoning,
  matchedDemandBookEntry: r.matched_demand_book_entry,
  evidenceMessageIds: JSON.parse(r.evidence_message_ids),
  createdAt: r.created_at,
  decision: r.decision,
  decidedAt: r.decided_at,
});

export class PendingReviewsRepo {
  constructor(private readonly db: Database.Database) {}

  listOpen(): PendingReview[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM pending_reviews WHERE decision IS NULL OR decision = 'snooze' ORDER BY confidence DESC, created_at DESC",
      )
      .all() as PendingReviewRow[];
    return rows.map(rowTo);
  }

  get(id: string): PendingReview | null {
    const row = this.db.prepare("SELECT * FROM pending_reviews WHERE id = ?").get(id) as
      | PendingReviewRow
      | undefined;
    return row ? rowTo(row) : null;
  }

  create(input: Omit<PendingReview, "id" | "createdAt" | "decision" | "decidedAt">): PendingReview {
    const id = uuid();
    this.db
      .prepare(
        `INSERT INTO pending_reviews (id, email, display_name, domain, proposed_entity_name, proposed_entity_id, confidence, reasoning, matched_demand_book_entry, evidence_message_ids, created_at, decision, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .run(
        id,
        input.email.toLowerCase(),
        input.displayName,
        input.domain,
        input.proposedEntityName,
        input.proposedEntityId,
        input.confidence,
        input.reasoning,
        input.matchedDemandBookEntry,
        JSON.stringify(input.evidenceMessageIds),
        nowIso(),
      );
    return this.get(id)!;
  }

  decide(id: string, decision: PendingReviewDecision): PendingReview {
    this.db
      .prepare("UPDATE pending_reviews SET decision = ?, decided_at = ? WHERE id = ?")
      .run(decision, nowIso(), id);
    return this.get(id)!;
  }

  isQueuedOrIgnored(email: string): boolean {
    const norm = email.toLowerCase();
    const ignored = this.db
      .prepare("SELECT 1 FROM ignored_senders WHERE email = ?")
      .get(norm);
    if (ignored) return true;
    const queued = this.db
      .prepare(
        "SELECT 1 FROM pending_reviews WHERE email = ? AND (decision IS NULL OR decision = 'snooze')",
      )
      .get(norm);
    return !!queued;
  }

  ignore(email: string, reason: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO ignored_senders (email, domain, reason, ignored_at) VALUES (?, ?, ?, ?)",
      )
      .run(email.toLowerCase(), email.split("@")[1]?.toLowerCase() ?? null, reason, nowIso());
  }
}
