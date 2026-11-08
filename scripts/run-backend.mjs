// Cross-platform helper: runs the backend from its virtualenv.
//   node scripts/run-backend.mjs          -> uvicorn dev server on :8000
//   node scripts/run-backend.mjs test     -> pytest
//   node scripts/run-backend.mjs reset    -> wipe + reseed database (python -m app.seed --reset)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const win = process.platform === "win32";
const py = join(backend, ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
if (!existsSync(py)) {
  console.error("Backend virtualenv not found. Run:\n  cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt");
  process.exit(1);
}
const mode = process.argv[2] ?? "serve";
const args = {
  serve: ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
  test: ["-m", "pytest", "-q"],
  reset: ["-m", "app.seed", "--reset"],
}[mode];
const child = spawn(py, args, { cwd: backend, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
