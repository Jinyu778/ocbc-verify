import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { ApiError, Banner, Button, Field } from "@/design";
import { useSession } from "../state/session";
import { BrandMark, LanguageSelect } from "../components/Layout";
import { HOME_FOR } from "../App";

/**
 * Original line art: a payment slip held by an open hand, the "pause before you pay" idea.
 * Authored for this app; not OCBC artwork, not the verified shield.
 */
function PauseArt() {
  return (
    <svg aria-hidden viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-auto w-full max-w-[17rem]">
      {/* slip */}
      <rect x="62" y="22" width="116" height="92" rx="12" opacity="0.95" />
      <path d="M80 48h52M80 64h80M80 80h36" opacity="0.7" />
      <path d="M140 96h22" strokeWidth="4" />
      {/* hand, palm up: pause */}
      <path d="M44 150c18-4 36-4 52 2l40 14c10 4 20 2 28-4l38-28c6-5 4-14-4-15-6-1-11 2-16 6l-22 16" />
      <path d="M96 152l34-2c8 0 12-10 4-14l-28-8c-14-4-30-2-42 6" />
      <path d="M20 146h24v40H20z" />
      {/* pause marks */}
      <path d="M196 30v26M208 30v26" strokeWidth="4" />
    </svg>
  );
}

/** One real login for every role. After sign-in each account goes to its own area. */
export function Login() {
  const { t } = useTranslation();
  const { login, user } = useSession();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");

  if (user && !busy) return <Navigate to={HOME_FOR[user.role]} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(t("login.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await login(username.trim(), password);
      const home = HOME_FOR[u.role];
      nav(next && next.startsWith(home) ? next : home, { replace: true });
    } catch (e2) {
      setError(e2 instanceof ApiError ? (e2.unreachable ? `${t("common.offlineTitle")}. ${t("common.offlineBody")}` : e2.message) : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        {/* Hero panel: the first impression. Red gradient, a big Sora line, original art. */}
        <section className="relative isolate overflow-hidden bg-hero text-on-primary">
          <div className="mx-auto flex h-full max-w-xl flex-col gap-8 px-5 pb-20 pt-6 lg:max-w-none lg:px-14 lg:pb-14 lg:pt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <BrandMark onDark />
              <span className="lg:hidden">
                <LanguageSelect id="lang-login" onDark />
              </span>
            </div>
            <div className="lg:my-auto">
              <p
                style={{ ["--display-size" as string]: "3.75rem" }}
                className="sb-display max-w-[14ch] font-display text-[clamp(2.25rem,9vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em]"
              >
                {t("login.heroTitle")}
              </p>
              <p className="mt-4 max-w-[38ch] text-lg text-on-brand-deep-muted">{t("login.heroBody")}</p>
            </div>
            <div className="hidden text-on-primary opacity-90 lg:block">
              <PauseArt />
            </div>
          </div>
        </section>

        <main className="relative -mt-12 px-4 pb-10 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:bg-card lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-4 hidden justify-end lg:flex">
              <LanguageSelect id="lang-login-desktop" />
            </div>
            <form onSubmit={submit} noValidate className="space-y-4 rounded-tile border border-border bg-card p-5 shadow-lift sm:p-6 lg:border-0 lg:p-0 lg:shadow-none">
              <h1 className="text-2xl">{t("login.title")}</h1>
              {error && <Banner tone="danger" alert>{error}</Banner>}
              <Field label={t("login.username")} autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
              <div className="relative">
                <Field
                  label={t("login.password")}
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  inputClassName="pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? t("login.hidePassword") : t("login.showPassword")}
                  aria-pressed={show}
                  className="absolute bottom-0 right-0 inline-flex min-h-btn min-w-[3rem] items-center justify-center rounded-btn text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
                </button>
              </div>
              <Button type="submit" block size="lg" icon={LogIn} loading={busy}>
                {t("login.submit")}
              </Button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
