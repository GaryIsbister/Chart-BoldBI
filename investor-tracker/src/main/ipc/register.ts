import type { IpcMain } from "electron";
import type { IpcChannel, IpcContract } from "../../shared/ipc-channels.js";
import { authHandlers } from "./handlers/auth.js";
import { entityHandlers } from "./handlers/entities.js";
import { contactHandlers } from "./handlers/contacts.js";
import { threadHandlers } from "./handlers/threads.js";
import { jobHandlers } from "./handlers/jobs.js";
import { settingsHandlers } from "./handlers/settings.js";

type Handler<C extends IpcChannel> = (
  ...args: IpcContract[C]["args"]
) => Promise<IpcContract[C]["result"]> | IpcContract[C]["result"];

type HandlerMap = { [C in IpcChannel]: Handler<C> };

export function registerIpcHandlers(ipcMain: IpcMain): void {
  const handlers: HandlerMap = {
    ...authHandlers,
    ...entityHandlers,
    ...contactHandlers,
    ...threadHandlers,
    ...jobHandlers,
    ...settingsHandlers,
  };

  for (const channel of Object.keys(handlers) as IpcChannel[]) {
    ipcMain.handle(channel, async (_event, ...args) => {
      const fn = handlers[channel] as (...a: unknown[]) => unknown;
      return await fn(...args);
    });
  }
}
