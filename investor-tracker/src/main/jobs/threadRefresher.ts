import { analyzeThread, applyAnalysis } from "../claude/threadAnalyzer";
import { getDb } from "../store/db";

export interface ThreadRefresherResult {
  refreshed: number;
  errors: string[];
}

export const runThreadRefresher = async (limit = 10): Promise<ThreadRefresherResult> => {
  const db = getDb();
  const errors: string[] = [];
  let refreshed = 0;

  const rows = db
    .prepare(
      `SELECT id, entity_id FROM threads
       WHERE entity_id IS NOT NULL
       ORDER BY last_message_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{ id: string; entity_id: string }>;

  for (const row of rows) {
    try {
      const analysis = await analyzeThread(row.id, row.entity_id);
      applyAnalysis(row.id, row.entity_id, analysis);
      refreshed += 1;
    } catch (e) {
      errors.push(`thread ${row.id}: ${(e as Error).message}`);
    }
  }

  return { refreshed, errors };
};

export const runThreadRefresherForEntity = async (
  entityId: string,
): Promise<ThreadRefresherResult> => {
  const db = getDb();
  const errors: string[] = [];
  let refreshed = 0;

  const rows = db
    .prepare(
      `SELECT id FROM threads WHERE entity_id = ? ORDER BY last_message_at DESC`,
    )
    .all(entityId) as Array<{ id: string }>;

  for (const row of rows) {
    try {
      const analysis = await analyzeThread(row.id, entityId);
      applyAnalysis(row.id, entityId, analysis);
      refreshed += 1;
    } catch (e) {
      errors.push(`thread ${row.id}: ${(e as Error).message}`);
    }
  }

  return { refreshed, errors };
};
