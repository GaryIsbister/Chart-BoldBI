import { loadConfig } from "../config.js";
import {
  getAttachmentBytes,
  listAttachments,
  searchMessagesFromSender,
} from "../graph/mail.js";
import { parseDemandBookPdf } from "../claude/parse-demand-book.js";
import { entityRepo } from "../store/repositories.js";

export async function importDemandBookOnce(): Promise<{
  imported: number;
  entitiesAdded: number;
}> {
  const cfg = loadConfig();
  const messages = await searchMessagesFromSender(
    cfg.polling.demandBookSenderEmail,
    5,
  );

  for (const m of messages) {
    const attachments = await listAttachments(m.id);
    const pdf = attachments.find(
      (a) =>
        a.contentType === "application/pdf" ||
        a.name.toLowerCase().endsWith(".pdf"),
    );
    if (!pdf) continue;

    const bytes = await getAttachmentBytes(m.id, pdf.id);
    const { result } = await parseDemandBookPdf(bytes, pdf.name);

    let added = 0;
    for (const e of result.entities) {
      const existing = e.domains
        .map((d) => entityRepo.findByDomain(d.toLowerCase()))
        .find(Boolean);
      const upserted = entityRepo.upsert({
        ...(existing?.id ? { id: existing.id } : {}),
        name: e.name,
        domains: e.domains.map((d) => d.toLowerCase()),
        classification: "investor",
        classificationReason: "imported from demand book",
        notes: e.status,
      });
      if (!existing) added++;
      void upserted;
    }
    return { imported: result.entities.length, entitiesAdded: added };
  }

  return { imported: 0, entitiesAdded: 0 };
}
