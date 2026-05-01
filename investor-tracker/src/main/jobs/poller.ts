import { loadConfig } from "../config.js";
import {
  contactRepo,
  cursorRepo,
  messageRepo,
  threadRepo,
} from "../store/repositories.js";
import {
  deltaInbox,
  deltaFolder,
  findFolderIdByName,
  type GraphMailMessage,
} from "../graph/mail.js";
import { listChats, listChatMessagesSince } from "../graph/teams.js";
import type { PollerStatus } from "../../shared/types.js";

let status: PollerStatus = {
  running: false,
  lastRunAt: null,
  lastRunOk: null,
  lastError: null,
};

export function getPollerStatus(): PollerStatus {
  return { ...status };
}

export async function runPollerOnce(): Promise<PollerStatus> {
  if (status.running) return getPollerStatus();
  status = { ...status, running: true, lastError: null };
  try {
    await pollMail();
    await pollTeams();
    status = {
      running: false,
      lastRunAt: new Date().toISOString(),
      lastRunOk: true,
      lastError: null,
    };
  } catch (e) {
    status = {
      running: false,
      lastRunAt: new Date().toISOString(),
      lastRunOk: false,
      lastError: e instanceof Error ? e.message : String(e),
    };
  }
  return getPollerStatus();
}

async function pollMail(): Promise<void> {
  const cfg = loadConfig();

  await pollMailScope("inbox", null);

  const investorsFolderId = await findFolderIdByName(
    cfg.polling.investorsFolderName,
  );
  if (investorsFolderId) {
    await pollMailScope(`folder:${cfg.polling.investorsFolderName}`, investorsFolderId);
  }
}

async function pollMailScope(
  scope: string,
  folderId: string | null,
): Promise<void> {
  const cursor = cursorRepo.get("outlook", scope);
  const { messages, deltaLink } = folderId
    ? await deltaFolder(folderId, cursor?.deltaLink ?? null)
    : await deltaInbox(cursor?.deltaLink ?? null);

  for (const m of messages) {
    if (m.isDraft) continue;
    persistMailMessage(m);
  }
  cursorRepo.set({
    source: "outlook",
    scope,
    deltaLink,
    lastSyncedAt: new Date().toISOString(),
  });
}

function persistMailMessage(m: GraphMailMessage): void {
  const fromAddr = m.from?.emailAddress.address ?? null;
  const fromName = m.from?.emailAddress.name ?? fromAddr ?? "(unknown)";
  let contactId: string | null = null;
  if (fromAddr) {
    const contact = contactRepo.upsertByEmail({
      email: fromAddr,
      displayName: fromName,
      seenAt: m.receivedDateTime,
    });
    contactId = contact.id;
  }
  const thread = threadRepo.upsert({
    source: "outlook",
    externalId: m.conversationId,
    subject: m.subject,
    entityId: null,
    lastMessageAt: m.receivedDateTime,
  });
  messageRepo.upsert({
    threadId: thread.id,
    source: "outlook",
    externalId: m.id,
    fromContactId: contactId,
    fromAddress: fromAddr,
    body: m.body?.content ?? "",
    bodyPreview: m.bodyPreview ?? "",
    receivedAt: m.receivedDateTime,
    isOutbound: false,
  });
}

async function pollTeams(): Promise<void> {
  const chats = await listChats();
  for (const chat of chats) {
    const scope = `chat:${chat.id}`;
    const cursor = cursorRepo.get("teams", scope);
    const since = cursor?.lastSyncedAt ?? null;
    const messages = await listChatMessagesSince(chat.id, since);
    for (const m of messages) {
      const user = m.from?.user;
      let contactId: string | null = null;
      if (user) {
        const c = contactRepo.upsertByTeamsId({
          teamsUserId: user.id,
          displayName: user.displayName,
          email: null,
          seenAt: m.createdDateTime,
        });
        contactId = c.id;
      }
      const thread = threadRepo.upsert({
        source: "teams",
        externalId: chat.id,
        subject: chat.topic,
        entityId: null,
        lastMessageAt: m.createdDateTime,
      });
      messageRepo.upsert({
        threadId: thread.id,
        source: "teams",
        externalId: m.id,
        fromContactId: contactId,
        fromAddress: null,
        body: m.body?.content ?? "",
        bodyPreview: stripHtml(m.body?.content ?? "").slice(0, 200),
        receivedAt: m.createdDateTime,
        isOutbound: false,
      });
    }
    cursorRepo.set({
      source: "teams",
      scope,
      deltaLink: null,
      lastSyncedAt: new Date().toISOString(),
    });
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
