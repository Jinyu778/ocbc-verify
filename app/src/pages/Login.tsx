import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { ApiError, Banner, Button, Disclaimer, Field } from "@/design";
import { useSession } from "../state/session";
import { LanguageSelect } from "../components/Layout";
import { HOME_FOR } from "../App";

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
    <div className="min-h-screen">
      <Disclaimer text={t("common.disclaimer")} />
      <main className="mx-auto max-w-md space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
      </main>
    </div>
  );
}
