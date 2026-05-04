import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import type { ActionItem, Entity } from "@shared/types";

interface CheckResult {
  newMessages: number;
  scanned: number;
  perInvestor: Array<{ entityId: string; entityName: string; count: number }>;
  errors: string[];
  cursor: string | null;
}

interface NewCount {
  entityId: string;
  count: number;
}

export const Dashboard = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newCounts, setNewCounts] = useState<NewCount[]>([]);
  const [checking, setChecking] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string>("");

  const refresh = async (): Promise<void> => {
    const [e, a, n] = await Promise.all([
      invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST),
      invoke<ActionItem[]>(IPC_CHANNELS.ACTION_ITEMS_LIST, { status: "open" }),
      invoke<NewCount[]>(IPC_CHANNELS.MESSAGES_NEW_COUNTS),
    ]);
    setEntities(e);
    setActionItems(a);
    setNewCounts(n);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const checkNewEmails = async (): Promise<void> => {
    setChecking(true);
    setError("");
    try {
      const result = await invoke<CheckResult>(IPC_CHANNELS.JOBS_CHECK_NEW_EMAILS);
      setLastResult(result);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const totalNew = newCounts.reduce((sum, n) => sum + n.count, 0);
  const stageCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.pipelineStage] = (acc[e.pipelineStage] ?? 0) + 1;
    return acc;
  }, {});

  const investorById = new Map(entities.map((e) => [e.id, e]));

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="card">
        <h3>Check for new emails</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Pulls any emails received since the last check, filters them against
          your investors&apos; domains and contact emails, and flags matches as
          new. No Claude API calls — pure Outlook query.
        </div>
        <button
          className="btn"
          disabled={checking || entities.length === 0}
          onClick={() => void checkNewEmails()}
        >
          {checking ? "Checking..." : "Check for new emails"}
        </button>
        {entities.length === 0 && (
          <div className="muted" style={{ marginTop: 8 }}>
            Add at least one investor first (Investors tab → + Add new
            investor).
          </div>
        )}
        {error && (
          <div className="muted" style={{ marginTop: 8, color: "#cf222e" }}>
            {error}
          </div>
        )}
        {lastResult && (
          <div style={{ marginTop: 8 }}>
            <div>
              Scanned <strong>{lastResult.scanned}</strong> recent message(s);
              flagged <strong>{lastResult.newMessages}</strong> as new.
            </div>
            {lastResult.perInvestor.length > 0 && (
              <ul style={{ marginTop: 6 }}>
                {lastResult.perInvestor.map((p) => (
                  <li key={p.entityId}>
                    <Link to={`/investors/${p.entityId}`}>{p.entityName}</Link>:{" "}
                    {p.count} new
                  </li>
                ))}
              </ul>
            )}
            {lastResult.errors.length > 0 && (
              <div className="muted" style={{ marginTop: 6, color: "#bf8700" }}>
                {lastResult.errors.length} error(s) — first:{" "}
                {lastResult.errors[0]}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Unread by investor ({totalNew})</h3>
        {newCounts.length === 0 ? (
          <div className="muted">Nothing new.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Investor</th>
                <th>New emails</th>
              </tr>
            </thead>
            <tbody>
              {newCounts
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((n) => (
                  <tr key={n.entityId}>
                    <td>
                      <Link to={`/investors/${n.entityId}`}>
                        {investorById.get(n.entityId)?.name ?? "(unknown)"}
                      </Link>
                    </td>
                    <td>{n.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
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
            <div className="muted">No investors yet.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Open action items ({actionItems.length})</h3>
        {actionItems.length === 0 ? (
          <div className="muted">No open items. See the Actions tab.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Description</th>
                <th>Due</th>
              </tr>
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
    </div>
  );
};
