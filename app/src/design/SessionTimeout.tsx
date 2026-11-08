import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { api } from "./api";
import { Button, Dialog } from "./components";

/**
 * WCAG 2.2.1 Timing Adjustable: warns before an idle sign-out and lets the user extend.
 */
export function SessionTimeout({
  idleMinutes = 10,
  warnSeconds = 60,
  onTimeout,
  strings,
}: {
  idleMinutes?: number;
  warnSeconds?: number;
  onTimeout: () => void;
  strings: { title: string; body: (s: number) => string; stay: string; signOut: string };
}) {
  const last = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const bump = () => {
      if (left === null) last.current = Date.now();
    };
    const evs = ["pointerdown", "keydown", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = (Date.now() - last.current) / 1000;
      const limit = idleMinutes * 60;
      if (idle >= limit) {
        clearInterval(t);
        onTimeout();
      } else if (idle >= limit - warnSeconds) setLeft(Math.ceil(limit - idle));
    }, 1000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, [idleMinutes, warnSeconds, onTimeout, left]);

  const stay = async () => {
    last.current = Date.now();
    setLeft(null);
    try {
      await api("/api/auth/me");
    } catch {
      /* refresh handled by client */
    }
  };

  return (
    <Dialog
      open={left !== null}
      onClose={stay}
      title={
        <span className="flex items-center gap-2">
          <Clock aria-hidden className="h-6 w-6" />
          {strings.title}
        </span>
      }
      footer={
        <>
          <Button data-autofocus onClick={stay} block>
            {strings.stay}
          </Button>
          <Button variant="outline" onClick={onTimeout} block>
            {strings.signOut}
          </Button>
        </>
      }
    >
      <p aria-live="polite">{strings.body(left ?? 0)}</p>
    </Dialog>
  );
}
