import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS, type AuthStatus, type DecidePendingReviewArgs, type UpdateActionItemStatusArgs, type UpdateEntityNotesArgs, type UpdateEntityStageArgs } from "@shared/ipc";
import { KEYCHAIN_KEYS, keychain } from "../keychain";
import { resetClaudeClient } from "../claude/client";
import { getSettings, updateSettings } from "../store/repositories/settings";
import {
  getEntity,
  listEntities,
  updateEntityNotes,
  updateEntityStage,
  findEntityByName,
  createEntity,
} from "../store/repositories/entities";
import { listContactsForEntity, upsertContact } from "../store/repositories/contacts";
import {
  listMessagesForThread,
  listThreadsForEntity,
  updateMessageEntity,
} from "../store/repositories/messages";
import { listActionItems, updateActionItemStatus } from "../store/repositories/actionItems";
import {
  getPendingReview,
  listOpenPendingReviews,
  setPendingReviewDecision,
} from "../store/repositories/pendingReviews";
import { runPoller } from "../jobs/poller";
import { runDailyClassifier } from "../jobs/dailyClassifier";
import { signIn, signOut, getSignedInAccount } from "../graph/auth";
import type { Settings } from "@shared/types";

export const registerIpcHandlers = (getWindow: () => BrowserWindow | null): void => {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => getSettings());
  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_e, patch: Partial<Settings>) => updateSettings(patch));

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async (): Promise<AuthStatus> => {
    const account = await getSignedInAccount();
    const apiKey = await keychain.get(KEYCHAIN_KEYS.ANTHROPIC_API_KEY);
    return {
      microsoftSignedIn: account !== null,
      microsoftAccount: account,
      hasAnthropicKey: Boolean(apiKey),
    };
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_IN, async () => {
    const win = getWindow();
    return signIn({
      onDeviceCode: (prompt) => {
        win?.webContents.send("auth:deviceCode", prompt);
      },
    });
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    await signOut();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_SET_ANTHROPIC_KEY, async (_e, key: string) => {
    if (!key) {
      await keychain.delete(KEYCHAIN_KEYS.ANTHROPIC_API_KEY);
    } else {
      await keychain.set(KEYCHAIN_KEYS.ANTHROPIC_API_KEY, key);
    }
    resetClaudeClient();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_HAS_ANTHROPIC_KEY, async () => {
    const apiKey = await keychain.get(KEYCHAIN_KEYS.ANTHROPIC_API_KEY);
    return Boolean(apiKey);
  });

  ipcMain.handle(IPC_CHANNELS.ENTITIES_LIST, () => listEntities());
  ipcMain.handle(IPC_CHANNELS.ENTITIES_GET, (_e, id: string) => getEntity(id));
  ipcMain.handle(IPC_CHANNELS.ENTITIES_UPDATE_STAGE, (_e, args: UpdateEntityStageArgs) =>
    updateEntityStage({
      id: args.id,
      stage: args.stage,
      changedBy: "user",
      reason: args.reason ?? null,
    }),
  );
  ipcMain.handle(IPC_CHANNELS.ENTITIES_UPDATE_NOTES, (_e, args: UpdateEntityNotesArgs) =>
    updateEntityNotes(args.id, args.notes),
  );

  ipcMain.handle(IPC_CHANNELS.CONTACTS_LIST_FOR_ENTITY, (_e, entityId: string) =>
    listContactsForEntity(entityId),
  );

  ipcMain.handle(IPC_CHANNELS.THREADS_LIST_FOR_ENTITY, (_e, entityId: string) =>
    listThreadsForEntity(entityId),
  );
  ipcMain.handle(IPC_CHANNELS.MESSAGES_LIST_FOR_THREAD, (_e, threadId: string) =>
    listMessagesForThread(threadId),
  );

  ipcMain.handle(IPC_CHANNELS.ACTION_ITEMS_LIST, (_e, filter?: { entityId?: string }) =>
    listActionItems(filter),
  );
  ipcMain.handle(IPC_CHANNELS.ACTION_ITEMS_UPDATE_STATUS, (_e, args: UpdateActionItemStatusArgs) =>
    updateActionItemStatus(args.id, args.status, null),
  );

  ipcMain.handle(IPC_CHANNELS.PENDING_REVIEWS_LIST, () => listOpenPendingReviews());
  ipcMain.handle(IPC_CHANNELS.PENDING_REVIEWS_DECIDE, (_e, args: DecidePendingReviewArgs) => {
    const review = getPendingReview(args.reviewId);
    if (!review) return null;

    if (args.decision === "confirm") {
      const entityName = args.entityName ?? review.proposedEntityName;
      const entity =
        findEntityByName(entityName) ??
        createEntity({
          name: entityName,
          domain: review.domain,
          pipelineStage: args.pipelineStage,
        });
      const contact = upsertContact({
        entityId: entity.id,
        email: review.email,
        displayName: review.displayName,
      });
      for (const messageId of review.evidenceMessageIds) {
        updateMessageEntity(messageId, entity.id);
      }
      void contact;
    }
    return setPendingReviewDecision(args.reviewId, args.decision);
  });

  ipcMain.handle(IPC_CHANNELS.JOBS_RUN_POLLER, () => runPoller());
  ipcMain.handle(IPC_CHANNELS.JOBS_RUN_DAILY_CLASSIFIER, () => runDailyClassifier());
};
