/** "S$8,000" for whole dollars, "S$8,000.50" otherwise. Always full numbers, never "8k". */
export function formatSGD(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "S$0";
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) return "S$0";
  const whole = Math.abs(n % 1) < 0.005;
  return `S$${n.toLocaleString("en-SG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function secondsLeft(until: string | Date | null | undefined, now = Date.now()): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** "1 minute", "6 hours"… in the user's language (keys under `duration.*`). */
export function formatMinutes(t: (k: string, o?: Record<string, unknown>) => string, minutes: number): string {
  return minutes % 60 === 0 ? t("duration.hours", { count: minutes / 60 }) : t("duration.minutes", { count: minutes });
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}
