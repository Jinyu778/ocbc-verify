import type { Tier } from "@/design";

export interface Payee {
  id: number;
  name: string;
  account_ref: string;
  is_new: boolean;
}
export interface Reason {
  key: string;
  points: number;
  text: string;
}
export type Status =
  | "draft"
  | "checking"
  | "sent"
  | "paused"
  | "saved_for_later"
  | "waiting_trusted_contact"
  | "in_verification_call"
  | "under_staff_review"
  | "cancelled"
  | "escalated"
  | "approved_by_staff";
export interface Transfer {
  id: number;
  payee: { id: number; name: string; is_new: boolean };
  amount: string;
  status: Status;
  risk_score: number;
  risk_tier: Tier;
  reasons: Reason[];
  signals: Record<string, unknown>;
  answers: Record<string, boolean> | null;
  wait_until: string | null;
  pause_shown_at: string | null;
  /** null while the customer still has to hang up, or before the pause screen was shown */
  continue_anyway_at: string | null;
  /** a phone call is part of this payment: Continue anyway needs the call to end first */
  hang_up_required: boolean;
  call_ended_at: string | null;
  trusted_requested_at: string | null;
  trusted_timeout_at: string | null;
  trusted_decision: "ok" | "stop" | null;
  trusted_contact_name: string | null;
  active_call_id: number | null;
  payee_reported: boolean;
  code_word_prompt: boolean;
  code_word_set: boolean;
  next_step: "questions" | "confirm" | "pause" | "saved" | "trusted" | "call" | "done";
  created_at: string;
  completed_at: string | null;
}
export interface CallInfo {
  id: number;
  status: "ringing" | "active" | "ended";
  mode: "voice" | "text";
  initiated_by: "customer" | "staff";
  transfer_id: number | null;
  customer: { id: number; display_name: string };
  staff: { id: number; display_name: string } | null;
  signed_token: string;
  started_at: string;
  ended_at: string | null;
}
export interface MessageFlag {
  key: string;
  strong: boolean;
  explanation: string;
  spans: [number, number][];
  phrases: string[];
}
export interface CheckResult {
  id: number;
  verdict: "likely_scam" | "be_careful" | "no_signs" | "not_sure";
  ml_probability: number;
  flags: MessageFlag[];
}
