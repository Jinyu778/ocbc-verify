import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Hand, Phone, UserRound, XCircle } from "lucide-react";
import { Banner, Button, Card, Skeleton, api, formatDuration, secondsLeft, useNow } from "@safebank/ui";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";

interface Req {
  transfer_id: number;
  customer_name: string;
  amount_band: string;
  payee_type: "new" | "known";
  reason_keys: string[];
  requested_at: string;
  timeout_at: string;
  decision: "ok" | "stop" | null;
  decided_at: string | null;
  status: string;
}

/** Trusted contact sees ONLY: name, amount band, payee type, reasons. Never balance or account details. */
export function ContactHome() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["trusted-requests"], queryFn: () => api<{ pending: Req[]; history: Req[] }>("/api/trusted/requests"), refetchInterval: 10000 });
  return (
    <Screen title={t("contact.title")}>
      <p>{t("contact.intro")}</p>
      <section aria-labelledby="pending-h" className="space-y-3">
        <h2 id="pending-h">{t("contact.pending")}</h2>
        {q.isLoading ? (
          <Skeleton className="h-40" label={t("common.loading")} />
        ) : q.isError ? (
          <Banner tone="warning" title={t("common.offlineTitle")}>{t("common.offlineBody")}</Banner>
        ) : q.data?.pending.length ? (
          q.data.pending.map((r) => <RequestCard key={r.transfer_id} r={r} />)
        ) : (
          <p className="text-muted-foreground">{t("contact.none")}</p>
        )}
      </section>
      {!!q.data?.history.length && (
        <section aria-labelledby="hist-h" className="space-y-2">
          <h2 id="hist-h">{t("contact.history")}</h2>
          <ul className="divide-y divide-border rounded-card border border-border bg-card">
            {q.data.history.map((r) => (
              <li key={r.transfer_id} className="flex items-center gap-3 px-4 py-3">
                {r.decision === "ok" ? <CheckCircle2 aria-hidden className="h-5 w-5 text-success" /> : r.decision === "stop" ? <Hand aria-hidden className="h-5 w-5 text-danger" /> : <XCircle aria-hidden className="h-5 w-5 text-muted-foreground" />}
                <span className="flex-1">
                  {r.customer_name} · {r.amount_band}
                </span>
                <span className="text-sm text-muted-foreground">
                  {r.decision === "ok" ? t("contact.decidedOk") : r.decision === "stop" ? t("contact.decidedStop") : t("contact.noAnswer")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}

function RequestCard({ r }: { r: Req }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const now = useNow(1000);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const left = secondsLeft(r.timeout_at, now);
  const decide = async (decision: "ok" | "stop") => {
    setBusy(decision);
    setErr(null);
    try {
      await api(`/api/trusted/requests/${r.transfer_id}/decision`, { method: "POST", body: { decision } });
      qc.invalidateQueries({ queryKey: ["trusted-requests"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const reasons = r.reason_keys.map((k) => t(`reasons.${k}`));
  const summary = `${t("contact.from", { name: r.customer_name })}. ${t("contact.amountBand")}: ${r.amount_band}. ${t("contact.payeeType")}: ${r.payee_type === "new" ? t("contact.newPayee") : t("contact.knownPayee")}. ${reasons.join(" ")} ${t("contact.callFirst")}`;
  return (
    <Card className="space-y-4 border-l-4 border-l-warning">
      <p className="flex items-center gap-2 text-xl font-bold">
        <UserRound aria-hidden className="h-6 w-6" />
        {t("contact.from", { name: r.customer_name })}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-sm text-muted-foreground">{t("contact.amountBand")}</dt>
          <dd className="tabular text-lg font-semibold">{r.amount_band}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t("contact.payeeType")}</dt>
          <dd className="text-lg font-semibold">{r.payee_type === "new" ? t("contact.newPayee") : t("contact.knownPayee")}</dd>
        </div>
      </dl>
      <div>
        <p className="font-semibold">{t("contact.why")}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {reasons.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </div>
      <Banner tone="warning" icon={Phone} title={t("contact.callFirst")} />
      <ReadAloud text={summary} />
      <p className="tabular text-sm text-muted-foreground">{t("contact.timeLeft", { time: formatDuration(left) })}</p>
      {err && <Banner tone="danger" alert>{err}</Banner>}
      <div className="flex flex-col gap-3">
        <Button size="lg" variant="navy" icon={CheckCircle2} block loading={busy === "ok"} disabled={!!busy} onClick={() => decide("ok")}>
          {t("contact.ok")}
        </Button>
        <Button size="lg" icon={Hand} block loading={busy === "stop"} disabled={!!busy} onClick={() => decide("stop")}>
          {t("contact.stop")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("contact.stopNote")}</p>
      </div>
    </Card>
  );
}
