import { useQuery } from "@tanstack/react-query";
import { Skeleton, api, formatSGD } from "@/design";

interface Metrics {
  payments_checked: number;
  pct_zero_friction: number;
  pct_paused: number;
  pct_cancelled_after_pause: number;
  pct_released_genuine: number;
  false_positives: number;
  money_protected: string;
  median_extra_seconds_genuine: number;
  median_trusted_response_seconds: number | null;
  message_checks: number;
  message_verdicts: Record<string, number>;
  messages_reported: number;
  model: { accuracy: number; precision_scam: number; recall_scam: number; n_test: number; grouped_by_template?: { accuracy: number; recall_scam: number } } | null;
}
const VERDICTS: [string, string][] = [["likely_scam", "Likely scam"], ["be_careful", "Be careful"], ["not_sure", "Not sure"], ["no_signs", "No obvious signs"]];

export function Impact() {
  const q = useQuery({ queryKey: ["metrics"], queryFn: () => api<Metrics>("/api/metrics"), refetchInterval: 10000 });
  const m = q.data;
  if (!m) return <div className="space-y-3"><h1>Impact</h1><Skeleton className="h-40" /></div>;
  const tiles: [string, string, string?][] = [
    ["Payments checked", String(m.payments_checked)],
    ["Zero friction", `${m.pct_zero_friction}%`, "of payments had no extra step"],
    ["Paused", `${m.pct_paused}%`, "of payments"],
    ["Cancelled after pause", `${m.pct_cancelled_after_pause}%`, "of paused payments"],
    ["Released as genuine", `${m.pct_released_genuine}%`, `false positives: ${m.false_positives}`],
    ["Money protected", formatSGD(m.money_protected), "cancelled + still held"],
    ["Median extra time, genuine payments", `${m.median_extra_seconds_genuine} s`, "0 s for zero-friction payments"],
    ["Trusted-contact response", m.median_trusted_response_seconds == null ? "–" : `${m.median_trusted_response_seconds} s`, "median"],
  ];
  const total = Math.max(1, m.message_checks);
  return (
    <div className="space-y-5">
      <h1>Impact</h1>
      <p className="text-muted-foreground">Live numbers from this database (synthetic test data only).</p>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <li key={label} className="rounded-card border border-border bg-card p-4 shadow-card">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="tabular mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
          </li>
        ))}
      </ul>
      <section className="rounded-card border border-border bg-card p-4 shadow-card">
        <h2>Message checks: {m.message_checks} run, {m.messages_reported} reported</h2>
        <dl className="mt-3 space-y-2">
          {VERDICTS.map(([k, label]) => {
            const n = m.message_verdicts[k] ?? 0;
            return (
              <div key={k} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-sm">
                <dt>{label}</dt>
                <dd className="h-4 overflow-hidden rounded bg-muted" aria-hidden>
                  <div className="h-full bg-secondary" style={{ width: `${(n / total) * 100}%` }} />
                </dd>
                <dd className="tabular text-right font-semibold">{n}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      {m.model && (
        <section className="rounded-card border border-border bg-card p-4 text-sm shadow-card">
          <h2>Message classifier (held-out test set, n={m.model.n_test})</h2>
          <p className="mt-1">Accuracy {m.model.accuracy} · Scam precision {m.model.precision_scam} · Scam recall {m.model.recall_scam}</p>
          {m.model.grouped_by_template && (
            <p className="text-muted-foreground">Harder split (unseen message templates): accuracy {m.model.grouped_by_template.accuracy} · recall {m.model.grouped_by_template.recall_scam}</p>
          )}
        </section>
      )}
    </div>
  );
}
