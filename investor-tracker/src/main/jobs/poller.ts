import {
  fetchMailBackfill,
  fetchMailDelta,
  fetchMailForInvestor,
} from "../graph/mail";
import { listContactsForEntity } from "../store/repositories/contacts";
import { getEntity } from "../store/repositories/entities";
import { backfillMessagesByEmail } from "../store/repositories/messages";
import { fetchTeamsDelta } from "../graph/teams";
import { getSettings } from "../store/repositories/settings";
import type { Message } from "@shared/types";
import { findContactByEmail } from "../store/repositories/contacts";
import { updateMessageContact, updateMessageEntity } from "../store/repositories/messages";
import { runDailyClassifier, type DailyClassifierResult } from "./dailyClassifier";
import { runThreadRefresher, type ThreadRefresherResult } from "./threadRefresher";

export interface PollerResult {
  newMail: number;
  newTeams: number;
  errors: string[];
}

export interface PollAndClassifyResult extends PollerResult {
  classifier: DailyClassifierResult | null;
  threadAnalysis: ThreadRefresherResult | null;
}

export interface BackfillResult {
  monthsBack: number;
  sinceIso: string;
  perFolder: Array<{ folder: string; fetched: number; error: string | null }>;
  totalFetched: number;
  classifier: DailyClassifierResult | null;
  errors: string[];
}

export const runPoller = async (): Promise<PollerResult> => {
  const settings = getSettings();
  const errors: string[] = [];
  let newMail = 0;
  let newTeams = 0;

  for (const folder of settings.watchedFolders) {
    try {
      const fetched = await fetchMailDelta({ folder });
      newMail += fetched.length;
      attachKnownContacts(fetched);
    } catch (e) {
      errors.push(`mail:${folder}: ${(e as Error).message}`);
    }
  }

  try {
    const fetched = await fetchTeamsDelta();
    newTeams += fetched.length;
    attachKnownContacts(fetched);
  } catch (e) {
    errors.push(`teams: ${(e as Error).message}`);
  }

  return { newMail, newTeams, errors };
};

const attachKnownContacts = (messages: Message[]): void => {
  for (const m of messages) {
    if (!m.fromEmail) continue;
    const contact = findContactByEmail(m.fromEmail);
    if (!contact) continue;
    updateMessageContact(m.id, contact.id);
    updateMessageEntity(m.id, contact.entityId);
  }
};

export interface InvestorBackfillResult {
  entityId: string;
  fetched: number;
  linked: number;
  errors: string[];
}

export const runBackfillForInvestor = async (
  entityId: string,
  monthsBack: number,
): Promise<InvestorBackfillResult> => {
  const errors: string[] = [];
  const entity = getEntity(entityId);
  if (!entity) {
    return {
      entityId,
      fetched: 0,
      linked: 0,
      errors: ["entity not found"],
    };
  }
  const contacts = listContactsForEntity(entityId);
  const emails = contacts.map((c) => c.email);
  if (emails.length === 0) {
    return {
      entityId,
      fetched: 0,
      linked: 0,
      errors: ["no contact emails set for this investor"],
    };
  }

  const settings = getSettings();
  let fetched = 0;
  try {
    const messages = await fetchMailForInvestor({
      emails,
      monthsBack,
      folders: settings.watchedFolders,
    });
    fetched = messages.length;
  } catch (e) {
    errors.push(`fetch: ${(e as Error).message}`);
  }

  let linked = 0;
  for (const contact of contacts) {
    try {
      const res = backfillMessagesByEmail(contact.email, entityId, contact.id);
      linked += res.messages;
    } catch (e) {
      errors.push(`link ${contact.email}: ${(e as Error).message}`);
    }
  }

  return { entityId, fetched, linked, errors };
};

export const runBackfillMail = async (
  monthsBack: number,
): Promise<BackfillResult> => {
  const settings = getSettings();
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);
  const sinceIso = since.toISOString();

  const perFolder: BackfillResult["perFolder"] = [];
  const errors: string[] = [];
  let totalFetched = 0;

  for (const folder of settings.watchedFolders) {
    try {
      const fetched = await fetchMailBackfill({ folder, sinceIso });
      perFolder.push({ folder, fetched: fetched.length, error: null });
      totalFetched += fetched.length;
      attachKnownContacts(fetched);
    } catch (e) {
      const msg = (e as Error).message;
      perFolder.push({ folder, fetched: 0, error: msg });
      errors.push(`mail:${folder}: ${msg}`);
    }
  }

  let classifier: DailyClassifierResult | null = null;
  if (totalFetched > 0) {
    try {
      classifier = await runDailyClassifier();
    } catch (e) {
      errors.push(`classifier: ${(e as Error).message}`);
    }
  }

  return {
    monthsBack,
    sinceIso,
    perFolder,
    totalFetched,
    classifier,
    errors,
  };
};

export const runPollAndClassify = async (): Promise<PollAndClassifyResult> => {
  const pollResult = await runPoller();
  let classifier: DailyClassifierResult | null = null;
  let threadAnalysis: ThreadRefresherResult | null = null;
  const errors = [...pollResult.errors];

  try {
    classifier = await runDailyClassifier();
  } catch (e) {
    errors.push(`classifier: ${(e as Error).message}`);
  }

  try {
    threadAnalysis = await runThreadRefresher();
  } catch (e) {
    errors.push(`threadAnalysis: ${(e as Error).message}`);
  }

  return {
    ...pollResult,
    errors,
    classifier,
    threadAnalysis,
  };
};
