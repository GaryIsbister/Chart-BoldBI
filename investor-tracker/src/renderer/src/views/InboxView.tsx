import { useEffect, useState } from "react";
import type { PollerStatus } from "../../../shared/types.js";

export function InboxView(): JSX.Element {
  const [status, setStatus] = useState<PollerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [classifyMsg, setClassifyMsg] = useState<string>("");
  const [importMsg, setImportMsg] = useState<string>("");

  async function refresh(): Promise<void> {
    setStatus(await window.investorTracker.invoke("jobs:status"));
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div>
      <div className="card">
        <h3>Sync</h3>
        <p className="muted">
          Polls Outlook (inbox + Investors folder) and Teams 1:1/group chats every 5 minutes.
        </p>
        <div className="row">
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await window.investorTracker.invoke("jobs:pollNow");
              await refresh();
              setBusy(false);
            }}
          >
            {busy ? "Polling…" : "Poll now"}
          </button>
          <span className="muted">
            {status?.lastRunAt
              ? `Last run: ${new Date(status.lastRunAt).toLocaleString()}`
              : "Never run"}
          </span>
          {status?.lastError && (
            <span style={{ color: "#991b1b" }}>{status.lastError}</span>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Classifier</h3>
        <p className="muted">
          Runs daily at 7am: Claude reviews unclassified contacts and groups them into entities.
        </p>
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              setClassifyMsg("Running…");
              const res = await window.investorTracker.invoke("jobs:classifyNow");
              setClassifyMsg(`Classified ${res.classified} contacts`);
            }}
          >
            Run classifier now
          </button>
          <span className="muted">{classifyMsg}</span>
        </div>
      </div>

      <div className="card">
        <h3>Demand book</h3>
        <p className="muted">
          Imports the latest demand book PDF from the configured sender.
        </p>
        <div className="row">
          <button
            className="btn secondary"
            onClick={async () => {
              setImportMsg("Importing…");
              const res = await window.investorTracker.invoke(
                "jobs:importDemandBook",
              );
              setImportMsg(
                `Imported ${res.imported} entries, ${res.entitiesAdded} new entities`,
              );
            }}
          >
            Import latest demand book
          </button>
          <span className="muted">{importMsg}</span>
        </div>
      </div>
    </div>
  );
}
