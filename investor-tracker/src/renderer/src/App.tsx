import { useEffect, useState } from "react";
import { EntitiesView } from "./views/EntitiesView.js";
import { ContactsView } from "./views/ContactsView.js";
import { ThreadsView } from "./views/ThreadsView.js";
import { InboxView } from "./views/InboxView.js";
import { SettingsView } from "./views/SettingsView.js";
import type { AuthStatus, PollerStatus } from "../../shared/types.js";

type Tab = "inbox" | "entities" | "contacts" | "threads" | "settings";

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>("inbox");
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [pollStatus, setPollStatus] = useState<PollerStatus | null>(null);

  async function refresh(): Promise<void> {
    setAuth(await window.investorTracker.invoke("auth:status"));
    setPollStatus(await window.investorTracker.invoke("jobs:status"));
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Investor Tracker</div>
        <nav>
          {(["inbox", "entities", "contacts", "threads", "settings"] as Tab[]).map(
            (t) => (
              <button
                key={t}
                className={tab === t ? "tab active" : "tab"}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        <div className="status">
          {auth?.signedIn ? (
            <span>
              {auth.account?.username}{" "}
              <button onClick={async () => {
                await window.investorTracker.invoke("auth:signOut");
                void refresh();
              }}>sign out</button>
            </span>
          ) : (
            <button onClick={async () => {
              await window.investorTracker.invoke("auth:signIn");
              void refresh();
            }}>Sign in to Microsoft</button>
          )}
          <span className="poll">
            {pollStatus?.lastRunAt
              ? `last poll ${new Date(pollStatus.lastRunAt).toLocaleTimeString()}`
              : "never polled"}
            {pollStatus?.lastRunOk === false ? " (error)" : ""}
          </span>
        </div>
      </header>
      <main>
        {tab === "inbox" && <InboxView />}
        {tab === "entities" && <EntitiesView />}
        {tab === "contacts" && <ContactsView />}
        {tab === "threads" && <ThreadsView />}
        {tab === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
