import { classifyMessage } from "../claude/classifier";
import {
  listEntities,
  findEntityByDomain,
  findEntityByName,
} from "../store/repositories/entities";
import { upsertContact } from "../store/repositories/contacts";
import {
  listRecentUnclassifiedMessages,
  updateMessageContact,
  updateMessageEntity,
  updateThreadEntity,
} from "../store/repositories/messages";
import { createPendingReview, findOpenReviewByEmail } from "../store/repositories/pendingReviews";
import { getSettings } from "../store/repositories/settings";
import { domainFromEmail } from "@shared/util";

export interface DailyClassifierResult {
  classified: number;
  pendingCreated: number;
  errors: string[];
}

export const runDailyClassifier = async (): Promise<DailyClassifierResult> => {
  const settings = getSettings();
  const errors: string[] = [];
  let classified = 0;
  let pendingCreated = 0;

  const messages = listRecentUnclassifiedMessages(200);
  const knownEntities = listEntities().map((e) => e.name);
  const searchContext = settings.investorSearchContext;

  for (const message of messages) {
    try {
      const domain = domainFromEmail(message.fromEmail);
      const existing = domain ? findEntityByDomain(domain) : null;
      if (existing) {
        const contact = upsertContact({
          entityId: existing.id,
          email: message.fromEmail,
          displayName: message.fromName,
        });
        updateMessageContact(message.id, contact.id);
        updateMessageEntity(message.id, existing.id);
        if (message.threadId) updateThreadEntity(message.threadId, existing.id);
        classified += 1;
        continue;
      }

      const result = await classifyMessage({
        message,
        searchContext,
        knownEntities,
      });

      if (!result.isInvestor) continue;

      const existingReview = findOpenReviewByEmail(message.fromEmail);
      if (existingReview) continue;

      const matchedExisting = findEntityByName(result.proposedEntityName);
      createPendingReview({
        email: message.fromEmail,
        displayName: message.fromName,
        domain,
        proposedEntityName: result.proposedEntityName,
        proposedEntityId: matchedExisting?.id ?? null,
        confidence: result.confidence,
        reasoning: result.reasoning,
        matchedDemandBookEntry: null,
        evidenceMessageIds: [message.id],
      });
      pendingCreated += 1;
    } catch (e) {
      errors.push(`message ${message.id}: ${(e as Error).message}`);
    }
  }

  return { classified, pendingCreated, errors };
};
