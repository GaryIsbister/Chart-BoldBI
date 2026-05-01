import type { IpcContract } from "../../../shared/ipc-channels.js";
import { runPollerOnce, getPollerStatus } from "../../jobs/poller.js";
import { runDailyClassifierOnce } from "../../jobs/classifier.js";
import { importDemandBookOnce } from "../../jobs/demand-book.js";

export const jobHandlers = {
  "jobs:pollNow": async (): Promise<IpcContract["jobs:pollNow"]["result"]> => {
    return await runPollerOnce();
  },
  "jobs:classifyNow": async (): Promise<
    IpcContract["jobs:classifyNow"]["result"]
  > => {
    const classified = await runDailyClassifierOnce();
    return { classified };
  },
  "jobs:importDemandBook": async (): Promise<
    IpcContract["jobs:importDemandBook"]["result"]
  > => {
    return await importDemandBookOnce();
  },
  "jobs:status": async (): Promise<IpcContract["jobs:status"]["result"]> => {
    return getPollerStatus();
  },
};
