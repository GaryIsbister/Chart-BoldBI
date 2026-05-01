import { getDb } from "../store/db";
import { ActionItemsRepo } from "../store/repositories/actionItems";
import { EntitiesRepo } from "../store/repositories/entities";
import { MessagesRepo } from "../store/repositories/messages";
import { SettingsRepo } from "../store/repositories/settings";
import { analyzeThread } from "../claude/threadAnalyzer";

export const refreshRecentThreads = async (
  windowHours = 24,
): Promise<void> => {
  const db = getDb();
  const settings = new SettingsRepo(db).get();
  const messages = new MessagesRepo(db);
  const entities = new EntitiesRepo(db);
  const actionItems = new ActionItemsRepo(db);

  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
  const threads = messages.listRecentlyActiveThreads(since);

  for (const thread of threads) {
    if (!thread.entityId) continue;
    const entity = entities.get(thread.entityId);
    if (!entity) continue;
    const threadMessages = messages.listForThread(thread.id);
    if (threadMessages.length === 0) continue;
    const open = actionItems.listOpenForThread(thread.id);

    let analysis;
    try {
      analysis = await analyzeThread({
        entityName: entity.name,
        currentStage: entity.pipelineStage,
        manualOverride: entity.stageManualOverride,
        messages: threadMessages.map((m) => ({
          direction: m.isFromUs ? "from_us" : "from_them",
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          receivedAt: m.receivedAt,
          subject: m.subject,
          bodyPreview: m.bodyPreview,
        })),
        openActionItems: open.map((a) => ({
          id: a.id,
          ownerSide: a.ownerSide,
          description: a.description,
        })),
        model: settings.synthesisModel,
      });
    } catch (err) {
      console.error("thread analyze failed", err);
      continue;
    }

    messages.setThreadSummary(thread.id, analysis.summary);

    if (
      !entity.stageManualOverride &&
      analysis.proposedStage !== entity.pipelineStage
    ) {
      entities.setStage(entity.id, analysis.proposedStage, "claude", analysis.stageReason);
    }

    const lastMessage = threadMessages[threadMessages.length - 1];
    for (const item of analysis.actionItems) {
      const exists = open.some(
        (o) => o.description.toLowerCase() === item.description.toLowerCase(),
      );
      if (exists) continue;
      actionItems.insert({
        entityId: entity.id,
        threadId: thread.id,
        sourceMessageId: lastMessage?.id ?? null,
        ownerSide: item.ownerSide,
        description: item.description,
        dueDate: item.dueDate,
      });
    }

    for (const resolvedDesc of analysis.resolvedActionItemDescriptions) {
      const match = open.find(
        (o) => o.description.toLowerCase() === resolvedDesc.toLowerCase(),
      );
      if (match) actionItems.setStatus(match.id, "done", lastMessage?.id ?? null);
    }
  }
};
