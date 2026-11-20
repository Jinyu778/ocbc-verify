import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PhoneIncoming, ArrowLeft, Home, LifeBuoy, MessageSquareWarning, Phone, PhoneCall, Send, Settings as Cog, ShieldCheck } from "lucide-react";
import { Button, Dialog, LANGUAGES, cx, useLive, type LangCode } from "@/design";
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
      <header className="sticky top-0 z-30 border-b border-border bg-card text-foreground">
        <div className="mx-auto flex max-w-[40rem] flex-wrap items-center gap-1.5 px-4 py-2.5">
          <BrandMark />
          <span className="flex-1" />
          <LanguageSelect />
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
  "sb-press inline-flex min-h-touch items-center gap-1.5 rounded-btn px-3 text-sm font-semibold text-foreground hover:bg-muted";

/** Wordmark: an authored monogram, not the shield (the shield-check is reserved for "verified"). */
/**
 * Brand mark. Uses the official OCBC logo file at app/public/brand/ocbc-logo.svg when it is present
 * (supplied by the team; it is never drawn or approximated in code). Until then it falls back to a
 * plain authored mark so the header never shows a broken image.
 */
const LOGO_SRC = "/brand/ocbc-logo.svg";
export function BrandMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { t } = useTranslation();
  const [logoMissing, setLogoMissing] = useState(false);
  return (
    <span className={cx("flex min-w-0 items-center gap-2.5", className)}>
      {logoMissing ? (
        <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
          <rect width="32" height="32" rx="9" fill={onDark ? "#ffffff" : "var(--accent)"} />
          <path d="M9 16.5l4.5 4.5L23 11" fill="none" stroke={onDark ? "var(--accent)" : "#ffffff"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span aria-hidden className={cx("inline-flex h-9 shrink-0 items-center", onDark && "rounded-[8px] bg-white px-1.5")}>
          <img src={LOGO_SRC} alt="" className="h-7 w-auto" onError={() => setLogoMissing(true)} />
        </span>
      )}
      <span className="whitespace-nowrap font-display text-base font-bold tracking-[-0.02em] sm:text-lg">{t("common.appName")}</span>
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
          "min-h-touch rounded-field border px-2.5 text-sm font-medium",
          onDark ? "max-w-[6rem] border-tint-on-dark-strong bg-transparent text-on-primary sm:max-w-[9.5rem] [&>option]:text-foreground" : "max-w-[5.75rem] border-border bg-card text-foreground hover:border-border-strong sm:max-w-[9.5rem]",
          showLabel && "min-h-btn w-full max-w-none text-base",
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

/** Bottom nav: the one frosted surface in the app; a red bar slides to the active tab. */
function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const items = [
    { to: "/customer", icon: Home, label: t("nav.home"), end: true },
    { to: "/customer/pay", icon: Send, label: t("nav.pay") },
    { to: "/customer/check", icon: MessageSquareWarning, label: t("nav.checkShort"), aria: t("nav.check") },
    { to: "/customer/settings", icon: Cog, label: t("nav.settings") },
  ];
  const active = items.findIndex((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  return (
    <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-nav-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="relative mx-auto grid max-w-[40rem] grid-cols-4 gap-1 px-1">
        {active >= 0 && (
          <li aria-hidden className="pointer-events-none absolute inset-x-1 top-0">
            {/* one column wide, so translateX(100%) moves exactly one tab (+ the 0.25 rem gap) */}
            <span
              className="block h-[3px] transition-transform duration-base ease-out motion-reduce:transition-none"
              style={{ width: "calc((100% - 0.75rem) / 4)", transform: `translateX(calc(${active} * (100% + 0.25rem)))` }}
            >
              <span className="mx-auto block h-full w-10 rounded-b-full bg-accent" />
            </span>
          </li>
        )}
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
                  <span aria-hidden className={cx("grid h-8 w-14 place-items-center transition-colors duration-fast", isActive ? "text-accent-ink" : "")}>
                    <Icon className={cx("h-[22px] w-[22px]", isActive && "stroke-[2.25]")} />
                  </span>
                  <span className={isActive ? "font-semibold" : ""}>{label}</span>
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
        <a href="tel:1799" className="sb-press inline-flex min-h-btn items-center justify-center gap-2 rounded-btn border border-border-strong bg-card px-4 font-semibold text-foreground no-underline hover:bg-muted">
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
