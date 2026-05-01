import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "../api";
import { IPC_CHANNELS } from "@shared/ipc";
import {
  type ActionItem,
  type ActionItemOwner,
  type ActionItemStatus,
  type Entity,
} from "@shared/types";

type SortKey = "investor" | "owner" | "description" | "due" | "status" | "source" | "updated";
type SortDir = "asc" | "desc";

interface Filters {
  text: string;
  owner: ActionItemOwner | "all";
  status: ActionItemStatus | "all" | "open_or_in_progress";
  investorId: string | "all";
}

const defaultFilters: Filters = {
  text: "",
  owner: "all",
  status: "open_or_in_progress",
  investorId: "all",
};

export const Actions = (): JSX.Element => {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const navigate = useNavigate();

  const refresh = async (): Promise<void> => {
    const [a, e] = await Promise.all([
      invoke<ActionItem[]>(IPC_CHANNELS.ACTION_ITEMS_LIST),
      invoke<Entity[]>(IPC_CHANNELS.ENTITIES_LIST),
    ]);
    setItems(a);
    setEntities(e);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const entityById = useMemo(() => {
    const map = new Map<string, Entity>();
    for (const e of entities) map.set(e.id, e);
    return map;
  }, [entities]);

  const toggleDone = async (item: ActionItem, done: boolean): Promise<void> => {
    await invoke(IPC_CHANNELS.ACTION_ITEMS_UPDATE_STATUS, {
      id: item.id,
      status: done ? "done" : "open",
    });
    await refresh();
  };

  const filtered = useMemo(() => {
    const txt = filters.text.trim().toLowerCase();
    return items.filter((a) => {
      if (filters.owner !== "all" && a.ownerSide !== filters.owner) return false;
      if (filters.status === "open_or_in_progress") {
        if (a.status !== "open" && a.status !== "in_progress") return false;
      } else if (filters.status !== "all" && a.status !== filters.status) {
        return false;
      }
      if (filters.investorId !== "all" && a.entityId !== filters.investorId)
        return false;
      if (txt) {
        const entityName = entityById.get(a.entityId)?.name?.toLowerCase() ?? "";
        const desc = a.description.toLowerCase();
        if (!desc.includes(txt) && !entityName.includes(txt)) return false;
      }
      return true;
    });
  }, [items, filters, entityById]);

  const sorted = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "investor":
          cmp = (entityById.get(a.entityId)?.name ?? "").localeCompare(
            entityById.get(b.entityId)?.name ?? "",
          );
          break;
        case "owner":
          cmp = a.ownerSide.localeCompare(b.ownerSide);
          break;
        case "description":
          cmp = a.description.localeCompare(b.description);
          break;
        case "due":
          cmp = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "source":
          cmp = (a.sourceDate ?? "").localeCompare(b.sourceDate ?? "");
          break;
        case "updated":
          cmp = a.updatedAt.localeCompare(b.updatedAt);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filtered, sortKey, sortDir, entityById]);

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const arrow = (key: SortKey): string =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const headerStyle: React.CSSProperties = { cursor: "pointer", userSelect: "none" };

  return (
    <div>
      <h2>Actions</h2>
      <div className="muted" style={{ marginBottom: 12 }}>
        All action items across all investors. Filter by column or click a
        header to sort.
      </div>

      <div className="card">
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Search description / investor</label>
            <input
              value={filters.text}
              onChange={(e) => setFilters({ ...filters, text: e.target.value })}
              placeholder="filter by text..."
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Investor</label>
            <select
              value={filters.investorId}
              onChange={(e) =>
                setFilters({ ...filters, investorId: e.target.value })
              }
            >
              <option value="all">All</option>
              {entities
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Owner</label>
            <select
              value={filters.owner}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  owner: e.target.value as Filters["owner"],
                })
              }
            >
              <option value="all">All</option>
              <option value="us">us</option>
              <option value="them">them</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as Filters["status"],
                })
              }
            >
              <option value="open_or_in_progress">Open + in progress</option>
              <option value="all">All</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="done">done</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <div style={{ flex: "0 0 auto", alignSelf: "end" }}>
            <button
              className="btn secondary"
              onClick={() => setFilters(defaultFilters)}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card muted">No action items match.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>Done</th>
              <th onClick={() => toggleSort("investor")} style={headerStyle}>
                Investor{arrow("investor")}
              </th>
              <th onClick={() => toggleSort("owner")} style={headerStyle}>
                Owner{arrow("owner")}
              </th>
              <th onClick={() => toggleSort("description")} style={headerStyle}>
                Description{arrow("description")}
              </th>
              <th onClick={() => toggleSort("due")} style={headerStyle}>
                Due{arrow("due")}
              </th>
              <th onClick={() => toggleSort("status")} style={headerStyle}>
                Status{arrow("status")}
              </th>
              <th onClick={() => toggleSort("source")} style={headerStyle}>
                Source email{arrow("source")}
              </th>
              <th onClick={() => toggleSort("updated")} style={headerStyle}>
                Updated{arrow("updated")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const entity = entityById.get(a.entityId);
              const completed = a.status === "done" || a.status === "cancelled";
              return (
                <tr key={a.id} style={{ cursor: "pointer" }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => void toggleDone(a, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: "auto" }}
                    />
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {entity?.name ?? "—"}
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {a.ownerSide}
                  </td>
                  <td
                    onClick={() => navigate(`/investors/${a.entityId}`)}
                    style={
                      completed ? { textDecoration: "line-through", color: "var(--muted)" } : {}
                    }
                  >
                    {a.description}
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {a.dueDate ?? "—"}
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {a.status}
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {a.sourceDate
                      ? new Date(a.sourceDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td onClick={() => navigate(`/investors/${a.entityId}`)}>
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
