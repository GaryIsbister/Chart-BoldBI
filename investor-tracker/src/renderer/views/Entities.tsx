import { useEffect, useState } from "react";
import { api } from "../api";
import type { Entity, PipelineStage } from "@shared/types";
import { PIPELINE_STAGES } from "@shared/types";

export const Entities = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async (): Promise<void> => {
    setEntities(await api.invoke("entities:list", undefined));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const setStage = async (id: string, stage: PipelineStage): Promise<void> => {
    setBusy(true);
    try {
      const parkedUntil =
        stage === "parked" ? prompt("Revisit on (YYYY-MM-DD)?") ?? undefined : undefined;
      await api.invoke("entities:setStage", { id, stage, parkedUntil });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Entities</h2>
      {entities.length === 0 && <div className="muted">No entities yet. Confirm pending reviews to populate this list.</div>}
      {entities.map((e) => (
        <div className="card" key={e.id}>
          <div className="row">
            <div>
              <strong>{e.name}</strong>{" "}
              <span className="muted">{e.domain}</span>
              <div style={{ marginTop: 4 }}>
                <span className="tag stage">{e.pipelineStage.replace("_", " ")}</span>
                {e.parkedUntil && <span className="muted"> revisit {e.parkedUntil.slice(0, 10)}</span>}
                {e.stageManualOverride && <span className="muted"> (manual)</span>}
              </div>
            </div>
            <div>
              <select
                disabled={busy}
                value={e.pipelineStage}
                onChange={(ev) => setStage(e.id, ev.target.value as PipelineStage)}
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
