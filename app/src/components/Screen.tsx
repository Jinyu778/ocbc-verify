import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigationType } from "react-router-dom";
import { AlertTriangle, MessageCircleWarning, MonitorUp, PhoneCall } from "lucide-react";
import { Banner } from "@/design";
import { useSignals } from "../signals";
import { BackButton } from "./Layout";

/** One screen: back button, focused heading (announced on route change), content. */
export function Screen({
  title,
  back,
  onBack,
  children,
  actions,
}: {
  title?: ReactNode;
  back?: string | true;
  onBack?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const h = useRef<HTMLHeadingElement>(null);
  // Back (browser back, nav(-1)) slides in from the left; everything else rises.
  const navType = useNavigationType();
  const { key } = useLocation();
  const goingBack = navType === "POP" && key !== "default"; // "default" = the first page load
  useEffect(() => {
    h.current?.focus();
  }, []);
  return (
    <div data-nav={goingBack ? "back" : "forward"} className="sb-screen mx-auto w-full max-w-[40rem] space-y-gap px-4 py-5">
      {onBack ? <BackButton onClick={onBack} /> : back && <BackButton to={back === true ? undefined : back} />}
      {title && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 ref={h} tabIndex={-1} className="text-[1.75rem] outline-none sm:text-3xl">
            {title}
          </h1>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

interface BannerSignals {
  on_call?: unknown;
  recent_call?: unknown;
  chatting?: unknown;
  screen_sharing?: unknown;
  available?: unknown;
}

/**
 * Live call/chat/screen-share warnings. role="alert", icon + text, never colour alone.
 * Pass `signals` (e.g. the ones stored on a transfer); otherwise shows what the device sees now.
 */
export function SignalBanners({ signals }: { signals?: BannerSignals }) {
  const { t } = useTranslation();
  const device = useSignals();
  const raw = signals ?? device;
  const s = {
    on_call: !!raw.on_call,
    recent_call: !!raw.recent_call,
    chatting: !!raw.chatting,
    screen_sharing: !!raw.screen_sharing,
    available: raw.available !== false,
  };
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
