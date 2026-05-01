import type { IpcContract } from "../../../shared/ipc-channels.js";
import { contactRepo } from "../../store/repositories.js";

export const contactHandlers = {
  "contacts:list": async (
    arg?: { entityId?: string },
  ): Promise<IpcContract["contacts:list"]["result"]> => {
    return contactRepo.list(arg?.entityId);
  },
  "contacts:assignToEntity": async (
    arg: { contactId: string; entityId: string | null },
  ): Promise<IpcContract["contacts:assignToEntity"]["result"]> => {
    return contactRepo.assignToEntity(arg.contactId, arg.entityId);
  },
};
