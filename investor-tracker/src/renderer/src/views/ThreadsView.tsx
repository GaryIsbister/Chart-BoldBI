import { useEffect, useState } from "react";
import type { Message, Thread } from "../../../shared/types.js";

export function ThreadsView(): JSX.Element {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    void (async () => {
      setThreads(await window.investorTracker.invoke("threads:list"));
    })();
  }, []);

  async function open(t: Thread): Promise<void> {
    setActive(t);
    setMessages(await window.investorTracker.invoke("threads:messages", t.id));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1rem", height: "100%" }}>
      <div className="card" style={{ overflow: "auto" }}>
        <h3>Threads</h3>
        {threads.map((t) => (
          <div
            key={t.id}
            onClick={() => void open(t)}
            style={{
              padding: "0.4rem 0.5rem",
              borderRadius: 6,
              cursor: "pointer",
              background: active?.id === t.id ? "#eef2ff" : "transparent",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              {t.subject ?? "(no subject)"}
            </div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>
              {t.source} · {new Date(t.lastMessageAt).toLocaleString()}
            </div>
          </div>
        ))}
        {threads.length === 0 && (
          <div className="muted">No threads yet.</div>
        )}
      </div>
      <div className="card" style={{ overflow: "auto" }}>
        {active ? (
          <>
            <h3>{active.subject ?? "(no subject)"}</h3>
            {messages.map((m) => (
              <div key={m.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "0.5rem 0" }}>
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {m.fromAddress ?? "Teams user"} · {new Date(m.receivedAt).toLocaleString()}
                </div>
                <div dangerouslySetInnerHTML={{ __html: m.body }} />
              </div>
            ))}
          </>
        ) : (
          <div className="muted">Select a thread.</div>
        )}
      </div>
    </div>
  );
}
