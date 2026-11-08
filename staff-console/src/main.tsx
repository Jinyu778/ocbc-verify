import "@safebank/ui/src/tokens.css";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initI18n, setSessionNamespace } from "@safebank/ui";
import { App } from "./App";

setSessionNamespace("staff");
initI18n("en");
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 3000 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
