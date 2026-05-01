import type { Client } from "@microsoft/microsoft-graph-client";

export interface NormalizedMessage {
  externalId: string;
  conversationId: string;
  subject: string | null;
  bodyPreview: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  receivedAt: string;
  isFromUs: boolean;
}

const extractEmail = (
  recipient: { emailAddress?: { address?: string; name?: string } } | undefined,
): { email: string; name: string | null } | null => {
  const addr = recipient?.emailAddress?.address;
  if (!addr) return null;
  return { email: addr.toLowerCase(), name: recipient?.emailAddress?.name ?? null };
};

const normalize = (msg: Record<string, unknown>, signedInEmail: string): NormalizedMessage | null => {
  const from = extractEmail(msg["from"] as never);
  if (!from) return null;
  const to = ((msg["toRecipients"] as Array<Record<string, unknown>>) ?? [])
    .map((r) => extractEmail(r as never)?.email)
    .filter((e): e is string => !!e);
  return {
    externalId: msg["id"] as string,
    conversationId: (msg["conversationId"] as string) ?? (msg["id"] as string),
    subject: (msg["subject"] as string | null) ?? null,
    bodyPreview: (msg["bodyPreview"] as string) ?? "",
    fromEmail: from.email,
    fromName: from.name,
    toEmails: to,
    receivedAt: msg["receivedDateTime"] as string,
    isFromUs: from.email === signedInEmail.toLowerCase(),
  };
};

interface DeltaResult {
  messages: NormalizedMessage[];
  deltaLink: string | null;
}

const collectDelta = async (
  client: Client,
  initialUrl: string,
  signedInEmail: string,
): Promise<DeltaResult> => {
  const messages: NormalizedMessage[] = [];
  let url: string | null = initialUrl;
  let deltaLink: string | null = null;

  while (url) {
    const res = (await client.api(url).get()) as {
      value?: Array<Record<string, unknown>>;
      "@odata.nextLink"?: string;
      "@odata.deltaLink"?: string;
    };
    for (const item of res.value ?? []) {
      const norm = normalize(item, signedInEmail);
      if (norm) messages.push(norm);
    }
    if (res["@odata.deltaLink"]) {
      deltaLink = res["@odata.deltaLink"];
      url = null;
    } else if (res["@odata.nextLink"]) {
      url = res["@odata.nextLink"];
    } else {
      url = null;
    }
  }

  return { messages, deltaLink };
};

export const fetchInboxDelta = async (
  client: Client,
  signedInEmail: string,
  cursor: string | null,
): Promise<DeltaResult> => {
  const url = cursor ?? "/me/mailFolders/inbox/messages/delta?$top=50";
  return collectDelta(client, url, signedInEmail);
};

export const fetchFolderDelta = async (
  client: Client,
  folderName: string,
  signedInEmail: string,
  cursor: string | null,
): Promise<DeltaResult> => {
  if (cursor) return collectDelta(client, cursor, signedInEmail);
  const folders = (await client.api(`/me/mailFolders?$filter=displayName eq '${folderName}'`).get()) as {
    value?: Array<{ id: string }>;
  };
  const folder = folders.value?.[0];
  if (!folder) return { messages: [], deltaLink: null };
  return collectDelta(client, `/me/mailFolders/${folder.id}/messages/delta?$top=50`, signedInEmail);
};

export const getSignedInEmail = async (client: Client): Promise<string> => {
  const me = (await client.api("/me").get()) as { mail?: string; userPrincipalName?: string };
  const email = me.mail ?? me.userPrincipalName;
  if (!email) throw new Error("Could not determine signed-in user email");
  return email;
};
