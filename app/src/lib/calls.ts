import { api } from "@/design";
import type { CallInfo } from "../types";

export const startSafeBankCall = (transferId: number | null) =>
  api<CallInfo>("/api/calls", { method: "POST", body: { transfer_id: transferId } });
