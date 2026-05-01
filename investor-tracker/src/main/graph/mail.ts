import { graph } from "./client";
import type { MessageInput } from "../store/repositories/messages";

type GraphMessage = {
  id: string;
  conversationId: string | null;
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
  parentFolderId?: string;
};

type DeltaResponse = {
  value: GraphMessage[];
  "@odata.deltaLink"?: string;
  "@odata.nextLink"?: string;
};

export type MailDeltaResult = {
  messages: MessageInput[];
  deltaLink: string;
};

export const fetchMailDelta = async (
  meEmail: string,
  folder: string,
  previousDeltaLink: string | null,
): Promise<MailDeltaResult> => {
  const client = graph();
  const url =
    previousDeltaLink ??
    `/me/mailFolders/${encodeURIComponent(folder)}/messages/delta?$select=id,conversationId,subject,bodyPreview,receivedDateTime,from,toRecipients,parentFolderId&$top=50`;

  const messages: MessageInput[] = [];
  let next: string | null = url;
  let deltaLink = previousDeltaLink ?? "";
  while (next) {
    const resp: DeltaResponse = await client.api(next).get();
    for (const m of resp.value) {
      const fromEmail = m.from?.emailAddress?.address ?? "";
      if (!fromEmail) continue;
      const toEmails =
        m.toRecipients
          ?.map((r) => r.emailAddress?.address)
          .filter((x): x is string => Boolean(x)) ?? [];
      messages.push({
        source: "outlook_mail",
        externalId: m.id,
        externalConversationId: m.conversationId,
        fromEmail,
        fromName: m.from?.emailAddress?.name ?? null,
        toEmails,
        subject: m.subject,
        bodyPreview: m.bodyPreview ?? "",
        receivedAt: m.receivedDateTime,
        isFromUs: fromEmail.toLowerCase() === meEmail.toLowerCase(),
        raw: m,
      });
    }
    if (resp["@odata.deltaLink"]) {
      deltaLink = resp["@odata.deltaLink"];
      next = null;
    } else {
      next = resp["@odata.nextLink"] ?? null;
    }
  }
  return { messages, deltaLink };
};

export const fetchMessageBody = async (externalId: string): Promise<string> => {
  const client = graph();
  const m: { body?: { content?: string; contentType?: string } } = await client
    .api(`/me/messages/${externalId}?$select=body`)
    .get();
  return m.body?.content ?? "";
};

export const getMyEmailAddress = async (): Promise<string> => {
  const client = graph();
  const me: { mail?: string; userPrincipalName?: string } = await client
    .api("/me?$select=mail,userPrincipalName")
    .get();
  return (me.mail ?? me.userPrincipalName ?? "").toLowerCase();
};
