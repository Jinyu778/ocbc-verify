/** Fail-safe drafts: when OCBC is unreachable, the payment is saved on the phone, never sent. */
export interface OfflineDraft {
  payee_id: number;
  payee_name: string;
  amount: string;
  at: number;
}
const KEY = "sb.offlineDrafts";

export function listOfflineDrafts(): OfflineDraft[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function addOfflineDraft(d: Omit<OfflineDraft, "at">): OfflineDraft[] {
  const next = [...listOfflineDrafts(), { ...d, at: Date.now() }];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
export function removeOfflineDraft(at: number): OfflineDraft[] {
  const next = listOfflineDrafts().filter((d) => d.at !== at);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
