import type { IpcContract } from "../../../shared/ipc-channels.js";
import { entityRepo } from "../../store/repositories.js";

export const entityHandlers = {
  "entities:list": async (
    arg?: { classification?: string },
  ): Promise<IpcContract["entities:list"]["result"]> => {
    return entityRepo.list(arg?.classification);
  },
  "entities:get": async (
    id: string,
  ): Promise<IpcContract["entities:get"]["result"]> => {
    return entityRepo.get(id);
  },
  "entities:setClassification": async (
    arg: { id: string; classification: string; reason?: string },
  ): Promise<IpcContract["entities:setClassification"]["result"]> => {
    return entityRepo.setClassification(arg.id, arg.classification, arg.reason ?? null);
  },
};
