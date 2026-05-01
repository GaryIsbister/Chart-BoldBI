import { ipcMain } from "electron";
import type Database from "better-sqlite3";
import type { IpcChannel, IpcContract } from "@shared/ipc";
import { EntitiesRepo } from "../store/repositories/entities";
import { ContactsRepo } from "../store/repositories/contacts";
import { MessagesRepo } from "../store/repositories/messages";
import { ActionItemsRepo } from "../store/repositories/actionItems";
import { PendingReviewsRepo } from "../store/repositories/pendingReviews";
import { SettingsRepo } from "../store/repositories/settings";
import { keys, setSecret } from "../keychain";
import type { GraphAuth } from "../graph/auth";
import { buildGraphClient } from "../graph/client";
import { runPoller } from "../jobs/poller";
import { runDailyClassifier } from "../jobs/dailyClassifier";
import { domainFromEmail, uuid } from "@shared/util";
import { parseDemandBook, renderDemandBookContext } from "../claude/demandBook";

type Handler<C extends IpcChannel> = (req: IpcContract[C]["req"]) => Promise<IpcContract[C]["res"]>;

const register = <C extends IpcChannel>(channel: C, handler: Handler<C>): void => {
  ipcMain.handle(channel, (_evt, payload: IpcContract[C]["req"]) => handler(payload));
};

export const registerIpcHandlers = (deps: { db: Database.Database; auth: GraphAuth }): void => {
  const { db, auth } = deps;

  register("auth:status", async () => {
    const account = await auth.loadCachedAccount();
    return { signedIn: !!account, account: account?.username ?? null };
  });

  register("auth:signIn", async () => {
    const account = await auth.signIn();
    return { signedIn: true, account: account.username };
  });

  register("auth:signOut", async () => {
    return { signedIn: false };
  });

  register("settings:get", async () => new SettingsRepo(db).get());

  register("settings:update", async (patch) => new SettingsRepo(db).update(patch));

  register("settings:setAnthropicKey", async ({ apiKey }) => {
    await setSecret(keys.anthropicApiKey, apiKey);
    return { ok: true } as const;
  });

  register("entities:list", async (req) => new EntitiesRepo(db).list(req?.stage));

  register("entities:get", async ({ id }) => {
    const entitiesRepo = new EntitiesRepo(db);
    const entity = entitiesRepo.get(id);
    if (!entity) throw new Error(`entity ${id} not found`);
    const contacts = new ContactsRepo(db).listForEntity(id);
    return { entity, contacts };
  });

  register("entities:setStage", async ({ id, stage, reason, parkedUntil }) => {
    return new EntitiesRepo(db).setStage(id, stage, {
      changedBy: "user",
      reason,
      parkedUntil: parkedUntil ?? null,
    });
  });

  register("entities:stageHistory", async ({ id }) => new EntitiesRepo(db).stageHistory(id));

  register("pendingReviews:list", async () => new PendingReviewsRepo(db).listOpen());

  register("pendingReviews:decide", async ({ id, decision }) => {
    const pending = new PendingReviewsRepo(db);
    const review = pending.get(id);
    if (!review) throw new Error(`pending review ${id} not found`);

    if (decision === "confirm") {
      const entitiesRepo = new EntitiesRepo(db);
      const contactsRepo = new ContactsRepo(db);
      const messagesRepo = new MessagesRepo(db);

      const domain = review.domain ?? domainFromEmail(review.email);
      const entity =
        (review.proposedEntityId ? entitiesRepo.get(review.proposedEntityId) : null) ??
        (domain ? entitiesRepo.findByDomain(domain) : null) ??
        entitiesRepo.create({ id: uuid(), name: review.proposedEntityName, domain });

      contactsRepo.upsert({
        entityId: entity.id,
        email: review.email,
        displayName: review.displayName,
      });
      messagesRepo.attachToEntity(review.evidenceMessageIds, entity.id);
    } else if (decision === "reject") {
      new PendingReviewsRepo(db).ignore(review.email, "rejected via review queue");
    }

    pending.decide(id, decision);
    return { id, decision };
  });

  register("actionItems:list", async (filter) => new ActionItemsRepo(db).list(filter ?? {}));

  register("actionItems:setStatus", async ({ id, status }) =>
    new ActionItemsRepo(db).setStatus(id, status),
  );

  register("threads:listForEntity", async ({ entityId }) =>
    new MessagesRepo(db).listThreadsForEntity(entityId),
  );

  register("messages:listForThread", async ({ threadId }) =>
    new MessagesRepo(db).listForThread(threadId),
  );

  register("jobs:runPollerNow", async () => {
    const client = buildGraphClient(auth);
    return runPoller(db, client);
  });

  register("jobs:runDailyClassifierNow", async () => runDailyClassifier(db));

  register("jobs:importDemandBook", async () => {
    // Stub. The real flow searches Outlook for Marina's latest demand book
    // attachment, downloads it via Graph, runs `parseDemandBook` on the
    // extracted text, persists rows to demand_book_entries, and updates the
    // cached demand-book context used by the classifier. Wire that here once
    // the attachment download + PDF/DOCX text extraction are implemented.
    void parseDemandBook;
    void renderDemandBookContext;
    void uuid;
    return { importId: "not-yet-implemented", entries: 0 };
  });
};
