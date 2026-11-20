/** Shared Tailwind preset: every colour comes from a CSS variable in tokens.css. */
const v = (name) => `var(--${name})`;
module.exports = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: v("primary"),
        "primary-2": v("primary-2"),
        "on-primary": v("on-primary"),
        "on-primary-muted": v("on-primary-muted"),
        secondary: v("secondary"),
        "on-secondary": v("on-secondary"),
        accent: v("accent"),
        "accent-hover": v("accent-hover"),
        "accent-ink": v("accent-ink"),
        "accent-soft": v("accent-soft"),
        "info-strong": v("info-strong"),
        "on-info-strong": v("on-info-strong"),
        "on-accent": v("on-accent"),
        background: v("background"),
        card: v("card"),
        foreground: v("foreground"),
        muted: v("muted"),
        "muted-foreground": v("muted-foreground"),
        border: v("border"),
        "border-strong": v("border-strong"),
        danger: v("danger"),
        "danger-soft": v("danger-soft"),
        "danger-strong": v("danger-strong"),
        "on-danger-strong": v("on-danger-strong"),
        warning: v("warning"),
        "warning-soft": v("warning-soft"),
        "warning-strong": v("warning-strong"),
        "on-warning-strong": v("on-warning-strong"),
        success: v("success"),
        "success-soft": v("success-soft"),
        "success-strong": v("success-strong"),
        "on-success-strong": v("on-success-strong"),
        "info-soft": v("info-soft"),
        ring: v("ring"),
        "dark-fill": v("dark-fill"),
        "brand-red": v("brand-red"),
        "brand-deep": v("brand-deep"),
        "on-brand-deep-muted": v("on-brand-deep-muted"),
        "ink-950": v("ink-950"),
        "accent-pressed": v("accent-pressed"),
        "nav-glass": v("nav-glass"),
        scrim: v("scrim"),
        "tint-on-dark": v("tint-on-dark"),
        "tint-on-dark-strong": v("tint-on-dark-strong"),
      },
      fontFamily: { sans: v("font-sans"), display: v("font-display") },
      /* One type scale, used everywhere. rem, so Easy Mode and text size scale it. */
      fontSize: {
        /* Readability scale: nothing the user must read is under 14 px. */
        xs: ["0.875rem", { lineHeight: "1.4" }],   /* 14: meta, chips, staff table cells */
        sm: ["1rem", { lineHeight: "1.4" }],       /* 16: secondary lines, helper text */
        base: ["1.0625rem", { lineHeight: "1.5" }], /* 17: body */
        lg: ["1.125rem", { lineHeight: "1.3" }],   /* 18: primary lines, button labels */
        xl: ["1.25rem", { lineHeight: "1.25" }],   /* 20: section headings */
        "2xl": ["1.5rem", { lineHeight: "1.25" }],
        "3xl": ["2rem", { lineHeight: "1.15" }],    /* display 32 */
        "4xl": ["2.75rem", { lineHeight: "1.05" }],  /* display 44 */
        "5xl": ["3.75rem", { lineHeight: "1" }],     /* display 60, login and Home hero only */
      },
      borderRadius: { tile: "20px", card: "16px", btn: "14px", field: "12px", pill: "999px" },
      boxShadow: { card: v("shadow"), lift: v("shadow-lift"), hover: v("shadow-hover") },
      backgroundImage: { hero: v("hero-gradient"), glow: v("hero-glow") },
      minHeight: { btn: v("btn-h"), touch: "44px" },
      minWidth: { touch: "44px" },
      spacing: { gap: v("gap") },
      transitionTimingFunction: { out: v("ease-out"), "in-out": v("ease-in-out") },
      transitionDuration: { press: "120ms", fast: "120ms", base: "220ms", slow: "360ms" },
    },
  },
};
