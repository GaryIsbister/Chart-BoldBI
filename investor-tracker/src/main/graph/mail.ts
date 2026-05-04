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

const WELL_KNOWN_FOLDERS = new Set([
  "inbox",
  "drafts",
  "sentitems",
  "deleteditems",
  "junkemail",
  "outbox",
  "archive",
  "clutter",
  "conflicts",
  "conversationhistory",
  "localfailures",
  "msgfolderroot",
  "recoverableitemsdeletions",
  "scheduled",
  "searchfolders",
  "serverfailures",
  "syncissues",
]);

interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
}

const resolveFolderId = async (folder: string): Promise<string | null> => {
  const lower = folder.toLowerCase();
  if (WELL_KNOWN_FOLDERS.has(lower)) return lower;
  const escaped = folder.replace(/'/g, "''");
  const res = await graphFetch<GraphPage<MailFolder>>(
    `/me/mailFolders?$filter=${encodeURIComponent(`displayName eq '${escaped}'`)}&$top=1`,
  );
  if (res.value[0]) return res.value[0].id;
  const child = await graphFetch<GraphPage<MailFolder>>(
    `/me/mailFolders/inbox/childFolders?$filter=${encodeURIComponent(`displayName eq '${escaped}'`)}&$top=1`,
  );
  return child.value[0]?.id ?? null;
};

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

  const folderId = await resolveFolderId(folder);
  if (!folderId) {
    return [];
  }
  const folderPath = `/me/mailFolders/${folderId}/messages`;

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

export interface InvestorSenderCandidate {
  email: string;
  displayName: string | null;
  messageCount: number;
  lastSeen: string;
}

export const searchSendersByQuery = async (
  query: string,
  monthsBack: number,
): Promise<InvestorSenderCandidate[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  const cutoffMs = cutoff.getTime();

  const escaped = trimmed.replace(/"/g, '\\"');
  const search = encodeURIComponent(`"from:${escaped}"`);
  const select = encodeURIComponent("id,from,sender,receivedDateTime");
  const url = `/me/messages?$search=${search}&$top=200&$select=${select}`;

  const page = await graphFetch<GraphPage<GraphMessage>>(url);
  const byEmail = new Map<string, InvestorSenderCandidate>();
  for (const msg of page.value) {
    const received = msg.receivedDateTime;
    if (!received || new Date(received).getTime() < cutoffMs) continue;
    const email =
      msg.from?.emailAddress?.address ?? msg.sender?.emailAddress?.address ?? "";
    if (!email) continue;
    const name =
      msg.from?.emailAddress?.name ?? msg.sender?.emailAddress?.name ?? null;
    const key = email.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) {
      existing.messageCount += 1;
      if (received > existing.lastSeen) existing.lastSeen = received;
      if (!existing.displayName && name) existing.displayName = name;
    } else {
      byEmail.set(key, {
        email,
        displayName: name,
        messageCount: 1,
        lastSeen: received,
      });
    }
  }
  return [...byEmail.values()].sort(
    (a, b) =>
      b.messageCount - a.messageCount ||
      b.lastSeen.localeCompare(a.lastSeen),
  );
};

export interface BackfillForInvestorOptions {
  emails: string[];
  domain: string | null;
  monthsBack: number;
  folders: string[];
  pageSize?: number;
  maxPages?: number;
}

const escapeOData = (s: string): string => s.replace(/'/g, "''");

const buildSenderClause = (
  emails: string[],
  domain: string | null,
): { clause: string; advanced: boolean } => {
  const parts: string[] = [];
  for (const e of emails) {
    parts.push(`from/emailAddress/address eq '${escapeOData(e)}'`);
  }
  let advanced = false;
  if (domain) {
    parts.push(`endsWith(from/emailAddress/address, '@${escapeOData(domain)}')`);
    advanced = true;
  }
  return { clause: parts.join(" or "), advanced };
};

const buildRecipientClause = (
  emails: string[],
  domain: string | null,
): { clause: string; advanced: boolean } => {
  const parts: string[] = [];
  for (const e of emails) {
    parts.push(
      `toRecipients/any(r: r/emailAddress/address eq '${escapeOData(e)}')`,
    );
  }
  let advanced = false;
  if (domain) {
    parts.push(
      `toRecipients/any(r: endsWith(r/emailAddress/address, '@${escapeOData(domain)}'))`,
    );
    advanced = true;
  }
  return { clause: parts.join(" or "), advanced };
};

export const fetchMailForInvestor = async (
  options: BackfillForInvestorOptions,
): Promise<Message[]> => {
  const emails = options.emails.map((e) => e.trim()).filter((e) => e.length > 0);
  const domain = options.domain?.trim().toLowerCase().replace(/^@/, "") || null;
  if (emails.length === 0 && !domain) return [];

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - options.monthsBack);
  const sinceIso = cutoff.toISOString();
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 50;
  const accountEmail = (await getSignedInAccount())?.toLowerCase() ?? null;

  const inserted: Message[] = [];
  for (const folder of options.folders) {
    const folderId = await resolveFolderId(folder);
    if (!folderId) continue;
    const sender = buildSenderClause(emails, domain);
    if (!sender.clause) continue;
    const filter = `(receivedDateTime ge ${sinceIso}) and (${sender.clause})`;
    await pageThrough(
      `/me/mailFolders/${folderId}/messages`,
      filter,
      pageSize,
      maxPages,
      accountEmail,
      inserted,
      sender.advanced,
    );
  }

  // Sent items: fetch messages where any recipient is the investor's email or domain.
  // This catches replies sent by anyone @<our-domain> (the team) to the investor.
  const sentFolderId = await resolveFolderId("sentitems");
  if (sentFolderId) {
    const recipient = buildRecipientClause(emails, domain);
    if (recipient.clause) {
      const sentFilter = `(receivedDateTime ge ${sinceIso}) and (${recipient.clause})`;
      try {
        await pageThrough(
          `/me/mailFolders/${sentFolderId}/messages`,
          sentFilter,
          pageSize,
          maxPages,
          accountEmail,
          inserted,
          recipient.advanced,
        );
      } catch (e) {
        console.error(
          `[mail] sent-items recipient filter failed: ${(e as Error).message}`,
        );
      }
    }
  }

  return inserted;
};

const pageThrough = async (
  folderPath: string,
  filter: string,
  pageSize: number,
  maxPages: number,
  accountEmail: string | null,
  inserted: Message[],
  advanced: boolean = false,
): Promise<void> => {
  const countParam = advanced ? "&$count=true" : "";
  let url: string | null = `${folderPath}?$top=${pageSize}&$orderby=receivedDateTime desc${countParam}&$filter=${encodeURIComponent(filter)}`;
  let pages = 0;

  while (url && pages < maxPages) {
    const page: GraphPage<GraphMessage> = await graphFetch<GraphPage<GraphMessage>>(
      url,
      advanced ? { advanced: true } : undefined,
    );
    for (const msg of page.value) {
      if (findMessageByExternalId("outlook_mail", msg.id)) continue;
      const fromAddr =
        msg.from?.emailAddress?.address ?? msg.sender?.emailAddress?.address ?? "";
      const fromName =
        msg.from?.emailAddress?.name ?? msg.sender?.emailAddress?.name ?? null;
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
};

export interface BackfillMailOptions {
  folder: string;
  sinceIso: string;
  pageSize?: number;
  maxPages?: number;
  onProgress?: (folder: string, pages: number, fetched: number) => void;
}

export const fetchMailBackfill = async (
  options: BackfillMailOptions,
): Promise<Message[]> => {
  const pageSize = options.pageSize ?? 50;
  const maxPages = options.maxPages ?? 400;
  const accountEmail = (await getSignedInAccount())?.toLowerCase() ?? null;
  const folderId = await resolveFolderId(options.folder);
  if (!folderId) return [];

  const filter = `&$filter=${encodeURIComponent(
    `receivedDateTime ge ${options.sinceIso}`,
  )}`;
  const folderPath = `/me/mailFolders/${folderId}/messages`;
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
      if (findMessageByExternalId("outlook_mail", msg.id)) continue;
      const fromAddr =
        msg.from?.emailAddress?.address ?? msg.sender?.emailAddress?.address ?? "";
      const fromName =
        msg.from?.emailAddress?.name ?? msg.sender?.emailAddress?.name ?? null;
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
    pages += 1;
    options.onProgress?.(options.folder, pages, inserted.length);
    url = page["@odata.nextLink"] ?? null;
  }

  if (newestSeen) {
    const existingCursor = getCursor(cursorKey(options.folder));
    if (!existingCursor || newestSeen > existingCursor) {
      setCursor(cursorKey(options.folder), newestSeen);
    }
  }
  return inserted;
};
