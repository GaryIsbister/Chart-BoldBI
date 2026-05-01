import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { Actions } from "./views/Actions";
import { Dashboard } from "./views/Dashboard";
import { Investors } from "./views/Investors";
import { InvestorDetail } from "./views/InvestorDetail";
import { PendingReview } from "./views/PendingReview";
import { Settings } from "./views/Settings";

export const App = (): JSX.Element => {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Investor Tracker</h1>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/investors">Investors</NavLink>
          <NavLink to="/actions">Actions</NavLink>
          <NavLink to="/pending">Pending Review</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/investors" element={<Investors />} />
          <Route path="/investors/:id" element={<InvestorDetail />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/pending" element={<PendingReview />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
};
