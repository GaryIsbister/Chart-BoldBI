import type {
  IpcChannel,
  IpcContract,
} from "../../shared/ipc-channels.js";

declare global {
  interface Window {
    investorTracker: {
      invoke<C extends IpcChannel>(
        channel: C,
        ...args: IpcContract[C]["args"]
      ): Promise<IpcContract[C]["result"]>;
    };
  }
}

export {};
