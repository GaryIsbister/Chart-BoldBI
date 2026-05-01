import type { IpcContract } from "../../../shared/ipc-channels.js";
import { hasClaudeKey, setClaudeKey } from "../../claude/key-store.js";

export const settingsHandlers = {
  "settings:getClaudeKeyPresent": async (): Promise<
    IpcContract["settings:getClaudeKeyPresent"]["result"]
  > => {
    return await hasClaudeKey();
  },
  "settings:setClaudeKey": async (
    key: string,
  ): Promise<IpcContract["settings:setClaudeKey"]["result"]> => {
    await setClaudeKey(key);
  },
};
