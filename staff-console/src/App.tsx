import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Flag, History, ListChecks, LogIn, LogOut, ShieldCheck } from "lucide-react";
import {
  ApiError,
  Banner,
  Button,
  Disclaimer,
  Field,
  LiveProvider,
  SessionTimeout,
  ToastProvider,
  cx,
  getSession,
  login,
  logout,
  onSessionChange,
  useLive,
  useLiveEvent,
  useToast,
  type User,
} from "@safebank/ui";
import { Queue } from "./pages/Queue";
import { Messages } from "./pages/Messages";
import { Impact } from "./pages/Impact";
import { Audit } from "./pages/Audit";
import { CallDock } from "./components/CallDock";

type Tab = "queue" | "messages" | "impact" | "audit";

export function App() {
  const [user, setUser] = useState<User | null>(() => getSession()?.user ?? null);
  useEffect(() => onSessionChange((s) => setUser(s?.user ?? null)), []);
  return (
    <ToastProvider>
      <LiveProvider>{user?.role === "staff" ? <Shell user={user} /> : <Login />}</LiveProvider>
    </ToastProvider>
  );
}

function Login() {
  const [username, setUsername] = useState(() => (new URLSearchParams(location.search).get("as") ?? "staff.anna"));
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const u = await login(username, password);
      if (u.role !== "staff") {
        logout();
        setErr("This console is for SafeBank staff only. Customers use the SafeBank app.");
      }
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.unreachable ? "We can't reach the SafeBank API. Check it is running on port 8000." : e2.message) : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="min-h-screen">
      <Disclaimer />
      <main className="mx-auto max-w-sm space-y-5 px-4 py-12">
        <h1 className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-8 w-8 text-accent" /> SafeBank Fraud Console
        </h1>
        <form onSubmit={submit} className="space-y-4 rounded-card border border-border bg-card p-5 shadow-card" noValidate>
          {err && <Banner tone="danger" alert>{err}</Banner>}
          <Field label="Staff username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" helper="Demo password: Demo1234!" />
          <Button type="submit" block icon={LogIn} loading={busy}>Sign in</Button>
        </form>
      </main>
    </div>
  );
}

function Shell({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>("queue");
  const qc = useQueryClient();
  const toast = useToast();
  const { connected } = useLive();
  useLiveEvent((m) => {
    if (m.type === "transfer.updated") {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["case", m.transfer_id] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    } else if (m.type.startsWith("call.")) {
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      if (m.type === "call.incoming" && m.customer_name) toast(`Incoming verification call from ${m.customer_name}`, "warning");
    } else if (m.type.startsWith("message.")) {
      qc.invalidateQueries({ queryKey: ["messages"] });
      if (m.type === "message.reported") toast("A customer reported a suspicious message", "info");
    } else if (m.type === "demo.reset") qc.invalidateQueries();
  });
  const onTimeout = useCallback(() => logout(), []);
  const nav: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: "queue", label: "Case queue", icon: ListChecks },
    { id: "messages", label: "Reported messages", icon: Flag },
    { id: "impact", label: "Impact", icon: BarChart3 },
    { id: "audit", label: "Audit trail", icon: History },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <Disclaimer />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="bg-primary text-on-primary md:w-60 md:shrink-0">
          <div className="flex items-center gap-2 px-4 py-4 text-lg font-bold">
            <ShieldCheck aria-hidden className="h-7 w-7 text-accent" /> SafeBank
          </div>
          <nav aria-label="Console">
            <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
              {nav.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => setTab(n.id)}
                    aria-current={tab === n.id ? "page" : undefined}
                    className={cx("flex min-h-touch w-full items-center gap-2 whitespace-nowrap rounded-btn px-3 text-left font-medium", tab === n.id ? "bg-white/15" : "hover:bg-white/10")}
                  >
                    <n.icon aria-hidden className="h-5 w-5" /> {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="hidden px-4 py-4 text-sm md:block">
            <p className="font-semibold">{user.display_name}</p>
            <p className="opacity-80">Fraud officer</p>
            <p className="mt-1 flex items-center gap-1 opacity-90" role="status">
              <span aria-hidden className={cx("inline-block h-2 w-2 rounded-full", connected ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
              {connected ? "Live" : "Reconnecting…"}
            </p>
            <button type="button" onClick={() => logout()} className="mt-3 inline-flex min-h-touch items-center gap-2 rounded-btn px-2 hover:bg-white/10">
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          {tab === "queue" && <Queue />}
          {tab === "messages" && <Messages />}
          {tab === "impact" && <Impact />}
          {tab === "audit" && <Audit />}
        </main>
      </div>
      <CallDock />
      <SessionTimeout
        idleMinutes={30}
        onTimeout={onTimeout}
        strings={{ title: "Are you still there?", body: (s) => `You'll be signed out in ${s} seconds.`, stay: "Stay signed in", signOut: "Sign out now" }}
      />
    </div>
  );
}
