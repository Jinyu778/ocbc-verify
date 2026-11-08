import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

/** What we send to the server with each transfer. Call STATE only – never audio, numbers, contacts or chat content. */
export interface SignalSnapshot {
  on_call: boolean;
  recent_call: boolean;
  chatting: boolean;
  screen_sharing: boolean;
  available: boolean;
  source: "native" | "customer_answer" | "not_asked" | "none";
}
export type PermissionStatus = "granted" | "denied" | "prompt" | "unavailable";

/** The customer's answer to "Are you on a call or chatting about this payment right now?" */
export type LiveAnswer = "call" | "chatting" | "no";

export interface SignalProvider {
  kind: "native" | "browser";
  permission(): Promise<PermissionStatus>;
  requestPermission(): Promise<PermissionStatus>;
  /** What the device itself can tell us right now. */
  snapshot(): Promise<SignalSnapshot>;
  subscribe(cb: (s: SignalSnapshot) => void): () => void;
}

const RECENT_MS = 10 * 60 * 1000;
const NONE: SignalSnapshot = { on_call: false, recent_call: false, chatting: false, screen_sharing: false, available: true, source: "not_asked" };

// ------------------------------------------------------------------------- browser
/**
 * A browser cannot see phone calls, so it reports nothing by itself. For a NEW payee the app asks
 * the customer one question instead (see `needsLiveQuestion`), and their answer becomes the signal.
 */
export class BrowserSignalProvider implements SignalProvider {
  kind = "browser" as const;
  async permission(): Promise<PermissionStatus> {
    return "unavailable";
  }
  async requestPermission(): Promise<PermissionStatus> {
    return "unavailable";
  }
  async snapshot(): Promise<SignalSnapshot> {
    return NONE;
  }
  subscribe() {
    return () => undefined;
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
      // Chat apps can never be read (and we wouldn't): "chatting" comes from the customer's answer.
      return { on_call: s.onCall, recent_call: recent, chatting: false, screen_sharing: !!s.screenShared, available: true, source: "native" };
    } catch {
      // Permission denied or plugin failed: unknown, so we fall back to asking the customer.
      return { ...NONE, available: false, source: "none" };
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

export const signalProvider: SignalProvider = Capacitor.isNativePlatform() ? new NativeSignalProvider() : new BrowserSignalProvider();

/** Ask the live-call question when the device can't tell us (browser, or permission denied) and the payee is new. */
export function needsLiveQuestion(device: SignalSnapshot, payeeIsNew: boolean): boolean {
  return payeeIsNew && device.source !== "native";
}

/** Combine what the device saw with what the customer told us. */
export function mergeSignals(device: SignalSnapshot, answer: LiveAnswer | null): SignalSnapshot {
  if (answer === null) return device;
  return {
    ...device,
    on_call: device.on_call || answer === "call",
    chatting: device.chatting || answer === "chatting",
    source: device.source === "native" ? "native" : "customer_answer",
  };
}

export function useSignals(): SignalSnapshot {
  const [s, setS] = useState<SignalSnapshot>(NONE);
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
