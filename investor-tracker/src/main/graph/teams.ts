import type { Client } from "@microsoft/microsoft-graph-client";
import type { NormalizedMessage } from "./mail";

interface ChatsResult {
  messages: NormalizedMessage[];
  cursor: string | null;
}

interface ChatMessage {
  id: string;
  chatId: string;
  body?: { content?: string };
  subject?: string | null;
  createdDateTime: string;
  from?: { user?: { id?: string; displayName?: string; userPrincipalName?: string } };
}

const stripHtml = (s: string): string =>
  s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const fetchTeamsChats = async (
  client: Client,
  signedInEmail: string,
  sinceIso: string | null,
): Promise<ChatsResult> => {
  const filter = sinceIso ? `&$filter=lastUpdatedDateTime ge ${sinceIso}` : "";
  const chats = (await client.api(`/me/chats?$top=20${filter}`).get()) as {
    value?: Array<{ id: string; topic?: string | null }>;
  };

  const messages: NormalizedMessage[] = [];
  let latestSeen: string | null = sinceIso;

  for (const chat of chats.value ?? []) {
    const chatMessages = (await client
      .api(`/me/chats/${chat.id}/messages?$top=20${sinceIso ? `&$filter=createdDateTime ge ${sinceIso}` : ""}`)
      .get()) as { value?: ChatMessage[] };

    for (const m of chatMessages.value ?? []) {
      const fromUpn = m.from?.user?.userPrincipalName;
      const fromName = m.from?.user?.displayName ?? null;
      if (!fromUpn) continue;
      const body = stripHtml(m.body?.content ?? "");
      messages.push({
        externalId: `${m.chatId}/${m.id}`,
        conversationId: m.chatId,
        subject: chat.topic ?? null,
        bodyPreview: body.slice(0, 500),
        fromEmail: fromUpn.toLowerCase(),
        fromName,
        toEmails: [],
        receivedAt: m.createdDateTime,
        isFromUs: fromUpn.toLowerCase() === signedInEmail.toLowerCase(),
      });
      if (!latestSeen || m.createdDateTime > latestSeen) latestSeen = m.createdDateTime;
    }
  }

  return { messages, cursor: latestSeen };
};
