import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useLive, useLiveEvent } from "./live";

export type CallMode = "voice" | "text";
export type MediaState = "idle" | "connecting" | "connected" | "failed";
export interface ChatLine {
  from: "me" | "them";
  text: string;
  at: number;
}

/**
 * Browser-to-browser voice over WebRTC; signalling over the app WebSocket.
 * Staff side makes the offer; the customer side announces "ready" until the offer arrives.
 * Any failure (mic denied, no connection within 15 s) falls back to text chat and is logged.
 */
export function useCallEngine(opts: { callId: number | null; active: boolean; offerer: boolean; initialMode?: CallMode }) {
  const { callId, active, offerer } = opts;
  const { send } = useLive();
  const [mode, setMode] = useState<CallMode>(opts.initialMode ?? "voice");
  const [media, setMedia] = useState<MediaState>("idle");
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [muted, setMuted] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const offered = useRef(false);
  const gotOffer = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const signal = useCallback(
    (data: unknown) => callId != null && send({ type: "call.signal", call_id: callId, data }),
    [callId, send],
  );

  const teardown = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
  }, []);

  const fallBack = useCallback(
    async (reason: string, notifyServer = true) => {
      if (modeRef.current === "text") return;
      setMode("text");
      setMedia("failed");
      setFallbackReason(reason);
      teardown();
      if (notifyServer && callId != null) {
        try {
          await api(`/api/calls/${callId}/fallback`, { method: "POST", body: { reason } });
        } catch {
          /* chat still works over the socket */
        }
      }
    },
    [callId, teardown],
  );

  const makeOffer = useCallback(async () => {
    const p = pc.current;
    if (!p || offered.current) return;
    offered.current = true;
    const offer = await p.createOffer();
    await p.setLocalDescription(offer);
    signal({ sdp: p.localDescription });
  }, [signal]);

  // set up media + peer connection when the call becomes active
  useEffect(() => {
    if (!active || callId == null || mode !== "voice") return;
    let cancelled = false;
    let readyTimer: ReturnType<typeof setInterval> | undefined;
    const watchdog = setTimeout(() => {
      if (pc.current?.connectionState !== "connected") fallBack("no_connection_15s");
    }, 15000);
    (async () => {
      setMedia("connecting");
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        fallBack("webrtc_unsupported");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        fallBack("microphone_denied");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      local.current = stream;
      let iceServers: RTCIceServer[] = [];
      try {
        iceServers = (await api<{ ice_servers: RTCIceServer[] }>("/api/calls/config")).ice_servers;
      } catch {
        /* same-network calls work without STUN */
      }
      const p = new RTCPeerConnection({ iceServers });
      pc.current = p;
      stream.getTracks().forEach((t) => p.addTrack(t, stream));
      p.ontrack = (ev) => {
        if (audioEl.current) {
          audioEl.current.srcObject = ev.streams[0];
          audioEl.current.play().catch(() => undefined);
        }
      };
      p.onicecandidate = (ev) => ev.candidate && signal({ candidate: ev.candidate.toJSON() });
      p.onconnectionstatechange = () => {
        if (p.connectionState === "connected") {
          setMedia("connected");
          clearTimeout(watchdog);
        } else if (p.connectionState === "failed") fallBack("connection_failed");
      };
      if (!offerer) {
        const sayReady = () => !gotOffer.current && signal({ ready: true });
        sayReady();
        readyTimer = setInterval(sayReady, 2000);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      if (readyTimer) clearInterval(readyTimer);
    };
  }, [active, callId, mode, offerer, signal, fallBack]);

  useEffect(() => () => teardown(), [teardown]);

  useLiveEvent(
    async (m) => {
      if (m.call_id !== callId) return;
      if (m.type === "call.fallback") {
        fallBack("other_side_fell_back", false);
        return;
      }
      if (m.type === "call.chat") {
        setChat((c) => [...c, { from: "them", text: String(m.text), at: Date.now() }]);
        return;
      }
      if (m.type !== "call.signal") return;
      const data = m.data as { ready?: boolean; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      const p = pc.current;
      if (!p) return;
      try {
        if (data.ready && offerer) await makeOffer();
        else if (data.sdp?.type === "offer" && !offerer) {
          gotOffer.current = true;
          await p.setRemoteDescription(data.sdp);
          for (const c of pendingIce.current.splice(0)) await p.addIceCandidate(c);
          const answer = await p.createAnswer();
          await p.setLocalDescription(answer);
          signal({ sdp: p.localDescription });
        } else if (data.sdp?.type === "answer" && offerer) {
          await p.setRemoteDescription(data.sdp);
          for (const c of pendingIce.current.splice(0)) await p.addIceCandidate(c);
        } else if (data.candidate) {
          if (p.remoteDescription) await p.addIceCandidate(data.candidate);
          else pendingIce.current.push(data.candidate);
        }
      } catch {
        fallBack("signalling_error");
      }
    },
    [callId, offerer, makeOffer, signal, fallBack],
  );

  const sendChat = (text: string) => {
    const t = text.trim();
    if (!t || callId == null) return false;
    const ok = send({ type: "call.chat", call_id: callId, text: t });
    if (ok) setChat((c) => [...c, { from: "me", text: t, at: Date.now() }]);
    return ok;
  };

  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  return { mode, media, chat, sendChat, muted, toggleMute, audioEl, fallbackReason, switchToText: () => fallBack("user_chose_text") };
}
