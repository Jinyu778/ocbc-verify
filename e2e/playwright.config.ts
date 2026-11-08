import { defineConfig, devices } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const py = join(root, "backend", ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");

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
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: [
    {
      command: `"${py}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
      cwd: join(root, "backend"),
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: true,
      env: { DATABASE_URL: "sqlite:///./e2e.db", DEMO_MODE: "true", JWT_SECRET: "e2e-secret", TRUSTED_TIMEOUT_SECONDS: "120" },
      timeout: 60_000,
    },
    { command: "npm run dev -w customer-app", cwd: root, url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
    { command: "npm run dev -w staff-console", cwd: root, url: "http://localhost:5174", reuseExistingServer: true, timeout: 60_000 },
  ],
});
