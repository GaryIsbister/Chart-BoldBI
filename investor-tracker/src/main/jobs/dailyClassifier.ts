import type Database from "better-sqlite3";
import { classifySender } from "../claude/classifier";
import { MessagesRepo } from "../store/repositories/messages";
import { PendingReviewsRepo } from "../store/repositories/pendingReviews";
import { SettingsRepo } from "../store/repositories/settings";
import { domainFromEmail } from "@shared/util";

export interface DailyClassifierResult {
  reviewed: number;
  queued: number;
}

export const runDailyClassifier = async (db: Database.Database): Promise<DailyClassifierResult> => {
  const messagesRepo = new MessagesRepo(db);
  const pending = new PendingReviewsRepo(db);
  const settingsRepo = new SettingsRepo(db);
  const settings = settingsRepo.get();
  const demandBook = settingsRepo.getDemandBookContext() ?? "(no demand book imported yet)";

  const since = new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString();
  const senders = messagesRepo.newSendersSince(since);

  let reviewed = 0;
  let queued = 0;

  for (const s of senders) {
    if (pending.isQueuedOrIgnored(s.email)) continue;
    reviewed += 1;
    const recent = messagesRepo.recentMessagesFromSender(s.email, 5);
    try {
      const result = await classifySender({
        demandBookContext: demandBook,
        email: s.email,
        displayName: s.displayName,
        recentMessages: recent,
      });
      if (result.isPotentialInvestor && result.confidence >= settings.pendingReviewThreshold) {
        pending.create({
          email: s.email,
          displayName: s.displayName,
          domain: domainFromEmail(s.email),
          proposedEntityName: result.proposedEntityName,
          proposedEntityId: null,
          confidence: result.confidence,
          reasoning: result.reasoning,
          matchedDemandBookEntry: result.matchedDemandBookEntry,
          evidenceMessageIds: recent.map((m) => m.id),
        });
        queued += 1;
      }
    } catch (e) {
      console.error(`classifier failed for ${s.email}:`, e);
    }
  }

  return { reviewed, queued };
};
