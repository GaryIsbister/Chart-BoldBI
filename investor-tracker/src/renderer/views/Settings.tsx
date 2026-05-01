import { useEffect, useState } from "react";
import { api } from "../api";
import type { AuthStatus, DeviceCodeChallenge } from "@shared/ipc";
import type { Settings as SettingsT } from "@shared/types";

export const Settings = () => {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [challenge, setChallenge] = useState<DeviceCodeChallenge | null>(null);
  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const refresh = async () => {
    setAuth(await api.authStatus());
    setSettings(await api.getSettings());
    setHasKey(await api.hasAnthropicKey());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const startSignIn = async () => {
    setChallenge(null);
    const c = await api.authStartDeviceCode();
    setChallenge(c);
    const poll = setInterval(async () => {
      const status = await api.authStatus();
      if (status.signedIn) {
        clearInterval(poll);
        setChallenge(null);
        setAuth(status);
      }
    }, 3000);
  };

  const signOut = async () => {
    await api.authSignOut();
    await refresh();
  };

  const saveKey = async () => {
    if (!keyDraft) return;
    setSavingKey(true);
    try {
      await api.setAnthropicKey(keyDraft);
      setKeyDraft("");
      setHasKey(true);
    } finally {
      setSavingKey(false);
    }
  };

  const updateSetting = async <K extends keyof SettingsT>(key: K, value: SettingsT[K]) => {
    if (!settings) return;
    const next = await api.updateSettings({ [key]: value } as Partial<SettingsT>);
    setSettings(next);
  };

  if (!settings) return <p className="muted">Loading…</p>;

  return (
    <>
      <h2>Settings</h2>

      <div className="card">
        <h3>Microsoft account</h3>
        {auth?.signedIn ? (
          <div className="row between">
            <div>
              Signed in as <strong>{auth.account?.name ?? auth.account?.username}</strong>{" "}
              <span className="muted">({auth.account?.username})</span>
            </div>
            <button onClick={() => void signOut()}>Sign out</button>
          </div>
        ) : challenge ? (
          <div>
            <p>
              Open <a href={challenge.verificationUri} target="_blank" rel="noreferrer">{challenge.verificationUri}</a>{" "}
              and enter code <strong>{challenge.userCode}</strong>.
            </p>
            <p className="muted">Expires {new Date(challenge.expiresAt).toLocaleTimeString()}.</p>
          </div>
        ) : (
          <button className="primary" onClick={() => void startSignIn()}>
            Sign in with Microsoft
          </button>
        )}
      </div>

      <div className="card">
        <h3>Anthropic API key</h3>
        <p className="muted">
          {hasKey ? "A key is stored in your OS keychain." : "No key configured. Classifier will be disabled."}
        </p>
        <div className="row">
          <input
            type="password"
            placeholder="sk-ant-..."
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <button className="primary" onClick={() => void saveKey()} disabled={savingKey || !keyDraft}>
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Polling</h3>
        <label>
          Poll interval (minutes)
          <input
            type="number"
            min={1}
            value={settings.pollIntervalMinutes}
            onChange={(e) => void updateSetting("pollIntervalMinutes", Number(e.target.value))}
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Watched mail folders (comma separated)
          <input
            value={settings.watchedFolders.join(", ")}
            onChange={(e) =>
              void updateSetting(
                "watchedFolders",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Pending review threshold (0–1)
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={settings.pendingReviewThreshold}
            onChange={(e) => void updateSetting("pendingReviewThreshold", Number(e.target.value))}
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Daily classifier hour (local 0–23)
          <input
            type="number"
            min={0}
            max={23}
            value={settings.dailyClassifierHourLocal}
            onChange={(e) => void updateSetting("dailyClassifierHourLocal", Number(e.target.value))}
          />
        </label>
      </div>

      <div className="card">
        <h3>Models</h3>
        <label>
          Classifier model
          <input
            value={settings.classifierModel}
            onChange={(e) => void updateSetting("classifierModel", e.target.value)}
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Synthesis model
          <input
            value={settings.synthesisModel}
            onChange={(e) => void updateSetting("synthesisModel", e.target.value)}
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          Demand-book sender email
          <input
            value={settings.demandBookSenderEmail}
            onChange={(e) => void updateSetting("demandBookSenderEmail", e.target.value)}
          />
        </label>
      </div>
    </>
  );
};
