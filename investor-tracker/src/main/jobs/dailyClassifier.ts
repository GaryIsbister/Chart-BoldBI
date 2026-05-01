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
import {
  createPendingReview,
  findLatestReviewByEmail,
  findOpenReviewByEmail,
} from "../store/repositories/pendingReviews";
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
  const searchKeywords = settings.searchKeywords;
  const lowerKeywords = searchKeywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
  const prefilter = settings.keywordPrefilterEnabled && lowerKeywords.length > 0;
  const matchesAnyKeyword = (text: string): boolean =>
    lowerKeywords.some((k) => text.includes(k));

  for (const message of messages) {
    try {
      const priorReview = findLatestReviewByEmail(message.fromEmail);
      if (priorReview?.decision === "reject") continue;

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

      if (prefilter) {
        const haystack = [
          message.fromEmail,
          message.fromName ?? "",
          message.subject ?? "",
          message.bodyPreview,
          domain ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!matchesAnyKeyword(haystack)) continue;
      }

      const result = await classifyMessage({
        message,
        searchContext,
        searchKeywords,
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
