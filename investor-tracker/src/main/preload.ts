import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "@shared/ipc";

const invoke = (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);

const api = {
  authStatus: invoke(IPC.authStatus),
  authStartDeviceCode: invoke(IPC.authStartDeviceCode),
  authSignOut: invoke(IPC.authSignOut),
  setAnthropicKey: invoke(IPC.setAnthropicKey),
  hasAnthropicKey: invoke(IPC.hasAnthropicKey),
  getSettings: invoke(IPC.getSettings),
  updateSettings: invoke(IPC.updateSettings),
  listEntities: invoke(IPC.listEntities),
  getEntity: invoke(IPC.getEntity),
  setEntityStage: invoke(IPC.setEntityStage),
  setEntityNotes: invoke(IPC.setEntityNotes),
  parkEntity: invoke(IPC.parkEntity),
  listPendingReviews: invoke(IPC.listPendingReviews),
  decidePendingReview: invoke(IPC.decidePendingReview),
  listOpenActionItems: invoke(IPC.listOpenActionItems),
  setActionItemStatus: invoke(IPC.setActionItemStatus),
  listThreadsForEntity: invoke(IPC.listThreadsForEntity),
  dashboardSummary: invoke(IPC.dashboardSummary),
  triggerPollNow: invoke(IPC.triggerPollNow),
  triggerDailyClassifierNow: invoke(IPC.triggerDailyClassifierNow),
};

contextBridge.exposeInMainWorld("api", api);
