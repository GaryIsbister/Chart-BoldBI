import { getGraphClient } from "./client.js";

export type GraphMailMessage = {
  id: string;
  conversationId: string;
  subject: string | null;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from?: { emailAddress: { address: string; name: string } };
  toRecipients?: { emailAddress: { address: string; name: string } }[];
  receivedDateTime: string;
  isDraft: boolean;
  parentFolderId?: string;
};

type DeltaResult<T> = {
  value: T[];
  "@odata.deltaLink"?: string;
  "@odata.nextLink"?: string;
};

const MESSAGE_SELECT =
  "id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isDraft,parentFolderId";

export async function findFolderIdByName(name: string): Promise<string | null> {
  const client = getGraphClient();
  type Folder = { id: string; displayName: string };
  const res = (await client
    .api("/me/mailFolders")
    .top(50)
    .get()) as { value: Folder[] };
  const match = res.value.find(
    (f) => f.displayName.toLowerCase() === name.toLowerCase(),
  );
  return match?.id ?? null;
}

async function followDelta(
  initialUrl: string,
): Promise<{ messages: GraphMailMessage[]; deltaLink: string | null }> {
  const client = getGraphClient();
  const messages: GraphMailMessage[] = [];
  let url: string | null = initialUrl;
  let deltaLink: string | null = null;

  while (url) {
    const page = (await client.api(url).get()) as DeltaResult<GraphMailMessage>;
    messages.push(...(page.value ?? []));
    if (page["@odata.nextLink"]) {
      url = page["@odata.nextLink"];
    } else {
      deltaLink = page["@odata.deltaLink"] ?? null;
      url = null;
    }
  }
  return { messages, deltaLink };
}

export async function deltaInbox(prevDeltaLink: string | null): Promise<{
  messages: GraphMailMessage[];
  deltaLink: string | null;
}> {
  const initial =
    prevDeltaLink ?? `/me/mailFolders/Inbox/messages/delta?$select=${MESSAGE_SELECT}`;
  return followDelta(initial);
}

export async function deltaFolder(
  folderId: string,
  prevDeltaLink: string | null,
): Promise<{ messages: GraphMailMessage[]; deltaLink: string | null }> {
  const initial =
    prevDeltaLink ??
    `/me/mailFolders/${folderId}/messages/delta?$select=${MESSAGE_SELECT}`;
  return followDelta(initial);
}

export async function searchMessagesFromSender(
  senderEmail: string,
  top = 5,
): Promise<GraphMailMessage[]> {
  const client = getGraphClient();
  const res = (await client
    .api("/me/messages")
    .filter(`from/emailAddress/address eq '${senderEmail.replace(/'/g, "''")}'`)
    .orderby("receivedDateTime desc")
    .top(top)
    .select(MESSAGE_SELECT)
    .get()) as { value: GraphMailMessage[] };
  return res.value ?? [];
}

export async function getAttachmentBytes(
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const client = getGraphClient();
  const att = (await client
    .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
    .get()) as { contentBytes?: string; "@odata.type"?: string };
  if (!att.contentBytes) throw new Error("Attachment has no contentBytes");
  return Buffer.from(att.contentBytes, "base64");
}

export async function listAttachments(
  messageId: string,
): Promise<{ id: string; name: string; contentType: string; size: number }[]> {
  const client = getGraphClient();
  const res = (await client
    .api(`/me/messages/${messageId}/attachments`)
    .select("id,name,contentType,size")
    .get()) as { value: { id: string; name: string; contentType: string; size: number }[] };
  return res.value ?? [];
}
