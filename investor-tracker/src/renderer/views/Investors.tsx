import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import { type Entity } from "@shared/types";

export const Investors = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const navigate = useNavigate();

  const refresh = async (): Promise<void> => {
    const list = await invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST);
    setEntities(list);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div>
      <h2>Investors</h2>
      {entities.length === 0 ? (
        <div className="card muted">
          No investors yet. Run a poll + classify, then confirm pending reviews.
        </div>
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
              <tr
                key={e.id}
                onClick={() => navigate(`/investors/${e.id}`)}
                style={{ cursor: "pointer" }}
              >
                <td>{e.name}</td>
                <td>{e.domain ?? "—"}</td>
                <td>{e.pipelineStage}</td>
                <td>{new Date(e.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
