import { graphFetch } from "./client";
import { getCursor, setCursor } from "../store/repositories/cursors";
import {
  findMessageByExternalId,
  insertMessage,
  upsertThread,
} from "../store/repositories/messages";
import type { Message } from "@shared/types";
import { getSignedInAccount } from "./auth";

interface GraphMailRecipient {
  emailAddress: { name?: string; address?: string };
}

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  from?: GraphMailRecipient;
  sender?: GraphMailRecipient;
  toRecipients?: GraphMailRecipient[];
  parentFolderId?: string;
}

interface GraphPage<T> {
  value: T[];
  ["@odata.nextLink"]?: string;
}

const cursorKey = (folder: string): string => `outlook:${folder}:lastReceivedDateTime`;

export interface FetchMailOptions {
  folder: string;
  pageSize?: number;
  maxPages?: number;
}

export const fetchMailDelta = async (options: FetchMailOptions): Promise<Message[]> => {
  const folder = options.folder;
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 5;
  const accountEmail = (await getSignedInAccount())?.toLowerCase() ?? null;

  const sinceIso = getCursor(cursorKey(folder));
  const filter = sinceIso
    ? `&$filter=${encodeURIComponent(`receivedDateTime gt ${sinceIso}`)}`
    : "";

  const folderPath = folder === "inbox"
    ? "/me/mailFolders/inbox/messages"
    : `/me/mailFolders('${folder}')/messages`;

  let url: string | null = `${folderPath}?$top=${pageSize}&$orderby=receivedDateTime desc${filter}`;
  const inserted: Message[] = [];
  let pages = 0;
  let newestSeen: string | null = null;

  while (url && pages < maxPages) {
    const page: GraphPage<GraphMessage> = await graphFetch<GraphPage<GraphMessage>>(url);
    for (const msg of page.value) {
      if (!newestSeen || msg.receivedDateTime > newestSeen) {
        newestSeen = msg.receivedDateTime;
      }
      const existing = findMessageByExternalId("outlook_mail", msg.id);
      if (existing) continue;
      const fromAddr = msg.from?.emailAddress?.address ?? msg.sender?.emailAddress?.address ?? "";
      const fromName = msg.from?.emailAddress?.name ?? msg.sender?.emailAddress?.name ?? null;
      const toEmails = (msg.toRecipients ?? [])
        .map((r) => r.emailAddress?.address ?? "")
        .filter((s) => s.length > 0);
      const isFromUs =
        accountEmail !== null && fromAddr.toLowerCase() === accountEmail;

      const thread = upsertThread({
        source: "outlook_mail",
        externalConversationId: msg.conversationId,
        subject: msg.subject,
        lastMessageAt: msg.receivedDateTime,
      });

      const stored = insertMessage({
        source: "outlook_mail",
        externalId: msg.id,
        threadId: thread.id,
        contactId: null,
        entityId: null,
        fromEmail: fromAddr,
        fromName,
        toEmails,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview,
        receivedAt: msg.receivedDateTime,
        isFromUs,
        raw: msg,
      });
      inserted.push(stored);
    }
    url = page["@odata.nextLink"] ?? null;
    pages += 1;
  }

  if (newestSeen) {
    setCursor(cursorKey(folder), newestSeen);
  }
  return inserted;
};
