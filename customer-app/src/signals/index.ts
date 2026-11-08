import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

/** What we send to the server with each transfer. Call STATE only – never audio, numbers, contacts or chat content. */
export interface SignalSnapshot {
  on_call: boolean;
  recent_call: boolean;
  chatting: boolean;
  screen_sharing: boolean;
  available: boolean;
  source: "native" | "simulated" | "none";
}
export type PermissionStatus = "granted" | "denied" | "prompt" | "unavailable";

export interface SignalProvider {
  kind: "native" | "simulated";
  permission(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  snapshot(): Promise<SignalSnapshot>;
  subscribe(cb: (s: SignalSnapshot) => void): () => void;
}

const RECENT_MS = 10 * 60 * 1000;
const EMPTY: SignalSnapshot = { on_call: false, recent_call: false, chatting: false, screen_sharing: false, available: true, source: "simulated" };

// ------------------------------------------------------------------------- simulated (web / demo)
export interface SimState {
  on_call: boolean;
  recent_call: boolean;
  chatting: boolean;
  screen_sharing: boolean;
  unavailable: boolean;
}
const SIM_KEY = "sb.demo.signals";
const SIM_EVENT = "sb-signals";
export function readSim(): SimState {
  try {
    return { on_call: false, recent_call: false, chatting: false, screen_sharing: false, unavailable: false, ...JSON.parse(localStorage.getItem(SIM_KEY) || "{}") };
  } catch {
    return { on_call: false, recent_call: false, chatting: false, screen_sharing: false, unavailable: false };
  }
}
export function writeSim(s: Partial<SimState>) {
  const next = { ...readSim(), ...s };
  try {
    localStorage.setItem(SIM_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SIM_EVENT));
}
const simToSnapshot = (s: SimState): SignalSnapshot =>
  s.unavailable
    ? { ...EMPTY, available: false, source: "none" }
    : { on_call: s.on_call, recent_call: s.recent_call, chatting: s.chatting, screen_sharing: s.screen_sharing, available: true, source: "simulated" };

export class SimulatedSignalProvider implements SignalProvider {
  kind = "simulated" as const;
  async permission(): Promise<PermissionStatus> {
    return readSim().unavailable ? "denied" : "granted";
  }
  async requestPermission() {
    return this.permission();
  }
  async snapshot() {
    return simToSnapshot(readSim());
  }
  subscribe(cb: (s: SignalSnapshot) => void) {
    const h = () => cb(simToSnapshot(readSim()));
    window.addEventListener(SIM_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(SIM_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }
}

// ------------------------------------------------------------------------- native (Android)
export class NativeSignalProvider implements SignalProvider {
  kind = "native" as const;
  private async plugin() {
    return (await import("safebank-call-state")).CallState;
  }
  async permission(): Promise<PermissionStatus> {
    try {
      const r = await (await this.plugin()).checkPermissions();
      return r.phone === "granted" ? "granted" : r.phone === "denied" ? "denied" : "prompt";
    } catch {
      return "unavailable";
    }
  }
  async requestPermission(): Promise<PermissionStatus> {
    try {
      const r = await (await this.plugin()).requestPermissions();
      return r.phone === "granted" ? "granted" : "denied";
    } catch {
      return "unavailable";
    }
  }
  async snapshot(): Promise<SignalSnapshot> {
    try {
      const s = await (await this.plugin()).getCallState();
      const recent = !s.onCall && s.lastCallEndedAt != null && Date.now() - s.lastCallEndedAt < RECENT_MS;
      // Chat apps can't be read (and we wouldn't): "chatting" comes from safety question (d).
      return { on_call: s.onCall, recent_call: recent, chatting: false, screen_sharing: !!s.screenShared, available: true, source: "native" };
    } catch {
      return { ...EMPTY, available: false, source: "none" };
    }
  }
  subscribe(cb: (s: SignalSnapshot) => void) {
    let handle: { remove: () => void } | null = null;
    let stopped = false;
    this.plugin()
      .then((p) => p.addListener("callStateChange", () => this.snapshot().then(cb)))
      .then((h) => {
        if (stopped) h.remove();
        else handle = h;
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      handle?.remove();
    };
  }
}

export const signalProvider: SignalProvider = Capacitor.isNativePlatform() ? new NativeSignalProvider() : new SimulatedSignalProvider();

export function useSignals(): SignalSnapshot {
  const [s, setS] = useState<SignalSnapshot>(EMPTY);
  useEffect(() => {
    let alive = true;
    signalProvider.snapshot().then((x) => alive && setS(x));
    const un = signalProvider.subscribe((x) => alive && setS(x));
    const t = setInterval(() => signalProvider.snapshot().then((x) => alive && setS(x)), 15000);
    return () => {
      alive = false;
      un();
      clearInterval(t);
    };
  }, []);
  return s;
}
