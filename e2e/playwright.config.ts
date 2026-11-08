import { defineConfig, devices } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
export const PY = join(root, "backend", ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");

/** Short timers come ONLY from the test server's environment – the app has no shortcuts. */
export const E2E_ENV = {
  DATABASE_URL: "sqlite:///./e2e.db",
  JWT_SECRET: "e2e-secret",
  SAVE_FOR_LATER_OPTIONS_MINUTES: "1,3,5",
  TRUSTED_CONTACT_TIMEOUT_MINUTES: "1",
  CONTACT_CHANGE_COOLING_MINUTES: "1440",
};

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    viewport: { width: 375, height: 812 },
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } }],
  webServer: [
    {
      command: `"${PY}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: join(root, "backend"),
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      env: E2E_ENV,
      timeout: 60_000,
    },
    { command: "npm run dev -w app", cwd: root, url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
  ],
});
