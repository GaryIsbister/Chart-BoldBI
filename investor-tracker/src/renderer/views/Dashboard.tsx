import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import type { ActionItem, Entity, PendingReview, Settings } from "@shared/types";

type JobLabel = "poller" | "classifier" | "pollAndClassify";

export const Dashboard = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchDraft, setSearchDraft] = useState<string>("");
  const [keywordsDraft, setKeywordsDraft] = useState<string>("");
  const [savingContext, setSavingContext] = useState<boolean>(false);
  const [running, setRunning] = useState<JobLabel | null>(null);
  const [status, setStatus] = useState<string>("");

  const refresh = async (): Promise<void> => {
    const [e, a, p, s] = await Promise.all([
      invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST),
      invoke<ActionItem[]>(IPC_CHANNELS.ACTION_ITEMS_LIST, { status: "open" }),
      invoke<PendingReview[]>(IPC_CHANNELS.PENDING_REVIEWS_LIST),
      invoke<Settings>(IPC_CHANNELS.SETTINGS_GET),
    ]);
    setEntities(e);
    setActionItems(a);
    setPending(p);
    setSettings(s);
    setSearchDraft(s.investorSearchContext);
    setKeywordsDraft(s.searchKeywords.join("\n"));
  };

  useEffect(() => {
    void refresh();
  }, []);

  const parseKeywords = (text: string): string[] =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const saveContext = async (): Promise<void> => {
    setSavingContext(true);
    try {
      const updated = await invoke<Settings>(IPC_CHANNELS.SETTINGS_UPDATE, {
        investorSearchContext: searchDraft,
        searchKeywords: parseKeywords(keywordsDraft),
      });
      setSettings(updated);
    } finally {
      setSavingContext(false);
    }
  };

  const isContextDirty = (): boolean => {
    if (!settings) return false;
    if (searchDraft !== settings.investorSearchContext) return true;
    const parsed = parseKeywords(keywordsDraft);
    if (parsed.length !== settings.searchKeywords.length) return true;
    return parsed.some((k, i) => k !== settings.searchKeywords[i]);
  };

  const runJob = async (
    channel:
      | typeof IPC_CHANNELS.JOBS_RUN_POLLER
      | typeof IPC_CHANNELS.JOBS_RUN_DAILY_CLASSIFIER
      | typeof IPC_CHANNELS.JOBS_RUN_POLL_AND_CLASSIFY,
    label: JobLabel,
  ): Promise<void> => {
    if (label !== "poller" && isContextDirty()) {
      await saveContext();
    }
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
        <h3>Investor search context</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Describe the kind of investors you&apos;re looking for.
        </div>
        <div className="form-group">
          <textarea
            rows={4}
            placeholder={
              "e.g. Family offices and DFIs interested in African trade finance. Tickets $5M-$50M."
            }
            value={searchDraft}
            onChange={(ev) => setSearchDraft(ev.target.value)}
            onBlur={() => {
              if (isContextDirty()) void saveContext();
            }}
          />
        </div>

        <h4 style={{ marginTop: 8 }}>Keywords (one per line)</h4>
        <div className="muted" style={{ marginBottom: 8 }}>
          Specific words, phrases, or investor names Claude should look for in
          subject, body, or sender info.
        </div>
        <div className="form-group">
          <textarea
            rows={5}
            placeholder={
              "trade finance\nprivate credit\nfamily office\nLP commitment\nSwedfund\nBlackRock"
            }
            value={keywordsDraft}
            onChange={(ev) => setKeywordsDraft(ev.target.value)}
            onBlur={() => {
              if (isContextDirty()) void saveContext();
            }}
          />
        </div>
        {settings && (
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={settings.keywordPrefilterEnabled}
              onChange={(e) =>
                void invoke<Settings>(IPC_CHANNELS.SETTINGS_UPDATE, {
                  keywordPrefilterEnabled: e.target.checked,
                }).then(setSettings)
              }
              style={{ width: "auto", marginTop: 4 }}
            />
            <span>
              <span>Only classify emails matching keywords</span>
              <div className="muted" style={{ fontSize: 12 }}>
                Saves Claude API cost by skipping emails whose subject, body, or
                sender doesn&apos;t match any keyword. Tradeoff: investor emails
                that don&apos;t mention a keyword will be missed. Add investor
                firm names as keywords to catch them.
              </div>
            </span>
          </label>
        )}
        <button
          className="btn secondary"
          disabled={savingContext || !isContextDirty()}
          onClick={() => void saveContext()}
        >
          {savingContext ? "Saving..." : "Save context"}
        </button>
      </div>

      <div className="card">
        <div className="row">
          <button
            className="btn"
            disabled={running !== null}
            onClick={() =>
              void runJob(IPC_CHANNELS.JOBS_RUN_POLL_AND_CLASSIFY, "pollAndClassify")
            }
          >
            {running === "pollAndClassify"
              ? "Polling & classifying..."
              : "Poll inbox & find matching investors"}
          </button>
          <button
            className="btn secondary"
            disabled={running !== null}
            onClick={() => void runJob(IPC_CHANNELS.JOBS_RUN_POLLER, "poller")}
          >
            {running === "poller" ? "Polling..." : "Poll only"}
          </button>
          <button
            className="btn secondary"
            disabled={running !== null}
            onClick={() =>
              void runJob(IPC_CHANNELS.JOBS_RUN_DAILY_CLASSIFIER, "classifier")
            }
          >
            {running === "classifier" ? "Classifying..." : "Classify only"}
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
