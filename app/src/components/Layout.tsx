import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PhoneIncoming, ArrowLeft, Home, LifeBuoy, MessageSquareWarning, Phone, PhoneCall, Send, Settings as Cog, ShieldCheck } from "lucide-react";
import { Button, Dialog, Disclaimer, LANGUAGES, cx, useLive, type LangCode } from "@/design";
import { usePrefs } from "../state/prefs";
import { savePrefsToServer, useSession } from "../state/session";
import { startSafeBankCall } from "../lib/calls";

export function Layout({ children, customer }: { children: ReactNode; customer: boolean }) {
  const { t } = useTranslation();
  const [help, setHelp] = useState(false);
  const { connected } = useLive();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-card focus:p-3">
        Skip to content
      </a>
      <Disclaimer text={t("common.disclaimer")} className="border-b border-tint-on-dark" />
      <header className="sticky top-0 z-30 bg-primary text-on-primary shadow-card">
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 px-4 py-2.5">
          <BrandMark />
          <span className="flex-1" />
          <LanguageSelect onDark />
          <button type="button" onClick={() => setHelp(true)} className={HEADER_BTN}>
            <LifeBuoy aria-hidden className="h-4 w-4" />
            {t("common.help")}
          </button>
          {!customer && (
            <button type="button" onClick={() => nav("/contact/settings")} className={HEADER_BTN}>
              <Cog aria-hidden className="h-4 w-4" />
              {t("nav.settings")}
            </button>
          )}
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
    </div>
  );
}

const HEADER_BTN =
  "sb-press inline-flex min-h-touch items-center gap-1.5 rounded-pill border border-tint-on-dark-strong bg-tint-on-dark px-3 text-sm font-semibold text-on-primary hover:bg-tint-on-dark-strong";

/**
 * The Verity logo: a navy shield holding amber pause bars, with an orange rim (plain shapes, so it
 * scales from 16 px to a slide). It never carries a tick: the green shield-check means "verified" only.
 * Same artwork as public/shield.svg (the browser-tab icon).
 */
export function VerityLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      <path
        d="M32 3.5 L55 11.5 V30 C55 45.5 45.5 55.5 32 61 C18.5 55.5 9 45.5 9 30 V11.5 Z"
        style={{ fill: "var(--primary)", stroke: "var(--accent)" }}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <rect x="23" y="20" width="7" height="22" rx="2" style={{ fill: "var(--warning-strong)" }} />
      <rect x="34" y="20" width="7" height="22" rx="2" style={{ fill: "var(--warning-strong)" }} />
    </svg>
  );
}

/** Logo + name, as shown in the app header, the login screen and the staff console. */
export function BrandMark({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cx("flex min-w-0 items-center gap-2", className)}>
      <VerityLogo className="h-9 w-9 shrink-0" />
      <span className="whitespace-nowrap font-display text-base font-extrabold tracking-[-0.02em] sm:text-lg">{t("common.appName")}</span>
    </span>
  );
}

export function LanguageSelect({ id = "lang-header", showLabel = false, onDark = false }: { id?: string; showLabel?: boolean; onDark?: boolean }) {
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
        className={cx(
          "min-h-touch rounded-field border-2 px-2.5 font-medium",
          onDark ? "max-w-[6rem] border-tint-on-dark-strong bg-primary-2 text-on-primary sm:max-w-[9.5rem]" : "border-border-strong bg-card text-foreground",
          showLabel && "min-h-btn w-full",
        )}
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
    { to: "/customer", icon: Home, label: t("nav.home"), end: true },
    { to: "/customer/pay", icon: Send, label: t("nav.pay") },
    { to: "/customer/check", icon: MessageSquareWarning, label: t("nav.checkShort"), aria: t("nav.check") },
    { to: "/customer/settings", icon: Cog, label: t("nav.settings") },
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
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden className={cx("grid h-8 w-14 place-items-center rounded-pill transition-[transform,background-color] duration-fast ease-out", isActive ? "bg-accent text-on-accent" : "bg-transparent")}>
                    <Icon className={cx("h-[22px] w-[22px]", isActive && "stroke-[2.4]")} />
                  </span>
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
                nav(`/customer/call/${c.id}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("help.callInApp")}
          </Button>
        )}
        <a href="tel:1799" className="sb-press inline-flex min-h-btn items-center justify-center gap-2 rounded-pill border-2 border-border-strong bg-card px-4 font-semibold text-foreground no-underline hover:bg-muted">
          <Phone aria-hidden className="h-5 w-5" />
          {t("help.helpline")}
        </a>
        <p className="text-sm text-muted-foreground">{t("help.helplineDesc")}</p>
        {customer && (
          <Button variant="ghost" icon={PhoneIncoming} block onClick={() => (onClose(), nav("/customer/verify"))}>
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
