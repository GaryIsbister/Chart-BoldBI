import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
});
