import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, cx } from "@/design";
import { usePrefs } from "../state/prefs";

export function speechAvailable(lang: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return true; // voices load lazily; try anyway
  const code = LANGUAGES.find((l) => l.code === lang)?.speech ?? "en-SG";
  return voices.some((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
}

/** Web Speech API in the user's language. Shows a clear message if no voice exists. */
export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const { t, i18n } = useTranslation();
  const { prefs } = usePrefs();
  const [speaking, setSpeaking] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);
  if (!prefs.readAloud) return null;

  const toggle = () => {
    if (!speechAvailable(i18n.language)) {
      setUnavailable(true);
      return;
    }
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const code = LANGUAGES.find((l) => l.code === i18n.language)?.speech ?? "en-SG";
    const u = new SpeechSynthesisUtterance(text);
    u.lang = code;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => {
      setSpeaking(false);
      setUnavailable(true);
    };
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <div className={cx("inline-flex flex-col items-start", className)}>
      <button
        type="button"
        onClick={toggle}
        className="sb-press inline-flex min-h-touch items-center gap-2 rounded-pill border border-border-strong bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-muted"
        aria-pressed={speaking}
      >
        {speaking ? <Square aria-hidden className="h-4 w-4" /> : <Volume2 aria-hidden className="h-4 w-4" />}
        {speaking ? t("common.stopReading") : t("common.readAloud")}
      </button>
      {unavailable && (
        <p role="status" className="mt-1 text-sm text-muted-foreground">
          {t("common.readAloudUnavailable")}
        </p>
      )}
    </div>
  );
}
