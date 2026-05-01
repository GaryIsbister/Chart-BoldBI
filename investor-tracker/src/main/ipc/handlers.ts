import { ipcMain } from "electron";
import { PIPELINE_STAGES, type PipelineStage } from "@shared/types";
import { IPC, type AuthStatus, type DashboardSummary, type DeviceCodeChallenge } from "@shared/ipc";
import { getDb } from "../store/db";
import { ActionItemsRepo } from "../store/repositories/actionItems";
import { ContactsRepo } from "../store/repositories/contacts";
import { EntitiesRepo } from "../store/repositories/entities";
import { MessagesRepo } from "../store/repositories/messages";
import { PendingReviewsRepo } from "../store/repositories/pendingReviews";
import { SettingsRepo } from "../store/repositories/settings";
import { keychain, KeychainAccount } from "../keychain";
import { resetAnthropic } from "../claude/client";
import {
  getAccount,
  initAuth,
  signOut as authSignOut,
  startDeviceCode,
} from "../graph/auth";
import {
  startScheduler,
  stopScheduler,
  triggerDailyClassifierNow,
  triggerPollNow,
} from "../jobs/scheduler";

let pendingDeviceChallenge: DeviceCodeChallenge | null = null;

const ensureAuthInit = async (): Promise<void> => {
  const settings = new SettingsRepo(getDb()).get();
  if (!settings.microsoftClientId) throw new Error("microsoftClientId not set");
  initAuth(settings.microsoftClientId, settings.microsoftTenantId);
};

const computeDashboard = (): DashboardSummary => {
  const db = getDb();
  const entities = new EntitiesRepo(db);
  const messages = new MessagesRepo(db);
  const actionItems = new ActionItemsRepo(db);
  const pending = new PendingReviewsRepo(db);

  const all = entities.list();
  const byStage = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, 0]),
  ) as Record<PipelineStage, number>;
  for (const e of all) byStage[e.pipelineStage] += 1;

  const stale = all
    .map((e) => {
      const days = messages.daysSinceLastMessage(e.id);
      return days === null ? null : { id: e.id, name: e.name, daysSinceLastMessage: days };
    })
    .filter((x): x is { id: string; name: string; daysSinceLastMessage: number } => x !== null)
    .filter((x) => x.daysSinceLastMessage >= 14)
    .sort((a, b) => b.daysSinceLastMessage - a.daysSinceLastMessage)
    .slice(0, 10);

  return {
    totalEntities: all.length,
    byStage,
    pendingReviewCount: pending.count(),
    openActionItems: actionItems.countOpen(),
    staleEntities: stale,
  };
};

export const registerIpcHandlers = (): void => {
  ipcMain.handle(IPC.authStatus, async (): Promise<AuthStatus> => {
    try {
      await ensureAuthInit();
      const account = await getAccount();
      return account
        ? { signedIn: true, account: { username: account.username, name: account.name ?? null } }
        : { signedIn: false, account: null };
    } catch {
      return { signedIn: false, account: null };
    }
  });

  ipcMain.handle(IPC.authStartDeviceCode, async (): Promise<DeviceCodeChallenge> => {
    await ensureAuthInit();
    pendingDeviceChallenge = null;
    const challengePromise = new Promise<DeviceCodeChallenge>((resolve) => {
      void startDeviceCode((c) => {
        pendingDeviceChallenge = c;
        resolve(c);
      }).then(() => {
        startScheduler();
      });
    });
    return challengePromise;
  });

  ipcMain.handle(IPC.authSignOut, async (): Promise<void> => {
    await ensureAuthInit();
    stopScheduler();
    await authSignOut();
  });

  ipcMain.handle(IPC.setAnthropicKey, async (_e, key: string): Promise<void> => {
    await keychain.set(KeychainAccount.anthropicApiKey, key);
    resetAnthropic();
  });

  ipcMain.handle(IPC.hasAnthropicKey, async (): Promise<boolean> => {
    const k = await keychain.get(KeychainAccount.anthropicApiKey);
    return Boolean(k);
  });

  ipcMain.handle(IPC.getSettings, () => new SettingsRepo(getDb()).get());
  ipcMain.handle(IPC.updateSettings, (_e, patch) =>
    new SettingsRepo(getDb()).update(patch),
  );

  ipcMain.handle(IPC.listEntities, () => new EntitiesRepo(getDb()).list());
  ipcMain.handle(IPC.getEntity, (_e, id: string) => new EntitiesRepo(getDb()).get(id));
  ipcMain.handle(IPC.setEntityStage, (_e, id: string, stage: PipelineStage, reason: string | null) =>
    new EntitiesRepo(getDb()).setStage(id, stage, "user", reason),
  );
  ipcMain.handle(IPC.setEntityNotes, (_e, id: string, notes: string | null) =>
    new EntitiesRepo(getDb()).setNotes(id, notes),
  );
  ipcMain.handle(IPC.parkEntity, (_e, id: string, until: string | null) =>
    new EntitiesRepo(getDb()).park(id, until),
  );

  ipcMain.handle(IPC.listPendingReviews, () => new PendingReviewsRepo(getDb()).listOpen());
  ipcMain.handle(IPC.decidePendingReview, (_e, id: string, decision) => {
    const db = getDb();
    const pending = new PendingReviewsRepo(db);
    const review = pending.get(id);
    if (!review) throw new Error(`pending review ${id} not found`);
    if (decision === "confirm") {
      const entities = new EntitiesRepo(db);
      const target =
        (review.proposedEntityId && entities.get(review.proposedEntityId)) ||
        entities.findByName(review.proposedEntityName) ||
        entities.create({ name: review.proposedEntityName, domain: review.domain });
      const contacts = new ContactsRepo(db);
      contacts.upsert({
        entityId: target.id,
        email: review.email,
        displayName: review.displayName,
      });
    }
    pending.decide(id, decision);
  });

  ipcMain.handle(IPC.listOpenActionItems, () => new ActionItemsRepo(getDb()).listOpen());
  ipcMain.handle(IPC.setActionItemStatus, (_e, id: string, status) =>
    new ActionItemsRepo(getDb()).setStatus(id, status),
  );

  ipcMain.handle(IPC.listThreadsForEntity, (_e, entityId: string) =>
    new MessagesRepo(getDb()).listThreadsForEntity(entityId),
  );

  ipcMain.handle(IPC.dashboardSummary, () => computeDashboard());
  ipcMain.handle(IPC.triggerPollNow, () => triggerPollNow());
  ipcMain.handle(IPC.triggerDailyClassifierNow, () => triggerDailyClassifierNow());
};

export const getPendingDeviceChallenge = (): DeviceCodeChallenge | null =>
  pendingDeviceChallenge;
