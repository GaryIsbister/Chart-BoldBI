import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
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

export const Investors = (): JSX.Element => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [draft, setDraft] = useState<NewInvestorDraft>(emptyDraft);
  const [saving, setSaving] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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

  return (
    <div>
      <div className="row" style={{ alignItems: "baseline", marginBottom: 8 }}>
        <h2 style={{ flex: 1 }}>Investors</h2>
        <button
          className="btn"
          onClick={() => setShowForm((v) => !v)}
          style={{ flex: "0 0 auto" }}
        >
          {showForm ? "Cancel" : "+ Add new investor"}
        </button>
      </div>

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
