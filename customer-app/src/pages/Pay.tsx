import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight, CircleUserRound, RefreshCw, Save, ShieldAlert, Sparkles, X } from "lucide-react";
import { ApiError, Banner, Button, Card, Skeleton, api, cx, formatSGD } from "@safebank/ui";
import { Screen, SignalBanners } from "../components/Screen";
import { signalProvider } from "../signals";
import { addOfflineDraft } from "../lib/offlineDrafts";
import type { Payee, Transfer } from "../types";

export function NewChip() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-soft px-2 py-0.5 text-sm font-bold text-warning" title={t("common.newPayeeA11y")}>
      <Sparkles aria-hidden className="h-4 w-4" />
      <span aria-hidden>{t("common.newChip")}</span>
      <span className="sr-only">{t("common.newPayeeA11y")}</span>
    </span>
  );
}

export function Pay() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const payees = useQuery({ queryKey: ["payees"], queryFn: () => api<Payee[]>("/api/me/payees") });
  const account = useQuery({ queryKey: ["account"], queryFn: () => api<{ balance: string }>("/api/me/account") });
  const [payee, setPayee] = useState<Payee | null>(null);
  const [amount, setAmount] = useState(params.get("amount") ?? "");
  const [error, setError] = useState<{ field: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Prefill from ?payee=<name> / ?payee_id=<id> (demo scenarios, "Pay again", offline drafts)
  useEffect(() => {
    if (!payees.data || payee) return;
    const byName = params.get("payee");
    const byId = params.get("payee_id");
    const found = payees.data.find((p) => (byId && String(p.id) === byId) || (byName && p.name === byName));
    if (found) setPayee(found);
  }, [payees.data, params, payee]);
  useEffect(() => {
    if (payee) amountRef.current?.focus();
  }, [payee]);

  const balance = Number(account.data?.balance ?? NaN);

  const validate = (): string | null => {
    const raw = amount.replace(/,/g, "").trim();
    if (!raw) return t("pay.errAmountEmpty");
    if (!/^\d*\.?\d*$/.test(raw) || Number(raw) <= 0) return t("pay.errAmountPositive");
    if (/\.\d{3,}$/.test(raw)) return t("pay.errAmountDecimals");
    if (Number.isFinite(balance) && Number(raw) > balance) return t("pay.errAmountBalance", { balance: formatSGD(balance) });
    return null;
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!payee) {
      setError({ field: "payee", msg: t("pay.errChoosePayee") });
      return;
    }
    const msg = validate();
    if (msg) {
      setError({ field: "amount", msg });
      amountRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    setFailed(false);
    try {
      const signals = await signalProvider.snapshot();
      const tr = await api<Transfer>("/api/transfers", {
        method: "POST",
        body: { payee_id: payee.id, amount: amount.replace(/,/g, "").trim(), signals },
      });
      qc.setQueryData(["transfer", tr.id], tr);
      qc.invalidateQueries({ queryKey: ["activity"] });
      nav(`/pay/${tr.id}`);
    } catch (err) {
      if (err instanceof ApiError && !err.unreachable && err.status !== 500) {
        setError({ field: err.field === "payee_id" ? "payee" : "amount", msg: err.message });
      } else {
        // Fail SAFE: never send when we can't check.
        setFailed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (failed && payee) {
    return (
      <Screen title={t("pay.failTitle")}>
        <Banner tone="warning" icon={ShieldAlert} alert>
          {t("pay.failBody")}
        </Banner>
        <Card>
          <p className="font-semibold">{payee.name}</p>
          <p className="tabular text-2xl font-bold">{formatSGD(amount)}</p>
        </Card>
        {savedOffline ? (
          <Banner tone="success">{t("pay.failSaved")}</Banner>
        ) : null}
        <div className="flex flex-col gap-3">
          <Button block size="lg" icon={RefreshCw} onClick={() => submit()} loading={busy}>
            {t("common.retry")}
          </Button>
          {!savedOffline && (
            <Button
              block
              variant="outline"
              icon={Save}
              onClick={() => {
                addOfflineDraft({ payee_id: payee.id, payee_name: payee.name, amount });
                setSavedOffline(true);
              }}
            >
              {t("pay.failSave")}
            </Button>
          )}
          <Button block variant="outline" icon={X} onClick={() => nav("/")}>
            {t("pay.failCancel")}
          </Button>
        </div>
      </Screen>
    );
  }

  if (!payee) {
    return (
      <Screen title={t("pay.choosePayee")} back="/">
        <SignalBanners />
        {error?.field === "payee" && <Banner tone="danger" alert>{error.msg}</Banner>}
        {payees.isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" label={t("common.loading")} />)}</div>
        ) : payees.isError ? (
          <Banner tone="warning" title={t("common.offlineTitle")} action={<Button size="sm" variant="outline" onClick={() => payees.refetch()}>{t("common.retry")}</Button>}>
            {t("common.offlineBody")}
          </Banner>
        ) : (
          <ul className="space-y-2">
            {payees.data?.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPayee(p)}
                  className="flex min-h-btn w-full items-center gap-3 rounded-card border border-border bg-card p-4 text-left shadow-card hover:bg-muted"
                >
                  <CircleUserRound aria-hidden className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-sm text-muted-foreground">{p.account_ref}</span>
                  </span>
                  {p.is_new && <NewChip />}
                  <ChevronRight aria-hidden className="h-5 w-5 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Screen>
    );
  }

  const amountErr = error?.field === "amount" ? error.msg : null;
  return (
    <Screen title={t("pay.title")}>
      <button type="button" onClick={() => setPayee(null)} className="-ml-2 inline-flex min-h-touch items-center gap-1 rounded-btn px-2 font-semibold hover:bg-muted">
        <ArrowLeft aria-hidden className="h-5 w-5" />
        {t("common.back")}
      </button>
      <SignalBanners />
      <Card className="flex items-center gap-3">
        <CircleUserRound aria-hidden className="h-10 w-10 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{payee.name}</p>
          <p className="text-sm text-muted-foreground">{payee.account_ref}</p>
          {payee.is_new && <p className="mt-1 text-sm">{t("pay.newPayeeHint")}</p>}
        </div>
        {payee.is_new && <NewChip />}
      </Card>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="text-center">
          <label htmlFor="amount" className="block text-lg font-semibold">
            {t("pay.amountLabel")}
          </label>
          <div className={cx("mx-auto mt-2 flex max-w-xs items-center rounded-card border-2 bg-card px-4", amountErr ? "border-danger" : "border-border-strong")}>
            <span aria-hidden className="text-3xl font-bold text-muted-foreground">S$</span>
            <input
              ref={amountRef}
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              aria-invalid={amountErr ? true : undefined}
              aria-describedby={cx("amount-help", amountErr && "amount-err")}
              placeholder="0.00"
              className="tabular min-h-[4rem] w-full bg-transparent text-center text-3xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p id="amount-help" className="mt-1 text-sm text-muted-foreground">
            {account.data ? t("pay.amountHelper", { balance: formatSGD(account.data.balance) }) : " "}
          </p>
          {amountErr && (
            <p id="amount-err" role="alert" className="mt-1 font-medium text-danger">
              {amountErr}
            </p>
          )}
        </div>
        <Button type="submit" block size="lg" loading={busy}>
          {busy ? t("pay.checking") : t("pay.review")}
        </Button>
      </form>
    </Screen>
  );
}
