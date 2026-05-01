import { useEffect, useState } from "react";

export function SettingsView(): JSX.Element {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  async function refresh(): Promise<void> {
    setHasKey(
      await window.investorTracker.invoke("settings:getClaudeKeyPresent"),
    );
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h3>Anthropic API key</h3>
      <p className="muted">
        Stored in your OS keychain. Used for the daily classifier and demand-book
        parser. The <code>ANTHROPIC_API_KEY</code> env var, if set, takes
        precedence.
      </p>
      <div className="row">
        <input
          className="input"
          type="password"
          value={draft}
          placeholder={hasKey ? "(key stored — overwrite)" : "sk-ant-…"}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn"
          disabled={!draft}
          onClick={async () => {
            await window.investorTracker.invoke(
              "settings:setClaudeKey",
              draft,
            );
            setDraft("");
            setMsg("Saved.");
            await refresh();
          }}
        >
          Save
        </button>
        <span className="muted">
          {msg || (hasKey ? "Key on file." : "No key on file.")}
        </span>
      </div>
    </div>
  );
}
