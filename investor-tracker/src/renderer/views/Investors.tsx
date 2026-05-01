import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS, type SenderCandidate } from "@shared/ipc";
import {
  ENTITY_CATEGORIES,
  PIPELINE_STAGES,
  type Entity,
  type EntityCategory,
  type PipelineStage,
} from "@shared/types";

interface NewInvestorDraft {
  name: string;
  domain: string;
  stage: PipelineStage;
  category: EntityCategory;
  emails: string;
  notes: string;
}

const emptyDraft = (): NewInvestorDraft => ({
  name: "",
  domain: "",
  stage: "new",
  category: "investor",
  emails: "",
  notes: "",
});

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

type SortKey = "name" | "category" | "domain" | "stage" | "updated";
type SortDir = "asc" | "desc";

const STAGE_ORDER: Record<string, number> = {
  committed: 0,
  funded: 1,
  negotiating: 2,
  diligence: 3,
  engaged: 4,
  initial_outreach: 5,
  new: 6,
  parked: 7,
  declined: 8,
};

interface SearchState {
  query: string;
  monthsBack: number;
  searching: boolean;
  results: SenderCandidate[] | null;
  selected: Record<string, boolean>;
  newName: string;
  stage: PipelineStage;
  category: EntityCategory;
  notes: string;
  saving: boolean;
  error: string | null;
}

const emptySearch = (): SearchState => ({
  query: "",
  monthsBack: 12,
  searching: false,
  results: null,
  selected: {},
  newName: "",
  stage: "new",
  category: "investor",
  notes: "",
  saving: false,
  error: null,
});

export const Investors = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [draft, setDraft] = useState<NewInvestorDraft>(emptyDraft);
  const [saving, setSaving] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const navigate = useNavigate();

  const refresh = async (): Promise<void> => {
    const list = await invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST);
    setEntities(list);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (): Promise<void> => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const emails = draft.emails
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const created = await invoke<Entity>(IPC_CHANNELS.ENTITIES_CREATE, {
        name: draft.name.trim(),
        domain: draft.domain.trim() || null,
        pipelineStage: draft.stage,
        category: draft.category,
        notes: draft.notes.trim() || null,
        contactEmails: emails,
      });
      setShowForm(false);
      setDraft(emptyDraft());
      await refresh();
      navigate(`/investors/${created.id}`);
    } finally {
      setSaving(false);
    }
  };

  const runSearch = async (): Promise<void> => {
    if (!search.query.trim()) return;
    setSearch((s) => ({ ...s, searching: true, results: null, error: null }));
    try {
      const results = await invoke<SenderCandidate[]>(
        IPC_CHANNELS.MAIL_SEARCH_SENDERS,
        { query: search.query.trim(), monthsBack: search.monthsBack },
      );
      const selected: Record<string, boolean> = {};
      for (const r of results) selected[r.email] = false;
      const guessName =
        results[0]?.displayName ?? results[0]?.email.split("@")[1] ?? search.query;
      setSearch((s) => ({
        ...s,
        searching: false,
        results,
        selected,
        newName: s.newName || guessName,
      }));
    } catch (e) {
      setSearch((s) => ({
        ...s,
        searching: false,
        error: (e as Error).message,
      }));
    }
  };

  const submitSearchInvestor = async (): Promise<void> => {
    if (!search.newName.trim()) return;
    const emails = Object.entries(search.selected)
      .filter(([, v]) => v)
      .map(([email]) => email);
    if (emails.length === 0) {
      setSearch((s) => ({ ...s, error: "Pick at least one sender to link." }));
      return;
    }
    setSearch((s) => ({ ...s, saving: true, error: null }));
    try {
      const created = await invoke<Entity>(IPC_CHANNELS.ENTITIES_CREATE, {
        name: search.newName.trim(),
        domain: null,
        pipelineStage: search.stage,
        category: search.category,
        notes: search.notes.trim() || null,
        contactEmails: emails,
      });
      setShowSearch(false);
      setSearch(emptySearch());
      await refresh();
      navigate(`/investors/${created.id}`);
    } catch (e) {
      setSearch((s) => ({
        ...s,
        saving: false,
        error: (e as Error).message,
      }));
    }
  };

  return (
    <div>
      <div className="row" style={{ alignItems: "baseline", marginBottom: 8 }}>
        <h2 style={{ flex: 1 }}>Investors</h2>
        <button
          className="btn secondary"
          onClick={() => {
            setShowSearch((v) => !v);
            if (!showSearch) setShowForm(false);
          }}
          style={{ flex: "0 0 auto" }}
        >
          {showSearch ? "Cancel search" : "🔍 Search for new investor"}
        </button>
        <button
          className="btn"
          onClick={() => {
            setShowForm((v) => !v);
            if (!showForm) setShowSearch(false);
          }}
          style={{ flex: "0 0 auto" }}
        >
          {showForm ? "Cancel" : "+ Add new investor"}
        </button>
      </div>

      {showSearch && (
        <div className="card">
          <h3>Search Outlook for a new investor</h3>
          <div className="muted" style={{ marginBottom: 8 }}>
            Enter a person&apos;s name, company name, or domain. Searches your
            Outlook for senders matching it. Pick which results belong to this
            investor and create them in one go.
          </div>
          <div className="row">
            <div style={{ flex: 3 }}>
              <label>Search query</label>
              <input
                value={search.query}
                onChange={(e) => setSearch({ ...search, query: e.target.value })}
                placeholder="e.g. Sebastian, Swedfund, swedfund.se"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <label>Range</label>
              <select
                value={search.monthsBack}
                onChange={(e) =>
                  setSearch({ ...search, monthsBack: Number(e.target.value) })
                }
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>1 year</option>
                <option value={36}>3 years</option>
              </select>
            </div>
            <button
              className="btn"
              disabled={search.searching || !search.query.trim()}
              onClick={() => void runSearch()}
              style={{ flex: "0 0 auto", alignSelf: "end" }}
            >
              {search.searching ? "Searching..." : "Search"}
            </button>
          </div>

          {search.error && (
            <div className="muted" style={{ marginTop: 8, color: "#f85149" }}>
              {search.error}
            </div>
          )}

          {search.results !== null && (
            <div style={{ marginTop: 12 }}>
              {search.results.length === 0 ? (
                <div className="muted">
                  No senders matched &quot;{search.query}&quot; in the last{" "}
                  {search.monthsBack} months. Try a broader search (a domain or a
                  shorter name).
                </div>
              ) : (
                <>
                  <div className="muted" style={{ marginBottom: 4 }}>
                    {search.results.length} sender(s) found. Tick the ones that
                    are this investor.
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Messages</th>
                        <th>Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {search.results.map((r) => (
                        <tr key={r.email}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!search.selected[r.email]}
                              onChange={(e) =>
                                setSearch((s) => ({
                                  ...s,
                                  selected: {
                                    ...s.selected,
                                    [r.email]: e.target.checked,
                                  },
                                }))
                              }
                              style={{ width: "auto" }}
                            />
                          </td>
                          <td>{r.displayName ?? "—"}</td>
                          <td>{r.email}</td>
                          <td>{r.messageCount}</td>
                          <td>{new Date(r.lastSeen).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4 style={{ marginTop: 16 }}>Create investor</h4>
                  <div className="row">
                    <div>
                      <label>Investor name *</label>
                      <input
                        value={search.newName}
                        onChange={(e) =>
                          setSearch({ ...search, newName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label>Stage</label>
                      <select
                        value={search.stage}
                        onChange={(e) =>
                          setSearch({
                            ...search,
                            stage: e.target.value as PipelineStage,
                          })
                        }
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Type</label>
                      <select
                        value={search.category}
                        onChange={(e) =>
                          setSearch({
                            ...search,
                            category: e.target.value as EntityCategory,
                          })
                        }
                      >
                        {ENTITY_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {categoryLabel(c)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <label>Notes (optional)</label>
                    <textarea
                      rows={2}
                      value={search.notes}
                      onChange={(e) =>
                        setSearch({ ...search, notes: e.target.value })
                      }
                    />
                  </div>
                  <button
                    className="btn"
                    disabled={
                      search.saving ||
                      !search.newName.trim() ||
                      Object.values(search.selected).every((v) => !v)
                    }
                    onClick={() => void submitSearchInvestor()}
                  >
                    {search.saving ? "Creating..." : "Create investor with checked senders"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card">
          <h3>New investor</h3>
          <div className="row">
            <div>
              <label>Name *</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Swedfund"
              />
            </div>
            <div>
              <label>Domain (optional)</label>
              <input
                value={draft.domain}
                onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                placeholder="e.g. swedfund.se"
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Pipeline stage</label>
              <select
                value={draft.stage}
                onChange={(e) =>
                  setDraft({ ...draft, stage: e.target.value as PipelineStage })
                }
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    category: e.target.value as EntityCategory,
                  })
                }
              >
                {ENTITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Contact emails (one per line or comma-separated)</label>
            <textarea
              rows={3}
              value={draft.emails}
              onChange={(e) => setDraft({ ...draft, emails: e.target.value })}
              placeholder="sebastian@swedfund.se&#10;jane.doe@swedfund.se"
            />
          </div>
          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          <div className="row">
            <button
              className="btn"
              disabled={saving || !draft.name.trim()}
              onClick={() => void submit()}
            >
              {saving ? "Saving..." : "Create investor"}
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                setDraft(emptyDraft());
                setShowForm(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {entities.length === 0 ? (
        <div className="card muted">
          No investors yet. Add one manually or run a poll + classify.
        </div>
      ) : (
        (() => {
          const toggleSort = (key: SortKey): void => {
            if (sortKey === key) {
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            } else {
              setSortKey(key);
              setSortDir(key === "updated" ? "desc" : "asc");
            }
          };

          const sorted = [...entities].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
              case "name":
                cmp = a.name.localeCompare(b.name);
                break;
              case "category":
                cmp = a.category.localeCompare(b.category);
                break;
              case "domain":
                cmp = (a.domain ?? "").localeCompare(b.domain ?? "");
                break;
              case "stage":
                cmp =
                  (STAGE_ORDER[a.pipelineStage] ?? 99) -
                  (STAGE_ORDER[b.pipelineStage] ?? 99);
                break;
              case "updated":
                cmp = a.updatedAt.localeCompare(b.updatedAt);
                break;
            }
            return sortDir === "asc" ? cmp : -cmp;
          });

          const arrow = (key: SortKey): string =>
            sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

          const headerStyle: React.CSSProperties = { cursor: "pointer", userSelect: "none" };

          return (
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort("name")} style={headerStyle}>Name{arrow("name")}</th>
                  <th onClick={() => toggleSort("category")} style={headerStyle}>Type{arrow("category")}</th>
                  <th onClick={() => toggleSort("domain")} style={headerStyle}>Domain{arrow("domain")}</th>
                  <th onClick={() => toggleSort("stage")} style={headerStyle}>Stage{arrow("stage")}</th>
                  <th onClick={() => toggleSort("updated")} style={headerStyle}>Updated{arrow("updated")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => navigate(`/investors/${e.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{e.name}</td>
                    <td>{categoryLabel(e.category)}</td>
                    <td>{e.domain ?? "—"}</td>
                    <td>{e.pipelineStage}</td>
                    <td>{new Date(e.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()
      )}
    </div>
  );
};
