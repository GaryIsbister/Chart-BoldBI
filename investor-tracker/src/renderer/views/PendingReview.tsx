import { useEffect, useState } from "react";
import { api } from "../api";
import type { PendingReview, PendingReviewDecision } from "@shared/types";

export const PendingReviewView = (): JSX.Element => {
  const [items, setItems] = useState<PendingReview[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async (): Promise<void> => {
    setItems(await api.invoke("pendingReviews:list", undefined));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (id: string, decision: PendingReviewDecision): Promise<void> => {
    setBusy(true);
    try {
      await api.invoke("pendingReviews:decide", { id, decision });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runClassifier = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.invoke("jobs:runDailyClassifierNow", undefined);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Pending Review</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        <span className="muted">Senders Claude flagged as likely investors. Confirm to add them to your tracked entities.</span>
        <button className="primary" disabled={busy} onClick={runClassifier}>
          Run classifier now
        </button>
      </div>
      {items.length === 0 && <div className="muted">No pending senders.</div>}
      {items.map((p) => (
        <div className="card" key={p.id}>
          <div className="row">
            <div>
              <div>
                <strong>{p.proposedEntityName}</strong>{" "}
                <span className="muted">
                  ({p.displayName ?? p.email})
                </span>
              </div>
              <div className="muted">{p.email}</div>
              {p.matchedDemandBookEntry && (
                <div className="muted">demand book match: {p.matchedDemandBookEntry}</div>
              )}
              <div style={{ marginTop: 6 }}>{p.reasoning}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="confidence">conf {(p.confidence * 100).toFixed(0)}%</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="primary" disabled={busy} onClick={() => decide(p.id, "confirm")}>
                  Confirm
                </button>
                <button className="ghost" disabled={busy} onClick={() => decide(p.id, "reject")}>
                  Reject
                </button>
                <button className="ghost" disabled={busy} onClick={() => decide(p.id, "snooze")}>
                  Snooze
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
