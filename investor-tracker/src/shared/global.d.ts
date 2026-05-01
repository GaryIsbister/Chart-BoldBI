import type { IpcChannel, IpcRequest, IpcResponse } from "./ipc";

declare global {
  interface Window {
    api: {
      invoke: <C extends IpcChannel>(channel: C, payload: IpcRequest<C>) => Promise<IpcResponse<C>>;
    };
  }
}

export {};
