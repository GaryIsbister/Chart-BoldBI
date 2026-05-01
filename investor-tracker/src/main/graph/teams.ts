import { graphFetch } from "./client";
import { getCursor, setCursor } from "../store/repositories/cursors";
import {
  findMessageByExternalId,
  insertMessage,
  upsertThread,
} from "../store/repositories/messages";
import type { Message } from "@shared/types";
import { getSignedInAccount } from "./auth";

interface GraphChat {
  id: string;
  topic: string | null;
  lastUpdatedDateTime: string;
}

interface GraphChatMessage {
  id: string;
  chatId: string;
  createdDateTime: string;
  body?: { content: string; contentType: string };
  from?: {
    user?: { id: string; displayName?: string; userIdentityType?: string };
  };
}

interface GraphPage<T> {
  value: T[];
  ["@odata.nextLink"]?: string;
}

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const teamsCursorKey = (chatId: string): string => `teams:${chatId}:lastCreatedDateTime`;

export const fetchTeamsDelta = async (): Promise<Message[]> => {
  const accountEmail = (await getSignedInAccount())?.toLowerCase() ?? null;
  const inserted: Message[] = [];

  const chats = await graphFetch<GraphPage<GraphChat>>("/me/chats?$top=50");
  const skippedChats: string[] = [];
  for (const chat of chats.value) {
    const since = getCursor(teamsCursorKey(chat.id));
    const filter = since
      ? `&$filter=${encodeURIComponent(`createdDateTime gt ${since}`)}`
      : "";
    let url: string | null =
      `/me/chats/${encodeURIComponent(chat.id)}/messages?$top=50${filter}`;
    let pages = 0;
    let newestSeen: string | null = null;

    try {
    while (url && pages < 3) {
      const page: GraphPage<GraphChatMessage> = await graphFetch<GraphPage<GraphChatMessage>>(url);
      for (const msg of page.value) {
        if (!newestSeen || msg.createdDateTime > newestSeen) {
          newestSeen = msg.createdDateTime;
        }
        if (findMessageByExternalId("teams_chat", msg.id)) continue;
        if (!msg.from?.user) continue;

        const userId = msg.from.user.id;
        const fromName = msg.from.user.displayName ?? null;
        const fakeEmail = `${userId}@teams.local`;
        const isFromUs = accountEmail !== null && fromName?.toLowerCase() === accountEmail;
        const bodyContent = msg.body?.content ?? "";
        const preview =
          msg.body?.contentType === "html" ? stripHtml(bodyContent) : bodyContent;

        const thread = upsertThread({
          source: "teams_chat",
          externalConversationId: chat.id,
          subject: chat.topic,
          lastMessageAt: msg.createdDateTime,
        });

        const stored = insertMessage({
          source: "teams_chat",
          externalId: msg.id,
          threadId: thread.id,
          contactId: null,
          entityId: null,
          fromEmail: fakeEmail,
          fromName,
          toEmails: [],
          subject: chat.topic,
          bodyPreview: preview.slice(0, 500),
          receivedAt: msg.createdDateTime,
          isFromUs,
          raw: msg,
        });
        inserted.push(stored);
      }
      url = page["@odata.nextLink"] ?? null;
      pages += 1;
    }
    if (newestSeen) setCursor(teamsCursorKey(chat.id), newestSeen);
    } catch (e) {
      const message = (e as Error).message ?? "";
      if (message.includes("403") || message.includes("404")) {
        skippedChats.push(chat.id);
        continue;
      }
      throw e;
    }
  }
  if (skippedChats.length > 0) {
    console.log(`[teams] skipped ${skippedChats.length} inaccessible chats (403/404)`);
  }
  return inserted;
};
