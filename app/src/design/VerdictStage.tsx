import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./components";

/**
 * The verdict card: the product's judgement in one place, readable from across a room.
 *   verified = green tint + seal   (verify-call genuine, the ONLY thing the app can actually prove)
 *   risk     = risk-red tint        (verify-call "not calling", checker "likely scam")
 *   caution  = amber tint           (checker "be careful" / "not sure")
 *   paused   = neutral white card   (payment pause: calm, never alarming, never red)
 *   neutral  = grey card + question seal (checker "no known signs": not alarming, but never a green tick,
 *              because a message without known signs is still unverified)
 *
 * Always icon + word + colour. It appears once with a 0.98 scale-in; nothing waits for it, so every
 * action below it is usable immediately. `checkingLabel` is kept for callers and screen readers only.
 */
export type VerdictTone = "verified" | "risk" | "caution" | "paused" | "neutral";

const FIELD: Record<VerdictTone, { card: string; seal: string; heading: string }> = {
  verified: { card: "bg-success-soft", seal: "bg-success-strong text-on-success-strong", heading: "text-success" },
  risk: { card: "bg-danger-soft", seal: "bg-danger-strong text-on-danger-strong", heading: "text-danger" },
  caution: { card: "bg-warning-soft", seal: "bg-warning-strong text-on-warning-strong", heading: "text-warning" },
  paused: { card: "bg-card border border-border", seal: "bg-muted text-foreground", heading: "text-foreground" },
  neutral: { card: "bg-muted", seal: "bg-card text-foreground", heading: "text-foreground" },
};

export function VerdictStage({
  tone,
  icon: Icon,
  title,
  children,
  aside,
  headingLevel = 2,
  className,
}: {
  tone: VerdictTone;
  icon: LucideIcon;
  title: ReactNode;
  checkingLabel?: string;
  children?: ReactNode;
  /** Small chips shown at the top of the card (e.g. "On a call"). */
  aside?: ReactNode;
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const f = FIELD[tone];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section data-stage data-tone={tone} className={cx("sb-scale-in rounded-tile p-6 text-foreground sm:p-8", f.card, className)}>
      {aside && <div className="mb-4 flex flex-wrap gap-2">{aside}</div>}
      <div className="flex items-start gap-4">
        <span data-stage-seal aria-hidden className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-card sm:h-16 sm:w-16", f.seal)}>
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} />
        </span>
        <div data-stage-content className="min-w-0 flex-1 space-y-2">
          <Heading tabIndex={-1} style={{ ["--display-size" as string]: "2rem" }} className={cx("sb-display text-3xl leading-[1.1] outline-none", f.heading)}>
            {title}
          </Heading>
          {children}
        </div>
      </div>
    </section>
  );
}
