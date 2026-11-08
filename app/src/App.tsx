import { lazy, Suspense, useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneIncoming } from "lucide-react";
import { Button, Dialog, LiveProvider, SessionTimeout, Skeleton, ToastProvider, api, useLiveEvent, useToast, type Role } from "@/design";
import { PrefsProvider } from "./state/prefs";
import { SessionProvider, useSession } from "./state/session";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Pay } from "./pages/Pay";
import { TransferFlow } from "./pages/TransferFlow";
import { CallScreen } from "./pages/CallScreen";
import { Verify } from "./pages/Verify";
import { Check } from "./pages/Check";
import { Settings } from "./pages/Settings";
import { Guide, guideDone } from "./pages/Guide";
import { ContactHome } from "./pages/ContactHome";
import type { CallInfo } from "./types";

const StaffApp = lazy(() => import("./staff/StaffApp"));

export const HOME_FOR: Record<Role, string> = { customer: "/customer", trusted_contact: "/contact", staff: "/staff" };

export function App() {
  return (
    <PrefsProvider>
      <SessionProvider>
        <LiveProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/customer/*" element={<RequireRole role="customer"><CustomerArea /></RequireRole>} />
              <Route path="/contact/*" element={<RequireRole role="trusted_contact"><ContactArea /></RequireRole>} />
              <Route
                path="/staff/*"
                element={
                  <RequireRole role="staff">
                    <Suspense fallback={<Skeleton className="m-6 h-64" />}>
                      <StaffApp />
                    </Suspense>
                  </RequireRole>
                }
              />
              <Route path="*" element={<RoleRedirect />} />
            </Routes>
          </ToastProvider>
        </LiveProvider>
      </SessionProvider>
    </PrefsProvider>
  );
}

/** "/" and unknown paths: send each account to its own area. */
function RoleRedirect() {
  const { user } = useSession();
  return <Navigate to={user ? HOME_FOR[user.role] : "/login"} replace />;
}

/** UI route guard (the API enforces roles too). */
function RequireRole({ role, children }: { role: Role; children: JSX.Element }) {
  const { user } = useSession();
  const loc = useLocation();
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.role !== role) return <Navigate to={HOME_FOR[user.role]} replace />;
  return children;
}

function useTimeout() {
  const { logout } = useSession();
  const nav = useNavigate();
  return useCallback(() => {
    logout();
    nav("/login");
  }, [logout, nav]);
}

function Timeout() {
  const { t } = useTranslation();
  const onTimeout = useTimeout();
  return (
    <SessionTimeout
      onTimeout={onTimeout}
      strings={{ title: t("session.title"), body: (s) => t("session.body", { s }), stay: t("session.stay"), signOut: t("session.signOut") }}
    />
  );
}

function CustomerArea() {
  const { user } = useSession();
  const loc = useLocation();
  if (user && !guideDone(user.username) && loc.pathname !== "/customer/guide") return <Navigate to="/customer/guide" replace />;
  return (
    <Layout customer>
      <LiveSync />
      <IncomingCall />
      <Timeout />
      <Routes>
        <Route index element={<Home />} />
        <Route path="pay" element={<Pay />} />
        <Route path="pay/:id" element={<TransferFlow />} />
        <Route path="call/:id" element={<CallScreen />} />
        <Route path="verify" element={<Verify />} />
        <Route path="check" element={<Check />} />
        <Route path="settings" element={<Settings />} />
        <Route path="guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </Layout>
  );
}

function ContactArea() {
  return (
    <Layout customer={false}>
      <LiveSync />
      <Timeout />
      <Routes>
        <Route index element={<ContactHome />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/contact" replace />} />
      </Routes>
    </Layout>
  );
}

/** Live updates: any server push refreshes the affected data. */
function LiveSync() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  useLiveEvent((m) => {
    if (m.type === "transfer.updated") {
      qc.invalidateQueries({ queryKey: ["transfer", m.transfer_id] });
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["trusted-requests"] });
    } else if (m.type === "trusted.request") {
      qc.invalidateQueries({ queryKey: ["trusted-requests"] });
      toast(t("contact.newRequest", { name: m.customer_name }), "warning");
    } else if (m.type.startsWith("call.")) {
      qc.invalidateQueries({ queryKey: ["call"] });
      qc.invalidateQueries({ queryKey: ["verify"] });
    }
  });
  return null;
}

/** SafeBank staff can ring the customer in-app; shown wherever they are. */
function IncomingCall() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const [call, setCall] = useState<CallInfo | null>(null);
  const [busy, setBusy] = useState(false);
  useLiveEvent((m) => {
    if (m.type === "call.incoming" && m.call && !loc.pathname.startsWith("/customer/call/")) setCall(m.call as CallInfo);
    if (m.type === "call.ended" && call && m.call_id === call.id) setCall(null);
  });
  const answer = async () => {
    if (!call) return;
    setBusy(true);
    try {
      await api(`/api/calls/${call.id}/accept`, { method: "POST" });
      nav(`/customer/call/${call.id}`);
    } finally {
      setBusy(false);
      setCall(null);
    }
  };
  return (
    <Dialog
      open={!!call}
      onClose={() => setCall(null)}
      closeLabel={t("common.close")}
      title={
        <span className="flex items-center gap-2">
          <PhoneIncoming aria-hidden className="h-6 w-6 text-success" />
          {t("call.incoming")}
        </span>
      }
      footer={
        <Button onClick={answer} loading={busy} block size="lg" data-autofocus>
          {t("call.answer")}
        </Button>
      }
    >
      <p className="font-semibold">{t("call.verified")}</p>
      <p className="text-lg">{call?.staff?.display_name}</p>
      <p className="mt-2 text-muted-foreground">{t("call.incomingBody")}</p>
    </Dialog>
  );
}
