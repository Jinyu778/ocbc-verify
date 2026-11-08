import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { ApiError, Banner, Button, Disclaimer, Field } from "@safebank/ui";
import { useSession } from "../state/session";
import { LanguageSelect } from "../components/Layout";

export function Login() {
  const { t } = useTranslation();
  const { login, config, user } = useSession();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [username, setUsername] = useState(params.get("as") ?? "");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(params.get("wrong") === "staff" ? "Staff accounts use the staff console." : null);
  const [busy, setBusy] = useState(false);
  const autoTried = useRef(false);
  const next = params.get("next") || "/";

  const go = async (u: string, p: string) => {
    if (!u.trim() || !p) {
      setError(t("login.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const usr = await login(u.trim(), p);
      if (usr.role === "staff") {
        setError("Staff accounts use the staff console.");
        return;
      }
      nav(next, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? (e.unreachable ? t("common.offlineTitle") : e.message) : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  // Demo launcher: /login?as=username signs straight in (DEMO_MODE only).
  useEffect(() => {
    const as = params.get("as");
    if (as && config?.demo_mode && config.demo_password && !autoTried.current && user?.username !== as) {
      autoTried.current = true;
      go(as, config.demo_password);
    } else if (as && user?.username === as) nav(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(username, password);
  };

  return (
    <div className="min-h-screen">
      <Disclaimer text={t("common.disclaimer")} />
      <div className="mx-auto max-w-md space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck aria-hidden className="h-8 w-8 text-accent" />
            {t("common.appName")}
          </span>
          <LanguageSelect id="lang-login" />
        </div>
        <h1>{t("login.title")}</h1>
        <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card">
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
        {config?.demo_mode && (
          <div className="space-y-1 text-center">
            <p className="text-muted-foreground">{t("login.demoHint", { password: config.demo_password })}</p>
            <Link to="/demo" className="font-semibold text-secondary underline">
              {t("login.openDemo")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
