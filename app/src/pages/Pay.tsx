import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneOff, ChevronRight, MessageCircleWarning, PhoneCall, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, Sparkles, UserPlus, Users, X } from "lucide-react";
import { ApiError, Banner, Button, Card, Field, SectionTitle, Skeleton, api, cx, formatSGD, useStaggerIn } from "@/design";
import { Screen, SignalBanners } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { mergeSignals, needsLiveQuestion, signalProvider, useSignals, type LiveAnswer } from "../signals";
import { addOfflineDraft } from "../lib/offlineDrafts";
import type { Payee, Transfer } from "../types";

export function NewChip() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] bg-warning-soft px-2 py-1 text-xs font-semibold text-warning" title={t("common.newPayeeA11y")}>
      <UserPlus aria-hidden className="h-4 w-4" strokeWidth={2.25} />
      <span aria-hidden>{t("common.newPayeeTag")}</span>
      <span className="sr-only">{t("common.newPayeeA11y")}</span>
    </span>
  );
}

/** Initials from the payee's name ("Tan Wei Ming (son)" -> "TW"), so each row is recognisable at a glance. */
function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function PayeeAvatar({ payee }: { payee: Payee }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-base font-bold",
        payee.is_new ? "bg-warning-soft text-warning" : "bg-muted text-foreground",
      )}
    >
      {initials(payee.name)}
    </span>
  );
}

function PayeeRow({ payee, onChoose }: { payee: Payee; onChoose: (p: Payee) => void }) {
  return (
    <li data-payee>
      <button
        type="button"
        onClick={() => onChoose(payee)}
        className="sb-press flex min-h-[4.5rem] w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted active:bg-muted sm:px-5"
      >
        <PayeeAvatar payee={payee} />
        {/* the tag sits under the name, so long names keep the full width at 375 px and in Easy Mode */}
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold leading-snug text-foreground">{payee.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="sb-ref text-sm text-muted-foreground">{payee.account_ref}</span>
            {payee.is_new && <NewChip />}
          </span>
        </span>
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>
    </li>
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
  const payeeListRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  useStaggerIn(payeeListRef, "[data-payee]", [payees.data?.length, step]);

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
            <Button size="lg" variant="outline" icon={PhoneOff} block onClick={() => (setLive("no"), setStep("amount"))}>
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
        <Button variant="outline" size="lg" icon={UserPlus} block onClick={() => setStep("add")} className="min-h-[3.5rem]">
          {t("addPayee.button")}
        </Button>
        {payees.isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[4.5rem]" label={t("common.loading")} />)}</div>
        ) : payees.isError ? (
          <Banner tone="warning" title={t("common.offlineTitle")} action={<Button size="sm" variant="outline" onClick={() => payees.refetch()}>{t("common.retry")}</Button>}>
            {t("common.offlineBody")}
          </Banner>
        ) : (
          <PayeeGroups payees={payees.data ?? []} query={query} setQuery={setQuery} onChoose={choose} listRef={payeeListRef} />
        )}
      </Screen>
    );
  }

  // ------------------------------------------------------------------ amount
  const amountErr = error?.field === "amount" ? error.msg : null;
  return (
    <Screen title={t("pay.title")} onBack={() => setStep(needsLiveQuestion(device, payee.is_new) ? "live" : "payee")}>
      <SignalBanners signals={signals} />
      <Card className="space-y-2">
        <div className="flex items-center gap-4">
          <PayeeAvatar payee={payee} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-snug">{payee.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="sb-ref text-sm text-muted-foreground">{payee.account_ref}</span>
              {payee.is_new && <NewChip />}
            </p>
          </div>
        </div>
        {payee.is_new && <p className="text-sm text-muted-foreground">{t("pay.newPayeeHint")}</p>}
      </Card>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="amount" className="block font-display text-xl font-semibold">
            {t("pay.amountLabel")}
          </label>
          {/* One field: the S$ prefix and the number share one box; the focus ring is on the box, not the input. */}
          <div
            onClick={() => amountRef.current?.focus()}
            className={cx(
              "mt-2 flex cursor-text items-center gap-2 rounded-field border bg-card px-5 transition-[border-color,box-shadow] duration-fast",
              "focus-within:border-foreground focus-within:shadow-[0_0_0_1px_var(--foreground)]",
              amountErr ? "border-danger shadow-[0_0_0_1px_var(--danger)]" : "border-border-strong hover:border-foreground",
            )}
          >
            <span className="font-display text-3xl font-bold text-muted-foreground">
              S$<span className="sr-only"> {t("pay.amountPrefix")}</span>
            </span>
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
              className="tabular min-h-[4.5rem] w-full min-w-0 bg-transparent font-display text-4xl font-bold tracking-[-0.02em] text-foreground caret-accent placeholder:text-border-strong focus:outline-none focus-visible:shadow-none focus-visible:outline-none"
            />
          </div>
          <p id="amount-help" className="mt-2 text-sm text-muted-foreground">
            {account.data ? t("pay.amountHelper", { balance: formatSGD(account.data.balance) }) : "\u00a0"}
          </p>
          {amountErr && (
            <p id="amount-err" role="alert" className="mt-1 font-semibold text-danger">
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

/** Trusted payees first; new payees in their own clearly marked group. Search appears with more than 6 payees. */
function PayeeGroups({ payees, query, setQuery, onChoose, listRef }: {
  payees: Payee[]; query: string; setQuery: (q: string) => void; onChoose: (p: Payee) => void; listRef: React.RefObject<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const q = query.trim().toLowerCase();
  const shown = q ? payees.filter((p) => `${p.name} ${p.account_ref}`.toLowerCase().includes(q)) : payees;
  const known = shown.filter((p) => !p.is_new);
  const fresh = shown.filter((p) => p.is_new);
  return (
    <div ref={listRef} className="space-y-6">
      {payees.length > 6 && (
        <div className="relative">
          <label htmlFor="payee-search" className="sr-only">{t("pay.search")}</label>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="payee-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pay.search")}
            autoComplete="off"
            className="block min-h-btn w-full rounded-field border border-border-strong bg-card pl-12 pr-4 text-lg text-foreground placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground"
          />
        </div>
      )}
      {shown.length === 0 && <p className="text-muted-foreground">{t("pay.searchNone", { q: query.trim() })}</p>}
      {known.length > 0 && (
        <section aria-labelledby="g-known">
          <SectionTitle id="g-known" icon={Users} tone="neutral" className="mb-3 text-xl">{t("pay.groupKnown")}</SectionTitle>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
            {known.map((p) => <PayeeRow key={p.id} payee={p} onChoose={onChoose} />)}
          </ul>
        </section>
      )}
      {fresh.length > 0 && (
        <section aria-labelledby="g-new" aria-describedby="g-new-hint">
          <SectionTitle id="g-new" icon={ShieldAlert} tone="amber" className="text-xl">{t("pay.groupNew")}</SectionTitle>
          <p id="g-new-hint" className="mb-3 mt-1 text-sm text-muted-foreground">{t("pay.groupNewHint")}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-warning bg-card">
            {fresh.map((p) => <PayeeRow key={p.id} payee={p} onChoose={onChoose} />)}
          </ul>
        </section>
      )}
    </div>
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
