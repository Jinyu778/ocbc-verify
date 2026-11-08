import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Home, LifeBuoy, MessageSquareWarning, Phone, PhoneCall, Send, Settings as Cog, ShieldCheck } from "lucide-react";
import { Button, Dialog, Disclaimer, LANGUAGES, cx, useLive, type LangCode } from "@safebank/ui";
import { usePrefs } from "../state/prefs";
import { savePrefsToServer, useSession } from "../state/session";
import { DemoDrawer } from "./DemoDrawer";
import { startSafeBankCall } from "../lib/calls";

export function Layout({ children, customer }: { children: ReactNode; customer: boolean }) {
  const { t } = useTranslation();
  const [help, setHelp] = useState(false);
  const { config } = useSession();
  const { connected } = useLive();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-card focus:p-3">
        Skip to content
      </a>
      <Disclaimer text={t("common.disclaimer")} />
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 px-4 py-2">
          <span className="flex min-w-0 items-center gap-2 text-lg font-bold text-foreground">
            <ShieldCheck aria-hidden className="h-7 w-7 text-accent" />
            {t("common.appName")}
          </span>
          <span className="flex-1" />
          <LanguageSelect />
          <Button variant="outline" size="sm" icon={LifeBuoy} onClick={() => setHelp(true)}>
            {t("common.help")}
          </Button>
        </div>
        {!connected && (
          <p role="status" className="bg-warning-soft px-4 py-1 text-center text-sm text-foreground">
            {t("common.liveOff")}
          </p>
        )}
      </header>
      <main id="main" className={cx("flex-1", customer && "pb-24")}>
        {children}
      </main>
      {customer && <BottomNav />}
      <HelpSheet open={help} onClose={() => setHelp(false)} customer={customer} />
      {config?.demo_mode && customer && <DemoDrawer />}
    </div>
  );
}

export function LanguageSelect({ id = "lang-header", showLabel = false }: { id?: string; showLabel?: boolean }) {
  const { t, i18n } = useTranslation();
  const { setLang } = usePrefs();
  const { user } = useSession();
  return (
    <div className={showLabel ? "" : "flex items-center"}>
      <label htmlFor={id} className={showLabel ? "mb-1 block font-semibold" : "sr-only"}>
        {t("common.language")}
      </label>
      <select
        id={id}
        value={i18n.language}
        onChange={(e) => {
          const l = e.target.value as LangCode;
          setLang(l);
          if (user) savePrefsToServer({ preferred_language: l });
        }}
        className={cx("min-h-touch rounded-btn border-2 border-border-strong bg-card px-2 text-foreground", showLabel && "min-h-btn w-full")}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  const items = [
    { to: "/", icon: Home, label: t("nav.home"), end: true },
    { to: "/pay", icon: Send, label: t("nav.pay") },
    { to: "/check", icon: MessageSquareWarning, label: t("nav.checkShort"), aria: t("nav.check") },
    { to: "/settings", icon: Cog, label: t("nav.settings") },
  ];
  return (
    <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-1">
        {items.map(({ to, icon: Icon, label, end, aria }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              aria-label={aria}
              className={({ isActive }) =>
                cx(
                  "flex min-h-btn min-w-0 flex-col items-center justify-center gap-0.5 rounded-btn px-0.5 py-1 text-center text-sm font-medium leading-tight no-underline [overflow-wrap:anywhere]",
                  isActive ? "text-accent" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden className={cx("h-6 w-6", isActive && "stroke-[2.5]")} />
                  <span className={isActive ? "font-bold" : ""}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HelpSheet({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={t("help.title")} sheet closeLabel={t("common.close")}>
      <p>{t("help.body")}</p>
      <div className="mt-4 flex flex-col gap-3">
        {customer && (
          <Button
            icon={PhoneCall}
            block
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const c = await startSafeBankCall(null);
                onClose();
                nav(`/call/${c.id}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("help.callInApp")}
          </Button>
        )}
        <a href="tel:1799" className="inline-flex min-h-btn items-center justify-center gap-2 rounded-btn border-2 border-border-strong bg-card px-4 font-semibold text-foreground no-underline hover:bg-muted">
          <Phone aria-hidden className="h-5 w-5" />
          {t("help.helpline")}
        </a>
        <p className="text-sm text-muted-foreground">{t("help.helplineDesc")}</p>
        {customer && (
          <Button variant="ghost" icon={ShieldCheck} block onClick={() => (onClose(), nav("/verify"))}>
            {t("help.verify")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

export function BackButton({ to, label, onClick }: { to?: string; label?: string; onClick?: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to ? nav(to) : nav(-1))}
      className="-ml-2 inline-flex min-h-touch items-center gap-1 rounded-btn px-2 font-semibold text-foreground hover:bg-muted"
    >
      <ArrowLeft aria-hidden className="h-5 w-5" />
      {label ?? t("common.back")}
    </button>
  );
}
