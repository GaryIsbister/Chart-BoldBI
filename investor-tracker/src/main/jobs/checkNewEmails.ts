import { graphFetch } from "../graph/client";
import { getCursor, setCursor } from "../store/repositories/cursors";
import { listEntities } from "../store/repositories/entities";
import { listContactsForEntity, findContactByEmail } from "../store/repositories/contacts";
import {
  findMessageByExternalId,
  insertMessage,
  upsertThread,
  updateMessageContact,
} from "../store/repositories/messages";
import { getSignedInAccount } from "../graph/auth";
import { domainFromEmail } from "@shared/util";

const CHECK_CURSOR = "checkNewEmails:lastReceivedDateTime";
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  sender?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
}

interface GraphPage<T> {
  value: T[];
  ["@odata.nextLink"]?: string;
}

interface InvestorMatcher {
  entityId: string;
  entityName: string;
  domain: string | null;
  useDomain: boolean;
  contactEmails: Set<string>;
}

const buildMatchers = (): InvestorMatcher[] => {
  const entities = listEntities();
  return entities.map((e) => {
    const contacts = listContactsForEntity(e.id);
    return {
      entityId: e.id,
      entityName: e.name,
      domain: e.domain ? e.domain.toLowerCase().replace(/^@/, "") : null,
      useDomain: e.useDomainMatching,
      contactEmails: new Set(contacts.map((c) => c.email.toLowerCase())),
    };
  });
};

const matchEntity = (
  fromEmail: string,
  toEmails: string[],
  matchers: InvestorMatcher[],
): InvestorMatcher | null => {
  const fromLower = fromEmail.toLowerCase();
  const fromDomain = domainFromEmail(fromEmail);
  const allEmails = [fromLower, ...toEmails.map((e) => e.toLowerCase())];
  const allDomains = allEmails
    .map((e) => domainFromEmail(e))
    .filter((d): d is string => d !== null);

  for (const m of matchers) {
    if (m.contactEmails.has(fromLower)) return m;
    for (const to of toEmails.map((e) => e.toLowerCase())) {
      if (m.contactEmails.has(to)) return m;
    }
  }
  for (const m of matchers) {
    if (!m.useDomain || !m.domain) continue;
    if (fromDomain === m.domain) return m;
    if (allDomains.includes(m.domain)) return m;
  }
  return null;
};

export interface CheckResult {
  newMessages: number;
  scanned: number;
  perInvestor: Array<{ entityId: string; entityName: string; count: number }>;
  errors: string[];
  cursor: string | null;
}

export const runCheckForNewEmails = async (): Promise<CheckResult> => {
  const errors: string[] = [];
  const matchers = buildMatchers();
  if (matchers.length === 0) {
    return {
      newMessages: 0,
      scanned: 0,
      perInvestor: [],
      errors: ["no investors yet — add at least one before checking for new emails"],
      cursor: null,
    };
  }

  const accountEmail = (await getSignedInAccount())?.toLowerCase() ?? null;
  const sinceIso = getCursor(CHECK_CURSOR);
  const filter = sinceIso
    ? `&$filter=${encodeURIComponent(`receivedDateTime gt ${sinceIso}`)}`
    : "";
  let url: string | null = `/me/messages?$top=${PAGE_SIZE}&$orderby=receivedDateTime desc${filter}`;

  let scanned = 0;
  let pages = 0;
  let newestSeen: string | null = null;
  const perInvestor = new Map<string, { entityName: string; count: number }>();
  const newMessageIds: string[] = [];

  while (url && pages < MAX_PAGES) {
    let page: GraphPage<GraphMessage>;
    try {
      page = await graphFetch<GraphPage<GraphMessage>>(url);
    } catch (e) {
      errors.push(`graph: ${(e as Error).message}`);
      break;
    }
    for (const msg of page.value) {
      scanned += 1;
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

      const match = matchEntity(fromAddr, toEmails, matchers);
      if (!match) continue;

      const isFromUs =
        accountEmail !== null && fromAddr.toLowerCase() === accountEmail;

      const thread = upsertThread({
        source: "outlook_mail",
        externalConversationId: msg.conversationId,
        subject: msg.subject,
        lastMessageAt: msg.receivedDateTime,
        entityId: match.entityId,
      });

      const stored = insertMessage({
        source: "outlook_mail",
        externalId: msg.id,
        threadId: thread.id,
        contactId: null,
        entityId: match.entityId,
        fromEmail: fromAddr,
        fromName,
        toEmails,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview,
        receivedAt: msg.receivedDateTime,
        isFromUs,
        isNew: true,
        raw: msg,
      });

      // attach contact if we know the sender's email
      const contact = findContactByEmail(fromAddr);
      if (contact && contact.entityId === match.entityId) {
        updateMessageContact(stored.id, contact.id);
      }

      newMessageIds.push(stored.id);
      const existing = perInvestor.get(match.entityId);
      if (existing) {
        existing.count += 1;
      } else {
        perInvestor.set(match.entityId, { entityName: match.entityName, count: 1 });
      }
    }
    url = page["@odata.nextLink"] ?? null;
    pages += 1;
  }

  if (newestSeen) {
    setCursor(CHECK_CURSOR, newestSeen);
  }

  return {
    newMessages: newMessageIds.length,
    scanned,
    perInvestor: [...perInvestor.entries()].map(([entityId, v]) => ({
      entityId,
      entityName: v.entityName,
      count: v.count,
    })),
    errors,
    cursor: newestSeen,
  };
};
