import type Database from "better-sqlite3";
import type { Client } from "@microsoft/microsoft-graph-client";
import { fetchFolderDelta, fetchInboxDelta, getSignedInEmail, type NormalizedMessage } from "../graph/mail";
import { fetchTeamsChats } from "../graph/teams";
import { CursorsRepo } from "../store/repositories/cursors";
import { MessagesRepo } from "../store/repositories/messages";
import { ContactsRepo } from "../store/repositories/contacts";
import { SettingsRepo } from "../store/repositories/settings";

export interface PollerResult {
  fetched: number;
  newSenders: number;
}

export const runPoller = async (db: Database.Database, client: Client): Promise<PollerResult> => {
  const cursors = new CursorsRepo(db);
  const messagesRepo = new MessagesRepo(db);
  const contactsRepo = new ContactsRepo(db);
  const settings = new SettingsRepo(db).get();

  const me = await getSignedInEmail(client);
  let fetched = 0;
  const seenSenders = new Set<string>();

  const ingest = (source: "outlook_mail" | "teams_chat", batch: NormalizedMessage[]): void => {
    for (const m of batch) {
      const thread = messagesRepo.upsertThread({
        source,
        externalConversationId: m.conversationId,
        subject: m.subject,
        lastMessageAt: m.receivedAt,
      });
      const existingContact = contactsRepo.findByEmail(m.fromEmail);
      messagesRepo.upsertMessage({
        source,
        externalId: m.externalId,
        threadId: thread.id,
        contactId: existingContact?.id ?? null,
        entityId: existingContact?.entityId ?? null,
        fromEmail: m.fromEmail,
        fromName: m.fromName,
        toEmails: m.toEmails,
        subject: m.subject,
        bodyPreview: m.bodyPreview,
        receivedAt: m.receivedAt,
        isFromUs: m.isFromUs,
      });
      if (!m.isFromUs && !existingContact) seenSenders.add(m.fromEmail);
      fetched += 1;
    }
  };

  for (const folder of settings.watchedFolders) {
    const cursorKey = `outlook:${folder}`;
    const cursor = cursors.get(cursorKey);
    const result =
      folder.toLowerCase() === "inbox"
        ? await fetchInboxDelta(client, me, cursor)
        : await fetchFolderDelta(client, folder, me, cursor);
    ingest("outlook_mail", result.messages);
    if (result.deltaLink) cursors.set(cursorKey, result.deltaLink);
  }

  const teamsCursor = cursors.get("teams:chats");
  const teams = await fetchTeamsChats(client, me, teamsCursor);
  ingest("teams_chat", teams.messages);
  if (teams.cursor) cursors.set("teams:chats", teams.cursor);

  return { fetched, newSenders: seenSenders.size };
};
