import type { IpcContract } from "../../../shared/ipc-channels.js";
import { messageRepo, threadRepo } from "../../store/repositories.js";

export const threadHandlers = {
  "threads:list": async (
    arg?: { entityId?: string },
  ): Promise<IpcContract["threads:list"]["result"]> => {
    return threadRepo.list(arg?.entityId);
  },
  "threads:messages": async (
    threadId: string,
  ): Promise<IpcContract["threads:messages"]["result"]> => {
    return messageRepo.byThread(threadId);
  },
};
