import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneIncoming, ChevronRight, Clock, Eye, EyeOff, MessageSquareWarning, Send, ShieldCheck, WifiOff } from "lucide-react";
import { Banner, Button, Card, Skeleton, api, cx, formatSGD, useStaggerIn } from "@/design";
import { useSession } from "../state/session";
import { usePrefs } from "../state/prefs";
import { Screen } from "../components/Screen";
import { listOfflineDrafts, removeOfflineDraft } from "../lib/offlineDrafts";
import type { Payee, Transfer } from "../types";
import { StatusIcon } from "../components/StatusIcon";

export function Home() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { prefs } = usePrefs();
  const nav = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [drafts, setDrafts] = useState(listOfflineDrafts);
  const account = useQuery({ queryKey: ["account"], queryFn: () => api<{ balance: string }>("/api/me/account") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api<Transfer[]>("/api/me/activity?limit=8") });
  const payees = useQuery({ queryKey: ["payees"], queryFn: () => api<Payee[]>("/api/me/payees") });
  const saved = activity.data?.filter((x) => x.status === "saved_for_later") ?? [];
  const easy = prefs.easy;
  const listRef = useRef<HTMLUListElement>(null);
  useStaggerIn(listRef, "[data-row]", [activity.data?.length], { scroll: true });
  const known = payees.data?.filter((p) => !p.is_new).slice(0, 3) ?? [];

  return (
    <Screen title={t("home.greeting", { name: user?.display_name })}>
      <Card className="border-transparent bg-primary text-on-primary dark:border-border dark:bg-primary-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-primary-muted">{t("home.balance")}</p>
            {account.isLoading ? (
              <Skeleton className="mt-2 h-9 w-40" label={t("common.loading")} />
            ) : account.isError ? (
              <p className="mt-1">{t("common.offlineTitle")}</p>
            ) : (
              <p className="tabular mt-1 font-display text-[min(2.25rem,11vw)] font-extrabold leading-none" aria-live="polite">
                {hidden ? <span>••••••<span className="sr-only">{t("home.balanceHidden")}</span></span> : formatSGD(account.data?.balance)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-pressed={hidden}
            className="sb-press inline-flex min-h-touch items-center gap-1.5 rounded-pill border border-tint-on-dark-strong px-3 text-sm font-semibold hover:bg-tint-on-dark"
          >
            {hidden ? <Eye aria-hidden className="h-5 w-5" /> : <EyeOff aria-hidden className="h-5 w-5" />}
            {hidden ? t("home.showBalance") : t("home.hideBalance")}
          </button>
        </div>
      </Card>

      {drafts.map((d) => (
        <Banner key={d.at} tone="warning" icon={WifiOff} title={t("home.offlineDraft")}>
          <p>{t("home.savedBody", { amount: formatSGD(d.amount), payee: d.payee_name })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => nav(`/customer/pay?payee_id=${d.payee_id}&amount=${d.amount}`)}>{t("home.offlineDraftRetry")}</Button>
            <Button size="sm" variant="outline" onClick={() => setDrafts(removeOfflineDraft(d.at))}>{t("home.offlineDraftRemove")}</Button>
          </div>
        </Banner>
      ))}

      {saved.map((s) => (
        <Card key={s.id} className="border-warning bg-warning-soft">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-card text-warning">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t("home.savedTitle")}</p>
              <p className="tabular">{t("home.savedBody", { amount: formatSGD(s.amount), payee: s.payee.name })}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => nav(`/customer/pay/${s.id}`)}>
              {t("home.savedOpen")}
            </Button>
          </div>
        </Card>
      ))}

      <div className={cx("grid gap-3", !easy && "sm:grid-cols-2")}>
        <Button size="lg" icon={Send} block onClick={() => nav("/customer/pay")}>
          {t("home.pay")}
        </Button>
        <Button size="lg" variant="navy" icon={PhoneIncoming} block onClick={() => nav("/customer/verify")}>
          {t("home.verifyCall")}
        </Button>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{t("home.verifyCallDesc")}</p>

      {!easy && known.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t("pay.choosePayee")} role="group">
          {known.map((p) => (
            <Link
              key={p.id}
              to={`/customer/pay?payee_id=${p.id}`}
              className="inline-flex min-h-touch items-center gap-1 rounded-full border border-border-strong bg-card px-3 text-sm font-semibold text-foreground no-underline hover:bg-muted"
            >
              <Send aria-hidden className="h-4 w-4" />
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {!easy && (
        <Link to="/customer/check" className="flex min-h-btn items-center gap-3 rounded-card border border-border bg-card p-4 font-semibold text-foreground no-underline shadow-card hover:bg-muted">
          <MessageSquareWarning aria-hidden className="h-6 w-6 text-accent" />
          <span className="flex-1">{t("home.checkMessage")}</span>
          <ChevronRight aria-hidden className="h-5 w-5" />
        </Link>
      )}

      <section aria-labelledby="recent-h">
        <h2 id="recent-h" className="mb-2">{t("home.recent")}</h2>
        {activity.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" label={t("common.loading")} />)}
          </div>
        ) : activity.isError ? (
          <Banner tone="warning" title={t("common.offlineTitle")} action={<Button size="sm" variant="outline" onClick={() => activity.refetch()}>{t("common.retry")}</Button>}>
            {t("common.offlineBody")}
          </Banner>
        ) : activity.data?.length ? (
          <ul ref={listRef} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card shadow-card">
            {activity.data.slice(0, easy ? 4 : 8).map((x) => (
              <li key={x.id} data-row>
                <Link to={`/customer/pay/${x.id}`} className="flex min-h-btn items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-muted">
                  <StatusIcon status={x.status} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{x.payee.name}</span>
                    <span className="block text-sm text-muted-foreground">{t(`status.${x.status}`)}</span>
                  </span>
                  <span className="tabular font-semibold">{formatSGD(x.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("home.noActivity")}</p>
        )}
      </section>
    </Screen>
  );
}
