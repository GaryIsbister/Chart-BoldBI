import { classifyMessage } from "../claude/classifier";
import { buildDemandBookContext, findDemandBookMatchByEmail } from "../claude/demandBook";
import {
  listEntities,
  findEntityByDomain,
  findEntityByName,
  createEntity,
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
  const demandBookContext = buildDemandBookContext();

  for (const message of messages) {
    try {
      const domain = domainFromEmail(message.fromEmail);
      const existing =
        (domain ? findEntityByDomain(domain) : null) ??
        (await Promise.resolve(null));
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
        demandBookContext,
        knownEntities,
      });

      if (!result.isInvestor) continue;

      if (result.confidence >= settings.pendingReviewThreshold) {
        const matchedEntity =
          findEntityByName(result.proposedEntityName) ??
          createEntity({
            name: result.proposedEntityName,
            domain,
          });
        const contact = upsertContact({
          entityId: matchedEntity.id,
          email: message.fromEmail,
          displayName: message.fromName,
        });
        updateMessageContact(message.id, contact.id);
        updateMessageEntity(message.id, matchedEntity.id);
        if (message.threadId) updateThreadEntity(message.threadId, matchedEntity.id);
        classified += 1;
      } else {
        const existingReview = findOpenReviewByEmail(message.fromEmail);
        if (existingReview) continue;
        const matched = findDemandBookMatchByEmail(message.fromEmail);
        createPendingReview({
          email: message.fromEmail,
          displayName: message.fromName,
          domain,
          proposedEntityName: result.proposedEntityName,
          proposedEntityId: null,
          confidence: result.confidence,
          reasoning: result.reasoning,
          matchedDemandBookEntry: matched?.entityName ?? result.matchedDemandBookEntry,
          evidenceMessageIds: [message.id],
        });
        pendingCreated += 1;
      }
    } catch (e) {
      errors.push(`message ${message.id}: ${(e as Error).message}`);
    }
  }

  return { classified, pendingCreated, errors };
};
