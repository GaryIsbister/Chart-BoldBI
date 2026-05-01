import { useEffect, useState } from "react";
import { api } from "../api";
import type { DashboardSummary } from "@shared/ipc";
import { PIPELINE_STAGES } from "@shared/types";

export const Dashboard = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setSummary(await api.dashboardSummary());

  useEffect(() => {
    void load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const pollNow = async () => {
    setRefreshing(true);
    try {
      await api.triggerPollNow();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (!summary) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="row between section">
        <h2>Dashboard</h2>
        <div className="row">
          <button onClick={pollNow} disabled={refreshing} className="primary">
            {refreshing ? "Polling…" : "Poll now"}
          </button>
          <button onClick={() => void api.triggerDailyClassifierNow()}>Run daily classifier</button>
        </div>
      </div>

      <div className="section stat-grid">
        <div className="stat">
          <div className="label">Entities</div>
          <div className="value">{summary.totalEntities}</div>
        </div>
        <div className="stat">
          <div className="label">Pending review</div>
          <div className="value">{summary.pendingReviewCount}</div>
        </div>
        <div className="stat">
          <div className="label">Open action items</div>
          <div className="value">{summary.openActionItems}</div>
        </div>
      </div>

      <div className="section">
        <h3>Pipeline</h3>
        <div className="stat-grid">
          {PIPELINE_STAGES.map((stage) => (
            <div className="stat" key={stage}>
              <div className="label">{stage.replace(/_/g, " ")}</div>
              <div className="value">{summary.byStage[stage] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Stale (no message in 14+ days)</h3>
        {summary.staleEntities.length === 0 ? (
          <p className="muted">No stale entities.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Days since last message</th>
              </tr>
            </thead>
            <tbody>
              {summary.staleEntities.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.daysSinceLastMessage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};
