import type { Tier } from "@/design";

export interface Reason {
  key: string;
  points: number;
  text: string;
}
export interface CaseRow {
  id: number;
  payee: { id: number; name: string; is_new: boolean };
  amount: string;
  status: string;
  risk_score: number;
  risk_tier: Tier;
  reasons: Reason[];
  signals: Record<string, unknown>;
  answers: Record<string, boolean> | null;
  trusted_decision: "ok" | "stop" | null;
  trusted_contact_name: string | null;
  active_call_id: number | null;
  payee_reported: boolean;
  code_word_prompt: boolean;
  code_word_set: boolean;
  false_positive: boolean;
  created_at: string;
  customer: { id: number; display_name: string; age: number | null };
  waiting_seconds: number;
  is_new_payee: boolean;
  /** the customer used "Continue anyway" on a warning: worth a follow-up call */
  continued_anyway: boolean;
}
export interface CallInfo {
  id: number;
  status: "ringing" | "active" | "ended";
  mode: "voice" | "text";
  initiated_by: "customer" | "staff";
  transfer_id: number | null;
  customer: { id: number; display_name: string };
  staff: { id: number; display_name: string } | null;
  started_at: string;
  ended_at: string | null;
}
export interface Evidence {
  id: number;
  actor: string;
  event_type: string;
  detail: Record<string, unknown>;
  created_at: string;
}
export interface CaseDetail extends CaseRow {
  usual: { mean: string; std: string; times_usual: number | null };
  evidence: Evidence[];
  calls: CallInfo[];
  staff_actions: { id: number; staff: string; action: string; note: string; created_at: string }[];
  attached_messages: { id: number; text_redacted: string; verdict: string; flags: string[]; ml_probability: number; review_status: string; created_at: string }[];
}
export interface Summary {
  cases_today: number;
  paused: number;
  waiting_trusted_contact: number;
  in_call: number;
  cancelled: number;
  money_protected: string;
}
export const STATUS_LABEL: Record<string, string> = {
  checking: "Answering questions",
  sent: "Sent",
  paused: "Paused",
  saved_for_later: "Saved for later",
  waiting_trusted_contact: "Waiting on trusted contact",
  in_verification_call: "In verification call",
  under_staff_review: "Needs staff review",
  cancelled: "Cancelled",
  escalated: "Escalated to ASC",
  approved_by_staff: "Approved by staff",
};
export const TIER_LABEL: Record<Tier, string> = { pause: "High", ask: "Medium", none: "Low" };
