import { useEffect, useState } from "react";
import { invoke } from "../api";
import { IPC_CHANNELS, type AuthStatus } from "@shared/ipc";
import type { Settings as SettingsType } from "@shared/types";

export const Settings = (): JSX.Element => {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [signInMessage, setSignInMessage] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const refresh = async (): Promise<void> => {
    const [s, a] = await Promise.all([
      invoke<SettingsType>(IPC_CHANNELS.SETTINGS_GET),
      invoke<AuthStatus>(IPC_CHANNELS.AUTH_STATUS),
    ]);
    setSettings(s);
    setAuth(a);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const update = async (patch: Partial<SettingsType>): Promise<void> => {
    setSaving(true);
    try {
      const s = await invoke<SettingsType>(IPC_CHANNELS.SETTINGS_UPDATE, patch);
      setSettings(s);
    } finally {
      setSaving(false);
    }
  };

  const saveApiKey = async (): Promise<void> => {
    await invoke(IPC_CHANNELS.AUTH_SET_ANTHROPIC_KEY, apiKey);
    setApiKey("");
    await refresh();
  };

  const signIn = async (): Promise<void> => {
    setSignInMessage("Starting device-code flow...");
    try {
      const result = await invoke<{ account: string }>(IPC_CHANNELS.AUTH_SIGN_IN);
      setSignInMessage(`Signed in as ${result.account}`);
      await refresh();
    } catch (e) {
      setSignInMessage(`Sign-in failed: ${(e as Error).message}`);
    }
  };

  const signOut = async (): Promise<void> => {
    await invoke(IPC_CHANNELS.AUTH_SIGN_OUT);
    await refresh();
  };

  if (!settings || !auth) return <div>Loading...</div>;

  return (
    <div>
      <h2>Settings</h2>

      <div className="card">
        <h3>Microsoft account</h3>
        {auth.microsoftSignedIn ? (
          <>
            <div className="muted">Signed in as {auth.microsoftAccount}</div>
            <button className="btn secondary" onClick={() => void signOut()} style={{ marginTop: 8 }}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => void signIn()}>Sign in to Microsoft</button>
            <p className="muted">{signInMessage}</p>
          </>
        )}
      </div>

      <div className="card">
        <h3>Anthropic API key</h3>
        <div className="muted">
          {auth.hasAnthropicKey ? "An API key is configured." : "No API key set."}
        </div>
        <div className="form-group" style={{ marginTop: 8 }}>
          <label>API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>
        <button className="btn" disabled={!apiKey} onClick={() => void saveApiKey()}>
          Save key
        </button>
      </div>

      <div className="card">
        <h3>Polling</h3>
        <div className="form-group">
          <label>Poll interval (minutes)</label>
          <input
            type="number"
            min={1}
            value={settings.pollIntervalMinutes}
            onChange={(e) => void update({ pollIntervalMinutes: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="form-group">
          <label>Watched folders (comma separated)</label>
          <input
            value={settings.watchedFolders.join(", ")}
            onChange={(e) =>
              void update({
                watchedFolders: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="card">
        <h3>Classifier</h3>
        <div className="form-group">
          <label>Classifier model</label>
          <input
            value={settings.classifierModel}
            onChange={(e) => void update({ classifierModel: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Synthesis model</label>
          <input
            value={settings.synthesisModel}
            onChange={(e) => void update({ synthesisModel: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Pending review threshold (0–1)</label>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={settings.pendingReviewThreshold}
            onChange={(e) => void update({ pendingReviewThreshold: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="form-group">
          <label>Daily classifier hour (local, 0–23)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.dailyClassifierHourLocal}
            onChange={(e) => void update({ dailyClassifierHourLocal: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="form-group">
          <label>Demand book sender email</label>
          <input
            value={settings.demandBookSenderEmail}
            onChange={(e) => void update({ demandBookSenderEmail: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h3>Microsoft app registration</h3>
        <div className="form-group">
          <label>Client ID</label>
          <input
            value={settings.microsoftClientId ?? ""}
            onChange={(e) => void update({ microsoftClientId: e.target.value || null })}
          />
        </div>
        <div className="form-group">
          <label>Tenant ID</label>
          <input
            value={settings.microsoftTenantId}
            onChange={(e) => void update({ microsoftTenantId: e.target.value })}
          />
        </div>
      </div>

      {saving && <div className="muted">Saving...</div>}
    </div>
  );
};
