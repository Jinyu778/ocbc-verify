import { CheckCircle2, Clock, PauseCircle, PhoneCall, ShieldAlert, Users, XCircle, Search } from "lucide-react";
import type { Status } from "../types";

export function StatusIcon({ status }: { status: Status }) {
  const cls = "h-6 w-6 shrink-0";
  switch (status) {
    case "sent":
    case "approved_by_staff":
      return <CheckCircle2 aria-hidden className={`${cls} text-success`} />;
    case "cancelled":
      return <XCircle aria-hidden className={`${cls} text-muted-foreground`} />;
    case "saved_for_later":
      return <Clock aria-hidden className={`${cls} text-warning`} />;
    case "waiting_trusted_contact":
      return <Users aria-hidden className={`${cls} text-warning`} />;
    case "in_verification_call":
      return <PhoneCall aria-hidden className={`${cls} text-secondary`} />;
    case "under_staff_review":
      return <Search aria-hidden className={`${cls} text-secondary`} />;
    case "escalated":
      return <ShieldAlert aria-hidden className={`${cls} text-danger`} />;
    default:
      return <PauseCircle aria-hidden className={`${cls} text-warning`} />;
  }
}
