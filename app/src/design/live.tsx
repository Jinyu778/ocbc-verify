import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_BASE, getSession, onSessionChange } from "./api";

export type LiveMessage = { type: string; [k: string]: unknown };
type Handler = (m: LiveMessage) => void;

interface LiveCtx {
  connected: boolean;
  send: (m: LiveMessage) => boolean;
  subscribe: (h: Handler) => () => void;
}
const Ctx = createContext<LiveCtx | null>(null);

/** One WebSocket per tab, reconnecting with back-off. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlers = useRef(new Set<Handler>());
  const [token, setToken] = useState(() => getSession()?.access_token ?? null);

  useEffect(() => onSessionChange((s) => setToken(s?.access_token ?? null)), []);

  useEffect(() => {
    if (!token) return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    let ping: ReturnType<typeof setInterval>;
    const open = () => {
      const url = `${API_BASE.replace(/^http/, "ws")}/api/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        ping = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: "ping" })), 25000);
      };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data) as LiveMessage;
          handlers.current.forEach((h) => h(m));
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        clearInterval(ping);
        if (!closed) timer = setTimeout(open, Math.min(10000, 500 * 2 ** retry++));
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [token]);

  const send = useCallback((m: LiveMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify(m));
    return true;
  }, []);
  const subscribe = useCallback((h: Handler) => {
    handlers.current.add(h);
    return () => {
      handlers.current.delete(h);
    };
  }, []);
  const value = useMemo(() => ({ connected, send, subscribe }), [connected, send, subscribe]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLive outside LiveProvider");
  return c;
}

export function useLiveEvent(handler: Handler, deps: unknown[] = []) {
  const { subscribe } = useLive();
  const ref = useRef(handler);
  ref.current = handler;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => subscribe((m) => ref.current(m)), [subscribe, ...deps]);
}
