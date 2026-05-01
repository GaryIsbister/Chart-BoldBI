import { useEffect, useState } from "react";
import { api } from "../api";
import { PIPELINE_STAGES, type Entity, type PipelineStage } from "@shared/types";

export const Entities = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<PipelineStage | "all">("all");

  const load = async () => setEntities(await api.listEntities());

  useEffect(() => {
    void load();
  }, []);

  const onStageChange = async (id: string, stage: PipelineStage) => {
    await api.setEntityStage(id, stage, "manual update");
    await load();
  };

  const visible =
    filter === "all" ? entities : entities.filter((e) => e.pipelineStage === filter);

  return (
    <>
      <div className="row between section">
        <h2>Entities</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as PipelineStage | "all")}
          style={{ width: 200 }}
        >
          <option value="all">All stages</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <p className="muted">No entities yet. Sign in and poll, or wait for the scheduler.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Stage</th>
              <th>Override</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="muted">{e.domain ?? "—"}</td>
                <td>
                  <select
                    value={e.pipelineStage}
                    onChange={(ev) => void onStageChange(e.id, ev.target.value as PipelineStage)}
                    style={{ width: 160 }}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{e.stageManualOverride ? <span className="badge">manual</span> : <span className="muted">auto</span>}</td>
                <td className="muted">{new Date(e.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};
