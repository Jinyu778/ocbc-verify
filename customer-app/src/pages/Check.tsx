import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CircleHelp, Flag, Phone, PhoneCall, ShieldAlert, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { ApiError, Banner, Button, Card, api, cx } from "@safebank/ui";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { startSafeBankCall } from "../lib/calls";
import type { CheckResult, MessageFlag } from "../types";

export const SAMPLES: Record<string, string> = {
  mas: "This is Officer Lee from the Monetary Authority of Singapore (MAS). Your bank account is linked to a money laundering case. To protect your savings, transfer them to the MAS safety account immediately. Do not tell anyone, including bank staff.",
  parcel: "SingPost: Your parcel could not be delivered due to an incomplete address. Pay a $2.50 redelivery fee within 24 hours at https://singpost-redeliver.cc/track",
  friend: "Hi Aunty, this is Wei Ming, my new number. My phone broke. Can you lend me $1,500 urgently? Please PayNow to my friend's number, I'll return tomorrow. Don't tell Mum.",
  job: "Part-time job offer! Earn $300 per day just liking TikTok videos. No experience needed. Pay a $50 registration deposit to start. Contact our HR on Telegram now.",
  ticket: "Selling 2x Coldplay concert tickets Cat 1, below price! Many people asking, PayNow first, no meetup. Will send e-tickets after payment. Last 2 left, decide now!",
  bank: "SafeBank: Your monthly statement for October is ready. View it in the SafeBank app. We will never ask for your OTP, PIN or password.",
};

const VERDICT: Record<CheckResult["verdict"], { icon: LucideIcon; cls: string }> = {
  likely_scam: { icon: ShieldAlert, cls: "border-danger text-danger bg-danger-soft" },
  be_careful: { icon: AlertTriangle, cls: "border-warning text-warning bg-warning-soft" },
  not_sure: { icon: CircleHelp, cls: "border-secondary text-secondary bg-info-soft" },
  no_signs: { icon: ShieldCheck, cls: "border-success text-success bg-success-soft" },
};

/** Splits the checked text into plain and flagged segments (merging overlaps). */
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
  const [params] = useSearchParams();
  const [text, setText] = useState(() => SAMPLES[params.get("sample") ?? ""] ?? "");
  const [checked, setChecked] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [calling, setCalling] = useState(false);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) {
      setErr(t("check.errEmpty"));
      return;
    }
    setErr(null);
    setBusy(true);
    setReported(false);
    setOpen(null);
    try {
      const r = await api<CheckResult>("/api/messages/check", { method: "POST", body: { text } });
      setResult(r);
      setChecked(text.trim());
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.unreachable ? `${t("common.offlineTitle")}. ${t("common.offlineBody")}` : e2.message) : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.get("sample") && text) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segs = useMemo(() => (result ? segments(checked, result.flags) : []), [result, checked]);
  const v = result ? VERDICT[result.verdict] : null;

  return (
    <Screen title={t("check.title")}>
      <p>{t("check.subtitle")}</p>
      <form onSubmit={run} noValidate className="space-y-3">
        <label htmlFor="msg" className="block font-semibold">{t("check.label")}</label>
        <textarea
          id="msg"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("check.placeholder")}
          aria-invalid={err === t("check.errEmpty") || undefined}
          aria-describedby={err ? "msg-err" : undefined}
          className={cx("block w-full rounded-card border-2 bg-card p-3 text-foreground", err ? "border-danger" : "border-border-strong")}
        />
        {err && (
          <p id="msg-err" role="alert" className="flex items-center gap-1 font-medium text-danger">
            <TriangleAlert aria-hidden className="h-4 w-4" /> {err}
          </p>
        )}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-muted-foreground">{t("check.samples")}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(SAMPLES).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setText(SAMPLES[k])}
                className="min-h-touch rounded-full border border-border-strong bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
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
        <section aria-labelledby="result-h" aria-live="polite" className="space-y-4">
          <h2 id="result-h" className="sr-only">{t("check.result")}</h2>
          <Card className={cx("space-y-2 border-2", v.cls)}>
            <p className="flex items-center gap-2 text-xl font-bold">
              <v.icon aria-hidden className="h-7 w-7" />
              {t(`check.${result.verdict}`)}
            </p>
            <p className="text-foreground">{t(`check.${result.verdict}Body`)}</p>
            <p className="text-sm text-muted-foreground">{t("check.confidence", { p: Math.round(result.ml_probability * 100) })}</p>
            <ReadAloud text={`${t(`check.${result.verdict}`)}. ${t(`check.${result.verdict}Body`)}`} />
          </Card>

          {result.flags.length > 0 && (
            <Card className="space-y-3">
              <h3 className="text-lg font-bold">{t("check.flagsTitle")}</h3>
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
                      className="inline rounded font-semibold text-foreground underline decoration-danger decoration-wavy decoration-2 underline-offset-4 hover:bg-danger-soft"
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
              <ul className="space-y-2">
                {result.flags.map((f) => (
                  <li key={f.key} id={`flag-${f.key}`} className={cx("rounded-btn border p-3", open === f.key ? "border-danger bg-danger-soft" : "border-border")}>
                    <button type="button" className="flex w-full items-center gap-2 text-left font-semibold" aria-expanded={open === f.key} onClick={() => setOpen(open === f.key ? null : f.key)}>
                      <Flag aria-hidden className={cx("h-4 w-4", f.strong ? "text-danger" : "text-warning")} />
                      {t(`check.flags.${f.key}`)}
                    </button>
                    {open === f.key && <p className="mt-1">{t(`check.explain.${f.key}`, { defaultValue: f.explanation })}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="space-y-3">
            <h3 className="text-lg font-bold">{t("check.safeActions")}</h3>
            <Button
              icon={PhoneCall}
              block
              loading={calling}
              onClick={async () => {
                setCalling(true);
                try {
                  nav(`/call/${(await startSafeBankCall(null)).id}`);
                } finally {
                  setCalling(false);
                }
              }}
            >
              {t("help.callInApp")}
            </Button>
            <a href="tel:1799" className="inline-flex min-h-btn w-full items-center justify-center gap-2 rounded-btn border-2 border-border-strong bg-card px-4 font-semibold text-foreground no-underline hover:bg-muted">
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
            <p className="text-sm text-muted-foreground">{t("check.privacy")}</p>
          </Card>
        </section>
      )}
    </Screen>
  );
}
