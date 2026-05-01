import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import { PIPELINE_STAGES, type Entity, type PipelineStage } from "@shared/types";

export const Entities = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<Entity | null>(null);

  const refresh = async (): Promise<void> => {
    const list = await invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST);
    setEntities(list);
    if (selected) {
      const updated = list.find((e) => e.id === selected.id) ?? null;
      setSelected(updated);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onStageChange = async (entity: Entity, stage: PipelineStage): Promise<void> => {
    await invoke<Entity>(IPC_CHANNELS.ENTITIES_UPDATE_STAGE, { id: entity.id, stage });
    await refresh();
  };

  return (
    <div>
      <h2>Entities</h2>
      {entities.length === 0 ? (
        <div className="card muted">No entities yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Stage</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <tr key={e.id} onClick={() => setSelected(e)} style={{ cursor: "pointer" }}>
                <td>{e.name}</td>
                <td>{e.domain ?? "—"}</td>
                <td>
                  <select
                    value={e.pipelineStage}
                    onClick={(ev) => ev.stopPropagation()}
                    onChange={(ev) => void onStageChange(e, ev.target.value as PipelineStage)}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{e.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{selected.name}</h3>
          <div className="muted">{selected.domain ?? "no domain"} · {selected.pipelineStage}</div>
          <p style={{ whiteSpace: "pre-wrap" }}>{selected.notes ?? "(no notes)"}</p>
        </div>
      )}
    </div>
  );
};
