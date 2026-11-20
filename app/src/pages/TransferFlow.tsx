import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  Clock,
  Home as HomeIcon,
  PhoneCall,
  PhoneOff,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  Flag,
  KeyRound,
  Hand,
  UserPlus,
  MessageCircleWarning,
  MonitorUp,
  Banknote,
  TrendingUp,
  Lock,
  Globe,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import {
  VerdictStage,
  useStaggerIn,
  ApiError,
  Banner,
  Button,
  Card,
  Dialog,
  RiskChip,
  Skeleton,
  SuccessTick,
  api,
  formatDuration,
  formatMinutes,
  formatSGD,
  secondsLeft,
  useNow,
  useToast,
} from "@/design";
import { Screen, SignalBanners } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { OfficialContacts } from "../components/OfficialContacts";
import { NewChip } from "./Pay";
import { useSession } from "../state/session";
import { startSafeBankCall } from "../lib/calls";
import { useSignals } from "../signals";
import type { Reason, Transfer } from "../types";

const QUESTIONS = ["q_phone", "q_secret", "q_online", "q_chat"] as const;

function useTransferActions(id: number) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, path: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    try {
      const tr = await api<Transfer>(`/api/transfers/${id}/${path}`, { method: "POST", body });
      qc.setQueryData(["transfer", id], tr);
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      return tr;
    } catch (e) {
      const msg =
        e instanceof ApiError ? (e.unreachable ? `${t("common.offlineTitle")}. ${t("pause.subtitle")}` : e.message) : t("common.errorGeneric");
      setError(msg);
      toast(msg, "warning");
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { run, busy, error };
}

export function TransferFlow() {
  const { id } = useParams();
  const tid = Number(id);
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["transfer", tid],
    queryFn: () => api<Transfer>(`/api/transfers/${tid}`),
    refetchInterval: (query) => (query.state.data?.status === "waiting_trusted_contact" ? 5000 : false),
  });
  // Each step of a payment (questions → pause → saved …) opens at the top of the screen.
  const step = q.data?.next_step;
  useEffect(() => {
    if (step) window.scrollTo({ top: 0 });
  }, [step]);
  if (q.isLoading)
    return (
      <Screen>
        <Skeleton className="h-10 w-2/3" label={t("common.loading")} />
        <Skeleton className="h-40" label={t("common.loading")} />
      </Screen>
    );
  if (q.isError || !q.data)
    return (
      <Screen title={t("common.offlineTitle")} back="/customer">
        <Banner tone="warning" action={<Button size="sm" variant="outline" onClick={() => q.refetch()}>{t("common.retry")}</Button>}>
          {(q.error as Error)?.message ?? t("common.offlineBody")}
        </Banner>
      </Screen>
    );
  const tr = q.data;
  switch (tr.next_step) {
    case "questions":
      return <Questions tr={tr} />;
    case "confirm":
      return <Review tr={tr} />;
    case "pause":
      return <Pause tr={tr} />;
    case "saved":
      return <Saved tr={tr} />;
    case "trusted":
      return <TrustedWait tr={tr} />;
    case "call":
      return <InCall tr={tr} />;
    default:
      return <Result tr={tr} />;
  }
}

// ----------------------------------------------------------------------------- shared bits
function PaymentSummary({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  return (
    <Card className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-muted-foreground">{t("review.to")}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-lg font-bold">
          <span>{tr.payee.name}</span>
          {tr.payee.is_new && <NewChip />}
        </p>
      </div>
      <div className="border-t border-dashed border-border pt-3 sm:border-0 sm:pt-0 sm:text-right">
        <p className="text-sm font-semibold text-muted-foreground">{t("review.amount")}</p>
        <p className="tabular font-display text-[min(2.25rem,11vw)] font-extrabold leading-none">{formatSGD(tr.amount)}</p>
      </div>
    </Card>
  );
}

const REASON_ICON: Record<string, LucideIcon> = {
  new_payee: UserPlus,
  on_call: PhoneCall,
  recent_call: PhoneCall,
  chatting: MessageCircleWarning,
  q_chat: MessageCircleWarning,
  screen_sharing: MonitorUp,
  amount_medium: Banknote,
  amount_high: Banknote,
  unusual_amount: TrendingUp,
  q_phone: PhoneCall,
  q_secret: Lock,
  q_online: Globe,
  payee_reported: Flag,
  override_new_payee_live: ShieldAlert,
  override_new_payee_unusual_large: ShieldAlert,
  signals_unavailable: CircleHelp,
};

export function ReasonsList({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLUListElement>(null);
  useStaggerIn(ref, "[data-reason]", [reasons.length]);
  if (!reasons.length) return null;
  return (
    <ul ref={ref} className="space-y-3">
      {reasons.map((r) => (
        <li key={r.key} data-reason className="flex items-start gap-3">
          {(() => {
            const Icon = REASON_ICON[r.key] ?? CircleAlert;
            const strong = r.points >= 3 || r.key.startsWith("override") || r.key === "payee_reported";
            return (
              <span aria-hidden className={strong ? "grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-danger-soft text-danger" : "grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-warning-soft text-warning"}>
                <Icon className="h-4 w-4" strokeWidth={2.4} />
              </span>
            );
          })()}
          <span className="pt-1">{t(`reasons.${r.key}`, { defaultValue: r.text })}</span>
        </li>
      ))}
    </ul>
  );
}

const reasonsText = (t: (k: string, o?: Record<string, unknown>) => string, reasons: Reason[]) =>
  reasons.map((r) => t(`reasons.${r.key}`, { defaultValue: r.text })).join(" ");

/** Waiting times come from the server's SAVE_FOR_LATER_OPTIONS_MINUTES and are shown as they really are. */
function SaveChooser({ open, onClose, onPick, busy }: { open: boolean; onClose: () => void; onPick: (minutes: number) => void; busy: boolean }) {
  const { t } = useTranslation();
  const { config } = useSession();
  const options = config?.save_for_later_options_minutes ?? [60, 360, 1440];
  return (
    <Dialog open={open} onClose={onClose} title={t("save.title")} sheet closeLabel={t("common.close")}>
      <p>{t("save.choose")}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("save.why")}</p>
      <div className="mt-4 flex flex-col gap-3">
        {options.map((m) => (
          <Button key={m} variant="outline" icon={Clock} block disabled={busy} onClick={() => onPick(m)}>
            {formatMinutes(t, m)}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------- questions
function Questions({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const { run, busy, error } = useTransferActions(tr.id);
  const nav = useNavigate();
  const key = QUESTIONS[i];
  const answer = async (yes: boolean) => {
    const next = { ...answers, [key]: yes };
    setAnswers(next);
    if (i < QUESTIONS.length - 1) setI(i + 1);
    else await run("answers", "answers", next);
  };
  const qText = t(`questions.${key}`);
  return (
    <Screen title={t("questions.title")}>
      <SignalBanners signals={tr.signals} />
      <p className="font-semibold text-muted-foreground" aria-live="polite">
        {t("questions.progress", { n: i + 1, total: QUESTIONS.length })}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full origin-left bg-secondary transition-transform duration-base ease-out"
          style={{ transform: `scaleX(${(i + 1) / QUESTIONS.length})` }}
        />
      </div>
      <Card key={key} className="sb-fade-up space-y-4">
        <h2 className="text-2xl font-bold sm:text-3xl" id={`q-${key}`}>{qText}</h2>
        <ReadAloud text={qText} />
        <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby={`q-${key}`}>
          <Button size="lg" variant="outline" block onClick={() => answer(true)} disabled={!!busy} className="min-h-[4.5rem] font-display text-2xl">
            {t("common.yes")}
          </Button>
          <Button size="lg" variant="outline" block onClick={() => answer(false)} disabled={!!busy} className="min-h-[4.5rem] font-display text-2xl">
            {t("common.no")}
          </Button>
        </div>
      </Card>
      <p className="text-muted-foreground">{t("questions.hint")}</p>
      {error && <Banner tone="warning" alert>{error}</Banner>}
      <div className="flex gap-3">
        {i > 0 && (
          <Button variant="ghost" onClick={() => setI(i - 1)}>
            {t("common.back")}
          </Button>
        )}
        <Button variant="ghost" icon={X} onClick={() => run("cancel", "cancel").then((r) => r && nav(`/customer/pay/${tr.id}`))}>
          {t("review.cancel")}
        </Button>
      </div>
    </Screen>
  );
}

// ----------------------------------------------------------------------------- review / confirm
function Review({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const { run, busy, error } = useTransferActions(tr.id);
  const [saving, setSaving] = useState(false);
  const ask = tr.risk_tier !== "none";
  return (
    <Screen title={t("review.title")}>
      <SignalBanners signals={tr.signals} />
      <PaymentSummary tr={tr} />
      <div>
        <RiskChip tier={tr.risk_tier} label={ask ? t("review.checkFirst") : t("review.lowRisk")} />
      </div>
      {ask && (
        <Card className="space-y-3">
          <p className="font-semibold">{t("review.askNote")}</p>
          <ReasonsList reasons={tr.reasons} />
          <ReadAloud text={`${t("review.askNote")} ${reasonsText(t, tr.reasons)}`} />
        </Card>
      )}
      {error && <Banner tone="warning" alert>{error}</Banner>}
      <div className="flex flex-col gap-3">
        <Button size="lg" icon={Send} block loading={busy === "send"} onClick={() => run("send", "send")}>
          {t("review.send", { amount: formatSGD(tr.amount) })}
        </Button>
        {ask && (
          <Button variant="outline" icon={Clock} block onClick={() => setSaving(true)}>
            {t("review.saveForLater")}
          </Button>
        )}
        <Button variant={ask ? "outline" : "ghost"} icon={X} block loading={busy === "cancel"} onClick={() => run("cancel", "cancel")}>
          {t("review.cancel")}
        </Button>
      </div>
      <SaveChooser open={saving} onClose={() => setSaving(false)} busy={!!busy} onPick={(m) => run("save", "save", { minutes: m }).then(() => setSaving(false))} />
    </Screen>
  );
}

// ----------------------------------------------------------------------------- pause
function Pause({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const now = useNow(500);
  const { run, busy, error } = useTransferActions(tr.id);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [calling, setCalling] = useState(false);
  const qc = useQueryClient();
  const hasContact = !!tr.trusted_contact_name;
  const wait = secondsLeft(tr.continue_anyway_at, now);
  const { config } = useSession();
  const device = useSignals();
  const hangUpWait = config?.hang_up_wait_minutes ?? 10;
  // Zero trust: whoever called or messaged, they are unverified. Offer the app's own numbers.
  const inbound = !!(tr.signals.on_call || tr.signals.recent_call || tr.signals.chatting || tr.answers?.q_phone || tr.answers?.q_chat);
  const mustHangUp = tr.hang_up_required && !tr.call_ended_at;

  // Android: the call-state plugin tells the server when the call ends, or when a new call starts
  // (scammers call back). In a browser the customer taps "I've hung up" instead.
  useEffect(() => {
    if (!tr.hang_up_required || device.source !== "native") return;
    if (!device.on_call && !tr.call_ended_at) void run("hangup", "call-state", { on_call: false, source: "native" });
    else if (device.on_call && tr.call_ended_at) void run("hangup", "call-state", { on_call: true, source: "native" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to call-state changes
  }, [device.on_call, device.source, tr.hang_up_required, tr.call_ended_at]);

  const logCallBack = (target: string) =>
    void api(`/api/transfers/${tr.id}/call-back`, { method: "POST", body: { target } }).catch(() => undefined);

  const [callError, setCallError] = useState<string | null>(null);
  const callSafeBank = async () => {
    setCalling(true);
    setCallError(null);
    try {
      const c = await startSafeBankCall(tr.id);
      qc.invalidateQueries({ queryKey: ["transfer", tr.id] });
      nav(`/customer/call/${c.id}`);
    } catch (e) {
      setCallError(e instanceof ApiError && !e.unreachable ? e.message : `${t("common.offlineTitle")}. ${t("help.helpline")}`);
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="sb-screen mx-auto w-full max-w-xl space-y-gap px-4 py-5">
      <VerdictStage
        tone="paused"
        icon={Hand}
        headingLevel={1}
        title={t("pause.title")}
        checkingLabel={t("pay.checking")}
        aside={
          !!(tr.signals.on_call || tr.signals.recent_call || tr.signals.chatting) ? (
            <>
              {!!(tr.signals.on_call || tr.signals.recent_call) && (
                <span className="inline-flex items-center gap-2 rounded-pill bg-danger-strong px-3 py-1 text-sm font-bold text-on-danger-strong">
                  <span aria-hidden className="sb-live-dot h-2 w-2 rounded-pill bg-current" />
                  <PhoneCall aria-hidden className="h-4 w-4" />
                  {t("pause.chipCall")}
                </span>
              )}
              {!!tr.signals.chatting && (
                <span className="inline-flex items-center gap-2 rounded-pill bg-danger-strong px-3 py-1 text-sm font-bold text-on-danger-strong">
                  <MessageCircleWarning aria-hidden className="h-4 w-4" />
                  {t("pause.chipChat")}
                </span>
              )}
            </>
          ) : undefined
        }
      >
        <p className="text-lg font-medium text-on-primary-muted">{t("pause.subtitle")}</p>
      </VerdictStage>
      <PaymentSummary tr={tr} />
      {(error || callError) && <Banner tone="warning" alert>{error ?? callError}</Banner>}
      <h2 data-after-stage className="text-lg">{t("pause.whatNext")}</h2>
      <div data-after-stage className="flex flex-col gap-3">
        <Button size="lg" icon={X} block loading={busy === "cancel"} onClick={() => run("cancel", "cancel")}>
          {t("pause.cancel")}
        </Button>
        <Button size="lg" variant="outline" icon={Clock} block onClick={() => setSaving(true)}>
          {t("pause.save")}
        </Button>
        <Button size="lg" variant="outline" icon={PhoneCall} block loading={calling} onClick={callSafeBank}>
          {t("pause.call")}
        </Button>
        <Button size="lg" variant="outline" icon={Users} block loading={busy === "trusted"} disabled={!hasContact} onClick={() => run("trusted", "ask-trusted")}>
          {hasContact ? t("pause.trusted") : t("pause.trustedNone")}
        </Button>
      </div>
      {inbound && (
        <div data-after-stage>
          <OfficialContacts onPick={logCallBack} />
        </div>
      )}
      <SignalBanners signals={tr.signals} />
      {tr.payee_reported && (
        <Banner tone="danger" icon={Flag} title={t("reasons.payee_reported")}>
          {t("pause.reportedBody")}
        </Banner>
      )}
      {tr.code_word_prompt && (
        <Banner tone="warning" icon={KeyRound} title={t("codeWord.prompt")}>
          {tr.code_word_set ? t("codeWord.promptBody") : t("codeWord.promptNotSet")}
        </Banner>
      )}
      <Card className="space-y-3">
        <h2 className="text-lg">{t("pause.because")}</h2>
        <ReasonsList reasons={tr.reasons} />
        <ReadAloud text={`${t("pause.title")}. ${t("pause.subtitle")} ${t("pause.because")} ${reasonsText(t, tr.reasons)}`} />
      </Card>
      <div data-after-stage className="pt-2 text-center">
        {mustHangUp ? (
          <Card className="space-y-3 text-left">
            <h2 className="flex items-start gap-2 text-lg">
              <PhoneOff aria-hidden className="mt-1 h-5 w-5 shrink-0 text-danger" />
              {t("pause.hangUpTitle")}
            </h2>
            <p>{t("pause.hangUpBody", { time: formatMinutes(t, hangUpWait) })}</p>
            {device.source === "native" ? (
              <p className="text-sm text-muted-foreground">{t("pause.hangUpNative")}</p>
            ) : (
              <Button
                variant="outline"
                block
                icon={PhoneOff}
                loading={busy === "hangup"}
                onClick={() => run("hangup", "call-state", { on_call: false, source: "customer_answer" })}
              >
                {t("pause.hungUp")}
              </Button>
            )}
          </Card>
        ) : wait > 0 ? (
          tr.hang_up_required ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground" aria-live="off">
                {t("pause.continueInTime", { time: formatDuration(wait) })}
              </p>
              <p className="text-sm">{t("pause.callEndedWait")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="off">
              {t("pause.continueIn", { s: wait })}
            </p>
          )
        ) : (
          <button type="button" onClick={() => setSheet(true)} className="min-h-touch px-2 text-sm font-semibold text-secondary underline">
            {t("pause.continue")}
          </button>
        )}
      </div>
      <SaveChooser open={saving} onClose={() => setSaving(false)} busy={!!busy} onPick={(m) => run("save", "save", { minutes: m }).then(() => setSaving(false))} />
      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        sheet
        closeLabel={t("common.close")}
        title={
          <span className="flex items-start gap-2">
            <ShieldAlert aria-hidden className="mt-1 h-6 w-6 shrink-0 text-danger" />
            {t("pause.sheetTitle")}
          </span>
        }
        footer={
          <>
            <Button data-autofocus block size="lg" onClick={() => setSheet(false)}>
              {t("pause.goBack")}
            </Button>
            <Button block variant="outline" loading={busy === "continue"} onClick={() => run("continue", "continue-anyway").then(() => setSheet(false))}>
              {t("pause.sendAnyway")}
            </Button>
          </>
        }
      >
        <p>{t("pause.sheetBody")}</p>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------------- saved for later
function Saved({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const { config } = useSession();
  const { run, busy, error } = useTransferActions(tr.id);
  const left = secondsLeft(tr.wait_until, now);
  return (
    <Screen title={t("save.savedTitle")} back="/customer">
      <PaymentSummary tr={tr} />
      <Card className="space-y-3 text-center">
        <Clock aria-hidden className="mx-auto h-12 w-12 text-warning" />
        {left > 0 ? (
          <p className="tabular text-2xl font-bold" aria-live="off">
            {t("save.countdown", { time: formatDuration(left) })}
          </p>
        ) : (
          <p className="text-lg font-semibold" role="status">{t("save.ready")}</p>
        )}
        <p className="text-muted-foreground">{t("save.why")}</p>
      </Card>
      {error && <Banner tone="warning" alert>{error}</Banner>}
      <div className="flex flex-col gap-3">
        <Button size="lg" icon={Send} block disabled={left > 0} loading={busy === "send"} onClick={() => run("send", "send")}>
          {t("save.sendNow")}
        </Button>
        <Button variant="outline" icon={X} block loading={busy === "cancel"} onClick={() => run("cancel", "cancel")}>
          {t("save.cancel")}
        </Button>
      </div>
    </Screen>
  );
}

// ----------------------------------------------------------------------------- trusted contact
function TrustedWait({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const nav = useNavigate();
  const { run, busy, error } = useTransferActions(tr.id);
  const [saving, setSaving] = useState(false);
  const name = tr.trusted_contact_name ?? "";
  const left = secondsLeft(tr.trusted_timeout_at, now);
  const timedOut = left === 0 && !tr.trusted_decision;
  const ok = tr.trusted_decision === "ok";
  const callSafeBank = async () => {
    const c = await startSafeBankCall(tr.id);
    nav(`/customer/call/${c.id}`);
  };
  return (
    <Screen title={ok ? t("trusted.okTitle", { name }) : timedOut ? t("trusted.timeoutTitle", { name }) : t("trusted.waitingTitle", { name })}>
      <PaymentSummary tr={tr} />
      <div aria-live="polite">
        {ok ? (
          <Banner tone="success" title={t("trusted.okTitle", { name })}>{t("trusted.okBody")}</Banner>
        ) : timedOut ? (
          <Banner tone="warning" title={t("trusted.timeoutTitle", { name })}>{t("trusted.timeoutBody")}</Banner>
        ) : (
          <Card className="space-y-2 text-center">
            <Users aria-hidden className="mx-auto h-12 w-12 text-secondary" />
            <p className="text-lg">{t("trusted.waitingBody", { name })}</p>
            <p className="tabular text-muted-foreground">{t("trusted.timeLeft", { time: formatDuration(left) })}</p>
          </Card>
        )}
      </div>
      {error && <Banner tone="warning" alert>{error}</Banner>}
      <div className="flex flex-col gap-3">
        {ok && (
          <Button size="lg" icon={Send} block loading={busy === "send"} onClick={() => run("send", "send")}>
            {t("save.sendNow")}
          </Button>
        )}
        <Button size={ok ? "md" : "lg"} variant={ok ? "outline" : "primary"} icon={Clock} block onClick={() => setSaving(true)}>
          {t("pause.save")}
        </Button>
        <Button variant="outline" icon={PhoneCall} block onClick={callSafeBank}>
          {t("pause.call")}
        </Button>
        <Button variant="outline" icon={X} block loading={busy === "cancel"} onClick={() => run("cancel", "cancel")}>
          {t("pause.cancel")}
        </Button>
      </div>
      <SaveChooser open={saving} onClose={() => setSaving(false)} busy={!!busy} onPick={(m) => run("save", "save", { minutes: m }).then(() => setSaving(false))} />
    </Screen>
  );
}

// ----------------------------------------------------------------------------- in verification call
function InCall({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { run, busy } = useTransferActions(tr.id);
  return (
    <Screen title={t("status.in_verification_call")} back="/customer">
      <PaymentSummary tr={tr} />
      <Banner tone="info" icon={PhoneCall}>{t("call.endedBody")}</Banner>
      <div className="flex flex-col gap-3">
        {tr.active_call_id ? (
          <Button icon={PhoneCall} block onClick={() => nav(`/customer/call/${tr.active_call_id}`)}>
            {t("verify.open")}
          </Button>
        ) : (
          <Button icon={PhoneCall} block onClick={async () => nav(`/customer/call/${(await startSafeBankCall(tr.id)).id}`)}>
            {t("pause.call")}
          </Button>
        )}
        <Button variant="outline" icon={X} block loading={busy === "cancel"} onClick={() => run("cancel", "cancel")}>
          {t("pause.cancel")}
        </Button>
      </div>
    </Screen>
  );
}

// ----------------------------------------------------------------------------- result
function Result({ tr }: { tr: Transfer }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const amount = formatSGD(tr.amount);
  const map: Record<string, { icon: JSX.Element; title: string; body: string }> = {
    sent: { icon: <SuccessTick className="mx-auto" />, title: t("result.sent"), body: t("result.sentBody", { amount, payee: tr.payee.name }) },
    approved_by_staff: { icon: <SuccessTick className="mx-auto" />, title: t("result.approved_by_staff"), body: t("result.approvedBody", { amount, payee: tr.payee.name }) },
    cancelled: { icon: <CheckCircle2 aria-hidden className="mx-auto h-16 w-16 text-success" />, title: t("result.cancelled"), body: t("result.cancelledBody") },
    under_staff_review: { icon: <Search aria-hidden className="mx-auto h-16 w-16 text-secondary" />, title: t("result.under_staff_review"), body: t("result.reviewBody") },
    escalated: { icon: <ShieldAlert aria-hidden className="mx-auto h-16 w-16 text-danger" />, title: t("result.escalated"), body: t("result.escalatedBody") },
  };
  const r = map[tr.status] ?? map.cancelled;
  const stopped = tr.status === "under_staff_review" && tr.trusted_decision === "stop";
  return (
    <Screen>
      <Card className="space-y-3 text-center" role="status">
        {r.icon}
        <h1 tabIndex={-1} className="text-2xl">{r.title}</h1>
        {stopped && <p className="font-semibold">{t("trusted.stopTitle", { name: tr.trusted_contact_name })}</p>}
        <p className="text-lg">{r.body}</p>
        <ReadAloud text={`${r.title}. ${r.body}`} className="mx-auto" />
      </Card>
      <div className="flex flex-col gap-3">
        {tr.status === "under_staff_review" && (
          <Button icon={PhoneCall} block onClick={async () => nav(`/customer/call/${(await startSafeBankCall(tr.id)).id}`)}>
            {t("pause.call")}
          </Button>
        )}
        <Button variant="outline" icon={HomeIcon} block onClick={() => nav("/customer")}>
          {t("result.home")}
        </Button>
      </div>
    </Screen>
  );
}
