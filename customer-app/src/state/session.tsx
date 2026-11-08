import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getConfig, getSession, login as apiLogin, logout as apiLogout, onSessionChange, setLanguage, type AppConfig, type User } from "@safebank/ui";
import { usePrefs } from "./prefs";

interface SessionCtx {
  user: User | null;
  config: AppConfig | undefined;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}
const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getSession()?.user ?? null);
  const { update } = usePrefs();
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: getConfig, staleTime: Infinity, retry: 1 });
  useEffect(() => onSessionChange((s) => setUser(s?.user ?? null)), []);

  const login = async (username: string, password: string) => {
    const u = await apiLogin(username, password);
    setLanguage(u.preferred_language);
    update({ easy: u.easy_mode });
    return u;
  };
  const logout = () => {
    apiLogout();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  };
  return <Ctx.Provider value={{ user, config, login, logout }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession outside provider");
  return c;
}

export const savePrefsToServer = (body: { preferred_language?: string; easy_mode?: boolean }) =>
  api("/api/me/preferences", { method: "PATCH", body }).catch(() => undefined);
