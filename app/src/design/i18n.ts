import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ms from "./locales/ms.json";
import ta from "./locales/ta.json";
import zh from "./locales/zh.json";

export const LANGUAGES = [
  { code: "en", label: "English", speech: "en-SG" },
  { code: "zh", label: "中文", speech: "zh-CN" },
  { code: "ms", label: "Bahasa Melayu", speech: "ms-MY" },
  { code: "ta", label: "தமிழ்", speech: "ta-IN" },
] as const;
export type LangCode = (typeof LANGUAGES)[number]["code"];

export function initI18n(lng: LangCode = "en") {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, zh: { translation: zh }, ms: { translation: ms }, ta: { translation: ta } },
      lng,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18n;
}

export function setLanguage(lng: LangCode) {
  i18n.changeLanguage(lng);
  if (typeof document !== "undefined") document.documentElement.lang = lng;
  try {
    localStorage.setItem("sb.lang", lng);
  } catch {
    /* ignore */
  }
}

export function savedLanguage(): LangCode | null {
  try {
    const v = localStorage.getItem("sb.lang");
    return LANGUAGES.some((l) => l.code === v) ? (v as LangCode) : null;
  } catch {
    return null;
  }
}

export { i18n };
