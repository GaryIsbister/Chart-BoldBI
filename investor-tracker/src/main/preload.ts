import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannel, IpcContract } from "../shared/ipc-channels.js";

const api = {
  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcContract[C]["args"]
  ): Promise<IpcContract[C]["result"]> {
    return ipcRenderer.invoke(channel, ...args);
  },
};

contextBridge.exposeInMainWorld("investorTracker", api);

declare global {
  interface Window {
    investorTracker: typeof api;
  }
}
