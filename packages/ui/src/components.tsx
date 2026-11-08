import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, ShieldCheck, X, type LucideIcon } from "lucide-react";

const cx = (...c: (string | false | 0 | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ---------------------------------------------------------------------------------- Button
type Variant = "primary" | "navy" | "outline" | "ghost" | "danger";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
  size?: "md" | "lg" | "sm";
}
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-sm",
  navy: "bg-primary text-on-primary hover:opacity-90 dark:bg-secondary dark:text-on-secondary",
  outline: "bg-card text-foreground border-2 border-border-strong hover:bg-muted",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  danger: "bg-danger text-white hover:opacity-90 dark:text-primary",
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", icon: Icon, loading, block, size = "md", className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-btn font-semibold transition-colors duration-200 ease-out",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 select-none",
        size === "lg" ? "min-h-btn px-5 text-lg" : size === "sm" ? "min-h-touch px-3 text-sm" : "min-h-btn px-4 text-base",
        variants[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : Icon ? <Icon aria-hidden className="h-5 w-5 shrink-0" /> : null}
      <span>{children}</span>
    </button>
  );
});

// ---------------------------------------------------------------------------------- Card
export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <As className={cx("rounded-card border border-border bg-card p-5 shadow-card", className)} {...rest}>
      {children}
    </As>
  );
}

// ---------------------------------------------------------------------------------- RiskChip
export type Tier = "none" | "ask" | "pause";
const tierStyle: Record<Tier, { icon: LucideIcon; cls: string }> = {
  pause: { icon: ShieldAlert, cls: "text-danger border-danger bg-danger-soft" },
  ask: { icon: AlertTriangle, cls: "text-warning border-warning bg-warning-soft" },
  none: { icon: ShieldCheck, cls: "text-success border-success bg-success-soft" },
};
export function RiskChip({ tier, label, className }: { tier: Tier; label: string; className?: string }) {
  const { icon: Icon, cls } = tierStyle[tier];
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-sm font-semibold", cls, className)}>
      <Icon aria-hidden className="h-4 w-4" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------------- Banner
type Tone = "danger" | "warning" | "info" | "success";
const toneStyle: Record<Tone, { icon: LucideIcon; cls: string }> = {
  danger: { icon: ShieldAlert, cls: "border-danger bg-danger-soft text-foreground [&_svg]:text-danger" },
  warning: { icon: AlertTriangle, cls: "border-warning bg-warning-soft text-foreground [&_svg]:text-warning" },
  info: { icon: Info, cls: "border-secondary bg-info-soft text-foreground [&_svg]:text-secondary" },
  success: { icon: CheckCircle2, cls: "border-success bg-success-soft text-foreground [&_svg]:text-success" },
};
export function Banner({
  tone = "info",
  title,
  children,
  icon,
  alert = false,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  alert?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  const { icon: DefIcon, cls } = toneStyle[tone];
  const Icon = icon ?? DefIcon;
  return (
    <div role={alert ? "alert" : "status"} className={cx("flex gap-3 rounded-btn border-l-4 p-4", cls, className)}>
      <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------- Skeleton
export function Skeleton({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cx("sb-skeleton", className)}>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------- Field
export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | null; helper?: ReactNode; inputClassName?: string }
>(function Field({ label, error, helper, id, inputClassName, className, ...rest }, ref) {
  const autoId = useId();
  const fid = id ?? autoId;
  const errId = `${fid}-err`;
  const helpId = `${fid}-help`;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1 block font-semibold">
        {label}
      </label>
      {helper && (
        <p id={helpId} className="mb-1 text-sm text-muted-foreground">
          {helper}
        </p>
      )}
      <input
        ref={ref}
        id={fid}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(helper && helpId, error && errId) || undefined}
        className={cx(
          "block min-h-btn w-full rounded-btn border-2 bg-card px-3 text-foreground placeholder:text-muted-foreground",
          error ? "border-danger" : "border-border-strong",
          inputClassName,
        )}
        {...rest}
      />
      {error && (
        <p id={errId} className="mt-1 flex items-start gap-1 text-sm font-medium text-danger">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------------- Dialog / Sheet
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  sheet = false,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  sheet?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const prevFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("button, [href], input, textarea, select");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex='-1'])"));
        if (!f.length) return;
        const [a, b] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={cx("fixed inset-0 z-50 flex bg-black/50 p-4", sheet ? "items-end justify-center sm:items-center" : "items-center justify-center")}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("sb-fade-up max-h-[90vh] w-full max-w-md overflow-auto rounded-card bg-card p-5 text-foreground shadow-card", sheet && "rounded-b-card")}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-2 inline-flex min-h-touch min-w-touch items-center justify-center rounded-btn hover:bg-muted">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-col gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------- Toasts
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((i) => {
          const { icon: Icon } = toneStyle[i.tone];
          return (
            <div key={i.id} className="sb-fade-up pointer-events-auto flex max-w-md items-center gap-2 rounded-btn bg-primary px-4 py-3 text-on-primary shadow-card dark:bg-card dark:text-foreground">
              <Icon aria-hidden className="h-5 w-5 shrink-0" />
              <span>{i.text}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------------------------- Disclaimer
export function Disclaimer({ text = "Student proof of concept – synthetic data – not an OCBC product", className }: { text?: string; className?: string }) {
  return <p className={cx("bg-primary px-4 py-1 text-center text-sm text-on-primary", className)}>{text}</p>;
}

// ---------------------------------------------------------------------------------- SuccessTick
export function SuccessTick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" aria-hidden className={cx("sb-tick h-16 w-16 text-success", className)}>
      <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------- useNow
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
