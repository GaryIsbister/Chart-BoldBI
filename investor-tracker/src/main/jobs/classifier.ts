import { getDb } from "../store/db.js";
import {
  contactRepo,
  entityRepo,
  messageRepo,
} from "../store/repositories.js";
import {
  classifyContacts,
  type ContactForClassification,
} from "../claude/classify.js";

const BATCH_SIZE = 25;

export async function runDailyClassifierOnce(): Promise<number> {
  const candidates = contactRepo.unclassified(200);
  if (candidates.length === 0) {
    recordRun({ contactsSeen: 0, entitiesAdded: 0, classificationsChanged: 0 });
    return 0;
  }

  const demandBookText = buildDemandBookContext();

  let totalClassified = 0;
  let entitiesAdded = 0;
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const payload: ContactForClassification[] = batch.map((c) => ({
      contactId: c.id,
      displayName: c.displayName,
      email: c.email,
      domain: c.email ? (c.email.split("@")[1] ?? null) : null,
      recentSnippets: messageRepo
        .byThread("")
        .slice(0, 0)
        .map(() => ""),
    }));

    for (let k = 0; k < batch.length; k++) {
      const contact = batch[k];
      const item = payload[k];
      if (!contact || !item) continue;
      const snippets = recentSnippetsForContact(contact.id);
      item.recentSnippets = snippets;
    }

    const { result, usage } = await classifyContacts({
      demandBookText,
      contacts: payload,
    });
    inputTokens += usage.inputTokens;
    cachedInputTokens += usage.cachedInputTokens;
    outputTokens += usage.outputTokens;

    for (const c of result.classifications) {
      const entityId = applyClassification(c);
      if (entityId.created) entitiesAdded++;
      contactRepo.assignToEntity(c.contactId, entityId.id);
      totalClassified++;
    }
  }

  recordRun({
    contactsSeen: candidates.length,
    entitiesAdded,
    classificationsChanged: totalClassified,
    inputTokens,
    cachedInputTokens,
    outputTokens,
  });
  return totalClassified;
}

function recentSnippetsForContact(contactId: string): string[] {
  type Row = { body_preview: string; received_at: string };
  const rows = getDb()
    .prepare(
      `SELECT body_preview, received_at FROM messages
       WHERE from_contact_id = ?
       ORDER BY received_at DESC LIMIT 3`,
    )
    .all(contactId) as Row[];
  return rows.map((r) => r.body_preview);
}

function buildDemandBookContext(): string {
  const investors = entityRepo.list("investor");
  const lines = investors.map(
    (e) =>
      `- id=${e.id} name="${e.name}" domains=${JSON.stringify(e.domains)}` +
      (e.notes ? ` notes="${e.notes}"` : ""),
  );
  return [
    "Tracked investor entities (use existingEntityId when a contact's domain matches):",
    ...lines,
  ].join("\n");
}

function applyClassification(c: {
  decision: "investor" | "not_investor" | "uncertain";
  reason: string;
  entity: {
    existingEntityId: string | null;
    suggestedName: string;
    suggestedDomain: string | null;
  };
}): { id: string; created: boolean } {
  if (c.entity.existingEntityId) {
    const existing = entityRepo.get(c.entity.existingEntityId);
    if (existing) {
      const newDomains =
        c.entity.suggestedDomain &&
        !existing.domains.includes(c.entity.suggestedDomain.toLowerCase())
          ? [...existing.domains, c.entity.suggestedDomain.toLowerCase()]
          : existing.domains;
      const updated = entityRepo.upsert({
        id: existing.id,
        name: existing.name,
        domains: newDomains,
        classification: c.decision,
        classificationReason: c.reason,
      });
      return { id: updated.id, created: false };
    }
  }
  const created = entityRepo.upsert({
    name: c.entity.suggestedName,
    domains: c.entity.suggestedDomain ? [c.entity.suggestedDomain.toLowerCase()] : [],
    classification: c.decision,
    classificationReason: c.reason,
  });
  return { id: created.id, created: true };
}

function recordRun(r: {
  contactsSeen: number;
  entitiesAdded: number;
  classificationsChanged: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  error?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO classification_runs
       (run_at, contacts_seen, entities_added, classifications_changed,
        input_tokens, cached_input_tokens, output_tokens, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      new Date().toISOString(),
      r.contactsSeen,
      r.entitiesAdded,
      r.classificationsChanged,
      r.inputTokens ?? null,
      r.cachedInputTokens ?? null,
      r.outputTokens ?? null,
      r.error ?? null,
    );
}
