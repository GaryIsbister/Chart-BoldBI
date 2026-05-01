import { useEffect, useState } from "react";
import { api } from "../api";
import type { Settings } from "@shared/types";

export const SettingsView = (): JSX.Element => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [authState, setAuthState] = useState<{ signedIn: boolean; account: string | null } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.invoke("settings:get", undefined).then(setSettings);
    void api.invoke("auth:status", undefined).then(setAuthState);
  }, []);

  if (!settings) return <div className="muted">Loading...</div>;

  const update = async (patch: Partial<Settings>): Promise<void> => {
    setBusy(true);
    try {
      const next = await api.invoke("settings:update", patch);
      setSettings(next);
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async (): Promise<void> => {
    if (!apiKey) return;
    setBusy(true);
    try {
      await api.invoke("settings:setAnthropicKey", { apiKey });
      setApiKey("");
      alert("Anthropic API key stored in OS keychain.");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await api.invoke("auth:signIn", undefined);
      setAuthState(result);
    } catch (e) {
      alert(`Sign-in failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const importDemandBook = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await api.invoke("jobs:importDemandBook", {});
      alert(`Imported ${r.entries} demand-book entries.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Settings</h2>

      <div className="card">
        <h3>Microsoft account</h3>
        {authState?.signedIn ? (
          <div>Signed in as <strong>{authState.account}</strong></div>
        ) : (
          <button className="primary" disabled={busy || !settings.microsoftClientId} onClick={signIn}>
            Sign in with Microsoft
          </button>
        )}
        <div className="muted" style={{ marginTop: 8 }}>
          Requires an Azure AD app registration (delegated <code>Mail.Read</code>, <code>Chat.Read</code>, <code>User.Read</code>) with a public-client redirect URI of <code>http://localhost:53682/redirect</code>.
        </div>
      </div>

      <div className="card">
        <h3>Microsoft client ID</h3>
        <input
          value={settings.microsoftClientId ?? ""}
          onChange={(e) => update({ microsoftClientId: e.target.value })}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </div>

      <div className="card">
        <h3>Microsoft tenant ID</h3>
        <input
          value={settings.microsoftTenantId}
          onChange={(e) => update({ microsoftTenantId: e.target.value })}
          placeholder="Directory (tenant) ID GUID, or 'common' for multi-tenant"
        />
        <div className="muted" style={{ marginTop: 8 }}>
          For a single-tenant app registration, paste the Directory (tenant) ID GUID from the app's Overview page. Use <code>common</code> only for multi-tenant apps.
        </div>
      </div>

      <div className="card">
        <h3>Anthropic API key</h3>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
        />
        <button className="primary" style={{ marginTop: 8 }} disabled={busy} onClick={saveKey}>
          Save key
        </button>
      </div>

      <div className="card">
        <h3>Polling</h3>
        <label>
          Interval (minutes):{" "}
          <input
            type="number"
            min={1}
            value={settings.pollIntervalMinutes}
            onChange={(e) => update({ pollIntervalMinutes: Number(e.target.value) })}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          Watched folders: {settings.watchedFolders.join(", ")}
        </div>
      </div>

      <div className="card">
        <h3>Classifier threshold</h3>
        <label>
          Minimum confidence to surface for review:{" "}
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={settings.pendingReviewThreshold}
            onChange={(e) => update({ pendingReviewThreshold: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="card">
        <h3>Demand book</h3>
        <label>
          Sender email:{" "}
          <input
            value={settings.demandBookSenderEmail}
            onChange={(e) => update({ demandBookSenderEmail: e.target.value })}
          />
        </label>
        <button className="primary" style={{ marginTop: 8 }} disabled={busy} onClick={importDemandBook}>
          Import latest demand book
        </button>
        <div className="muted" style={{ marginTop: 8 }}>
          Searches Outlook for the latest message from this sender, parses the attached demand book with Claude, and seeds the classifier context.
        </div>
      </div>
    </>
  );
};
