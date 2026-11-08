import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, CircleUserRound, MessageCircleWarning, PhoneCall, RefreshCw, Save, ShieldAlert, ShieldCheck, Sparkles, UserPlus, X } from "lucide-react";
import { ApiError, Banner, Button, Card, Field, Skeleton, api, cx, formatSGD } from "@/design";
import { Screen, SignalBanners } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { mergeSignals, needsLiveQuestion, signalProvider, useSignals, type LiveAnswer } from "../signals";
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

type Step = "payee" | "add" | "live" | "amount";

export function Pay() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const payees = useQuery({ queryKey: ["payees"], queryFn: () => api<Payee[]>("/api/me/payees") });
  const account = useQuery({ queryKey: ["account"], queryFn: () => api<{ balance: string }>("/api/me/account") });
  const device = useSignals();
  const [step, setStep] = useState<Step>("payee");
  const [payee, setPayee] = useState<Payee | null>(null);
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [amount, setAmount] = useState(params.get("amount") ?? "");
  const [error, setError] = useState<{ field: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const choose = (p: Payee) => {
    setPayee(p);
    setLive(null);
    setError(null);
    setStep(needsLiveQuestion(device, p.is_new) ? "live" : "amount");
  };

  // ?payee_id=<id> from "Pay again" chips and offline drafts
  useEffect(() => {
    if (!payees.data || payee) return;
    const byId = params.get("payee_id");
    const found = byId ? payees.data.find((p) => String(p.id) === byId) : undefined;
    if (found) choose(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payees.data]);
  useEffect(() => {
    if (step === "amount") amountRef.current?.focus();
  }, [step]);

  const balance = Number(account.data?.balance ?? NaN);
  const signals = mergeSignals(device, live);

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
      const fresh = mergeSignals(await signalProvider.snapshot(), live);
      const tr = await api<Transfer>("/api/transfers", {
        method: "POST",
        body: { payee_id: payee.id, amount: amount.replace(/,/g, "").trim(), signals: fresh },
      });
      qc.setQueryData(["transfer", tr.id], tr);
      qc.invalidateQueries({ queryKey: ["activity"] });
      nav(`/customer/pay/${tr.id}`);
    } catch (err) {
      if (err instanceof ApiError && !err.unreachable && err.status !== 500) {
        setError({ field: err.field === "payee_id" ? "payee" : "amount", msg: err.message });
      } else {
        setFailed(true); // Fail SAFE: never send when we can't check.
      }
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------ fail-safe screen
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
        {savedOffline && <Banner tone="success">{t("pay.failSaved")}</Banner>}
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
          <Button block variant="outline" icon={X} onClick={() => nav("/customer")}>
            {t("pay.failCancel")}
          </Button>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------------------------------ add a payee
  if (step === "add") {
    return (
      <AddPayee
        onBack={() => setStep("payee")}
        onAdded={(p) => {
          qc.invalidateQueries({ queryKey: ["payees"] });
          choose(p);
        }}
      />
    );
  }

  // ------------------------------------------------------------------ live call / chat question (browser, new payee)
  if (step === "live" && payee) {
    const q = t("live.question");
    return (
      <Screen title={t("live.title")} onBack={() => setStep("payee")}>
        <Card className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {payee.name} <NewChip />
          </p>
        </Card>
        <Card className="sb-fade-up space-y-4">
          <h2 id="live-q" className="text-2xl">{q}</h2>
          <ReadAloud text={q} />
          <div className="flex flex-col gap-3" role="group" aria-labelledby="live-q">
            <Button size="lg" variant="outline" icon={PhoneCall} block onClick={() => (setLive("call"), setStep("amount"))}>
              {t("live.call")}
            </Button>
            <Button size="lg" variant="outline" icon={MessageCircleWarning} block onClick={() => (setLive("chatting"), setStep("amount"))}>
              {t("live.chatting")}
            </Button>
            <Button size="lg" variant="outline" icon={ShieldCheck} block onClick={() => (setLive("no"), setStep("amount"))}>
              {t("live.no")}
            </Button>
          </div>
        </Card>
        <p className="text-muted-foreground">{t("live.why")}</p>
      </Screen>
    );
  }

  // ------------------------------------------------------------------ choose payee
  if (step === "payee" || !payee) {
    return (
      <Screen title={t("pay.choosePayee")} back="/customer">
        {error?.field === "payee" && <Banner tone="danger" alert>{error.msg}</Banner>}
        <Button variant="outline" icon={UserPlus} block onClick={() => setStep("add")}>
          {t("addPayee.button")}
        </Button>
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
                  onClick={() => choose(p)}
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

  // ------------------------------------------------------------------ amount
  const amountErr = error?.field === "amount" ? error.msg : null;
  return (
    <Screen title={t("pay.title")} onBack={() => setStep(needsLiveQuestion(device, payee.is_new) ? "live" : "payee")}>
      <SignalBanners signals={signals} />
      <Card className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CircleUserRound aria-hidden className="h-8 w-8 shrink-0 text-muted-foreground" />
          <p className="font-semibold">{payee.name}</p>
          {payee.is_new && <NewChip />}
        </div>
        <p className="text-sm text-muted-foreground">{payee.account_ref}</p>
        {payee.is_new && <p className="text-sm">{t("pay.newPayeeHint")}</p>}
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

function AddPayee({ onBack, onAdded }: { onBack: () => void; onAdded: (p: Payee) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState<{ field: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr({ field: "name", msg: t("addPayee.errName") });
    if (!/^[A-Za-z0-9\s-]{6,24}$/.test(ref.trim())) return setErr({ field: "account_ref", msg: t("addPayee.errRef") });
    setBusy(true);
    setErr(null);
    try {
      const p = await api<Payee>("/api/me/payees", { method: "POST", body: { name, account_ref: ref } });
      onAdded(p);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.field) setErr({ field: e2.field, msg: e2.message });
      else setErr({ field: "name", msg: e2 instanceof ApiError && e2.unreachable ? `${t("common.offlineTitle")}. ${t("common.offlineBody")}` : t("common.errorGeneric") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title={t("addPayee.title")} onBack={onBack}>
      <p>{t("addPayee.intro")}</p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label={t("addPayee.name")} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" error={err?.field === "name" ? err.msg : null} />
        <Field
          label={t("addPayee.ref")}
          helper={t("addPayee.refHelper")}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          error={err?.field === "account_ref" ? err.msg : null}
        />
        <Banner tone="info">{t("addPayee.newNote")}</Banner>
        <Button type="submit" block size="lg" icon={UserPlus} loading={busy}>
          {t("addPayee.save")}
        </Button>
      </form>
    </Screen>
  );
}
