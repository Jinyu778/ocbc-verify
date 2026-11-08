import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LiveProvider, ToastProvider } from "@/design";
import { PrefsProvider } from "../state/prefs";
import { SessionProvider } from "../state/session";

export function mockFetch(routes: Record<string, unknown> = {}) {
  const fn = vi.fn(async (url: string) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, "");
    const hit = Object.entries(routes).find(([k]) => path.startsWith(k));
    const body = hit
      ? hit[1]
      : path.startsWith("/api/config")
        ? { save_for_later_options_minutes: [60, 360, 1440], trusted_contact_timeout_minutes: 1440, contact_change_cooling_minutes: 1440, continue_anyway_seconds: 30 }
        : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export function renderApp(ui: ReactNode, { route = "/", path = "/", seed = {} as Record<string, unknown> } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  Object.entries(seed).forEach(([k, v]) => qc.setQueryData(JSON.parse(k), v));
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <PrefsProvider>
          <SessionProvider>
            <LiveProvider>
              <ToastProvider>
                <Routes>
                  <Route path={path} element={ui} />
                </Routes>
              </ToastProvider>
            </LiveProvider>
          </SessionProvider>
        </PrefsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
