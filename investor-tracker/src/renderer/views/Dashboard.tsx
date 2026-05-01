import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import type { ActionItem, Entity, PendingReview } from "@shared/types";

export const Dashboard = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const refresh = async (): Promise<void> => {
    const [e, a, p] = await Promise.all([
      invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST),
      invoke<ActionItem[]>(IPC_CHANNELS.ACTION_ITEMS_LIST, { status: "open" }),
      invoke<PendingReview[]>(IPC_CHANNELS.PENDING_REVIEWS_LIST),
    ]);
    setEntities(e);
    setActionItems(a);
    setPending(p);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const runJob = async (channel: typeof IPC_CHANNELS.JOBS_RUN_POLLER | typeof IPC_CHANNELS.JOBS_RUN_DAILY_CLASSIFIER, label: string): Promise<void> => {
    setRunning(label);
    setStatus("");
    try {
      const result = await invoke<unknown>(channel);
      setStatus(`${label}: ${JSON.stringify(result)}`);
      await refresh();
    } catch (e) {
      setStatus(`${label} failed: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  };

  const stageCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.pipelineStage] = (acc[e.pipelineStage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="card">
        <div className="row">
          <button
            className="btn"
            disabled={running !== null}
            onClick={() => void runJob(IPC_CHANNELS.JOBS_RUN_POLLER, "poller")}
          >
            {running === "poller" ? "Polling..." : "Run poller now"}
          </button>
          <button
            className="btn secondary"
            disabled={running !== null}
            onClick={() => void runJob(IPC_CHANNELS.JOBS_RUN_DAILY_CLASSIFIER, "classifier")}
          >
            {running === "classifier" ? "Classifying..." : "Run daily classifier"}
          </button>
        </div>
        {status && <div className="muted" style={{ marginTop: 8 }}>{status}</div>}
      </div>

      <div className="card">
        <h3>Pipeline</h3>
        <div className="row">
          {Object.entries(stageCounts).map(([stage, count]) => (
            <div key={stage}>
              <div className="muted">{stage}</div>
              <div style={{ fontSize: 22 }}>{count}</div>
            </div>
          ))}
          {Object.keys(stageCounts).length === 0 && (
            <div className="muted">No entities yet — run the poller and classifier.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Open action items ({actionItems.length})</h3>
        {actionItems.length === 0 ? (
          <div className="muted">No open items.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Owner</th><th>Description</th><th>Due</th></tr>
            </thead>
            <tbody>
              {actionItems.slice(0, 10).map((a) => (
                <tr key={a.id}>
                  <td>{a.ownerSide}</td>
                  <td>{a.description}</td>
                  <td>{a.dueDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Pending review ({pending.length})</h3>
        {pending.length === 0 ? (
          <div className="muted">Nothing pending.</div>
        ) : (
          <div className="muted">See the Pending Review tab.</div>
        )}
      </div>
    </div>
  );
};
