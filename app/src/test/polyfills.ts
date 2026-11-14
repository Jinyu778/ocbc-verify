// Loaded before any app module (GSAP's ScrollTrigger reads window.matchMedia on import).
// Component tests run as if the user prefers reduced motion, so nothing waits on animation.
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("prefers-reduced-motion: reduce"),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
export {};
