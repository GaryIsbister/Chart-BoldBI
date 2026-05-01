import { useEffect, useState } from "react";
import { api } from "../api";
import type { ActionItem, Entity, PipelineStage } from "@shared/types";
import { PIPELINE_STAGES } from "@shared/types";

export const Dashboard = (): JSX.Element => {
  const [openItems, setOpenItems] = useState<ActionItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    void api.invoke("actionItems:list", { status: "open" }).then(setOpenItems);
    void api.invoke("entities:list", undefined).then(setEntities);
  }, []);

  const usOwes = openItems.filter((i) => i.ownerSide === "us");
  const theyOwe = openItems.filter((i) => i.ownerSide === "them");
  const byStage: Record<PipelineStage, Entity[]> = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, [] as Entity[]]),
  ) as Record<PipelineStage, Entity[]>;
  for (const e of entities) byStage[e.pipelineStage].push(e);

  return (
    <>
      <h2>Dashboard</h2>

      <section>
        <h3>Outstanding items</h3>
        <div className="card">
          <div className="row">
            <strong>We owe ({usOwes.length})</strong>
          </div>
          {usOwes.length === 0 && <div className="muted">Nothing outstanding.</div>}
          {usOwes.map((i) => (
            <div key={i.id} className="row" style={{ marginTop: 8 }}>
              <span>
                <span className="tag us">us</span> {i.description}
              </span>
              <span className="muted">{i.dueDate ?? ""}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row">
            <strong>They owe ({theyOwe.length})</strong>
          </div>
          {theyOwe.length === 0 && <div className="muted">Nothing outstanding.</div>}
          {theyOwe.map((i) => (
            <div key={i.id} className="row" style={{ marginTop: 8 }}>
              <span>
                <span className="tag them">them</span> {i.description}
              </span>
              <span className="muted">{i.dueDate ?? ""}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Pipeline overview</h3>
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="card">
            <div className="row">
              <strong style={{ textTransform: "capitalize" }}>{stage.replace("_", " ")}</strong>
              <span className="muted">{byStage[stage].length}</span>
            </div>
            {byStage[stage].slice(0, 5).map((e) => (
              <div key={e.id} className="row" style={{ marginTop: 6 }}>
                <span>{e.name}</span>
                {e.parkedUntil && <span className="muted">revisit {e.parkedUntil.slice(0, 10)}</span>}
              </div>
            ))}
          </div>
        ))}
      </section>
    </>
  );
};
