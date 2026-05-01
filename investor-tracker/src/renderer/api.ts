import type { IpcChannel, IpcRequest, IpcResponse } from "@shared/ipc";

export const api = {
  invoke: <C extends IpcChannel>(channel: C, payload: IpcRequest<C>): Promise<IpcResponse<C>> =>
    window.api.invoke(channel, payload),
};
