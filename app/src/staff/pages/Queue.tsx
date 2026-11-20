import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Ban, Clock, Flag, PauseCircle, PhoneCall, PiggyBank, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Banner, Button, RiskChip, Skeleton, api, cx, formatSGD, timeAgo, useNow, type Tier } from "@/design";
import { STATUS_LABEL, TIER_LABEL, type CaseRow, type Summary } from "../types";
import { CaseDrawer } from "../components/CaseDrawer";

const STATUS_FILTERS = [
  ["", "All open & recent"],
  ["paused,checking", "Paused"],
  ["waiting_trusted_contact", "Waiting on trusted contact"],
  ["in_verification_call", "In call"],
  ["under_staff_review", "Needs review"],
  ["saved_for_later", "Saved for later"],
  ["escalated", "Escalated"],
  ["cancelled", "Cancelled"],
  ["sent,approved_by_staff", "Released / sent"],
] as const;

export function Queue() {
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const now = useNow(5000);
  const summary = useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/api/staff/summary") });
  const cases = useQuery({
    queryKey: ["cases", status, tier],
    queryFn: () => api<CaseRow[]>(`/api/staff/cases?${new URLSearchParams({ ...(status && { status }), ...(tier && { tier }) })}`),
  });
  // A case that arrives live (not on first load) fades in from a tint for 1.2 s.
  const firstSeen = useRef<Map<number, number> | null>(null);
  if (cases.data) {
    const seen = (firstSeen.current ??= new Map(cases.data.map((c) => [c.id, 0])));
    for (const c of cases.data) if (!seen.has(c.id)) seen.set(c.id, Date.now());
  }
  const isNew = (id: number) => Date.now() - (firstSeen.current?.get(id) ?? 0) < 1200;

  const cards = [
    { label: "Cases today", value: summary.data?.cases_today, icon: ListChecks },
    { label: "Paused", value: summary.data?.paused, icon: PauseCircle },
    { label: "Waiting on trusted contact", value: summary.data?.waiting_trusted_contact, icon: Users },
    { label: "In call", value: summary.data?.in_call, icon: PhoneCall },
    { label: "Cancelled", value: summary.data?.cancelled, icon: Ban },
    { label: "Money protected", value: summary.data ? formatSGD(summary.data.money_protected) : undefined, icon: PiggyBank },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl">Case queue</h1>
      {/* One compact labelled strip, not a row of stat cards. */}
      <ul aria-label="Today" className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <li key={c.label} className="bg-card px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><c.icon aria-hidden className="h-3.5 w-3.5" />{c.label}</p>
            {c.value === undefined ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="tabular mt-0.5 font-display text-lg font-semibold">{c.value}</p>}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-status" className="mb-1 block text-sm font-semibold">Status</label>
          <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-touch rounded-field border border-border-strong bg-card px-2 text-foreground">
            {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-tier" className="mb-1 block text-sm font-semibold">Risk</label>
          <select id="f-tier" value={tier} onChange={(e) => setTier(e.target.value)} className="min-h-touch rounded-field border border-border-strong bg-card px-2 text-foreground">
            <option value="">All</option>
            <option value="pause">High</option>
            <option value="ask">Medium</option>
          </select>
        </div>
        <p className="ml-auto text-sm text-muted-foreground">Keyboard: ↑/↓ rows · Enter open · in a case: A approve · C call · E escalate · G genuine · Esc close</p>
      </div>

      {cases.isError && <Banner tone="danger" alert title="Can't load cases">{(cases.error as Error).message}</Banner>}
      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[900px] text-xs text-foreground">
          <caption className="sr-only">Cases sorted by risk, then time</caption>
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs text-muted-foreground">
            <tr>
              {["Risk", "Customer", "Age", "Payee", "Amount", "Status", "Waiting", ""].map((h) => (
                <th key={h} scope="col" className={cx("h-10 px-3 font-semibold", h === "Amount" && "text-right")}>{h || <span className="sr-only">Open</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.isLoading &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={8} className="px-3 py-2"><Skeleton className="h-6" /></td></tr>
              ))}
            {cases.data?.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No cases match. Cases appear here live when a customer's payment is checked or paused.</td></tr>
            )}
            {cases.data?.map((c, idx) => (
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => setOpen(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setOpen(c.id);
                  if (e.key === "ArrowDown") ((e.currentTarget.nextElementSibling as HTMLElement | null)?.focus(), e.preventDefault());
                  if (e.key === "ArrowUp") ((e.currentTarget.previousElementSibling as HTMLElement | null)?.focus(), e.preventDefault());
                }}
                aria-label={`Case ${c.id}, ${c.customer.display_name}, ${formatSGD(c.amount)}`}
                className={cx("h-11 cursor-pointer hover:bg-muted focus:bg-muted", c.status === "in_verification_call" && "bg-info-soft", open === c.id && "bg-muted", isNew(c.id) && "sb-row-new")}
                data-row={idx}
              >
                <td className="px-3 py-2"><RiskChip tier={c.risk_tier as Tier} label={TIER_LABEL[c.risk_tier as Tier]} className="text-xs" /></td>
                <td className="px-3 py-2 font-semibold">{c.customer.display_name}</td>
                <td className="tabular px-3 py-2">{c.customer.age ?? "–"}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    {c.payee.name}
                    {c.is_new_payee && (
                      <span className="inline-flex items-center gap-0.5 rounded-[6px] bg-warning-soft px-1.5 text-xs font-semibold text-warning">
                        <UserPlus aria-hidden className="h-3 w-3" />NEW
                      </span>
                    )}
                    {c.payee_reported && (
                      <span className="inline-flex items-center gap-0.5 rounded-[6px] bg-danger-soft px-1.5 text-xs font-semibold text-danger">
                        <Flag aria-hidden className="h-3 w-3" />REPORTED
                      </span>
                    )}
                  </span>
                </td>
                <td className="tabular px-3 py-2 text-right font-semibold">{formatSGD(c.amount)}</td>
                <td className="px-3 py-2 font-semibold">{STATUS_LABEL[c.status] ?? c.status}</td>
                <td className="tabular px-3 py-2"><span className="inline-flex items-center gap-1"><Clock aria-hidden className="h-3.5 w-3.5" />{timeAgo(c.created_at, now)}</span></td>
                <td className="px-3 py-2"><Button size="sm" variant="outline" onClick={(e) => (e.stopPropagation(), setOpen(c.id))}>Open</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open !== null && <CaseDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
