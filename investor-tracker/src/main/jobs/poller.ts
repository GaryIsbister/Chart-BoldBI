import { fetchMailDelta } from "../graph/mail";
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
