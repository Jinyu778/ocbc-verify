import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { Banner, Button, Card, Disclaimer, api, setSimulatedOffline, useToast } from "@safebank/ui";
import { useSession } from "../state/session";
import { writeSim, type SimState } from "../signals";
import { DemoSignalControls } from "../components/DemoDrawer";
import { setGuideDone } from "./Guide";

const STAFF_URL = (import.meta.env.VITE_STAFF_URL as string) || `${location.protocol}//${location.hostname}:5174`;
const NO_SIGNALS: SimState = { on_call: false, recent_call: false, chatting: false, screen_sharing: false, unavailable: false };

interface Scenario {
  n: number;
  user: string;
  signals: Partial<SimState>;
  to: string;
  offline?: boolean;
}
const SCENARIOS: Scenario[] = [
  { n: 1, user: "tan.siewlan", signals: { on_call: true }, to: "/pay?payee=" + encodeURIComponent("MAS Safety Account – Lim K.") + "&amount=8000" },
  { n: 2, user: "tan.siewlan", signals: {}, to: "/pay?payee=" + encodeURIComponent("Hospital – NUH Billing") + "&amount=3200" },
  { n: 3, user: "tan.siewlan", signals: {}, to: "/pay?payee=" + encodeURIComponent("SP Group") + "&amount=45" },
  { n: 4, user: "tan.siewlan", signals: { on_call: true }, to: "/pay?payee=" + encodeURIComponent("MAS Safety Account – Lim K.") + "&amount=8000" },
  { n: 5, user: "ryan.lim", signals: { chatting: true }, to: "/pay?payee=" + encodeURIComponent("HR Onboarding – J. Wong") + "&amount=600" },
  { n: 6, user: "ryan.lim", signals: {}, to: "/check?sample=ticket" },
  { n: 7, user: "tan.siewlan", signals: {}, to: "/pay?payee=" + encodeURIComponent("Tan Wei Ming (son)") + "&amount=120", offline: true },
];
const ROLES = [
  { user: "tan.siewlan", label: "Mdm Tan Siew Lan (68, customer, 中文, Easy Mode)" },
  { user: "ryan.lim", label: "Ryan Lim (21, student, customer)" },
  { user: "aisha.rahman", label: "Aisha Rahman (41, customer, Bahasa Melayu)" },
  { user: "daniel.tan", label: "Daniel Tan (trusted contact for Mdm Tan)" },
  { user: "mrs.lim", label: "Mrs Lim (trusted contact for Ryan)" },
];

export function Demo() {
  const { t } = useTranslation();
  const { config, login } = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (config && !config.demo_mode) return <Navigate to="/login" replace />;

  const run = async (s: Scenario) => {
    setBusy(`s${s.n}`);
    setErr(null);
    try {
      setSimulatedOffline(false);
      writeSim({ ...NO_SIGNALS, ...s.signals });
      await login(s.user, config?.demo_password ?? "Demo1234!");
      setGuideDone(s.user);
      qc.clear();
      if (s.offline) setSimulatedOffline(true);
      nav(s.to);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      await api("/api/demo/reset", { method: "POST", auth: false });
      setSimulatedOffline(false);
      writeSim(NO_SIGNALS);
      qc.clear();
      toast(t("demo.resetDone"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Disclaimer text={t("common.disclaimer")} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <h1 className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-8 w-8 text-accent" />
          {t("demo.title")}
        </h1>
        <p>{t("demo.intro")}</p>
        {err && <Banner tone="danger" alert>{err}</Banner>}
        <div className="flex flex-wrap gap-3">
          <a href={STAFF_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-btn items-center gap-2 rounded-btn bg-primary px-4 font-semibold text-on-primary no-underline dark:bg-secondary dark:text-on-secondary">
            <ExternalLink aria-hidden className="h-5 w-5" /> {t("demo.openStaff")} (staff.anna)
          </a>
          <Button variant="outline" icon={RotateCcw} onClick={reset} loading={busy === "reset"}>
            {t("demo.reset")}
          </Button>
        </div>

        <section aria-labelledby="sc-h" className="space-y-3">
          <h2 id="sc-h">{t("demo.scenarios")}</h2>
          <ol className="grid gap-3 md:grid-cols-2">
            {SCENARIOS.map((s) => (
              <li key={s.n}>
                <Card className="flex h-full flex-col gap-3">
                  <h3 className="text-lg font-bold">
                    {s.n}. {t(`demo.s${s.n}`)}
                  </h3>
                  <p className="flex-1 text-muted-foreground">{t(`demo.s${s.n}d`)}</p>
                  <Button icon={Play} onClick={() => run(s)} loading={busy === `s${s.n}`}>
                    {t("demo.run")} {s.n}
                  </Button>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="roles-h" className="space-y-3">
          <h2 id="roles-h">{t("demo.roles")}</h2>
          <p className="text-sm text-muted-foreground">Each opens in a new tab with its own sign-in, so you can watch the customer, the trusted contact and staff side by side.</p>
          <ul className="grid gap-2 md:grid-cols-2">
            {ROLES.map((r) => (
              <li key={r.user}>
                <a
                  href={`/login?as=${r.user}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-btn items-center gap-2 rounded-card border border-border bg-card px-4 py-2 font-semibold text-foreground no-underline shadow-card hover:bg-muted"
                >
                  <ExternalLink aria-hidden className="h-4 w-4 shrink-0" />
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <Card>
          <h2 className="mb-3">{t("demo.drawer")}</h2>
          <DemoSignalControls />
        </Card>
      </div>
    </div>
  );
}
