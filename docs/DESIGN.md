# OCBC Verify – design system

Source of truth for the look of the app. Tokens live in `app/src/design/tokens.css` (Tailwind reads them through
`app/src/design/tailwind-preset.cjs`; components never use raw hex). `npm run check:contrast` tests every pair below,
and `npm run build -w app` fails if one drops under WCAG AA.

**Not an OCBC product.** Colours and type are approximations of OCBC's public identity: OCBC says its brand "has
always been defined by the colour red" and uses Geomanist (ocbc.com/group/about-us/our-brand.page). OCBC publishes
no hex values, so ours are chosen to feel right and pass contrast. No OCBC logo, sailing-ship mark, wordmark or
Geomanist files are drawn or bundled in code. The header loads the official OCBC logo from
`app/public/brand/ocbc-logo.svg` only when the team supplies it (with OCBC's permission), and otherwise shows a plain
authored mark. The on-screen disclaimer strip was removed at the team's request (20 Nov 2026).

## 1. Audit of the previous look (Nov 2026) and why it was replaced

| What it was | Why it read as generic / AI-made |
|---|---|
| Navy shell (`#0a1f44`) with vivid orange actions | The stock fintech-template palette; nothing about it said "Singapore bank" or OCBC |
| Pill-shaped everything (buttons, chips, nav, header controls) | The default "friendly SaaS" shape; one shape everywhere flattens hierarchy |
| Dark navy header on every customer screen | Heavy and app-store generic; OCBC's own surfaces are white with red accents |
| Home: two full-width stacked CTAs (orange Pay, navy Verify) of equal weight, then chips, then a card link | No primary moment; a vertical list of buttons, not a home |
| Pause and verdict screens: a dark navy "stage" with a 1-second scanning-ring "Checking…" animation | Theatrical, and it held the safety actions back until the animation finished |
| Checker verdict: a giant 100% number under the verdict | The hero-metric template, and it overclaimed certainty |
| Staff console: six identical stat cards | The dashboard-card-grid template |
| Bricolage Grotesque display face at extra-bold | Loud and quirky for money and safety decisions |

## 2. Direction

A Singapore retail bank in OCBC-style red: white and light-grey surfaces, charcoal ink, **one** confident red for
action, a wine-red gradient for the single hero surface. Expressive where people form a first impression
(**Login, Home hero**), calm and exact where money or safety decisions are made (**Pay, questions, Pause, checker,
staff console**).

## 3. Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `--brand-red` | `#ED1C24` | – | Large graphics only (4.4:1 on white, never text) |
| `--accent` (action) | `#D0121A` | `#E02027` | The one primary button per screen, active nav, red icons. White text 5.6:1 / 4.8:1 |
| `--accent-hover` / `--accent-pressed` | `#B30F16` / `#9C0D13` | `#C81A20` / `#B3121A` | Button states |
| `--secondary` (link) | `#B3121A` | `#FF8A8A` | Underlined links, red text |
| `--brand-deep` | `#721C24` | `#5E161D` | Hero surface base |
| `--hero-gradient` | `#721C24 → #B3121A → #D0121A` (135°) | `#4A1117 → #8A1018 → #B3121A` | Home balance tile and Login panel only. Text passes against the lightest stop |
| `--primary` (charcoal shell) | `#1C1617` | `#161112` | Disclaimer strip, staff sidebar, Verify tile, toasts |
| `--background` / `--card` / `--muted` | `#F4F4F4` / `#FFFFFF` / `#EDEDED` | `#0E0E0F` / `#1A1A1C` / `#242427` | Canvas, surface, surface-2 |
| `--foreground` / `--muted-foreground` | `#1A1A1A` / `#595959` | `#F2F2F2` / `#A8A8A8` | Ink and secondary text |
| `--border` / `--border-strong` | `#DDDDDD` / `#8A8A8A` | `#2E2E32` / `#7A7A7A` | Hairlines / inputs and outlined buttons (3:1) |
| High risk | tint `#FDECEC`, text `#8A1018` | `#3A1416` / `#FFB3B3` | shield-alert icon + word |
| Check first | tint `#FFF4E0`, text `#7A4A00` | `#3A2A0E` / `#FFD28A` | triangle icon + word |
| Looks safe | tint `#E8F5EC`, text `#0B6B3A` | `#123222` / `#8FE3AE` | shield-check icon + word |

Risk colours stay visibly different from the action red, and risk is always a tinted surface + icon + word, never
colour alone and never a side stripe. Extras: one soft red glow behind the Home balance tile; the bottom nav is the
only frosted (blurred) surface.

## 4. Type

- **Sora** (variable, self-hosted via `@fontsource-variable/sora`) for headings, the balance and amounts.
  **Figtree** for body and UI. Fallbacks: Noto Sans SC, Noto Sans Tamil, system sans. Chinese and Tamil set Noto
  first through `:lang()`.
- Readability scale (Nov 2026; rem, so Easy Mode and text size scale it): meta 14 · secondary 16 · body 17 ·
  primary line 18 · section heading 20 · 24 · page heading 28 (phone) / 32, plus display 44 and 60 for the Login
  headline and the Home balance only. Nothing the user must read is under 14 px. UI weights 500 / 600 / 700 only.
- Contrast targets (enforced by `scripts/check-contrast.mjs`): primary text 15:1, secondary text 7:1
  (light `#111111` / `#444444`, dark `#FFFFFF` / `#D2D2D6`), dark-mode hairlines about 20% white.
- Content column: centred, max 640 px.
- Headings 600, sentence case, -0.02em, `text-wrap: balance`. No eyebrows, no all-caps labels.
- Amounts: `tabular-nums`, "S$8,000.00", right-aligned in tables.
- Easy Mode: 20 px body, display capped at 32 px (`.sb-display`), normal tracking, 60 px buttons.

## 5. Shape, space, depth

- Radius: **20** hero and bento tiles, verdict card, sheets · **16** cards · **14** buttons · **12** inputs and
  selects · 6-8 small chips. No pill buttons.
- 4 px grid, `--gap` 16 px (24 px in Easy Mode). Hairline 1 px borders separate content.
- Shadows only on floating things (sheets, toasts, drawer, the hero tile): offset + soft blur, never a halo.

## 6. Components (one of each)

| Component | States |
|---|---|
| Button: `primary` (solid red), `dark`, `outline`, `ghost`, `danger` | hover (desktop: 1 px lift + shadow), focus-visible (2 px ink ring, 2 px surface gap), active (scale 0.97), disabled (60% opacity), loading (spinner replaces the label in place, width unchanged) |
| Field / textarea / select | default, hover (ink border), focus-visible, error (red border + inline message with icon) |
| Banner | danger / warning / info / success tints with an icon, `role=alert` for live warnings |
| RiskChip | High risk / Check first / Looks safe, icon + word |
| VerdictCard (`VerdictStage`) | verified / risk / caution tints, `paused` = neutral white card. Scales in once from 0.98 |
| Skeleton | the only looping animation (opacity pulse) |
| Empty states | one sentence saying what to do next |

## 7. Motion

CSS only (transform and opacity, plus the View Transitions cross-fade where supported). Tokens:
`--ease-out: cubic-bezier(.22,1,.36,1)`, `--ease-in-out: cubic-bezier(.65,0,.35,1)`, 120 / 220 / 360 ms, pages 300 ms.

| Moment | Motion |
|---|---|
| Route change | forward: fade + 16 px rise; back (browser back / `nav(-1)`): slide in from the left |
| Safety questions | each question slides in from the right |
| Buttons | press 0.97 in 120 ms; desktop hover lifts 1 px; loading spinner in place; success tick draws in 360 ms |
| Home, first visit of a session | tiles rise with a 40 ms stagger; the balance counts up once over 600 ms (screen readers get the final value) |
| Bottom nav | a red bar slides to the active tab |
| Pause | the screen rises once; the "Continue anyway" ring empties smoothly. No pulsing, flashing or sirens. Every action is usable at once |
| Checker | verdict card scales in from 0.98; flagged phrases appear 60 ms apart (max 10) |
| Staff | a live new queue row fades from a tint over 1.2 s; the case drawer slides in over 240 ms |

`prefers-reduced-motion` and Easy Mode turn every entrance into a 160 ms fade and remove all movement. Nothing ever
waits for an animation.

**Deviation from the brief:** the brief suggested the `motion` (Framer Motion) library. Every effect above is a
fixed CSS animation, which runs off the main thread (smoother on mid-range phones under load) and adds no
dependency, so `motion` was not added. GSAP (already in the app) is still used only for the Pay payee-list stagger.

## 8. Anti-slop checklist (checked 20 Nov 2026)

| # | Rule | Result |
|---|---|---|
| 1 | No navy/orange, purple/pink/cyan gradients, gradient text; one red-family gradient only | Pass: navy and orange removed; `--hero-gradient` is the only gradient |
| 2 | No grid of identical icon cards | Pass: Home bento tiles differ in size, colour and content |
| 3 | No fake dashboard fluff | Pass: staff figures are one compact labelled strip; the checker no longer shows a giant percentage |
| 4 | No eyebrows or decorative numbering | Pass |
| 5 | No coloured side stripes | Pass: banners and chips use tints + icons; the nav uses a top bar indicator, not a side stripe |
| 6 | No glows beyond the one behind the balance | Pass |
| 7 | No emoji or Unicode glyphs as icons | Pass: lucide only (the disclosure "+" glyph was replaced with an icon) |
| 8 | No decorative modal | Pass: dialogs remain only for Continue anyway, Save for later choices, Help, and staff notes (all need protected focus or a choice) |
| 9 | Every component has all states; skeletons; one-sentence empty states | Pass (see section 6) |
| 10 | Browser parts themed | Pass: `::selection`, `caret-color`, `accent-color`, scrollbar colours, `color-scheme`, focus ring |
| 11 | One button shape, input style, icon set, spacing scale | Pass |
| 12 | Plain copy, no exclamation marks, no "Oops" | Pass for new copy (sample scam messages keep their scam punctuation on purpose) |
| 13 | Looks designed, not default | Login and Home carry the red gradient, Sora display type and original line art; operational screens stay quiet |

Impeccable detector (`impeccable detect`, 20 Nov 2026): 0 findings beyond "colour not yet in DESIGN.md"
advisories, which this file resolves.

## 9. Verification

- `npm run check:contrast`: all pairs pass, light and dark, including text on the hero gradient's lightest stop.
- Screenshots at 375 and 1440 px (`TOUR=1 npx playwright test tour`, see e2e/tests/tour.spec.ts), light; dark with
  `TOUR_DARK=1`, reduced motion with `TOUR_RM=1`.
- axe (`e2e/tests/a11y.spec.ts`): results are in README.md.
