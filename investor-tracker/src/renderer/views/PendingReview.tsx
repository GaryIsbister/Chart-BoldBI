import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS, type DecidePendingReviewArgs } from "@shared/ipc";
import {
  PIPELINE_STAGES,
  type Entity,
  type PendingReview as PendingReviewItem,
  type PipelineStage,
} from "@shared/types";

interface RowEdit {
  mode: "existing" | "new";
  existingEntityId: string;
  newEntityName: string;
  stage: PipelineStage;
}

export const PendingReview = (): JSX.Element => {
  const [reviews, setReviews] = useState<PendingReviewItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const refresh = async (): Promise<void> => {
    const [list, ents] = await Promise.all([
      invoke<PendingReviewItem[]>(IPC_CHANNELS.PENDING_REVIEWS_LIST),
      invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST),
    ]);
    setReviews(list);
    setEntities(ents);
    setEdits((prev) => {
      const next = { ...prev };
      for (const r of list) {
        if (next[r.id]) continue;
        const matched = r.proposedEntityId
          ? ents.find((e) => e.id === r.proposedEntityId)
          : ents.find(
              (e) => e.name.toLowerCase() === r.proposedEntityName.toLowerCase(),
            );
        next[r.id] = matched
          ? {
              mode: "existing",
              existingEntityId: matched.id,
              newEntityName: r.proposedEntityName,
              stage: matched.pipelineStage,
            }
          : {
              mode: "new",
              existingEntityId: "",
              newEntityName: r.proposedEntityName,
              stage: "new",
            };
      }
      return next;
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (
    review: PendingReviewItem,
    decision: DecidePendingReviewArgs["decision"],
  ): Promise<void> => {
    const edit = edits[review.id];
    let entityName: string | undefined;
    let stage: PipelineStage | undefined;
    if (decision === "confirm" && edit) {
      if (edit.mode === "existing") {
        const ent = entities.find((e) => e.id === edit.existingEntityId);
        entityName = ent?.name ?? edit.newEntityName;
        stage = ent?.pipelineStage;
      } else {
        entityName = edit.newEntityName.trim();
        stage = edit.stage;
        if (!entityName) {
          alert("Enter a name for the new investor.");
          return;
        }
      }
    }
    await invoke(IPC_CHANNELS.PENDING_REVIEWS_DECIDE, {
      reviewId: review.id,
      decision,
      entityName,
      pipelineStage: stage,
    });
    await refresh();
  };

  const updateEdit = (id: string, patch: Partial<RowEdit>): void => {
    setEdits((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  return (
    <div>
      <h2>Pending Review</h2>
      <div className="muted" style={{ marginBottom: 12 }}>
        Each row is an email Claude flagged as a possible investor. Allocate it to
        an existing investor or create a new one.
      </div>

      {reviews.length === 0 ? (
        <div className="card muted">No reviews pending.</div>
      ) : (
        reviews.map((r) => {
          const edit = edits[r.id];
          if (!edit) return null;
          return (
            <div key={r.id} className="card">
              <div className="row">
                <div>
                  <div style={{ fontWeight: 600 }}>{r.displayName ?? r.email}</div>
                  <div className="muted">
                    {r.email} · {r.domain ?? "no domain"}
                  </div>
                </div>
                <div className="muted">
                  confidence {(r.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <p>{r.reasoning}</p>

              <div className="form-group">
                <label>Allocate to</label>
                <div className="row">
                  <label
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <input
                      type="radio"
                      checked={edit.mode === "existing"}
                      onChange={() => updateEdit(r.id, { mode: "existing" })}
                      style={{ width: "auto" }}
                    />
                    Existing
                  </label>
                  <label
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <input
                      type="radio"
                      checked={edit.mode === "new"}
                      onChange={() => updateEdit(r.id, { mode: "new" })}
                      style={{ width: "auto" }}
                    />
                    New
                  </label>
                </div>
              </div>

              {edit.mode === "existing" ? (
                <div className="form-group">
                  <label>Existing investor</label>
                  <select
                    value={edit.existingEntityId}
                    onChange={(e) =>
                      updateEdit(r.id, { existingEntityId: e.target.value })
                    }
                  >
                    <option value="">— pick one —</option>
                    {entities.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                        {ent.domain ? ` (${ent.domain})` : ""} · {ent.pipelineStage}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="row">
                  <div>
                    <label>New investor name</label>
                    <input
                      value={edit.newEntityName}
                      onChange={(e) =>
                        updateEdit(r.id, { newEntityName: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label>Stage</label>
                    <select
                      value={edit.stage}
                      onChange={(e) =>
                        updateEdit(r.id, {
                          stage: e.target.value as PipelineStage,
                        })
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
              )}

              <div className="row" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  disabled={
                    edit.mode === "existing" && !edit.existingEntityId
                  }
                  onClick={() => void decide(r, "confirm")}
                >
                  Confirm
                </button>
                <button
                  className="btn secondary"
                  onClick={() => void decide(r, "reject")}
                >
                  Reject
                </button>
                <button
                  className="btn secondary"
                  onClick={() => void decide(r, "snooze")}
                >
                  Snooze
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
