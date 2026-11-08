import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BadgeCheck, MessageSquare, Mic, MicOff, PhoneIncoming, PhoneOff, Send } from "lucide-react";
import { Banner, Button, Card, Skeleton, api, formatDuration, useCallEngine, useNow } from "@safebank/ui";
import { Screen } from "../components/Screen";
import type { CallInfo } from "../types";

export function CallScreen() {
  const { id } = useParams();
  const cid = Number(id);
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["call", cid], queryFn: () => api<CallInfo>(`/api/calls/${cid}`), refetchInterval: 4000 });
  const c = q.data;
  const engine = useCallEngine({ callId: cid, active: c?.status === "active", offerer: false, initialMode: c?.mode });
  const [text, setText] = useState("");

  if (q.isLoading) return <Screen><Skeleton className="h-48" label={t("common.loading")} /></Screen>;
  if (!c) return <Screen title={t("common.offlineTitle")} back="/"><p>{t("common.offlineBody")}</p></Screen>;

  const end = async () => {
    setBusy(true);
    try {
      await api(`/api/calls/${cid}/end`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["call", cid] });
    } finally {
      setBusy(false);
    }
  };
  const accept = async () => {
    setBusy(true);
    try {
      await api(`/api/calls/${cid}/accept`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["call", cid] });
    } finally {
      setBusy(false);
    }
  };
  const backTo = c.transfer_id ? `/pay/${c.transfer_id}` : "/";
  const elapsed = Math.max(0, Math.floor((now - new Date(c.started_at).getTime()) / 1000));
  const textMode = engine.mode === "text" || c.mode === "text";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (engine.sendChat(text)) setText("");
  };

  return (
    <Screen title={t("call.title")} back={backTo}>
      <section className="rounded-card bg-primary p-6 text-center text-on-primary shadow-card dark:border dark:border-border">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold">
          <BadgeCheck aria-hidden className="h-5 w-5 text-accent" />
          {t("call.verified")}
        </p>
        <p className="mt-3 text-2xl font-bold">{c.staff?.display_name ?? "SafeBank"}</p>
        <p className="tabular mt-1 text-lg opacity-90" aria-live="off">
          {c.status === "ended" ? t("call.ended") : formatDuration(elapsed)}
        </p>
        {c.status === "active" && !textMode && (
          <p className="mt-1 opacity-90" role="status">
            {engine.media === "connected" ? t("call.connected") : t("call.connectingAudio")}
          </p>
        )}
        <audio ref={engine.audioEl} autoPlay className="hidden" />
      </section>

      {c.status === "ringing" && c.initiated_by === "customer" && (
        <Banner tone="info" icon={PhoneIncoming}>{t("call.waitingStaff")}</Banner>
      )}
      {c.status === "ringing" && c.initiated_by === "staff" && (
        <Card className="space-y-3 text-center">
          <p className="text-lg font-semibold">{t("call.incoming")}</p>
          <p>{t("call.incomingBody")}</p>
          <Button size="lg" block icon={PhoneIncoming} onClick={accept} loading={busy}>
            {t("call.answer")}
          </Button>
        </Card>
      )}

      {c.status === "active" && textMode && (
        <Card className="space-y-3">
          <Banner tone="info" icon={MessageSquare}>{t("call.fallback")}</Banner>
          <ol aria-live="polite" className="max-h-72 space-y-2 overflow-auto">
            {engine.chat.length === 0 && <li className="text-sm text-muted-foreground">{t("call.noMessages")}</li>}
            {engine.chat.map((m, i) => (
              <li key={i} className={m.from === "me" ? "ml-8 rounded-btn bg-info-soft p-2" : "mr-8 rounded-btn bg-muted p-2"}>
                <span className="sr-only">{m.from === "me" ? "You:" : `${c.staff?.display_name ?? "SafeBank"}:`}</span>
                {m.text}
              </li>
            ))}
          </ol>
          <form onSubmit={submit} className="flex gap-2">
            <label htmlFor="chat-input" className="sr-only">{t("call.typeMessage")}</label>
            <input
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("call.typeMessage")}
              className="min-h-btn flex-1 rounded-btn border-2 border-border-strong bg-card px-3 text-foreground"
            />
            <Button type="submit" icon={Send}>{t("call.send")}</Button>
          </form>
        </Card>
      )}

      {c.status === "ended" && <Banner tone="success">{t("call.endedBody")}</Banner>}

      <div className="flex flex-col gap-3">
        {c.status === "active" && !textMode && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" icon={engine.muted ? MicOff : Mic} aria-pressed={engine.muted} onClick={engine.toggleMute}>
              {engine.muted ? t("call.unmute") : t("call.mute")}
            </Button>
            <Button variant="outline" icon={MessageSquare} onClick={engine.switchToText}>
              {t("call.useText")}
            </Button>
          </div>
        )}
        {c.status !== "ended" ? (
          <Button variant="danger" size="lg" block icon={PhoneOff} onClick={end} loading={busy}>
            {t("call.end")}
          </Button>
        ) : (
          <Button size="lg" block onClick={() => nav(backTo)}>
            {t("common.back")}
          </Button>
        )}
      </div>
    </Screen>
  );
}
