import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneIncoming, ChevronRight, Clock, Eye, EyeOff, MessageSquareWarning, Send, WifiOff } from "lucide-react";
import { Banner, Button, Skeleton, api, cx, formatSGD, prefersReducedMotion } from "@/design";
import { useSession } from "../state/session";
import { usePrefs } from "../state/prefs";
import { Screen } from "../components/Screen";
import { listOfflineDrafts, removeOfflineDraft } from "../lib/offlineDrafts";
import type { Payee, Transfer } from "../types";
import { StatusIcon } from "../components/StatusIcon";

/** The first visit of a session plays the tile entrance and the balance count-up once; later visits don't. */
function firstVisitThisSession(): boolean {
  try {
    if (sessionStorage.getItem("home-intro")) return false;
    sessionStorage.setItem("home-intro", "1");
    return true;
  } catch {
    return false;
  }
}

/** Counts a money amount up once over 600 ms. Screen readers get the final value straight away. */
function useCountUp(target: number | null, run: boolean) {
  const [shown, setShown] = useState<number | null>(run ? 0 : target);
  useEffect(() => {
    if (target === null) return;
    if (!run) return setShown(target);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      setShown(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return shown;
}

export function Home() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { prefs } = usePrefs();
  const nav = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [drafts, setDrafts] = useState(listOfflineDrafts);
  const [intro] = useState(() => firstVisitThisSession() && !prefersReducedMotion() && !prefs.easy);
  const account = useQuery({ queryKey: ["account"], queryFn: () => api<{ balance: string }>("/api/me/account") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api<Transfer[]>("/api/me/activity?limit=8") });
  const payees = useQuery({ queryKey: ["payees"], queryFn: () => api<Payee[]>("/api/me/payees") });
  const saved = activity.data?.filter((x) => x.status === "saved_for_later") ?? [];
  const easy = prefs.easy;
  const known = payees.data?.filter((p) => !p.is_new).slice(0, 3) ?? [];
  const balance = account.data ? Number(account.data.balance) : null;
  const counted = useCountUp(balance, intro);
  let tile = 0;
  const order = () => ({ ["--i" as string]: tile++ });

  return (
    <Screen title={t("home.greeting", { name: user?.display_name })}>
      <div className={cx("grid gap-3", !easy && "grid-cols-2", intro && "sb-stagger")}>
        {/* Hero tile: the one gradient surface in the app, with one soft red glow behind it. */}
        <section style={order()} aria-labelledby="bal-h" className="relative col-span-full isolate">
          <div aria-hidden className="absolute inset-x-6 -bottom-3 top-10 -z-10 rounded-tile bg-accent opacity-30 blur-2xl dark:opacity-25" />
          <div className="overflow-hidden rounded-tile bg-hero p-5 text-on-primary shadow-lift sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p id="bal-h" className="text-sm font-medium text-on-brand-deep-muted">{t("home.balance")}</p>
              <button
                type="button"
                onClick={() => setHidden((h) => !h)}
                aria-pressed={hidden}
                className="sb-press -mr-2 -mt-2 inline-flex min-h-touch items-center gap-1.5 rounded-btn px-2 text-sm font-semibold text-on-primary hover:bg-tint-on-dark"
              >
                {hidden ? <Eye aria-hidden className="h-5 w-5" /> : <EyeOff aria-hidden className="h-5 w-5" />}
                {hidden ? t("home.showBalance") : t("home.hideBalance")}
              </button>
            </div>
            {account.isLoading ? (
              <Skeleton className="mt-3 h-11 w-48 bg-tint-on-dark" label={t("common.loading")} />
            ) : account.isError ? (
              <p className="mt-2">{t("common.offlineTitle")}</p>
            ) : (
              <p
                style={{ ["--display-size" as string]: "2.75rem" }}
                className="sb-display tabular mt-2 font-display text-[min(2.75rem,12vw)] font-bold leading-none tracking-[-0.03em]"
              >
                {hidden ? (
                  <span>••••••<span className="sr-only">{t("home.balanceHidden")}</span></span>
                ) : counted !== balance ? (
                  // only while counting: the moving number is hidden from screen readers, which get the final value
                  <>
                    <span aria-hidden>{formatSGD(counted ?? 0)}</span>
                    <span className="sr-only">{formatSGD(account.data?.balance)}</span>
                  </>
                ) : (
                  formatSGD(account.data?.balance)
                )}
              </p>
            )}
            <Button
              size="lg"
              icon={Send}
              block
              onClick={() => nav("/customer/pay")}
              className="mt-6 !bg-card !text-brand-deep hover:!text-accent active:!bg-muted dark:!text-foreground"
            >
              {t("home.pay")}
            </Button>
          </div>
        </section>

        {drafts.map((d) => (
          <Banner key={d.at} tone="warning" icon={WifiOff} title={t("home.offlineDraft")} className="col-span-full">
            <p>{t("home.savedBody", { amount: formatSGD(d.amount), payee: d.payee_name })}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => nav(`/customer/pay?payee_id=${d.payee_id}&amount=${d.amount}`)}>{t("home.offlineDraftRetry")}</Button>
              <Button size="sm" variant="outline" onClick={() => setDrafts(removeOfflineDraft(d.at))}>{t("home.offlineDraftRemove")}</Button>
            </div>
          </Banner>
        ))}

        {saved.map((s) => (
          <section key={s.id} style={order()} className="col-span-full flex items-center gap-3 rounded-tile bg-warning-soft p-4">
            <Clock aria-hidden className="h-6 w-6 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t("home.savedTitle")}</p>
              <p className="tabular">{t("home.savedBody", { amount: formatSGD(s.amount), payee: s.payee.name })}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => nav(`/customer/pay/${s.id}`)}>
              {t("home.savedOpen")}
            </Button>
          </section>
        ))}

        {/* Two tiles that differ on purpose: a dark verify tile and a light message tile. */}
        <button
          type="button"
          style={order()}
          onClick={() => nav("/customer/verify")}
          aria-describedby="verify-desc"
          className="sb-press sb-lift flex min-h-[9.5rem] flex-col justify-between gap-3 rounded-tile bg-primary p-4 text-left text-on-primary dark:border dark:border-border"
        >
          <PhoneIncoming aria-hidden className="h-6 w-6" />
          <span>
            <span className="block font-display text-lg font-semibold leading-tight">{t("home.verifyCall")}</span>
            <span id="verify-desc" className="mt-1 block text-sm text-on-primary-muted">{t("home.verifyCallDesc")}</span>
          </span>
        </button>
        <Link
          to="/customer/check"
          style={order()}
          className="sb-press sb-lift flex min-h-[9.5rem] flex-col justify-between gap-3 rounded-tile border border-border bg-card p-4 text-foreground no-underline"
        >
          <MessageSquareWarning aria-hidden className="h-6 w-6 text-accent-ink" />
          <span>
            <span className="block font-display text-lg font-semibold leading-tight">{t("home.checkMessage")}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t("home.checkMessageDesc")}</span>
          </span>
        </Link>

        {!easy && known.length > 0 && (
          <section style={order()} aria-labelledby="again-h" className="col-span-full rounded-tile border border-border bg-card p-4">
            <h2 id="again-h" className="mb-3 text-xl">{t("home.payAgain")}</h2>
            <ul className="flex flex-wrap gap-2">
              {known.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/customer/pay?payee_id=${p.id}`}
                    className="sb-press inline-flex min-h-touch items-center gap-2 rounded-btn bg-muted px-3 text-base font-semibold text-foreground no-underline hover:bg-border"
                  >
                    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-card font-display text-xs font-semibold">
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={order()} aria-labelledby="recent-h" className="col-span-full overflow-hidden rounded-tile border border-border bg-card">
          <h2 id="recent-h" className="px-4 pb-1 pt-4 text-xl">{t("home.recent")}</h2>
          {activity.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" label={t("common.loading")} />)}
            </div>
          ) : activity.isError ? (
            <Banner tone="warning" className="m-4" title={t("common.offlineTitle")} action={<Button size="sm" variant="outline" onClick={() => activity.refetch()}>{t("common.retry")}</Button>}>
              {t("common.offlineBody")}
            </Banner>
          ) : activity.data?.length ? (
            <ul className="divide-y divide-border">
              {activity.data.slice(0, easy ? 4 : 8).map((x) => (
                <li key={x.id}>
                  <Link to={`/customer/pay/${x.id}`} className="flex min-h-btn items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-muted">
                    <StatusIcon status={x.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{x.payee.name}</span>
                      <span className="block text-sm text-muted-foreground">{t(`status.${x.status}`)}</span>
                    </span>
                    <span className="tabular font-display text-lg font-bold">{formatSGD(x.amount)}</span>
                    <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pb-4 text-muted-foreground">{t("home.noActivity")}</p>
          )}
        </section>
      </div>
    </Screen>
  );
}
