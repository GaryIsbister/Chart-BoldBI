import { getGraphClient } from "./client.js";

export type GraphChat = {
  id: string;
  topic: string | null;
  chatType: "oneOnOne" | "group" | "meeting";
  lastUpdatedDateTime: string;
};

export type GraphChatMessage = {
  id: string;
  chatId?: string;
  createdDateTime: string;
  body: { contentType: string; content: string };
  from?: {
    user?: { id: string; displayName: string; userIdentityType?: string };
  };
};

type Page<T> = { value: T[]; "@odata.nextLink"?: string };

export async function listChats(): Promise<GraphChat[]> {
  const client = getGraphClient();
  const out: GraphChat[] = [];
  let url: string | null =
    "/me/chats?$select=id,topic,chatType,lastUpdatedDateTime&$top=50";
  while (url) {
    const page = (await client.api(url).get()) as Page<GraphChat>;
    out.push(...(page.value ?? []));
    url = page["@odata.nextLink"] ?? null;
  }
  return out.filter((c) => c.chatType === "oneOnOne" || c.chatType === "group");
}

export async function listChatMessagesSince(
  chatId: string,
  sinceIso: string | null,
  topPerPage = 50,
): Promise<GraphChatMessage[]> {
  const client = getGraphClient();
  const out: GraphChatMessage[] = [];
  let url: string | null = `/me/chats/${chatId}/messages?$top=${topPerPage}`;
  while (url) {
    const page = (await client.api(url).get()) as Page<GraphChatMessage>;
    for (const m of page.value ?? []) {
      if (sinceIso && m.createdDateTime <= sinceIso) {
        return out;
      }
      out.push(m);
    }
    url = page["@odata.nextLink"] ?? null;
  }
  return out;
}
