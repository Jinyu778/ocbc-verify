import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, FileText, Flag, MessageSquareWarning, PhoneCall, ShieldAlert, ThumbsUp, X } from "lucide-react";
import { Banner, Button, Dialog, RiskChip, Skeleton, api, apiText, cx, formatSGD, useToast, type Tier } from "@/design";
import { STATUS_LABEL, TIER_LABEL, type CaseDetail } from "../types";
import { Timeline } from "./Timeline";
import { claimCall } from "../lib/claims";

type Action = "approve" | "call" | "escalate" | "genuine";
const ACTIONS: { id: Action; label: string; key: string; icon: typeof CheckCircle2; variant: "primary" | "dark" | "outline" | "danger"; help: string }[] = [
  { id: "approve", label: "Approve & release", key: "A", icon: CheckCircle2, variant: "dark", help: "Releases the payment. Money moves now." },
  { id: "call", label: "Call customer in-app", key: "C", icon: PhoneCall, variant: "outline", help: "Rings the customer inside the OCBC Verify app with a verified badge." },
  { id: "escalate", label: "Hold & escalate to ASC", key: "E", icon: ShieldAlert, variant: "danger", help: "Holds the payment and creates an Anti-Scam Centre referral." },
  { id: "genuine", label: "Mark as genuine", key: "G", icon: ThumbsUp, variant: "outline", help: "Releases it and records a false positive for the metrics." },
];
const CLOSED = ["sent", "cancelled", "approved_by_staff"];
const VERDICT: Record<string, string> = { likely_scam: "Likely scam", be_careful: "Be careful", not_sure: "Not sure", no_signs: "No known signs" };
const QUESTION_LABEL: Record<string, string> = {
  q_phone: "Someone on the phone telling them to pay",
  q_secret: "Told to keep secret / 'safe account'",
  q_online: "Only met online / by phone",
  q_chat: "Messaged on WhatsApp/Telegram/social",
};

export function CaseDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["case", id], queryFn: () => api<CaseDetail>(`/api/staff/cases/${id}`) });
  const [pending, setPending] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const c = q.data;
  const closed = !c || CLOSED.includes(c.status);

  useEffect(() => {
    ref.current?.focus();
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (pending || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") onClose();
      if (closed || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = ACTIONS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (a) {
        e.preventDefault();
        setPending(a.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, closed, onClose]);

  const submit = async () => {
    if (note.trim().length < 3) {
      setErr("Please write a short note (at least 3 characters). It goes into the audit trail.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ call: { id: number } | null }>(`/api/staff/cases/${id}/actions`, { method: "POST", body: { action: pending, note } });
      if (r.call) claimCall(r.call.id);
      toast(`${ACTIONS.find((a) => a.id === pending)?.label} – saved to the evidence log`);
      setPending(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["calls"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openReferral = async () => {
    const html = await apiText(`/api/staff/cases/${id}/referral.html`);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url + "#print", "_blank", "noopener");
  };
  const downloadJson = async () => {
    const data = await api(`/api/staff/cases/${id}/referral.json`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `referral-SB-${String(id).padStart(6, "0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="fixed inset-x-0 bottom-0 top-[30px] z-30 flex justify-end bg-scrim" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-h"
        onClick={(e) => e.stopPropagation()}
        className="sb-drawer h-full w-full max-w-2xl overflow-y-auto bg-background shadow-lift outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-card px-5 py-3">
          <h2 id="case-h" className="flex-1">Case SB-{String(id).padStart(6, "0")}</h2>
          {c && <RiskChip tier={c.risk_tier as Tier} label={`${TIER_LABEL[c.risk_tier as Tier]} risk · ${c.risk_score} pts`} />}
          <button type="button" onClick={onClose} aria-label="Close case" className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-btn hover:bg-muted">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {!c ? (
          <div className="space-y-3 p-5"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
        ) : (
          <div className="space-y-5 p-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <Info label="Customer" value={`${c.customer.display_name}${c.customer.age ? `, ${c.customer.age}` : ""}`} />
              <Info label="Status" value={STATUS_LABEL[c.status] ?? c.status} />
              <Info label="Payee" value={<>{c.payee.name} {c.is_new_payee ? <strong className="text-warning">(NEW payee)</strong> : <span className="text-muted-foreground">(known)</span>}</>} />
              {c.payee_reported && (
                <div className="sm:col-span-2">
                  <Banner tone="danger" icon={Flag} title="This account was reported by other customers">
                    Other customers' cases on this account number were escalated to the ASC or had a scam message attached.
                  </Banner>
                </div>
              )}
              <Info
                label="Amount vs usual"
                value={
                  <>
                    <span className="tabular font-bold">{formatSGD(c.amount)}</span>{" "}
                    <span className="text-muted-foreground">
                      usual {formatSGD(c.usual.mean)}{c.usual.times_usual ? ` · ${c.usual.times_usual}× usual` : ""}
                    </span>
                  </>
                }
              />
              <Info label="Trusted contact" value={c.trusted_decision ? `${c.trusted_contact_name}: ${c.trusted_decision === "ok" ? "said OK" : "asked to STOP"}` : c.trusted_contact_name ? `${c.trusted_contact_name} (not asked / no reply)` : "None set"} />
              <Info label="False positive" value={c.false_positive ? "Yes – marked genuine" : "No"} />
            </section>

            <section className="rounded-card border border-border bg-card p-4">
              <h3 className="mb-2 font-bold">Score breakdown</h3>
              <table className="w-full text-sm">
                <tbody>
                  {c.reasons.map((r) => (
                    <tr key={r.key} className="border-b border-border last:border-0">
                      <td className="py-1.5">{r.text}</td>
                      <td className="tabular py-1.5 text-right font-semibold">{r.points ? `+${r.points}` : "override"}</td>
                    </tr>
                  ))}
                  <tr><td className="py-1.5 font-bold">Total</td><td className="tabular py-1.5 text-right font-bold">{c.risk_score}</td></tr>
                </tbody>
              </table>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="font-semibold">Signals (state only)</p>
                  <ul>
                    {["on_call", "recent_call", "chatting", "screen_sharing"].map((k) => (
                      <li key={k}>{k.replace("_", " ")}: <strong>{c.signals[k] ? "yes" : "no"}</strong></li>
                    ))}
                    <li>source: {String(c.signals.source ?? "–")}{c.signals.available === false ? " (unavailable)" : ""}</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Customer answers</p>
                  {c.answers ? (
                    <ul>{Object.entries(c.answers).map(([k, v]) => <li key={k}>{QUESTION_LABEL[k] ?? k}: <strong className={v ? "text-danger" : ""}>{v ? "YES" : "no"}</strong></li>)}</ul>
                  ) : <p className="text-muted-foreground">Not answered yet</p>}
                </div>
              </div>
            </section>

            <section aria-labelledby="act-h" className="space-y-2">
              <h3 id="act-h" className="font-bold">Actions {closed && <span className="font-normal text-muted-foreground">(case closed)</span>}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACTIONS.map((a) => (
                  <Button key={a.id} variant={a.variant} icon={a.icon} disabled={closed} onClick={() => setPending(a.id)} aria-keyshortcuts={a.key} title={a.help}>
                    {a.label} <kbd className="ml-1 rounded border border-current px-1 text-xs">{a.key}</kbd>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="ghost" icon={FileText} onClick={openReferral}>Referral (printable)</Button>
                <Button size="sm" variant="ghost" icon={Download} onClick={downloadJson}>Referral JSON</Button>
              </div>
            </section>

            {c.staff_actions.length > 0 && (
              <section className="rounded-card border border-border bg-card p-4">
                <h3 className="mb-2 font-bold">Staff actions (audit)</h3>
                <ul className="space-y-1 text-sm">
                  {c.staff_actions.map((a) => (
                    <li key={a.id}><strong>{a.staff}</strong> · {a.action} · “{a.note}” · <time dateTime={a.created_at}>{new Date(a.created_at).toLocaleTimeString()}</time></li>
                  ))}
                </ul>
              </section>
            )}

            {c.attached_messages.length > 0 && (
              <section className="space-y-2 rounded-card border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 font-bold"><MessageSquareWarning aria-hidden className="h-5 w-5" />Messages the customer attached</h3>
                {c.attached_messages.map((m) => (
                  <div key={m.id} className="space-y-1 rounded-btn bg-muted p-3 text-sm">
                    <p className="font-semibold">
                      {VERDICT[m.verdict] ?? m.verdict} · ML {Math.round(m.ml_probability * 100)}% · review: {m.review_status}
                    </p>
                    <blockquote className="whitespace-pre-wrap">{m.text_redacted}</blockquote>
                    <p className="text-muted-foreground">Flags: {m.flags.map((f) => f.replace(/_/g, " ")).join(", ") || "none"} · redacted copy only</p>
                  </div>
                ))}
              </section>
            )}

            {c.calls.length > 0 && (
              <section className="rounded-card border border-border bg-card p-4 text-sm">
                <h3 className="mb-2 font-bold">Call history</h3>
                <ul>
                  {c.calls.map((call) => (
                    <li key={call.id}>#{call.id} · {call.initiated_by} started · {call.status} · {call.mode}{call.staff ? ` · ${call.staff.display_name}` : ""}</li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 font-bold">Evidence timeline <span className="font-normal text-muted-foreground">(append-only)</span></h3>
              <Timeline events={c.evidence} />
            </section>
          </div>
        )}
      </div>
    </div>

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={ACTIONS.find((a) => a.id === pending)?.label ?? ""}
        footer={
          <>
            <Button onClick={submit} loading={busy} block>Confirm</Button>
            <Button variant="outline" onClick={() => setPending(null)} block>Cancel</Button>
          </>
        }
      >
        <p className="mb-3 text-muted-foreground">{ACTIONS.find((a) => a.id === pending)?.help}</p>
        <label htmlFor="note" className="mb-1 block font-semibold">Note for the audit trail (required)</label>
        <textarea
          id="note"
          data-autofocus
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-invalid={!!err || undefined}
          aria-describedby={err ? "note-err" : undefined}
          className={cx("w-full rounded-field border bg-card p-2 text-foreground", err ? "border-danger" : "border-border-strong")}
        />
        {err && <Banner tone="danger" alert className="mt-2"><span id="note-err">{err}</span></Banner>}
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-btn border border-border bg-card p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
