import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type PhonePermission = "granted" | "denied" | "prompt" | "prompt-with-rationale";

export interface CallStateSnapshot {
  /** true while a call is ringing or in progress */
  onCall: boolean;
  /** epoch ms when the last call ended, or null if none seen since app start */
  lastCallEndedAt: number | null;
  /** true/false on Android 15+ (screen recording/sharing detection), null where unsupported */
  screenShared: boolean | null;
}

export interface CallStatePlugin {
  checkPermissions(): Promise<{ phone: PhonePermission }>;
  requestPermissions(): Promise<{ phone: PhonePermission }>;
  getCallState(): Promise<CallStateSnapshot>;
  addListener(event: "callStateChange", cb: (s: CallStateSnapshot) => void): Promise<PluginListenerHandle>;
}

export const CallState = registerPlugin<CallStatePlugin>("CallState");
