import { useEffect, useState } from "react";
import { api } from "../api";
import type { PendingReview as Review, PendingReviewDecision } from "@shared/types";

export const PendingReview = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => setReviews(await api.listPendingReviews());

  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, decision: PendingReviewDecision) => {
    setBusy(id);
    try {
      await api.decidePendingReview(id, decision);
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (reviews.length === 0) {
    return (
      <>
        <h2>Pending review</h2>
        <p className="muted">Inbox zero. The classifier hasn’t flagged anyone uncertain.</p>
      </>
    );
  }

  return (
    <>
      <h2>Pending review</h2>
      <p className="muted">
        {reviews.length} sender{reviews.length === 1 ? "" : "s"} the classifier wasn’t confident enough about.
      </p>
      {reviews.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between">
            <div>
              <strong>{r.displayName ?? r.email}</strong>{" "}
              <span className="muted">&lt;{r.email}&gt;</span>
            </div>
            <span className="badge">confidence {(r.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="muted" style={{ margin: "6px 0" }}>
            Proposed entity: <strong>{r.proposedEntityName}</strong>
            {r.matchedDemandBookEntry ? ` · demand-book match: ${r.matchedDemandBookEntry}` : ""}
          </div>
          <div style={{ marginBottom: 10 }}>{r.reasoning}</div>
          <div className="row">
            <button
              className="primary"
              disabled={busy === r.id}
              onClick={() => void decide(r.id, "confirm")}
            >
              Confirm
            </button>
            <button disabled={busy === r.id} onClick={() => void decide(r.id, "reject")}>
              Reject
            </button>
            <button disabled={busy === r.id} onClick={() => void decide(r.id, "snooze")}>
              Snooze
            </button>
          </div>
        </div>
      ))}
    </>
  );
};
