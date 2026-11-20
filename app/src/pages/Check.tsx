import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, CircleCheck, CircleHelp, Copy, EyeOff, Flag, Paperclip, Phone, PhoneCall, Plus, ShieldAlert, ShieldCheck, ShieldQuestion,
  ThumbsDown, ThumbsUp, TriangleAlert, type LucideIcon,
} from "lucide-react";
import { ApiError, Banner, Button, Card, VerdictStage, api, cx, formatSGD, prefersReducedMotion, type VerdictTone } from "@/design";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { startSafeBankCall } from "../lib/calls";
import type { CheckResult, MessageFlag, Transfer } from "../types";

/** Fictional samples for first-time users. Every name, number and link is made up and never opened. */
export const SAMPLES: Record<string, string> = {
  mas: "This is Officer Lee from the Monetary Authority of Singapore (MAS). Your bank account is linked to a money laundering case. To protect your savings, transfer them to the MAS safety account immediately. Do not tell anyone, including bank staff.",
  parcel: "SingPost: Your parcel could not be delivered due to an incomplete address. Pay a $2.50 redelivery fee within 24 hours at https://singpost-redeliver.cc/track",
  friend: "Hi Aunty, this is Wei Ming, my new number. My phone broke. Can you lend me $1,500 urgently? Please PayNow to my friend's number, I'll return tomorrow. Don't tell Mum.",
  job: "Part-time job offer! Earn $300 per day just liking TikTok videos. No experience needed. Pay a $50 registration deposit to start. Contact our HR on Telegram now.",
  ticket: "Selling 2x Coldplay concert tickets Cat 1, below price! Many people asking, PayNow first, no meetup. Will send e-tickets after payment. Last 2 left, decide now!",
  investment: "Welcome to our VIP investment group! Our analyst's tips give guaranteed 30% monthly returns. Download our trading app from vip-invest-sg.top and deposit $2,000 to start. Limited slots.",
  police: "SPF: You are under investigation for illegal activity. Verify your identity within 2 hours at http://police-gov-sg.live/verify or a warrant of arrest will be issued.",
  pokemon: "Pokemon 151 booster box pre-order, only $120! Limited slots. PayNow first to secure your box, no meetup, will mail when stock arrives next month.",
  bank: "OCBC: Your monthly statement for October is ready. View it in the OCBC app. We will never ask for your OTP, PIN or password.",
};
const SOURCES = ["sms", "whatsapp", "telegram", "email", "call", "social", "other"] as const;
const MAX = 5000;

const VERDICT: Record<CheckResult["verdict"], { icon: LucideIcon; tone: VerdictTone }> = {
  likely_scam: { icon: ShieldAlert, tone: "risk" },
  be_careful: { icon: AlertTriangle, tone: "caution" },
  not_sure: { icon: CircleHelp, tone: "caution" },
  // Zero trust: "no known signs" is not proof, so no green tick. See VerdictStage "neutral".
  no_signs: { icon: ShieldQuestion, tone: "neutral" },
};

/** Splits the checked text into plain and flagged segments (merging overlaps). Rendered as text, never HTML. */
function segments(text: string, flags: MessageFlag[]) {
  const marks: { a: number; b: number; key: string }[] = [];
  flags.forEach((f) => f.spans.forEach(([a, b]) => marks.push({ a, b, key: f.key })));
  marks.sort((x, y) => x.a - y.a);
  const merged: typeof marks = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m.a < last.b) last.b = Math.max(last.b, m.b);
    else merged.push({ ...m });
  }
  const out: { text: string; key?: string }[] = [];
  let i = 0;
  for (const m of merged) {
    if (m.a > i) out.push({ text: text.slice(i, m.a) });
    out.push({ text: text.slice(m.a, m.b), key: m.key });
    i = m.b;
  }
  if (i < text.length) out.push({ text: text.slice(i) });
  return out;
}

export function Check() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [text, setText] = useState("");
  const [source, setSource] = useState<(typeof SOURCES)[number] | null>(null);
  const [claimed, setClaimed] = useState("");
  const [sender, setSender] = useState("");
  const [checked, setChecked] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [calling, setCalling] = useState(false);
  const [shared, setShared] = useState<"ok" | "failed" | null>(null);
  const [feedback, setFeedback] = useState(false);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return setErr(t("check.errEmpty"));
    if (text.length > MAX) return setErr(t("check.errLong"));
    setErr(null);
    setBusy(true);
    setReported(false);
    setShared(null);
    setFeedback(false);
    setOpen(null);
    try {
      const body = { text, source, claimed_sender: claimed.trim() || null, sender: sender.trim() || null };
      const r = await api<CheckResult>("/api/messages/check", { method: "POST", body });
      setResult(r);
      setChecked(text.trim());
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.unreachable ? `${t("common.offlineTitle")}. ${t("common.offlineBody")}` : e2.message) : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const resultRef = useRef<HTMLElement>(null);
  // Bring the verdict into view (at 375 px it lands below the fold).
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }, [result]);
  const segs = useMemo(() => (result ? segments(checked, result.flags) : []), [result, checked]);
  const v = result ? VERDICT[result.verdict] : null;
  const typeName = result?.scam_type ? t(`check.types.${result.scam_type}`, { defaultValue: result.scam_type_label ?? "" }) : null;
  const risky = result && (result.verdict === "likely_scam" || result.verdict === "be_careful");
  const advice: string[] = result?.scam_type
    ? (t(`check.advice.${result.scam_type}`, { returnObjects: true, defaultValue: result.advice ?? [] }) as string[])
    : (t("check.doNowDefault", { returnObjects: true }) as string[]);
  const hasLink = !!result?.flags.some((f) => ["link", "short_link", "lookalike_link"].includes(f.key)) || /https?:\/\/|www\./i.test(checked);
  // Never claim certainty: the display is capped at 1-99 %.
  const pct = result?.ml_probability != null ? Math.min(99, Math.max(1, Math.round(result.ml_probability * 100))) : null;
  let markIndex = 0;

  const share = async () => {
    const msg = typeName ? t("check.shareText", { type: typeName }) : t("check.shareTextGeneric");
    try {
      await navigator.clipboard.writeText(msg);
      setShared("ok");
    } catch {
      setShared("failed");
    }
  };

  return (
    <Screen title={t("check.title")}>
      <p className="text-muted-foreground">{t("check.subtitle")}</p>
      <form onSubmit={run} noValidate className="space-y-4">
        <div>
          <label htmlFor="msg" className="mb-1 block font-semibold">{t("check.label")}</label>
          <textarea
            id="msg"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("check.placeholder")}
            aria-invalid={err === t("check.errEmpty") || err === t("check.errLong") || undefined}
            aria-describedby={cx("msg-count", err && "msg-err") || undefined}
            className={cx(
              "block w-full rounded-field border bg-card p-3 text-foreground transition-[border-color] duration-fast hover:border-foreground focus-visible:border-foreground",
              err ? "border-danger ring-1 ring-danger" : "border-border-strong",
            )}
          />
          <p id="msg-count" className={cx("mt-1 text-right text-xs tabular", text.length > MAX ? "font-semibold text-danger" : "text-muted-foreground")}>
            {t("check.count", { n: text.length.toLocaleString("en-SG") })}
          </p>
          {err && (
            <p id="msg-err" role="alert" className="flex items-center gap-1 font-medium text-danger">
              <TriangleAlert aria-hidden className="h-4 w-4" /> {err}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1 font-semibold">{t("check.sourceLabel")}</legend>
          <p className="mb-2 text-sm text-muted-foreground">{t("check.sourceHint")}</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <label key={s} className="relative">
                <input type="radio" name="source" value={s} checked={source === s} onChange={() => setSource(s)} className="peer sr-only" />
                <span className="sb-press inline-flex min-h-touch cursor-pointer items-center rounded-btn border border-border-strong bg-card px-3 text-sm font-medium text-foreground hover:bg-muted peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-card peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                  {t(`check.sources.${s}`)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <details className="group rounded-card border border-border bg-card">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 font-semibold">
            {t("check.moreDetails")}
            <Plus aria-hidden className="h-5 w-5 text-muted-foreground transition-transform duration-base group-open:rotate-45" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><EyeOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />{t("check.senderHint")}</p>
            <div>
              <label htmlFor="claimed" className="mb-1 block font-medium">{t("check.claimedLabel")}</label>
              <input id="claimed" value={claimed} maxLength={120} onChange={(e) => setClaimed(e.target.value)} className="block min-h-btn w-full rounded-field border border-border-strong bg-card px-3 text-foreground" />
            </div>
            <div>
              <label htmlFor="sender" className="mb-1 block font-medium">{t("check.senderLabel")}</label>
              <input id="sender" value={sender} maxLength={120} inputMode="email" onChange={(e) => setSender(e.target.value)} className="block min-h-btn w-full rounded-field border border-border-strong bg-card px-3 text-foreground" />
            </div>
          </div>
        </details>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-muted-foreground">{t("check.samples")}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(SAMPLES).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setText(SAMPLES[k])}
                className="sb-press min-h-touch rounded-btn bg-muted px-3 text-sm font-medium text-foreground hover:bg-border"
              >
                {t(`check.s_${k}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" block size="lg" loading={busy}>
          {busy ? t("check.checking") : t("check.submit")}
        </Button>
      </form>

      {result && v && (
        <section ref={resultRef} aria-labelledby="result-h" aria-live="polite" className="scroll-mt-20 space-y-4">
          <h2 id="result-h" className="sr-only">{t("check.result")}</h2>
          <VerdictStage key={result.id} tone={v.tone} icon={v.icon} title={t(`check.${result.verdict}`)} checkingLabel={t("check.checking")}>
            <p className="text-lg">{t(`check.${result.verdict}Body`)}</p>
            {risky && <p className="font-semibold">{typeName ? t("check.typeIs", { type: typeName }) : t("check.typeUnknown")}</p>}
            {pct != null ? (
              <p className="text-sm text-muted-foreground">{t("check.confidence", { p: pct })}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("check.rulesOnly")}</p>
            )}
            <ReadAloud text={`${t(`check.${result.verdict}`)}. ${t(`check.${result.verdict}Body`)} ${typeName ? t("check.typeIs", { type: typeName }) : ""}`} />
          </VerdictStage>

          {result.flags.length > 0 && (
            <Card className="space-y-3">
              <h3 className="text-lg">{t("check.flagsTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("check.tapExplain")}</p>
              <p className="whitespace-pre-wrap rounded-btn bg-muted p-3 leading-relaxed">
                {segs.map((s, i) =>
                  s.key ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOpen(open === s.key ? null : s.key!)}
                      aria-expanded={open === s.key}
                      aria-controls={`flag-${s.key}`}
                      style={{ ["--i" as string]: markIndex++ }}
                      className="sb-mark inline rounded font-semibold text-foreground underline decoration-danger decoration-wavy decoration-2 underline-offset-4 hover:bg-danger-soft"
                    >
                      <TriangleAlert aria-hidden className="mr-0.5 inline h-4 w-4 align-[-2px] text-danger" />
                      {s.text}
                      <span className="sr-only"> ({t(`check.flags.${s.key}`)})</span>
                    </button>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
              <ul className="divide-y divide-border">
                {result.flags.map((f) => (
                  <li key={f.key} id={`flag-${f.key}`} className={cx("py-3 first:pt-1 last:pb-0", open === f.key && "-mx-2 rounded-btn bg-danger-soft px-2")}>
                    <p className="flex items-center gap-2 font-semibold">
                      <Flag aria-hidden className={cx("h-4 w-4 shrink-0", f.strong ? "text-danger" : "text-warning")} />
                      {t(`check.flags.${f.key}`, { defaultValue: f.key })}
                    </p>
                    <p className="mt-1 pl-6">{t(`check.explain.${f.key}`, { defaultValue: f.explanation })}</p>
                    {f.source && <p className="mt-1 pl-6 text-sm text-muted-foreground">{t("check.sourceName", { name: f.source })}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {!!result.counter_evidence?.length && (
            <Card className="space-y-2">
              <h3 className="text-lg">{t("check.normalTitle")}</h3>
              <ul className="space-y-2">
                {result.counter_evidence.map((k) => (
                  <li key={k} className="flex items-start gap-2">
                    <CircleCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                    {t(`check.normal.${k}`)}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="space-y-2">
            <h3 className="text-lg">{t("check.cantTellTitle")}</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><CircleHelp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />{t("check.cantSender")}</li>
              {hasLink && <li className="flex items-start gap-2"><CircleHelp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />{t("check.cantLink")}</li>}
              {result.verdict === "no_signs" && <li className="flex items-start gap-2"><CircleHelp aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />{t("check.cantSafe")}</li>}
            </ul>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-lg">{t("check.doNowTitle")}</h3>
            <ol className="list-decimal space-y-1 pl-5 marker:font-semibold">
              {advice.map((a) => <li key={a}>{a}</li>)}
            </ol>
            <div className="flex flex-col gap-3 pt-1">
              <Button
                icon={PhoneCall}
                variant={result.verdict === "no_signs" ? "outline" : "primary"}
                block
                loading={calling}
                onClick={async () => {
                  setCalling(true);
                  try {
                    nav(`/customer/call/${(await startSafeBankCall(null)).id}`);
                  } finally {
                    setCalling(false);
                  }
                }}
              >
                {t("help.callInApp")}
              </Button>
              <a href="tel:1799" className="sb-press inline-flex min-h-btn w-full items-center justify-center gap-2 rounded-btn border border-border-strong bg-card px-4 font-semibold text-foreground no-underline hover:bg-muted">
                <Phone aria-hidden className="h-5 w-5" /> {t("help.helpline")}
              </a>
              {reported ? (
                <Banner tone="success">{t("check.reported")}</Banner>
              ) : (
                <Button
                  variant="outline"
                  icon={Flag}
                  block
                  onClick={async () => {
                    try {
                      await api(`/api/messages/${result.id}/report`, { method: "POST" });
                      setReported(true);
                    } catch (e3) {
                      setErr((e3 as Error).message);
                    }
                  }}
                >
                  {t("check.report")}
                </Button>
              )}
              {risky && (
                <Button variant="ghost" icon={Copy} block onClick={share}>
                  {t("check.share")}
                </Button>
              )}
              {shared === "ok" && <Banner tone="success">{t("check.shareCopied")}</Banner>}
              {shared === "failed" && (
                <Banner tone="warning" title={t("check.shareFailed")}>
                  <p className="select-all">{typeName ? t("check.shareText", { type: typeName }) : t("check.shareTextGeneric")}</p>
                </Banner>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("check.privacy")}</p>
          </Card>

          <AttachToPayment checkId={result.id} />

          <div className="flex flex-wrap items-center gap-2 px-1" role="group" aria-labelledby="helpful-q">
            {feedback ? (
              <p role="status" className="text-sm text-muted-foreground">{t("check.helpfulThanks")}</p>
            ) : (
              <>
                <span id="helpful-q" className="mr-1 text-sm font-semibold">{t("check.helpfulQ")}</span>
                {[true, false].map((yes) => (
                  <Button
                    key={String(yes)}
                    size="sm"
                    variant="outline"
                    icon={yes ? ThumbsUp : ThumbsDown}
                    onClick={() => {
                      setFeedback(true);
                      api(`/api/messages/${result.id}/feedback`, { method: "POST", body: { helpful: yes } }).catch(() => undefined);
                    }}
                  >
                    {yes ? t("check.helpfulYes") : t("check.helpfulNo")}
                  </Button>
                ))}
              </>
            )}
          </div>
        </section>
      )}
    </Screen>
  );
}

const OPEN = ["checking", "paused", "saved_for_later", "waiting_trusted_contact", "in_verification_call", "under_staff_review"];

/** Attach the checked message to one of the customer's flagged payments, as evidence for OCBC staff. */
function AttachToPayment({ checkId }: { checkId: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["activity"], queryFn: () => api<Transfer[]>("/api/me/activity?limit=20") });
  const open = (q.data ?? []).filter((x) => x.risk_tier !== "none" && OPEN.includes(x.status));
  const [pick, setPick] = useState<string>("");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open.length) return null;
  const chosen = pick || String(open[0].id);
  const attach = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/messages/${checkId}/attach`, { method: "POST", body: { transfer_id: Number(chosen) } });
      const tr = open.find((x) => String(x.id) === chosen);
      setDone(t("check.attached", { payee: tr?.payee.name ?? "" }));
      qc.invalidateQueries({ queryKey: ["transfer", Number(chosen)] });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg"><Paperclip aria-hidden className="h-5 w-5" />{t("check.attachTitle")}</h3>
      <p>{t("check.attachBody")}</p>
      {done ? (
        <Banner tone="success">{done}</Banner>
      ) : (
        <>
          <label htmlFor="attach-to" className="block font-semibold">{t("check.attachPick")}</label>
          <select
            id="attach-to"
            value={chosen}
            onChange={(e) => setPick(e.target.value)}
            className="min-h-btn w-full rounded-field border border-border-strong bg-card px-3 text-foreground"
          >
            {open.map((x) => (
              <option key={x.id} value={x.id}>
                {x.payee.name} · {formatSGD(x.amount)} · {t(`status.${x.status}`)}
              </option>
            ))}
          </select>
          {err && <Banner tone="danger" alert>{err}</Banner>}
          <Button variant="outline" icon={Paperclip} block loading={busy} onClick={attach}>
            {t("check.attachButton")}
          </Button>
        </>
      )}
    </Card>
  );
}
