import "@testing-library/jest-dom/vitest";
import { initI18n } from "@/design";

// Node 25+ ships its own (disabled) global localStorage that shadows jsdom's. Use an in-memory one.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  const s = new MemoryStorage();
  Object.defineProperty(globalThis, name, { value: s, configurable: true, writable: true });
  Object.defineProperty(window, name, { value: s, configurable: true, writable: true });
}

initI18n("en");

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
