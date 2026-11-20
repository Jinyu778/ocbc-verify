import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./components";
import { EASE_OUT, gsap, prefersReducedMotion } from "./motion";

/**
 * The signature moment: a large "Checking…" that resolves into the verdict.
 *   verified = green field + seal   (verify-call genuine: the ONLY thing the app can actually prove)
 *   risk     = red field            (verify-call "not calling", checker "likely scam")
 *   caution  = amber field          (checker "be careful" / "not sure")
 *   paused   = navy stage, amber hand seal (payment pause; calm, never alarming)
 *   neutral  = lifted navy, white seal (checker "no known signs": not alarming, but never a green tick,
 *              because a message without known signs is still unverified)
 *
 * The final content is always in the DOM and visible by default. GSAP only animates it in,
 * so a failed script never hides the verdict. Reduced motion: no checking phase, no movement.
 */
export type VerdictTone = "verified" | "risk" | "caution" | "paused" | "neutral";

const FIELD: Record<VerdictTone, { field: string; seal: string; text: string }> = {
  verified: { field: "bg-success-strong", seal: "bg-primary text-success-strong", text: "text-on-success-strong" },
  risk: { field: "bg-danger-strong", seal: "bg-card text-danger", text: "text-on-danger-strong" },
  caution: { field: "bg-warning-strong", seal: "bg-primary text-warning-strong", text: "text-on-warning-strong" },
  paused: { field: "bg-primary dark:bg-primary-2", seal: "bg-warning-strong text-on-warning-strong", text: "text-on-primary" },
  neutral: { field: "bg-primary-2", seal: "bg-card text-secondary", text: "text-on-primary" },
};

export function VerdictStage({
  tone,
  icon: Icon,
  title,
  checkingLabel,
  children,
  aside,
  headingLevel = 2,
  className,
}: {
  tone: VerdictTone;
  icon: LucideIcon;
  title: ReactNode;
  checkingLabel: string;
  children?: ReactNode;
  /** Small chips shown at the top of the stage (e.g. "On a call"). */
  aside?: ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const f = FIELD[tone];
  const Heading = headingLevel === 1 ? "h1" : "h2";

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      el.setAttribute("data-stage-running", "");
      const tl = gsap.timeline({
        defaults: { ease: EASE_OUT },
        // Once settled, the checking layer leaves layout entirely (never read, never measured).
        onComplete: () => {
          gsap.set("[data-stage-checking]", { display: "none" });
          el.removeAttribute("data-stage-running");
        },
      });
      // 1. Checking: navy stage with a scanning ring
      tl.set("[data-stage-checking]", { autoAlpha: 1 })
        .set("[data-stage-field]", { scaleX: 0, transformOrigin: "0% 50%" })
        .from("[data-stage-ring]", { scale: 0.85, opacity: 0, duration: 0.3 })
        // 2. Resolve: field sweeps in, seal stamps, content rises
        .to("[data-stage-checking]", { autoAlpha: 0, duration: 0.18 }, 0.85)
        .to("[data-stage-field]", { scaleX: 1, duration: 0.6 }, 0.85)
        .from("[data-stage-seal]", { scale: 0.6, opacity: 0, rotate: -12, duration: 0.55 }, 1.0)
        .from("[data-stage-content] > *", { y: 18, opacity: 0, duration: 0.5, stagger: 0.06 }, 1.05);
    }, el);
    return () => {
      el.removeAttribute("data-stage-running");
      ctx.revert();
    };
  }, [tone]);

  return (
    <section
      ref={root}
      data-stage
      className={cx("relative isolate overflow-hidden rounded-card bg-primary shadow-lift", f.text, className)}
    >
      {/* colour field; sits under the content, animates with transform only */}
      <div aria-hidden data-stage-field className={cx("absolute inset-0 -z-10", f.field)} />
      {/* checking layer: hidden by default, shown only while the timeline runs */}
      <div
        aria-hidden
        data-stage-checking
        className="invisible absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-primary text-on-primary opacity-0"
      >
        <span data-stage-ring className="relative grid h-20 w-20 place-items-center sm:h-24 sm:w-24">
          <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full [animation:sb-spin_0.9s_linear_infinite]">
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--tint-on-dark-strong)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="60 160" />
          </svg>
        </span>
        <span className="px-6 text-center font-display text-3xl font-extrabold leading-tight [text-wrap:balance] sm:text-4xl">{checkingLabel}</span>
      </div>

      <div className="flex flex-col gap-4 p-6 sm:p-8">
        {aside && <div className="flex flex-wrap gap-2">{aside}</div>}
        <div className="flex items-start gap-4">
          <span data-stage-seal aria-hidden className={cx("grid h-16 w-16 shrink-0 place-items-center rounded-pill shadow-card sm:h-20 sm:w-20", f.seal)}>
            <Icon className="h-9 w-9 sm:h-11 sm:w-11" strokeWidth={2.4} />
          </span>
          <div data-stage-content className="min-w-0 flex-1 space-y-2 pt-1">
            <Heading tabIndex={-1} className="font-display text-3xl font-extrabold leading-[1.05] outline-none sm:text-4xl">
              {title}
            </Heading>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
