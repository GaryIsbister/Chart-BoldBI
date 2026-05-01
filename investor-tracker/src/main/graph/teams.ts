import { graph } from "./client";
import type { MessageInput } from "../store/repositories/messages";

type Chat = { id: string; topic: string | null; lastUpdatedDateTime: string };

type ChatMessage = {
  id: string;
  chatId?: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  body?: { content?: string; contentType?: string };
  from?: { user?: { id?: string; displayName?: string }; emailAddress?: { address?: string } };
  importance?: string;
};

const stripHtml = (s: string): string =>
  s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export const fetchTeamsMessagesSince = async (
  meId: string,
  meEmail: string,
  sinceIso: string,
): Promise<MessageInput[]> => {
  const client = graph();
  const chatsResp: { value: Chat[] } = await client
    .api("/me/chats?$top=50&$orderby=lastUpdatedDateTime desc")
    .get();
  const out: MessageInput[] = [];
  for (const chat of chatsResp.value) {
    if (chat.lastUpdatedDateTime < sinceIso) continue;
    const filter = `lastModifiedDateTime gt ${sinceIso}`;
    let url:
      | string
      | null = `/me/chats/${chat.id}/messages?$top=50&$filter=${encodeURIComponent(filter)}`;
    while (url) {
      const resp: { value: ChatMessage[]; "@odata.nextLink"?: string } =
        await client.api(url).get();
      for (const m of resp.value) {
        const fromEmail =
          m.from?.emailAddress?.address ??
          (m.from?.user?.id === meId ? meEmail : "");
        if (!fromEmail) continue;
        const body = m.body?.content ?? "";
        const preview = stripHtml(body).slice(0, 500);
        out.push({
          source: "teams_chat",
          externalId: m.id,
          externalConversationId: chat.id,
          fromEmail,
          fromName: m.from?.user?.displayName ?? null,
          toEmails: [],
          subject: chat.topic,
          bodyPreview: preview,
          receivedAt: m.createdDateTime,
          isFromUs: m.from?.user?.id === meId,
          raw: m,
        });
      }
      url = resp["@odata.nextLink"] ?? null;
    }
  }
  return out;
};

export const getMyId = async (): Promise<string> => {
  const client = graph();
  const me: { id: string } = await client.api("/me?$select=id").get();
  return me.id;
};
