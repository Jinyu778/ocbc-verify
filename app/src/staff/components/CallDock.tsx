import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, MessageSquare, Mic, MicOff, PhoneIncoming, PhoneOff, Send } from "lucide-react";
import { Banner, Button, api, formatDuration, getSession, useCallEngine, useNow } from "@/design";
import { claimCall, isClaimed, onClaimsChange } from "../lib/claims";
import type { CallInfo } from "../types";

/** Bottom-right dock: ringing customer calls to answer, and the live call (WebRTC voice or text fallback). */
export function CallDock() {
  const me = getSession()?.user.id;
  const [, force] = useState(0);
  useEffect(() => onClaimsChange(() => force((x) => x + 1)), []);
  const q = useQuery({ queryKey: ["calls"], queryFn: () => api<{ calls: CallInfo[] }>("/api/calls/active"), refetchInterval: 5000 });
  const calls = q.data?.calls ?? [];
  const mine = calls.find((c) => c.staff?.id === me && c.status !== "ended");
  const ringing = calls.filter((c) => c.status === "ringing" && c.initiated_by === "customer" && !c.staff);
  if (!mine && !ringing.length) return null;
  return (
    <div className="fixed bottom-4 left-4 z-40 w-[min(24rem,calc(100vw-2rem))] space-y-3 md:left-64">
      {mine && isClaimed(mine.id) ? <LiveCall call={mine} /> : null}
      {mine && !isClaimed(mine.id) ? (
        <section aria-label="Call in another window" className="rounded-card border border-border bg-card p-4">
          <p className="font-semibold">Your call with {mine.customer.display_name} is open in another window.</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => claimCall(mine.id)}>Take over the call here</Button>
        </section>
      ) : null}
      {!mine && ringing.map((c) => <Ringing key={c.id} call={c} />)}
    </div>
  );
}

function Ringing({ call }: { call: CallInfo }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <section aria-label="Incoming call" className="sb-fade-up rounded-card border border-accent bg-card p-4 shadow-lift" role="alert">
      <p className="flex items-center gap-2 font-bold">
        <PhoneIncoming aria-hidden className="h-5 w-5 text-accent" /> Verification call: {call.customer.display_name}
      </p>
      <p className="text-sm text-muted-foreground">{call.transfer_id ? `About case SB-${String(call.transfer_id).padStart(6, "0")}` : "General help call"}</p>
      <Button
        className="mt-3"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            claimCall(call.id);
            await api(`/api/calls/${call.id}/accept`, { method: "POST" });
            qc.invalidateQueries({ queryKey: ["calls"] });
            qc.invalidateQueries({ queryKey: ["cases"] });
          } finally {
            setBusy(false);
          }
        }}
      >
        Answer
      </Button>
    </section>
  );
}

function LiveCall({ call }: { call: CallInfo }) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const engine = useCallEngine({ callId: call.id, active: call.status === "active", offerer: true, initialMode: call.mode });
  const [text, setText] = useState("");
  const textMode = engine.mode === "text" || call.mode === "text";
  const elapsed = Math.max(0, Math.floor((now - new Date(call.started_at).getTime()) / 1000));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (engine.sendChat(text)) setText("");
  };
  return (
    <section aria-label="Live call" className="sb-fade-up rounded-card border border-border bg-card">
      <div className="rounded-t-card bg-primary p-4 text-on-primary">
        <p className="flex items-center gap-2 text-sm"><BadgeCheck aria-hidden className="h-4 w-4 text-accent" /> Verified OCBC Fraud Team (you)</p>
        <p className="text-lg font-bold">{call.customer.display_name}</p>
        <p className="tabular text-sm opacity-90">
          {call.status === "ringing" ? "Ringing customer…" : textMode ? "Text chat" : engine.media === "connected" ? `Voice connected · ${formatDuration(elapsed)}` : "Connecting audio…"}
        </p>
        <audio ref={engine.audioEl} autoPlay className="hidden" />
      </div>
      <div className="space-y-3 p-4">
        {textMode && (
          <>
            <Banner tone="info" icon={MessageSquare}>Voice failed or was declined – using text chat (logged).</Banner>
            <ol aria-live="polite" className="max-h-56 space-y-2 overflow-auto text-sm">
              {engine.chat.map((m, i) => (
                <li key={i} className={m.from === "me" ? "ml-6 rounded-btn bg-info-soft p-2" : "mr-6 rounded-btn bg-muted p-2"}>
                  <span className="sr-only">{m.from === "me" ? "You:" : "Customer:"}</span>
                  {m.text}
                </li>
              ))}
            </ol>
            <form onSubmit={submit} className="flex gap-2">
              <label htmlFor="staff-chat" className="sr-only">Message to customer</label>
              <input id="staff-chat" value={text} onChange={(e) => setText(e.target.value)} className="min-h-touch flex-1 rounded-field border border-border-strong bg-card px-2 text-foreground" />
              <Button type="submit" size="sm" icon={Send}>Send</Button>
            </form>
          </>
        )}
        <div className="flex gap-2">
          {!textMode && call.status === "active" && (
            <>
              <Button size="sm" variant="outline" icon={engine.muted ? MicOff : Mic} aria-pressed={engine.muted} onClick={engine.toggleMute}>
                {engine.muted ? "Unmute" : "Mute"}
              </Button>
              <Button size="sm" variant="outline" icon={MessageSquare} onClick={engine.switchToText}>Text</Button>
            </>
          )}
          <Button
            size="sm"
            variant="danger"
            icon={PhoneOff}
            className="ml-auto"
            onClick={async () => {
              await api(`/api/calls/${call.id}/end`, { method: "POST" });
              qc.invalidateQueries({ queryKey: ["calls"] });
            }}
          >
            End
          </Button>
        </div>
      </div>
    </section>
  );
}
