import { Bot, Building2, User, Users } from "lucide-react";
import type { Evidence } from "../types";

const ICON = { system: Bot, customer: User, trusted_contact: Users } as const;

function summarise(e: Evidence): string {
  const d = e.detail ?? {};
  if (e.event_type.startsWith("risk_")) return `score ${d.score} → ${d.tier}${d.override ? " (override)" : ""}`;
  if (e.event_type === "money_moved") return `S$${d.amount} moved · balance now S$${d.new_balance}`;
  if (e.event_type === "questions_answered")
    return Object.entries(d).map(([k, v]) => `${k.replace("q_", "")}: ${v ? "YES" : "no"}`).join(" · ");
  if ("note" in d) return `“${d.note}”`;
  if (e.event_type === "message_attached")
    return `${String(d.verdict).replace("_", " ")} · flags: ${(d.flags as string[] | undefined)?.join(", ") || "none"} · “${String(d.text_redacted ?? "").slice(0, 160)}”`;
  if ("minutes" in d) return `wait ${d.minutes} min · until ${String(d.wait_until ?? "").slice(11, 19)} UTC`;
  if ("source" in d && e.event_type === "signal_source") return `signals from: ${String(d.source).replace("_", " ")}`;
  const keys = Object.keys(d).filter((k) => !["signals"].includes(k));
  return keys.map((k) => `${k}: ${typeof d[k] === "object" ? JSON.stringify(d[k]) : String(d[k])}`).join(" · ");
}

export function Timeline({ events }: { events: Evidence[] }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-border pl-5">
      {events.map((e) => {
        const Icon = e.actor.startsWith("staff") ? Building2 : ICON[e.actor as keyof typeof ICON] ?? Bot;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[1.85rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-card">
              <Icon aria-hidden className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm">
              <time dateTime={e.created_at} className="tabular text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</time>{" "}
              <strong>{e.event_type.replace(/_/g, " ")}</strong> <span className="text-muted-foreground">by {e.actor}</span>
            </p>
            <p className="text-sm break-words">{summarise(e)}</p>
          </li>
        );
      })}
    </ol>
  );
}
