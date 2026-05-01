import { useEffect, useState } from "react";
import type { Contact, Entity } from "../../../shared/types.js";

export function ContactsView(): JSX.Element {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  async function load(): Promise<void> {
    setContacts(await window.investorTracker.invoke("contacts:list"));
    setEntities(await window.investorTracker.invoke("entities:list"));
  }

  useEffect(() => {
    void load();
  }, []);

  function entityName(id: string | null): string {
    if (!id) return "—";
    return entities.find((e) => e.id === id)?.name ?? id;
  }

  return (
    <div className="card">
      <h3>Contacts</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email / Teams ID</th>
            <th>Entity</th>
            <th>First seen</th>
            <th>Last seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id}>
              <td>{c.displayName}</td>
              <td className="muted">{c.email ?? c.teamsUserId ?? ""}</td>
              <td>{entityName(c.entityId)}</td>
              <td className="muted">
                {new Date(c.firstSeenAt).toLocaleDateString()}
              </td>
              <td className="muted">
                {new Date(c.lastSeenAt).toLocaleDateString()}
              </td>
              <td>
                <select
                  value={c.entityId ?? ""}
                  onChange={async (ev) => {
                    const v = ev.target.value || null;
                    await window.investorTracker.invoke(
                      "contacts:assignToEntity",
                      { contactId: c.id, entityId: v },
                    );
                    await load();
                  }}
                >
                  <option value="">— unassigned —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No contacts yet. Run a poll to ingest mail and Teams chats.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
