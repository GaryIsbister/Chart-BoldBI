import type Database from "better-sqlite3";
import { analyzeThread } from "../claude/threadAnalyzer";
import { EntitiesRepo } from "../store/repositories/entities";
import { MessagesRepo } from "../store/repositories/messages";
import { ActionItemsRepo } from "../store/repositories/actionItems";

// Refreshes summaries, stage suggestions, and action items for threads
// belonging to confirmed entities. Run after the poller when new messages arrive.
export const refreshEntityThreads = async (db: Database.Database, entityId: string): Promise<void> => {
  const messagesRepo = new MessagesRepo(db);
  const entitiesRepo = new EntitiesRepo(db);
  const actionItemsRepo = new ActionItemsRepo(db);

  const entity = entitiesRepo.get(entityId);
  if (!entity) return;
  const threads = messagesRepo.listThreadsForEntity(entityId);

  for (const thread of threads) {
    const messages = messagesRepo.listForThread(thread.id);
    if (!messages.length) continue;
    try {
      const analysis = await analyzeThread(thread.subject, messages);

      // Stage suggestion — never override a manual override.
      if (!entity.stageManualOverride && analysis.inferredStage !== entity.pipelineStage) {
        entitiesRepo.setStage(entity.id, analysis.inferredStage, {
          changedBy: "claude",
          reason: analysis.stageRationale,
          parkedUntil: analysis.parkedUntil,
        });
      }

      // Action items — keyed by description for now, refined when we add stable IDs from Claude.
      const existing = actionItemsRepo.list({ entityId: entity.id });
      const existingByKey = new Map(existing.map((a) => [`${a.ownerSide}:${a.description}`, a]));
      const externalIdToInternal = new Map(messages.map((m) => [m.externalId, m.id]));

      for (const ai of analysis.actionItems) {
        const key = `${ai.ownerSide}:${ai.description}`;
        const found = existingByKey.get(key);
        const sourceMessageId = ai.sourceMessageExternalId
          ? externalIdToInternal.get(ai.sourceMessageExternalId) ?? null
          : null;
        const resolvedByMessageId = ai.resolvedByMessageExternalId
          ? externalIdToInternal.get(ai.resolvedByMessageExternalId) ?? null
          : null;
        actionItemsRepo.upsert({
          id: found?.id,
          entityId: entity.id,
          threadId: thread.id,
          sourceMessageId,
          ownerSide: ai.ownerSide,
          description: ai.description,
          dueDate: ai.dueDate,
          status: ai.status,
          resolvedAt: ai.status === "done" ? new Date().toISOString() : null,
          resolvedByMessageId,
        });
      }
    } catch (e) {
      console.error(`thread analysis failed for ${thread.id}:`, e);
    }
  }
};
