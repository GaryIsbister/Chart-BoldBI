import type { IpcChannel } from "./ipc";

declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: IpcChannel, payload?: unknown) => Promise<T>;
    };
  }
}

export {};
