// Checks every text/background token pair in app/src/design/tokens.css, light and dark.
// Stricter than WCAG AA on purpose (readability brief, Nov 2026): primary text 15:1, secondary text 7:1,
// other text 4.5:1, UI boundaries 3:1. Exits 1 on any failure, so `npm run build` fails.
//   node scripts/check-contrast.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "app", "src", "design", "tokens.css"), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
}
const light = block(":root");
const dark = { ...light, ...block(":root.dark") };
// Gradient stops: text on the hero must pass against the LIGHTEST stop it can sit on.
const heroStops = (theme) => [...(theme === "dark" ? css.slice(css.indexOf(":root.dark {")) : css).match(/--hero-gradient:[^;]+/)[0].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground token, background token, minimum, what it is]
const TEXT = 4.5, UI = 3, PRIMARY = 15, SECONDARY = 7;
const PAIRS = [
  ["foreground", "background", PRIMARY, "primary text on canvas"],
  ["foreground", "card", PRIMARY, "primary text on surface"],
  ["muted-foreground", "card", SECONDARY, "secondary text on surface"],
  ["muted-foreground", "background", SECONDARY, "secondary text on canvas"],
  ["muted-foreground", "muted", SECONDARY, "secondary text on surface-2 / hovered rows"],
  ["foreground", "muted", TEXT, "text on surface-2 / chips"],
  ["border", "card", 1.4, "row and card hairline is visible against the surface (dark mode was too faint)"],
  ["on-accent", "accent", TEXT, "primary button"],
  ["on-accent", "accent-hover", TEXT, "primary button hover"],
  ["on-accent", "accent-pressed", TEXT, "primary button pressed"],
  ["secondary", "card", TEXT, "link on surface"],
  ["accent-ink", "card", UI, "red icon on surface"],
  ["on-primary", "primary", TEXT, "text on charcoal shell / verify tile"],
  ["on-primary-muted", "primary", TEXT, "muted text on charcoal"],
  ["on-primary", "brand-deep", TEXT, "text on wine hero"],
  ["danger", "danger-soft", TEXT, "High risk text on its tint"],
  ["danger", "card", TEXT, "risk text on surface"],
  ["warning", "warning-soft", TEXT, "Check first text on its tint"],
  ["warning", "card", TEXT, "caution text on surface"],
  ["success", "success-soft", TEXT, "Looks safe text on its tint"],
  ["success", "card", TEXT, "safe text on surface"],
  ["on-danger-strong", "danger-strong", TEXT, "risk verdict seal"],
  ["on-warning-strong", "warning-strong", TEXT, "caution verdict seal"],
  ["on-success-strong", "success-strong", TEXT, "verified seal"],
  ["foreground", "danger-soft", TEXT, "body text in a risk banner"],
  ["foreground", "warning-soft", TEXT, "body text in a caution banner"],
  ["foreground", "success-soft", TEXT, "body text in a success banner"],
  ["border-strong", "card", UI, "input and outlined-button boundary"],
  ["ring", "card", UI, "focus ring"],
  ["brand-deep", "card", TEXT, "wine text on the white Pay button", "light"], // dark mode uses ink text there
];

let failed = 0;
for (const [name, theme] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg, min, what, only] of PAIRS) {
    if (!theme[fg] || !theme[bg] || (only && only !== name)) continue;
    const r = ratio(theme[fg], theme[bg]);
    if (r < min) {
      failed++;
      console.log(`FAIL ${name.padEnd(5)} ${r.toFixed(2)}:1 < ${min}  --${fg} on --${bg}  (${what})`);
    }
  }
  // hero gradient: white and the muted hero text against every stop, including the lightest
  for (const stop of heroStops(name)) {
    for (const fg of ["on-primary", "on-brand-deep-muted"]) {
      const r = ratio(theme[fg], stop);
      if (r < TEXT) {
        failed++;
        console.log(`FAIL ${name.padEnd(5)} ${r.toFixed(2)}:1 < ${TEXT}  --${fg} on hero stop ${stop}`);
      }
    }
  }
}
console.log(failed ? `\n${failed} contrast pair(s) below the required ratio.` : `All token pairs pass (primary text 15:1, secondary 7:1, other text 4.5:1, UI 3:1; ${PAIRS.length} pairs + hero stops, light and dark).`);
process.exit(failed ? 1 : 0);
