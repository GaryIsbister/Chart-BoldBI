import { BrowserWindow, ipcMain, dialog, shell, clipboard } from "electron";
import {
  IPC_CHANNELS,
  type AuthStatus,
  type CreateActionItemArgs,
  type CreateContactArgs,
  type CreateEntityArgs,
  type DecidePendingReviewArgs,
  type SearchSendersArgs,
  type UpdateActionItemDueDateArgs,
  type UpdateActionItemStatusArgs,
  type UpdateEntityCategoryArgs,
  type UpdateEntityNotesArgs,
  type UpdateEntityStageArgs,
  type UpdateEntityUseDomainArgs,
} from "@shared/ipc";
import { KEYCHAIN_KEYS, keychain } from "../keychain";
import { resetClaudeClient } from "../claude/client";
import { getSettings, updateSettings } from "../store/repositories/settings";
import {
  getEntity,
  listEntities,
  updateEntityCategory,
  updateEntityNotes,
  updateEntityStage,
  updateEntityUseDomainMatching,
  findEntityByName,
  createEntity,
} from "../store/repositories/entities";
import { listContactsForEntity, upsertContact } from "../store/repositories/contacts";
import {
  backfillMessagesByEmail,
  countNewMessagesByThread,
  countNewMessagesPerEntity,
  findSendersByName,
  listMessagesForThread,
  listThreadsForEntity,
  markEntityMessagesAsRead,
  markMessageReadState,
  updateMessageEntity,
} from "../store/repositories/messages";
import { runCheckForNewEmails } from "../jobs/checkNewEmails";
import {
  createActionItem,
  listActionItems,
  updateActionItemDueDate,
  updateActionItemStatus,
} from "../store/repositories/actionItems";
import {
  getPendingReview,
  listOpenPendingReviews,
  listRejectedReviews,
  reopenPendingReview,
  setPendingReviewDecision,
} from "../store/repositories/pendingReviews";
import {
  runBackfillForInvestor,
  runBackfillMail,
  runPoller,
  runPollAndClassify,
} from "../jobs/poller";
import { searchSendersByQuery } from "../graph/mail";
import { runDailyClassifier } from "../jobs/dailyClassifier";
import { runThreadRefresherForEntity } from "../jobs/threadRefresher";
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
        console.log("\n=== Microsoft device code ===");
        console.log(prompt.message);
        console.log("===\n");
        win?.webContents.send("auth:deviceCode", prompt);
        clipboard.writeText(prompt.userCode);
        if (win) {
          void dialog
            .showMessageBox(win, {
              type: "info",
              title: "Sign in to Microsoft",
              message: `Code: ${prompt.userCode}`,
              detail:
                `${prompt.message}\n\nThe code has been copied to your clipboard. ` +
                `Click "Open browser" to start, paste the code, and sign in. ` +
                `This dialog will stay open — close it once sign-in finishes.`,
              buttons: ["Open browser", "Close"],
              defaultId: 0,
              cancelId: 1,
            })
            .then((res) => {
              if (res.response === 0) {
                void shell.openExternal(prompt.verificationUri);
              }
            });
        }
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
  ipcMain.handle(IPC_CHANNELS.ENTITIES_UPDATE_CATEGORY, (_e, args: UpdateEntityCategoryArgs) =>
    updateEntityCategory(args.id, args.category),
  );
  ipcMain.handle(IPC_CHANNELS.ENTITIES_UPDATE_USE_DOMAIN, (_e, args: UpdateEntityUseDomainArgs) =>
    updateEntityUseDomainMatching(args.id, args.useDomainMatching),
  );
  ipcMain.handle(IPC_CHANNELS.ENTITIES_CREATE, (_e, args: CreateEntityArgs) => {
    const entity = createEntity({
      name: args.name,
      domain: args.domain ?? null,
      useDomainMatching: args.useDomainMatching,
      pipelineStage: args.pipelineStage,
      category: args.category,
      notes: args.notes ?? null,
    });
    for (const email of args.contactEmails ?? []) {
      const trimmed = email.trim();
      if (!trimmed) continue;
      const contact = upsertContact({
        entityId: entity.id,
        email: trimmed,
        displayName: null,
      });
      backfillMessagesByEmail(trimmed, entity.id, contact.id);
    }
    return entity;
  });

  ipcMain.handle(IPC_CHANNELS.CONTACTS_LIST_FOR_ENTITY, (_e, entityId: string) =>
    listContactsForEntity(entityId),
  );
  ipcMain.handle(IPC_CHANNELS.CONTACTS_CREATE, (_e, args: CreateContactArgs) => {
    const contact = upsertContact({
      entityId: args.entityId,
      email: args.email,
      displayName: args.displayName ?? null,
      title: args.title ?? null,
    });
    backfillMessagesByEmail(args.email, args.entityId, contact.id);
    return contact;
  });
  ipcMain.handle(IPC_CHANNELS.CONTACTS_FIND_BY_NAME, (_e, query: string) =>
    findSendersByName(query, 20),
  );
  ipcMain.handle(IPC_CHANNELS.MAIL_SEARCH_SENDERS, (_e, args: SearchSendersArgs) =>
    searchSendersByQuery(args.query, args.monthsBack),
  );

  ipcMain.handle(IPC_CHANNELS.JOBS_CHECK_NEW_EMAILS, () => runCheckForNewEmails());
  ipcMain.handle(IPC_CHANNELS.MESSAGES_MARK_ENTITY_READ, (_e, entityId: string) =>
    markEntityMessagesAsRead(entityId),
  );
  ipcMain.handle(
    IPC_CHANNELS.MESSAGES_TOGGLE_READ,
    (_e, args: { id: string; isNew: boolean }) =>
      markMessageReadState(args.id, args.isNew),
  );
  ipcMain.handle(IPC_CHANNELS.MESSAGES_NEW_COUNTS, () => {
    const map = countNewMessagesPerEntity();
    return [...map.entries()].map(([entityId, count]) => ({ entityId, count }));
  });
  ipcMain.handle(IPC_CHANNELS.MESSAGES_NEW_COUNTS_BY_THREAD, (_e, entityId: string) => {
    const map = countNewMessagesByThread(entityId);
    return [...map.entries()].map(([threadId, count]) => ({ threadId, count }));
  });
  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_e, url: string) => {
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    let finalUrl = url;
    try {
      const parsed = new URL(url);
      const isOutlook = /(^|\.)office\.com$|(^|\.)office365\.com$/i.test(
        parsed.hostname,
      );
      if (isOutlook) {
        const account = await getSignedInAccount();
        if (account) {
          if (!parsed.searchParams.has("login_hint")) {
            parsed.searchParams.set("login_hint", account);
          }
          if (!parsed.searchParams.has("ispopout")) {
            parsed.searchParams.set("ispopout", "0");
          }
          finalUrl = parsed.toString();
        }
      }
    } catch {
      // ignore URL parsing errors and use the original URL
    }
    await shell.openExternal(finalUrl);
    return true;
  });

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
  ipcMain.handle(
    IPC_CHANNELS.ACTION_ITEMS_UPDATE_DUE_DATE,
    (_e, args: UpdateActionItemDueDateArgs) =>
      updateActionItemDueDate(args.id, args.dueDate),
  );
  ipcMain.handle(IPC_CHANNELS.ACTION_ITEMS_CREATE, (_e, args: CreateActionItemArgs) =>
    createActionItem({
      entityId: args.entityId,
      threadId: null,
      sourceMessageId: null,
      ownerSide: args.ownerSide,
      description: args.description,
      dueDate: args.dueDate ?? null,
    }),
  );

  ipcMain.handle(IPC_CHANNELS.PENDING_REVIEWS_LIST, () => listOpenPendingReviews());
  ipcMain.handle(IPC_CHANNELS.PENDING_REVIEWS_LIST_REJECTED, () => listRejectedReviews());
  ipcMain.handle(IPC_CHANNELS.PENDING_REVIEWS_REOPEN, (_e, id: string) =>
    reopenPendingReview(id),
  );
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
  ipcMain.handle(IPC_CHANNELS.JOBS_RUN_POLL_AND_CLASSIFY, () => runPollAndClassify());
  ipcMain.handle(IPC_CHANNELS.JOBS_REFRESH_ENTITY_THREADS, (_e, entityId: string) =>
    runThreadRefresherForEntity(entityId),
  );
  ipcMain.handle(IPC_CHANNELS.JOBS_BACKFILL_MAIL, (_e, monthsBack: number) =>
    runBackfillMail(monthsBack),
  );
  ipcMain.handle(
    IPC_CHANNELS.JOBS_BACKFILL_FOR_INVESTOR,
    (_e, args: { entityId: string; monthsBack: number }) =>
      runBackfillForInvestor(args.entityId, args.monthsBack),
  );
};
