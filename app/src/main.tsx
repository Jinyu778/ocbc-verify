import "@/design/tokens.css";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getSession, initI18n, savedLanguage, setLanguage, setSessionNamespace } from "@/design";
import { App } from "./App";

setSessionNamespace("app");
const lang = savedLanguage() ?? getSession()?.user.preferred_language ?? "en";
initI18n(lang);
setLanguage(lang);

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5000 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
