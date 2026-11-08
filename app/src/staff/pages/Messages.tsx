import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Banner, Button, Dialog, Skeleton, api } from "@/design";

interface Reported {
  id: number;
  customer: string;
  text_redacted: string;
  flags: { key: string; strong: boolean }[];
  ml_probability: number;
  verdict: string;
  review_status: "pending" | "reviewed" | "escalated";
  created_at: string;
}
const VERDICT: Record<string, string> = { likely_scam: "Likely scam", be_careful: "Be careful", not_sure: "Not sure", no_signs: "No obvious signs" };

export function Messages() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["messages"], queryFn: () => api<Reported[]>("/api/staff/messages") });
  const [pending, setPending] = useState<{ id: number; status: "reviewed" | "escalated" } | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
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
  return (
    <div className="space-y-4">
      <h1>Reported messages</h1>
      <p className="text-muted-foreground">Customers' reports from the "Is this real?" checker. Only redacted text is stored (phone numbers hidden, links shortened to the domain).</p>
      {q.isLoading ? <Skeleton className="h-32" /> : q.data?.length === 0 ? <p>No reported messages yet.</p> : (
        <ul className="space-y-3">
          {q.data?.map((m) => (
            <li key={m.id} className="space-y-2 rounded-card border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{m.customer}</strong>
                <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                <span className="rounded-full border border-border-strong px-2">{VERDICT[m.verdict]} · ML {Math.round(m.ml_probability * 100)}%</span>
                <span className="ml-auto rounded-full bg-muted px-2 font-semibold">{m.review_status}</span>
              </div>
              <blockquote className="rounded-btn bg-muted p-3">{m.text_redacted}</blockquote>
              <p className="text-sm">Flags: {m.flags.map((f) => f.key.replace(/_/g, " ")).join(", ") || "none"}</p>
              {m.review_status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" icon={CheckCircle2} onClick={() => setPending({ id: m.id, status: "reviewed" })}>Mark reviewed</Button>
                  <Button size="sm" variant="danger" icon={ShieldAlert} onClick={() => setPending({ id: m.id, status: "escalated" })}>Escalate</Button>
                </div>
              )}
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
        <textarea id="mnote" data-autofocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-btn border-2 border-border-strong bg-card p-2 text-foreground" />
        {err && <Banner tone="danger" alert className="mt-2">{err}</Banner>}
      </Dialog>
    </div>
  );
}
