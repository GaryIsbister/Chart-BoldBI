import { useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { PendingReviewView } from "./views/PendingReview";
import { Entities } from "./views/Entities";
import { SettingsView } from "./views/Settings";

type View = "dashboard" | "pending" | "entities" | "settings";

export const App = (): JSX.Element => {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Investor Tracker</h1>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={view === "pending" ? "active" : ""} onClick={() => setView("pending")}>
            Pending Review
          </button>
          <button className={view === "entities" ? "active" : ""} onClick={() => setView("entities")}>
            Entities
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>
      </aside>
      <main className="main">
        {view === "dashboard" && <Dashboard />}
        {view === "pending" && <PendingReviewView />}
        {view === "entities" && <Entities />}
        {view === "settings" && <SettingsView />}
      </main>
    </div>
  );
};
