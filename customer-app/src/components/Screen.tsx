import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MessageCircleWarning, MonitorUp, PhoneCall } from "lucide-react";
import { Banner } from "@safebank/ui";
import { useSignals } from "../signals";
import { BackButton } from "./Layout";

/** One screen: back button, focused heading (announced on route change), content. */
export function Screen({ title, back, children, actions }: { title?: ReactNode; back?: string | true; children: ReactNode; actions?: ReactNode }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus();
  }, []);
  return (
    <div className="sb-screen mx-auto w-full max-w-xl space-y-gap px-4 py-5">
      {back && <BackButton to={back === true ? undefined : back} />}
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 ref={h} tabIndex={-1} className="outline-none">
            {title}
          </h1>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/** Live call/chat/screen-share warnings. role="alert", icon + text, never colour alone. */
export function SignalBanners() {
  const { t } = useTranslation();
  const s = useSignals();
  return (
    <div className="space-y-3">
      {(s.on_call || s.recent_call) && (
        <Banner tone="danger" alert icon={PhoneCall}>
          {t("banners.call")}
        </Banner>
      )}
      {s.chatting && (
        <Banner tone="danger" alert icon={MessageCircleWarning}>
          {t("banners.chat")}
        </Banner>
      )}
      {s.screen_sharing && (
        <Banner tone="danger" alert icon={MonitorUp}>
          {t("banners.screen")}
        </Banner>
      )}
      {!s.available && (
        <Banner tone="warning" icon={AlertTriangle}>
          {t("banners.unavailable")}
        </Banner>
      )}
    </div>
  );
}
