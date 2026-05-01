import { domainFromEmail } from "@shared/util";
import { getDb } from "../store/db";
import { ContactsRepo } from "../store/repositories/contacts";
import { CursorsRepo } from "../store/repositories/cursors";
import { EntitiesRepo } from "../store/repositories/entities";
import { MessagesRepo, type MessageInput } from "../store/repositories/messages";
import { PendingReviewsRepo } from "../store/repositories/pendingReviews";
import { DemandBookRepo, SettingsRepo } from "../store/repositories/settings";
import { fetchMailDelta, fetchMessageBody, getMyEmailAddress } from "../graph/mail";
import { fetchTeamsMessagesSince, getMyId } from "../graph/teams";
import { classifySender } from "../claude/classifier";
import { parseDemandBookEmail } from "../claude/demandBook";

const cursorKeyMail = (folder: string): string => `mail:delta:${folder}`;
const CURSOR_TEAMS_LAST = "teams:lastModifiedDateTime";

export const runPollOnce = async (): Promise<void> => {
  const db = getDb();
  const settingsRepo = new SettingsRepo(db);
  const cursors = new CursorsRepo(db);
  const messagesRepo = new MessagesRepo(db);
  const contactsRepo = new ContactsRepo(db);
  const entitiesRepo = new EntitiesRepo(db);
  const pendingRepo = new PendingReviewsRepo(db);
  const demandRepo = new DemandBookRepo(db);
  const settings = settingsRepo.get();

  const meEmail = await getMyEmailAddress();

  for (const folder of settings.watchedFolders) {
    const previous = cursors.get(cursorKeyMail(folder));
    const { messages, deltaLink } = await fetchMailDelta(meEmail, folder, previous);
    for (const m of messages) {
      await ingestMessage(m, {
        meEmail,
        settings,
        messagesRepo,
        contactsRepo,
        entitiesRepo,
        pendingRepo,
        demandRepo,
      });
    }
    if (deltaLink) cursors.set(cursorKeyMail(folder), deltaLink);
  }

  const teamsSince =
    cursors.get(CURSOR_TEAMS_LAST) ??
    new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
  const meId = await getMyId();
  const teamsMessages = await fetchTeamsMessagesSince(meId, meEmail, teamsSince);
  let maxSeen = teamsSince;
  for (const m of teamsMessages) {
    if (m.receivedAt > maxSeen) maxSeen = m.receivedAt;
    await ingestMessage(m, {
      meEmail,
      settings,
      messagesRepo,
      contactsRepo,
      entitiesRepo,
      pendingRepo,
      demandRepo,
    });
  }
  cursors.set(CURSOR_TEAMS_LAST, maxSeen);
};

type IngestCtx = {
  meEmail: string;
  settings: ReturnType<SettingsRepo["get"]>;
  messagesRepo: MessagesRepo;
  contactsRepo: ContactsRepo;
  entitiesRepo: EntitiesRepo;
  pendingRepo: PendingReviewsRepo;
  demandRepo: DemandBookRepo;
};

const ingestMessage = async (input: MessageInput, ctx: IngestCtx): Promise<void> => {
  const stored = ctx.messagesRepo.insertMessage(input);

  if (
    input.source === "outlook_mail" &&
    !input.isFromUs &&
    input.fromEmail.toLowerCase() === ctx.settings.demandBookSenderEmail.toLowerCase()
  ) {
    await processDemandBook(stored.externalId, ctx);
    return;
  }

  if (input.isFromUs) return;

  const existingContact = ctx.contactsRepo.findByEmail(input.fromEmail);
  if (existingContact) {
    ctx.messagesRepo.attachContactAndEntity(
      stored.id,
      existingContact.id,
      existingContact.entityId,
    );
    return;
  }

  const domain = domainFromEmail(input.fromEmail);
  if (domain) {
    const byDomain = ctx.entitiesRepo.findByDomain(domain);
    if (byDomain) {
      const contact = ctx.contactsRepo.upsert({
        entityId: byDomain.id,
        email: input.fromEmail,
        displayName: input.fromName,
      });
      ctx.messagesRepo.attachContactAndEntity(stored.id, contact.id, byDomain.id);
      return;
    }
  }

  const undecided = ctx.pendingRepo.findUndecidedByEmail(input.fromEmail);
  if (undecided) return;

  await classifyAndQueue(stored, ctx, domain);
};

const classifyAndQueue = async (
  message: { id: string; fromEmail: string; fromName: string | null; subject: string | null; bodyPreview: string },
  ctx: IngestCtx,
  domain: string | null,
): Promise<void> => {
  const recent = ctx.messagesRepo.listFromSender(message.fromEmail, 5);
  const knownEntities = ctx.entitiesRepo.list().map((e) => ({ name: e.name, domain: e.domain }));
  const demand = ctx.demandRepo.listAll();

  let result;
  try {
    result = await classifySender({
      email: message.fromEmail,
      displayName: message.fromName,
      domain,
      subjectsAndPreviews: recent.map((r) => ({ subject: r.subject, preview: r.bodyPreview })),
      knownEntities,
      demandBook: demand,
      model: ctx.settings.classifierModel,
    });
  } catch (err) {
    console.error("classifier failed", err);
    return;
  }

  if (!result.isInvestor) return;

  const matchedExisting = ctx.entitiesRepo.findByName(result.proposedEntityName);
  if (result.confidence >= ctx.settings.pendingReviewThreshold && matchedExisting) {
    const contact = ctx.contactsRepo.upsert({
      entityId: matchedExisting.id,
      email: message.fromEmail,
      displayName: message.fromName,
    });
    ctx.messagesRepo.attachContactAndEntity(message.id, contact.id, matchedExisting.id);
    return;
  }

  if (result.confidence >= ctx.settings.pendingReviewThreshold && !matchedExisting) {
    const created = ctx.entitiesRepo.create({
      name: result.proposedEntityName,
      domain,
    });
    const contact = ctx.contactsRepo.upsert({
      entityId: created.id,
      email: message.fromEmail,
      displayName: message.fromName,
    });
    ctx.messagesRepo.attachContactAndEntity(message.id, contact.id, created.id);
    return;
  }

  ctx.pendingRepo.insert({
    email: message.fromEmail,
    displayName: message.fromName,
    domain,
    proposedEntityName: result.proposedEntityName || message.fromName || message.fromEmail,
    proposedEntityId: matchedExisting?.id ?? null,
    confidence: result.confidence,
    reasoning: result.reasoning,
    matchedDemandBookEntry: result.matchedDemandBookEntry,
    evidenceMessageIds: recent.map((m) => m.id),
  });
};

const processDemandBook = async (externalId: string, ctx: IngestCtx): Promise<void> => {
  try {
    const html = await fetchMessageBody(externalId);
    const plain = html.replace(/<[^>]*>/g, "\n").replace(/\n{3,}/g, "\n\n");
    const parsed = await parseDemandBookEmail(plain, ctx.settings.synthesisModel);
    const importId = globalThis.crypto.randomUUID();
    ctx.demandRepo.insertImport(
      importId,
      parsed.entries.map((e) => ({
        entityName: e.entityName,
        contactNames: e.contactNames,
        contactEmails: e.contactEmails,
        ticketSize: e.ticketSize,
        notes: e.notes,
      })),
    );
  } catch (err) {
    console.error("demand book parse failed", err);
  }
};
