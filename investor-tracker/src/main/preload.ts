import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannel, IpcRequest, IpcResponse } from "@shared/ipc";

const invoke = <C extends IpcChannel>(channel: C, payload: IpcRequest<C>): Promise<IpcResponse<C>> =>
  ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("api", { invoke });
