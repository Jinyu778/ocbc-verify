import { useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Matches the CSS token --ease-out (cubic-bezier(0.23, 1, 0.32, 1)) closely. */
export const EASE_OUT = "expo.out";

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Staggered entrance for the children of a list or card group. Transform and opacity only.
 * - Content stays visible by default: GSAP only animates FROM a hidden state at runtime.
 * - `scroll: true` uses ScrollTrigger.batch so items below the fold enter as they scroll in
 *   (only used on screens that actually scroll).
 * - Reduced motion: no animation at all.
 */
export function useStaggerIn(
  ref: RefObject<HTMLElement>,
  selector: string,
  deps: unknown[] = [],
  opts: { scroll?: boolean; y?: number } = {},
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(selector, root);
      if (!items.length) return;
      const y = opts.y ?? 14;
      if (opts.scroll) {
        // Nothing is hidden up front: rows stay visible by default (and in print, full-page
        // captures and failed scripts). Each batch plays its entrance only as it enters view,
        // starting from just below the bottom edge so the brief "from" state is off-screen.
        ScrollTrigger.batch(items, {
          start: "top 98%",
          once: true,
          onEnter: (batch) =>
            gsap.from(batch, { opacity: 0, y, duration: 0.45, ease: EASE_OUT, stagger: { each: 0.05, amount: 0.3 }, clearProps: "transform,opacity" }),
        });
      } else {
        gsap.from(items, { opacity: 0, y, duration: 0.45, ease: EASE_OUT, stagger: { each: 0.05, amount: 0.3 }, clearProps: "transform,opacity" });
      }
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export { gsap, ScrollTrigger };
