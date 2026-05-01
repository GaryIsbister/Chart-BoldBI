import { useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { Entities } from "./views/Entities";
import { PendingReview } from "./views/PendingReview";
import { Settings } from "./views/Settings";

type View = "dashboard" | "entities" | "pending" | "settings";

export const App = () => {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Investor Tracker</h1>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Dashboard</button>
          <button className={view === "entities" ? "active" : ""} onClick={() => setView("entities")}>Entities</button>
          <button className={view === "pending" ? "active" : ""} onClick={() => setView("pending")}>Pending review</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>Settings</button>
        </nav>
      </aside>
      <main className="main">
        {view === "dashboard" && <Dashboard />}
        {view === "entities" && <Entities />}
        {view === "pending" && <PendingReview />}
        {view === "settings" && <Settings />}
      </main>
    </div>
  );
};
