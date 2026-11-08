// Starts the API (:8000) and the SafeBank app (:5173) together.
import { spawn } from "node:child_process";

const win = process.platform === "win32";
const npm = win ? "npm.cmd" : "npm";
const procs = [
  // node is spawned directly (no shell): its path often contains spaces ("C:\Program Files\...").
  ["api", process.execPath, ["scripts/run-backend.mjs"], false],
  ["app", npm, ["run", "dev", "-w", "app"], win],
].map(([name, cmd, args, shell]) => {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell });
  p.on("exit", (code) => code && console.error(`[${name}] exited with code ${code}`));
  const tag = `[${name}] `;
  p.stdout.on("data", (d) => process.stdout.write(d.toString().replace(/^/gm, tag)));
  p.stderr.on("data", (d) => process.stderr.write(d.toString().replace(/^/gm, tag)));
  return p;
});
const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
