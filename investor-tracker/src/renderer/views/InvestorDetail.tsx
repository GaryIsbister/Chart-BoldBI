import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS, type SenderCandidate } from "@shared/ipc";
import {
  ENTITY_CATEGORIES,
  PIPELINE_STAGES,
  type ActionItem,
  type ActionItemOwner,
  type ActionItemStatus,
  type Contact,
  type Entity,
  type EntityCategory,
  type Message,
  type PipelineStage,
  type Thread,
} from "@shared/types";

const categoryLabel = (c: EntityCategory): string => {
  switch (c) {
    case "investor":
      return "Investor";
    case "participant":
      return "Participant";
    case "both":
      return "Both";
  }
};

export const InvestorDetail = (): JSX.Element => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entity, setEntity] = useState<Entity | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({});
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const [newAction, setNewAction] = useState<{
    description: string;
    ownerSide: ActionItemOwner;
    dueDate: string;
  }>({ description: "", ownerSide: "us", dueDate: "" });
  const [newContact, setNewContact] = useState<{ email: string; name: string }>({
    email: "",
    name: "",
  });
  const [lookupQuery, setLookupQuery] = useState<string>("");
  const [lookupResults, setLookupResults] = useState<SenderCandidate[] | null>(null);
  const [lookupRunning, setLookupRunning] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<string>("");
  const [showManualContact, setShowManualContact] = useState<boolean>(false);
  const [backfillMonths, setBackfillMonths] = useState<number>(6);
  const [backfilling, setBackfilling] = useState<boolean>(false);
  const [backfillStatus, setBackfillStatus] = useState<string>("");

  const refresh = useCallback(async (): Promise<void> => {
    if (!id) return;
    const [e, c, t, a] = await Promise.all([
      invoke<Entity | null>(IPC_CHANNELS.ENTITIES_GET, id),
      invoke<Contact[]>(IPC_CHANNELS.CONTACTS_LIST_FOR_ENTITY, id),
      invoke<Thread[]>(IPC_CHANNELS.THREADS_LIST_FOR_ENTITY, id),
      invoke<ActionItem[]>(IPC_CHANNELS.ACTION_ITEMS_LIST, { entityId: id }),
    ]);
    setEntity(e);
    setContacts(c);
    setThreads(t);
    setActionItems(a);
    if (e) setNotes(e.notes ?? "");
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateStage = async (stage: PipelineStage): Promise<void> => {
    if (!id) return;
    await invoke<Entity>(IPC_CHANNELS.ENTITIES_UPDATE_STAGE, { id, stage });
    await refresh();
  };

  const updateCategory = async (category: EntityCategory): Promise<void> => {
    if (!id) return;
    await invoke<Entity>(IPC_CHANNELS.ENTITIES_UPDATE_CATEGORY, { id, category });
    await refresh();
  };

  const toggleActionItem = async (
    item: ActionItem,
    completed: boolean,
  ): Promise<void> => {
    await invoke(IPC_CHANNELS.ACTION_ITEMS_UPDATE_STATUS, {
      id: item.id,
      status: completed ? "done" : "open",
    });
    await refresh();
  };

  const saveNotes = async (): Promise<void> => {
    if (!id) return;
    setSavingNotes(true);
    try {
      await invoke<Entity>(IPC_CHANNELS.ENTITIES_UPDATE_NOTES, { id, notes });
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleThread = async (threadId: string): Promise<void> => {
    if (expandedThread === threadId) {
      setExpandedThread(null);
      return;
    }
    if (!messagesByThread[threadId]) {
      const msgs = await invoke<Message[]>(IPC_CHANNELS.MESSAGES_LIST_FOR_THREAD, threadId);
      setMessagesByThread((prev) => ({ ...prev, [threadId]: msgs }));
    }
    setExpandedThread(threadId);
  };

  const updateActionStatus = async (
    actionId: string,
    status: ActionItemStatus,
  ): Promise<void> => {
    await invoke(IPC_CHANNELS.ACTION_ITEMS_UPDATE_STATUS, { id: actionId, status });
    await refresh();
  };

  const addActionItem = async (): Promise<void> => {
    if (!id || !newAction.description.trim()) return;
    await invoke(IPC_CHANNELS.ACTION_ITEMS_CREATE, {
      entityId: id,
      description: newAction.description.trim(),
      ownerSide: newAction.ownerSide,
      dueDate: newAction.dueDate || null,
    });
    setNewAction({ description: "", ownerSide: "us", dueDate: "" });
    await refresh();
  };

  const addContact = async (): Promise<void> => {
    if (!id || !newContact.email.trim()) return;
    await invoke(IPC_CHANNELS.CONTACTS_CREATE, {
      entityId: id,
      email: newContact.email.trim(),
      displayName: newContact.name.trim() || null,
    });
    setNewContact({ email: "", name: "" });
    await refresh();
  };

  const runLookup = async (): Promise<void> => {
    if (!lookupQuery.trim()) return;
    setLookupRunning(true);
    try {
      const results = await invoke<SenderCandidate[]>(
        IPC_CHANNELS.CONTACTS_FIND_BY_NAME,
        lookupQuery.trim(),
      );
      setLookupResults(results);
    } finally {
      setLookupRunning(false);
    }
  };

  const reanalyzeThreads = async (): Promise<void> => {
    if (!id) return;
    setAnalyzing(true);
    setAnalyzeStatus("");
    try {
      const result = await invoke<{ refreshed: number; errors: string[] }>(
        IPC_CHANNELS.JOBS_REFRESH_ENTITY_THREADS,
        id,
      );
      setAnalyzeStatus(
        `Re-analyzed ${result.refreshed} thread(s)` +
          (result.errors.length > 0 ? ` · ${result.errors.length} error(s)` : ""),
      );
      await refresh();
    } catch (e) {
      setAnalyzeStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const runInvestorBackfill = async (): Promise<void> => {
    if (!id) return;
    if (contacts.length === 0) {
      setBackfillStatus("Add at least one contact email before backfilling.");
      return;
    }
    setBackfilling(true);
    setBackfillStatus("");
    try {
      const result = await invoke<{
        fetched: number;
        linked: number;
        errors: string[];
      }>(IPC_CHANNELS.JOBS_BACKFILL_FOR_INVESTOR, {
        entityId: id,
        monthsBack: backfillMonths,
      });
      const errs =
        result.errors.length > 0 ? ` · ${result.errors.length} error(s)` : "";
      setBackfillStatus(
        `Pulled ${result.fetched} new email(s); linked ${result.linked} message(s) total${errs}`,
      );
      await refresh();
    } catch (e) {
      setBackfillStatus(`Backfill failed: ${(e as Error).message}`);
    } finally {
      setBackfilling(false);
    }
  };

  const linkCandidate = async (candidate: SenderCandidate): Promise<void> => {
    if (!id) return;
    await invoke(IPC_CHANNELS.CONTACTS_CREATE, {
      entityId: id,
      email: candidate.email,
      displayName: candidate.displayName,
    });
    setLookupQuery("");
    setLookupResults(null);
    await refresh();
  };

  if (!id) return <div>No investor selected.</div>;
  if (!entity) return <div>Loading...</div>;

  const openItems = actionItems.filter((a) => a.status === "open" || a.status === "in_progress");
  const doneItems = actionItems.filter((a) => a.status === "done" || a.status === "cancelled");

  return (
    <div>
      <Link to="/investors" className="muted">&larr; All investors</Link>
      <h2 style={{ marginTop: 8 }}>{entity.name}</h2>
      <div className="muted">
        {entity.domain ?? "no domain"} · created {new Date(entity.createdAt).toLocaleDateString()}
      </div>

      <div className="card">
        <div className="row">
          <div>
            <label>Type</label>
            <select
              value={entity.category}
              onChange={(e) =>
                void updateCategory(e.target.value as EntityCategory)
              }
            >
              {ENTITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Pipeline stage</label>
            <select
              value={entity.pipelineStage}
              onChange={(e) => void updateStage(e.target.value as PipelineStage)}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Last updated</label>
            <div>{new Date(entity.updatedAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "baseline" }}>
          <h3 style={{ flex: 1 }}>Action items</h3>
          <button
            className="btn secondary"
            disabled={analyzing}
            onClick={() => void reanalyzeThreads()}
            style={{ flex: "0 0 auto" }}
            title="Run Claude across all email threads for this investor to find new action items and resolve completed ones."
          >
            {analyzing ? "Analyzing..." : "Re-analyze emails for action items"}
          </button>
        </div>
        {analyzeStatus && (
          <div className="muted" style={{ marginBottom: 8 }}>{analyzeStatus}</div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div className="row">
            <div style={{ flex: 3 }}>
              <label>New action</label>
              <input
                placeholder="Send updated deck to ..."
                value={newAction.description}
                onChange={(e) =>
                  setNewAction({ ...newAction, description: e.target.value })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Owner</label>
              <select
                value={newAction.ownerSide}
                onChange={(e) =>
                  setNewAction({
                    ...newAction,
                    ownerSide: e.target.value as ActionItemOwner,
                  })
                }
              >
                <option value="us">us</option>
                <option value="them">them</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Due (optional)</label>
              <input
                type="date"
                value={newAction.dueDate}
                onChange={(e) =>
                  setNewAction({ ...newAction, dueDate: e.target.value })
                }
              />
            </div>
          </div>
          <button
            className="btn"
            disabled={!newAction.description.trim()}
            onClick={() => void addActionItem()}
            style={{ marginTop: 8 }}
          >
            Add action
          </button>
        </div>

        <h4 className="muted" style={{ marginBottom: 4 }}>Open ({openItems.length})</h4>
        {openItems.length === 0 ? (
          <div className="muted">Nothing open.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>Done</th>
                <th>Owner</th>
                <th>Description</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {openItems.map((a) => (
                <tr key={a.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={(e) => void toggleActionItem(a, e.target.checked)}
                      style={{ width: "auto" }}
                    />
                  </td>
                  <td>{a.ownerSide}</td>
                  <td>{a.description}</td>
                  <td>{a.dueDate ?? "—"}</td>
                  <td>
                    <select
                      value={a.status}
                      onChange={(e) =>
                        void updateActionStatus(a.id, e.target.value as ActionItemStatus)
                      }
                    >
                      <option value="open">open</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {doneItems.length > 0 && (
          <>
            <h4 className="muted" style={{ marginTop: 12, marginBottom: 4 }}>
              Completed ({doneItems.length})
            </h4>
            <table>
              <tbody>
                {doneItems.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked
                        onChange={(e) =>
                          void toggleActionItem(a, e.target.checked)
                        }
                        style={{ width: "auto" }}
                      />
                    </td>
                    <td className="muted">{a.ownerSide}</td>
                    <td className="muted" style={{ textDecoration: "line-through" }}>
                      {a.description}
                    </td>
                    <td className="muted">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h3>Email threads ({threads.length})</h3>
        {threads.length === 0 ? (
          <div className="muted">No threads yet.</div>
        ) : (
          threads.map((t) => (
            <div
              key={t.id}
              style={{
                borderBottom: "1px solid var(--border)",
                padding: "8px 0",
              }}
            >
              <div
                onClick={() => void toggleThread(t.id)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontWeight: 500 }}>
                  {t.subject ?? "(no subject)"}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {t.source} · {new Date(t.lastMessageAt).toLocaleString()}
                </div>
                {t.summary && (
                  <div style={{ marginTop: 4, fontSize: 13 }}>{t.summary}</div>
                )}
              </div>
              {expandedThread === t.id && messagesByThread[t.id] && (
                <div style={{ marginTop: 8, paddingLeft: 16 }}>
                  {messagesByThread[t.id]!.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "6px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12 }}>
                        {m.isFromUs ? "US" : m.fromName ?? m.fromEmail} ·{" "}
                        {new Date(m.receivedAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        {m.bodyPreview}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>Contacts ({contacts.length})</h3>
        {contacts.length === 0 ? (
          <div className="muted">No contacts linked yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Title</th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.displayName ?? "—"}</td>
                  <td>{c.email}</td>
                  <td>{c.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h4 style={{ marginTop: 16 }}>Pull older emails for this investor</h4>
        <div className="muted" style={{ marginBottom: 8 }}>
          Searches Outlook for older emails sent FROM the contact addresses
          above and stores them locally. Cheaper than the full backfill — only
          fetches emails matching this investor.
        </div>
        <div className="row">
          <div style={{ flex: "0 0 auto" }}>
            <label>Range</label>
            <select
              value={backfillMonths}
              onChange={(e) => setBackfillMonths(Number(e.target.value))}
              disabled={backfilling}
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>1 year</option>
              <option value={36}>3 years</option>
            </select>
          </div>
          <button
            className="btn"
            disabled={backfilling || contacts.length === 0}
            onClick={() => void runInvestorBackfill()}
            style={{ flex: "0 0 auto", alignSelf: "end" }}
          >
            {backfilling ? "Backfilling..." : "Backfill emails"}
          </button>
        </div>
        {contacts.length === 0 && (
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Add a contact email before you can backfill.
          </div>
        )}
        {backfillStatus && (
          <div className="muted" style={{ marginTop: 8 }}>{backfillStatus}</div>
        )}

        <h4 style={{ marginTop: 16 }}>Find contact by name</h4>
        <div className="muted" style={{ marginBottom: 8 }}>
          Search the emails you&apos;ve already polled for a sender by name. Pick
          one to link.
        </div>
        <div className="row">
          <div style={{ flex: 3 }}>
            <input
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="e.g. Sebastian"
              onKeyDown={(e) => {
                if (e.key === "Enter") void runLookup();
              }}
            />
          </div>
          <button
            className="btn secondary"
            disabled={lookupRunning || !lookupQuery.trim()}
            onClick={() => void runLookup()}
            style={{ flex: "0 0 auto" }}
          >
            {lookupRunning ? "Searching..." : "Search emails"}
          </button>
        </div>
        {lookupResults !== null && (
          <div style={{ marginTop: 8 }}>
            {lookupResults.length === 0 ? (
              <div className="muted">No senders match &quot;{lookupQuery}&quot;.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Messages</th>
                    <th>Last seen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResults.map((c) => (
                    <tr key={c.email}>
                      <td>{c.displayName ?? "—"}</td>
                      <td>{c.email}</td>
                      <td>{c.messageCount}</td>
                      <td>{new Date(c.lastSeen).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn secondary"
                          onClick={() => void linkCandidate(c)}
                        >
                          Link
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button
            className="btn secondary"
            onClick={() => setShowManualContact((v) => !v)}
          >
            {showManualContact ? "Hide manual entry ▲" : "Add contact manually ▼"}
          </button>
        </div>
        {showManualContact && (
          <div style={{ marginTop: 12 }}>
            <div className="row">
              <div style={{ flex: 2 }}>
                <label>Email</label>
                <input
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact({ ...newContact, email: e.target.value })
                  }
                  placeholder="person@firm.com"
                />
              </div>
              <div style={{ flex: 2 }}>
                <label>Name (optional)</label>
                <input
                  value={newContact.name}
                  onChange={(e) =>
                    setNewContact({ ...newContact, name: e.target.value })
                  }
                />
              </div>
            </div>
            <button
              className="btn"
              disabled={!newContact.email.trim()}
              onClick={() => void addContact()}
              style={{ marginTop: 8 }}
            >
              Add contact
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Notes</h3>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          className="btn"
          disabled={savingNotes || notes === (entity.notes ?? "")}
          onClick={() => void saveNotes()}
          style={{ marginTop: 8 }}
        >
          {savingNotes ? "Saving..." : "Save notes"}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={() => navigate("/investors")}>
          Back to investors
        </button>
      </div>
    </div>
  );
};
