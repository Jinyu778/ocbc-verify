import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PhoneIncoming } from "lucide-react";
import { Button, Dialog, LiveProvider, SessionTimeout, ToastProvider, api, useLiveEvent, useToast } from "@safebank/ui";
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
import { Demo } from "./pages/Demo";
import type { CallInfo } from "./types";

export function App() {
  return (
    <PrefsProvider>
      <SessionProvider>
        <LiveProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/demo" element={<Demo />} />
              <Route path="/*" element={<Authed />} />
            </Routes>
          </ToastProvider>
        </LiveProvider>
      </SessionProvider>
    </PrefsProvider>
  );
}

function Authed() {
  const { user, logout } = useSession();
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const onTimeout = useCallback(() => {
    logout();
    nav("/login");
  }, [logout, nav]);
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.role === "staff") return <Navigate to="/login?wrong=staff" replace />;
  const isCustomer = user.role === "customer";
  if (isCustomer && !guideDone(user.username) && loc.pathname !== "/guide") return <Navigate to="/guide" replace />;

  return (
    <Layout customer={isCustomer}>
      <LiveSync />
      {isCustomer && <IncomingCall />}
      <SessionTimeout
        onTimeout={onTimeout}
        strings={{ title: t("session.title"), body: (s) => t("session.body", { s }), stay: t("session.stay"), signOut: t("session.signOut") }}
      />
      <Routes>
        {isCustomer ? (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/pay" element={<Pay />} />
            <Route path="/pay/:id" element={<TransferFlow />} />
            <Route path="/call/:id" element={<CallScreen />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/check" element={<Check />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/guide" element={<Guide />} />
          </>
        ) : (
          <>
            <Route path="/" element={<ContactHome />} />
            <Route path="/settings" element={<Settings />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
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
    } else if (m.type === "demo.reset") {
      qc.invalidateQueries();
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
    if (m.type === "call.incoming" && m.call && !loc.pathname.startsWith("/call/")) setCall(m.call as CallInfo);
    if (m.type === "call.ended" && call && m.call_id === call.id) setCall(null);
  });
  const answer = async () => {
    if (!call) return;
    setBusy(true);
    try {
      await api(`/api/calls/${call.id}/accept`, { method: "POST" });
      nav(`/call/${call.id}`);
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
