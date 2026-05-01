import type { IpcChannel } from "@shared/ipc";

export const invoke = <T = unknown>(channel: IpcChannel, payload?: unknown): Promise<T> =>
  window.api.invoke<T>(channel, payload);
