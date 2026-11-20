import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ShieldAlert } from "lucide-react";
import { Banner, Button, Dialog, Skeleton, api, apiText, cx } from "@/design";

interface Reported {
  id: number;
  customer: string;
  text_redacted: string;
  flags: { key: string; strong: boolean }[];
  ml_probability: number;
  verdict: string;
  review_status: "pending" | "reviewed" | "escalated";
  source_channel: string | null;
  scam_type: string | null;
  user_feedback: string | null;
  training_candidate: boolean;
  created_at: string;
}
const VERDICT: Record<string, string> = { likely_scam: "Likely scam", be_careful: "Be careful", not_sure: "Not sure", no_signs: "No obvious signs" };
const VERDICT_TONE: Record<string, string> = { likely_scam: "bg-danger-soft text-danger", be_careful: "bg-warning-soft text-warning", not_sure: "bg-warning-soft text-warning", no_signs: "bg-success-soft text-success" };
const TYPES: [string, string][] = [
  ["", "Not set"], ["government_official", "Government official"], ["fake_friend", "Fake friend / family"], ["phishing", "Phishing"],
  ["ecommerce", "Online shopping / tickets"], ["job", "Job"], ["investment", "Investment"], ["loan", "Loan"], ["romance", "Internet love"],
  ["business_email", "Business email"], ["prize", "Prize / lucky draw"], ["tech_support", "Tech support / remote access"], ["not_scam", "Not a scam"],
];

export function Messages() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => api<Reported[]>("/api/staff/messages") });
  const [pending, setPending] = useState<{ id: number; status: "reviewed" | "escalated" } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const submit = async () => {
    if (!pending) return;
    try {
      await api(`/api/staff/messages/${pending.id}/review`, { method: "POST", body: { review_status: pending.status, note } });
      setPending(null);
      setNote("");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const label = async (id: number, body: { scam_type?: string; training_candidate?: boolean }) => {
    try {
      setRowErr(null);
      await api(`/api/staff/messages/${id}/label`, { method: "POST", body });
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (e) {
      setRowErr((e as Error).message);
    }
  };
  /** Candidates go to a CSV for OFFLINE review by people. The model is never retrained automatically. */
  const exportCsv = async () => {
    try {
      const csv = await apiText("/api/staff/messages/training-candidates.csv");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "training-candidates.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setRowErr((e as Error).message);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl">Reported messages</h1>
        <Button size="sm" variant="outline" icon={Download} onClick={exportCsv}>Export training candidates (CSV)</Button>
      </div>
      <p className="max-w-[75ch] text-muted-foreground">
        Customers' reports from the "Is this real?" checker. Only redacted text is stored (phone numbers hidden, links shortened to the domain). Marking a training candidate only adds it to the CSV for offline review; the model is never retrained automatically.
      </p>
      {rowErr && <Banner tone="danger" alert>{rowErr}</Banner>}
      {q.isLoading ? <Skeleton className="h-32" /> : q.data?.length === 0 ? <p>No reported messages yet. They appear here live when a customer taps "Report this to OCBC".</p> : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
          {q.data?.map((m) => (
            <li key={m.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{m.customer}</strong>
                <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                {m.source_channel && <span className="text-muted-foreground">via {m.source_channel}</span>}
                <span className={cx("rounded-[6px] px-2 font-semibold", VERDICT_TONE[m.verdict])}>
                  {VERDICT[m.verdict]}{m.ml_probability >= 0 ? ` · model ${Math.round(m.ml_probability * 100)}%` : " · rules only"}
                </span>
                {m.user_feedback && <span className="text-muted-foreground">Customer found it {m.user_feedback === "helpful" ? "helpful" : "not helpful"}</span>}
                <span className="ml-auto rounded-[6px] bg-muted px-2 font-semibold">{m.review_status}</span>
              </div>
              <blockquote className="max-w-[75ch] whitespace-pre-wrap rounded-btn bg-muted p-3">{m.text_redacted}</blockquote>
              <p className="text-sm">Flags: {m.flags.map((f) => f.key.replace(/_/g, " ")).join(", ") || "none"}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`type-${m.id}`} className="mb-1 block text-xs font-semibold text-muted-foreground">Scam type</label>
                  <select
                    id={`type-${m.id}`}
                    value={m.scam_type ?? ""}
                    onChange={(e) => e.target.value && label(m.id, { scam_type: e.target.value })}
                    className="min-h-touch rounded-field border border-border-strong bg-card px-2 text-sm text-foreground"
                  >
                    {TYPES.map(([v, l]) => <option key={v} value={v} disabled={!v}>{l}</option>)}
                  </select>
                </div>
                <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={m.training_candidate} onChange={(e) => label(m.id, { training_candidate: e.target.checked })} className="h-5 w-5" />
                  Candidate for training set
                </label>
                {m.review_status === "pending" && (
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" icon={CheckCircle2} onClick={() => setPending({ id: m.id, status: "reviewed" })}>Mark reviewed</Button>
                    <Button size="sm" variant="danger" icon={ShieldAlert} onClick={() => setPending({ id: m.id, status: "escalated" })}>Escalate</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.status === "escalated" ? "Escalate message" : "Mark as reviewed"}
        footer={<><Button block onClick={submit}>Confirm</Button><Button block variant="outline" onClick={() => setPending(null)}>Cancel</Button></>}
      >
        <label htmlFor="mnote" className="mb-1 block font-semibold">Note (required)</label>
        <textarea id="mnote" data-autofocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-field border border-border-strong bg-card p-2 text-foreground" />
        {err && <Banner tone="danger" alert className="mt-2">{err}</Banner>}
      </Dialog>
    </div>
  );
}
