import { describe, expect, it } from "vitest";
import { formatDuration, formatSGD, secondsLeft } from "./format";
import { apiBaseFor } from "./api";

describe("formatSGD", () => {
  it("writes numbers in full", () => {
    expect(formatSGD("8000.00")).toBe("S$8,000");
    expect(formatSGD("42000")).toBe("S$42,000");
    expect(formatSGD("3200.5")).toBe("S$3,200.50");
    expect(formatSGD(45)).toBe("S$45");
    expect(formatSGD(null)).toBe("S$0");
  });
});

describe("timers", () => {
  it("counts down to zero and never negative", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(secondsLeft("2026-01-01T00:00:30Z", now)).toBe(30);
    expect(secondsLeft("2025-12-31T23:59:00Z", now)).toBe(0);
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("apiBaseFor", () => {
  const loc = (hostname: string, protocol = "http:", port = "5173") => ({ hostname, protocol, port, origin: `${protocol}//${hostname}${port ? `:${port}` : ""}` });
  it("uses the configured URL first (Android app on a LAN)", () => {
    expect(apiBaseFor(loc("localhost"), "http://192.168.1.20:8000")).toBe("http://192.168.1.20:8000");
  });
  it("local development: same host, port 8000", () => {
    expect(apiBaseFor(loc("localhost"))).toBe("http://localhost:8000");
    expect(apiBaseFor(loc("192.168.1.20"))).toBe("http://192.168.1.20:8000");
  });
  it("GitHub Codespaces: calls its own origin (Vite forwards /api to the backend)", () => {
    const cs = loc("fluffy-space-abc123-5173.app.github.dev", "https:", "");
    expect(apiBaseFor(cs)).toBe("https://fluffy-space-abc123-5173.app.github.dev");
  });
  it("hosted on a standard port (Render): calls its own origin", () => {
    expect(apiBaseFor(loc("ocbc-verify.onrender.com", "https:", ""))).toBe("https://ocbc-verify.onrender.com");
    expect(apiBaseFor(loc("localhost", "http:", ""))).toBe("http://localhost:8000");
  });
  it("no browser location: localhost", () => {
    expect(apiBaseFor(undefined)).toBe("http://localhost:8000");
  });
});
