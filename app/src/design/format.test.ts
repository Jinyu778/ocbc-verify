import { describe, expect, it } from "vitest";
import { formatDuration, formatSGD, secondsLeft } from "./format";

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
