import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setLanguage, type LangCode } from "@/design";
import { useTranslation } from "react-i18next";

export type Theme = "system" | "light" | "dark";
export type TextSize = "s" | "m" | "l" | "xl";
export interface Prefs {
  theme: Theme;
  easy: boolean;
  textSize: TextSize;
  readAloud: boolean;
}
const DEFAULTS: Prefs = { theme: "system", easy: false, textSize: "m", readAloud: true };
const SCALE: Record<TextSize, number> = { s: 0.9, m: 1, l: 1.15, xl: 1.3 };
const KEY = "sb.prefs";

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  lang: LangCode;
  setLang: (l: LangCode) => void;
}
const PrefsCtx = createContext<Ctx | null>(null);

export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", !!dark);
  root.classList.toggle("easy", p.easy);
  root.style.setProperty("--text-scale", String(SCALE[p.textSize]));
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const { i18n } = useTranslation();
  useEffect(() => {
    applyPrefs(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => applyPrefs(prefs);
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, [prefs]);
  const value: Ctx = {
    prefs,
    update: (p) => setPrefs((x) => ({ ...x, ...p })),
    lang: (i18n.language as LangCode) || "en",
    setLang: (l) => setLanguage(l),
  };
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsCtx);
  if (!c) throw new Error("usePrefs outside provider");
  return c;
}
