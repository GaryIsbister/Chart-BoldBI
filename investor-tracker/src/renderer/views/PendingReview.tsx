import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS, type DecidePendingReviewArgs } from "@shared/ipc";
import { PIPELINE_STAGES, type PendingReview as PendingReviewItem, type PipelineStage } from "@shared/types";

export const PendingReview = (): JSX.Element => {
  const [reviews, setReviews] = useState<PendingReviewItem[]>([]);
  const [edits, setEdits] = useState<Record<string, { name: string; stage: PipelineStage }>>({});

  const refresh = async (): Promise<void> => {
    const list = await invoke<PendingReviewItem[]>(IPC_CHANNELS.PENDING_REVIEWS_LIST);
    setReviews(list);
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of list) {
        if (!next[r.id]) {
          next[r.id] = { name: r.proposedEntityName, stage: "new" };
        }
      }
      return next;
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (
    id: string,
    decision: DecidePendingReviewArgs["decision"],
  ): Promise<void> => {
    const edit = edits[id];
    await invoke(IPC_CHANNELS.PENDING_REVIEWS_DECIDE, {
      reviewId: id,
      decision,
      entityName: edit?.name,
      pipelineStage: edit?.stage,
    });
    await refresh();
  };

  return (
    <div>
      <h2>Pending Review</h2>
      {reviews.length === 0 ? (
        <div className="card muted">No reviews pending.</div>
      ) : (
        reviews.map((r) => {
          const edit = edits[r.id] ?? { name: r.proposedEntityName, stage: "new" as PipelineStage };
          return (
            <div key={r.id} className="card">
              <div className="row">
                <div>
                  <div style={{ fontWeight: 600 }}>{r.displayName ?? r.email}</div>
                  <div className="muted">{r.email} · {r.domain ?? "no domain"}</div>
                </div>
                <div className="muted">confidence {(r.confidence * 100).toFixed(0)}%</div>
              </div>
              <p>{r.reasoning}</p>
              {r.matchedDemandBookEntry && (
                <p className="muted">demand book: {r.matchedDemandBookEntry}</p>
              )}
              <div className="row">
                <div>
                  <label>Entity name</label>
                  <input
                    value={edit.name}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [r.id]: { ...edit, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label>Stage</label>
                  <select
                    value={edit.stage}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [r.id]: { ...edit, stage: e.target.value as PipelineStage },
                      }))
                    }
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => void decide(r.id, "confirm")}>Confirm</button>
                <button className="btn secondary" onClick={() => void decide(r.id, "reject")}>Reject</button>
                <button className="btn secondary" onClick={() => void decide(r.id, "snooze")}>Snooze</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
