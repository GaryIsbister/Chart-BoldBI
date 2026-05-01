import { domainFromEmail } from "@shared/util";
import { getDb } from "../store/db";
import { ContactsRepo } from "../store/repositories/contacts";
import { EntitiesRepo } from "../store/repositories/entities";
import { MessagesRepo } from "../store/repositories/messages";
import { PendingReviewsRepo } from "../store/repositories/pendingReviews";
import { DemandBookRepo, SettingsRepo } from "../store/repositories/settings";
import { classifySender } from "../claude/classifier";
import { refreshRecentThreads } from "./threadRefresher";

const STALE_DAYS_FOR_DECLINED_FROM_PARKED = 60;

export const runDailyClassifier = async (): Promise<void> => {
  const db = getDb();
  const settings = new SettingsRepo(db).get();
  const messages = new MessagesRepo(db);
  const contacts = new ContactsRepo(db);
  const entities = new EntitiesRepo(db);
  const pending = new PendingReviewsRepo(db);
  const demand = new DemandBookRepo(db);

  const unclassified = messages.listUnclassified(100);
  const seen = new Set<string>();
  for (const m of unclassified) {
    if (seen.has(m.fromEmail.toLowerCase())) continue;
    seen.add(m.fromEmail.toLowerCase());
    const undecided = pending.findUndecidedByEmail(m.fromEmail);
    if (undecided) continue;

    const recent = messages.listFromSender(m.fromEmail, 5);
    const knownEntities = entities.list().map((e) => ({ name: e.name, domain: e.domain }));
    const demandList = demand.listAll();
    let result;
    try {
      result = await classifySender({
        email: m.fromEmail,
        displayName: m.fromName,
        domain: domainFromEmail(m.fromEmail),
        subjectsAndPreviews: recent.map((r) => ({ subject: r.subject, preview: r.bodyPreview })),
        knownEntities,
        demandBook: demandList,
        model: settings.classifierModel,
      });
    } catch (err) {
      console.error("daily classifier failed", err);
      continue;
    }

    if (!result.isInvestor) continue;

    const matched = entities.findByName(result.proposedEntityName);
    if (result.confidence >= settings.pendingReviewThreshold) {
      const target =
        matched ??
        entities.create({
          name: result.proposedEntityName,
          domain: domainFromEmail(m.fromEmail),
        });
      const contact = contacts.upsert({
        entityId: target.id,
        email: m.fromEmail,
        displayName: m.fromName,
      });
      messages.attachContactAndEntity(m.id, contact.id, target.id);
    } else {
      pending.insert({
        email: m.fromEmail,
        displayName: m.fromName,
        domain: domainFromEmail(m.fromEmail),
        proposedEntityName: result.proposedEntityName || m.fromName || m.fromEmail,
        proposedEntityId: matched?.id ?? null,
        confidence: result.confidence,
        reasoning: result.reasoning,
        matchedDemandBookEntry: result.matchedDemandBookEntry,
        evidenceMessageIds: recent.map((r) => r.id),
      });
    }
  }

  for (const e of entities.list()) {
    if (e.pipelineStage === "parked" && e.parkedUntil && e.parkedUntil < new Date().toISOString()) {
      entities.park(e.id, null);
    }
    if (e.pipelineStage === "parked" && !e.parkedUntil) {
      const days = messages.daysSinceLastMessage(e.id);
      if (days !== null && days > STALE_DAYS_FOR_DECLINED_FROM_PARKED && !e.stageManualOverride) {
        entities.setStage(e.id, "declined", "claude", `no activity for ${days} days while parked`);
      }
    }
  }

  await refreshRecentThreads(24 * 7);
};
