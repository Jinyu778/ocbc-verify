import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    strictPort: true,
    // GitHub Codespaces: the app is opened at https://<name>-5173.app.github.dev and calls its own
    // origin; these forward the API and the live WebSocket to the backend inside the codespace.
    allowedHosts: [".app.github.dev"],
    proxy: { "/api": { target: "http://127.0.0.1:8000", ws: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/polyfills.ts", "./src/test/setup.ts"],
    css: false,
  },
});
