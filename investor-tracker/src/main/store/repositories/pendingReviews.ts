import { getDb } from "../db";
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
  decision: string | null;
  decided_at: string | null;
}

const rowToPendingReview = (row: PendingReviewRow): PendingReview => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  domain: row.domain,
  proposedEntityName: row.proposed_entity_name,
  proposedEntityId: row.proposed_entity_id,
  confidence: row.confidence,
  reasoning: row.reasoning,
  matchedDemandBookEntry: row.matched_demand_book_entry,
  evidenceMessageIds: JSON.parse(row.evidence_message_ids) as string[],
  createdAt: row.created_at,
  decision: (row.decision as PendingReviewDecision | null) ?? null,
  decidedAt: row.decided_at,
});

export interface CreatePendingReviewInput {
  email: string;
  displayName: string | null;
  domain: string | null;
  proposedEntityName: string;
  proposedEntityId: string | null;
  confidence: number;
  reasoning: string;
  matchedDemandBookEntry: string | null;
  evidenceMessageIds: string[];
}

export const createPendingReview = (input: CreatePendingReviewInput): PendingReview => {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO pending_reviews
     (id, email, display_name, domain, proposed_entity_name, proposed_entity_id, confidence, reasoning, matched_demand_book_entry, evidence_message_ids, created_at, decision, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
  ).run(
    id,
    input.email,
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
  return getPendingReview(id)!;
};

export const getPendingReview = (id: string): PendingReview | null => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM pending_reviews WHERE id = ?").get(id) as
    | PendingReviewRow
    | undefined;
  return row ? rowToPendingReview(row) : null;
};

export const listOpenPendingReviews = (): PendingReview[] => {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM pending_reviews WHERE decision IS NULL ORDER BY created_at DESC")
      .all() as PendingReviewRow[]
  ).map(rowToPendingReview);
};

export const findOpenReviewByEmail = (email: string): PendingReview | null => {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM pending_reviews WHERE LOWER(email) = LOWER(?) AND decision IS NULL ORDER BY created_at DESC LIMIT 1",
    )
    .get(email) as PendingReviewRow | undefined;
  return row ? rowToPendingReview(row) : null;
};

export const setPendingReviewDecision = (
  id: string,
  decision: PendingReviewDecision,
): PendingReview | null => {
  const db = getDb();
  db.prepare(
    "UPDATE pending_reviews SET decision = ?, decided_at = ? WHERE id = ?",
  ).run(decision, nowIso(), id);
  return getPendingReview(id);
};
