import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { Dialog, isSimulatedOffline, setSimulatedOffline } from "@safebank/ui";
import { readSim, signalProvider, writeSim, type SimState } from "../signals";

/** DEMO_MODE only. The web version can't read real calls, so presenters toggle signals here. */
export function DemoSignalControls() {
  const { t } = useTranslation();
  const [s, setS] = useState<SimState>(readSim);
  const [offline, setOffline] = useState(isSimulatedOffline);
  useEffect(() => {
    const h = () => setS(readSim());
    window.addEventListener("sb-signals", h);
    return () => window.removeEventListener("sb-signals", h);
  }, []);
  const rows: [keyof SimState, string][] = [
    ["on_call", t("demo.onCall")],
    ["recent_call", t("demo.recentCall")],
    ["chatting", t("demo.chatting")],
    ["screen_sharing", t("demo.screenSharing")],
    ["unavailable", t("demo.unavailable")],
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-muted-foreground">{t("demo.drawerLabel")}</legend>
      {signalProvider.kind === "native" && <p className="text-sm">Native call detection is active on this device; these toggles add to it.</p>}
      {rows.map(([key, label]) => (
        <label key={key} className="flex min-h-touch cursor-pointer items-center gap-3 rounded-btn border border-border px-3">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={s[key]} onChange={(e) => writeSim({ [key]: e.target.checked })} />
          <span>{label}</span>
        </label>
      ))}
      <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-btn border border-dashed border-border-strong px-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--accent)]"
          checked={offline}
          onChange={(e) => {
            setSimulatedOffline(e.target.checked);
            setOffline(e.target.checked);
          }}
        />
        <span>{t("demo.offline")}</span>
      </label>
    </fieldset>
  );
}

export function DemoDrawer() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => countActive());
  useEffect(() => {
    const h = () => setActive(countActive());
    window.addEventListener("sb-signals", h);
    return () => window.removeEventListener("sb-signals", h);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("demo.drawer")}
        className="fixed bottom-24 right-2 z-30 inline-flex min-h-touch min-w-touch items-center justify-center gap-1 rounded-full border-2 border-dashed border-border-strong bg-card px-2 text-sm font-semibold text-foreground opacity-90 shadow-card hover:opacity-100"
      >
        <FlaskConical aria-hidden className="h-5 w-5" />
        <span className="sr-only">{t("demo.drawer")}</span>
        {active > 0 && <span className="rounded-full bg-danger px-1.5 text-xs text-white dark:text-primary">{active}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("demo.drawer")} sheet closeLabel={t("common.close")}>
        <DemoSignalControls />
      </Dialog>
    </>
  );
}

function countActive() {
  const s = readSim();
  return [s.on_call, s.recent_call, s.chatting, s.screen_sharing, s.unavailable].filter(Boolean).length + (isSimulatedOffline() ? 1 : 0);
}
