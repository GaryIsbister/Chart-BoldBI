import { useEffect, useState } from "react";
import type { Entity } from "../../../shared/types.js";

const FILTERS = ["all", "investor", "uncertain", "not_investor"] as const;
type Filter = (typeof FILTERS)[number];

export function EntitiesView(): JSX.Element {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  async function load(f: Filter): Promise<void> {
    const arg = f === "all" ? undefined : { classification: f };
    const list = await window.investorTracker.invoke("entities:list", arg);
    setEntities(list);
  }

  useEffect(() => {
    void load(filter);
  }, [filter]);

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Entities</h3>
        <div style={{ marginLeft: "auto" }} className="row">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? "tab active" : "tab"}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Domains</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td className="muted">{e.domains.join(", ")}</td>
              <td>
                <span className={`pill ${e.classification}`}>
                  {e.classification}
                </span>
              </td>
              <td className="muted">{e.classificationReason ?? ""}</td>
              <td className="muted">{e.notes ?? ""}</td>
            </tr>
          ))}
          {entities.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No entities yet. Sign in, poll, then run classifier or import demand book.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
