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
  model: {
    accuracy: number; precision_scam: number; recall_scam: number; n_test: number;
    grouped_by_template?: { accuracy: number; recall_scam: number; checker?: CheckerScores };
    unseen_tactics?: { n: number; checker: CheckerScores };
  } | null;
}
interface CheckerScores {
  recall_scam: number;
  legit_shown_likely_scam: number;
  legit_shown_be_careful: number;
}
const VERDICTS: [string, string][] = [["likely_scam", "Likely scam"], ["be_careful", "Be careful"], ["not_sure", "Not sure"], ["no_signs", "No known signs"]];

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
      <h1 className="text-2xl">Impact</h1>
      <p className="text-muted-foreground">Live numbers from this database (synthetic test data only).</p>
      <dl className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="bg-card px-4 py-3">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="tabular mt-0.5 font-display text-lg font-semibold">{value}</dd>
            {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
          </div>
        ))}
      </dl>
      <section className="rounded-card border border-border bg-card p-4">
        <h2 className="text-lg">Message checks: {m.message_checks} run, {m.messages_reported} reported</h2>
        <dl className="mt-3 space-y-2">
          {VERDICTS.map(([k, label]) => {
            const n = m.message_verdicts[k] ?? 0;
            return (
              <div key={k} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-sm">
                <dt>{label}</dt>
                <dd className="h-4 overflow-hidden rounded bg-muted" aria-hidden>
                  <div className="h-full bg-foreground" style={{ width: `${(n / total) * 100}%` }} />
                </dd>
                <dd className="tabular text-right font-semibold">{n}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      {m.model && (
        <section className="rounded-card border border-border bg-card p-4 text-sm">
          <h2 className="text-lg">Message checker (synthetic test sets; see docs/MODEL_CARD.md)</h2>
          {m.model.grouped_by_template?.checker && (
            <p className="mt-1">
              Unseen message templates: scams flagged {m.model.grouped_by_template.checker.recall_scam} · genuine shown "Likely scam" {m.model.grouped_by_template.checker.legit_shown_likely_scam} · genuine shown "Be careful" {m.model.grouped_by_template.checker.legit_shown_be_careful}
            </p>
          )}
          {m.model.unseen_tactics && (
            <p className="mt-1">
              Hand-written unseen tactics (n={m.model.unseen_tactics.n}): scams flagged {m.model.unseen_tactics.checker.recall_scam} · genuine shown "Likely scam" {m.model.unseen_tactics.checker.legit_shown_likely_scam}
            </p>
          )}
          <p className="mt-1 text-muted-foreground">Model alone, random split (optimistic): accuracy {m.model.accuracy} · scam precision {m.model.precision_scam} · scam recall {m.model.recall_scam}</p>
        </section>
      )}
    </div>
  );
}
