import { useCallback } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Flag, History, ListChecks, LogOut, ShieldCheck } from "lucide-react";
import { Disclaimer, SessionTimeout, cx, useLive, useLiveEvent, useToast } from "@/design";
import { useSession } from "../state/session";
import { Queue } from "./pages/Queue";
import { Messages } from "./pages/Messages";
import { Impact } from "./pages/Impact";
import { Audit } from "./pages/Audit";
import { CallDock } from "./components/CallDock";

const NAV = [
  { to: "/staff", label: "Case queue", icon: ListChecks, end: true },
  { to: "/staff/messages", label: "Reported messages", icon: Flag },
  { to: "/staff/impact", label: "Impact", icon: BarChart3 },
  { to: "/staff/audit", label: "Audit trail", icon: History },
];

/** Fraud console: the same app, laid out for a desktop browser, for staff accounts only. */
export default function StaffApp() {
  const { user, logout } = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { connected } = useLive();
  useLiveEvent((m) => {
    if (m.type === "transfer.updated") {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["case", m.transfer_id] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    } else if (m.type.startsWith("call.")) {
      qc.invalidateQueries({ queryKey: ["calls"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      if (m.type === "call.incoming" && m.customer_name) toast(`Incoming verification call from ${m.customer_name}`, "warning");
    } else if (m.type.startsWith("message.")) {
      qc.invalidateQueries({ queryKey: ["messages"] });
      if (m.type === "message.reported") toast("A customer reported a suspicious message", "info");
    }
  });
  const signOut = useCallback(() => {
    logout();
    nav("/login");
  }, [logout, nav]);

  return (
    <div className="flex min-h-screen flex-col text-base">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-btn focus:bg-card focus:p-3">
        Skip to content
      </a>
      <Disclaimer />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="bg-primary text-on-primary md:w-60 md:shrink-0">
          <div className="flex items-center gap-2 px-4 py-4 text-lg font-bold">
            <ShieldCheck aria-hidden className="h-7 w-7 text-accent" /> SafeBank
            <span className="ml-auto text-sm font-normal opacity-80 md:hidden">{user?.display_name}</span>
          </div>
          <nav aria-label="Console">
            <ul className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      cx("flex min-h-touch w-full items-center gap-2 whitespace-nowrap rounded-btn px-3 text-left font-medium text-on-primary no-underline", isActive ? "bg-white/15" : "hover:bg-white/10")
                    }
                  >
                    <n.icon aria-hidden className="h-5 w-5" /> {n.label}
                  </NavLink>
                </li>
              ))}
              <li className="md:hidden">
                <button type="button" onClick={signOut} className="flex min-h-touch items-center gap-2 whitespace-nowrap rounded-btn px-3 hover:bg-white/10">
                  <LogOut aria-hidden className="h-5 w-5" /> Sign out
                </button>
              </li>
            </ul>
          </nav>
          <div className="hidden px-4 py-4 text-sm md:block">
            <p className="font-semibold">{user?.display_name}</p>
            <p className="opacity-80">Fraud officer</p>
            <p className="mt-1 flex items-center gap-1 opacity-90" role="status">
              <span aria-hidden className={cx("inline-block h-2 w-2 rounded-full", connected ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
              {connected ? "Live" : "Reconnecting…"}
            </p>
            <button type="button" onClick={signOut} className="mt-3 inline-flex min-h-touch items-center gap-2 rounded-btn px-2 hover:bg-white/10">
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6">
          <Routes>
            <Route index element={<Queue />} />
            <Route path="messages" element={<Messages />} />
            <Route path="impact" element={<Impact />} />
            <Route path="audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/staff" replace />} />
          </Routes>
        </main>
      </div>
      <CallDock />
      <SessionTimeout
        idleMinutes={30}
        onTimeout={signOut}
        strings={{ title: "Are you still there?", body: (s) => `You'll be signed out in ${s} seconds.`, stay: "Stay signed in", signOut: "Sign out now" }}
      />
    </div>
  );
}
