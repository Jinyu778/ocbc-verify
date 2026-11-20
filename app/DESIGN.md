---
name: Verity
description: A navy-shelled payment safety app where every risky moment resolves on a visible verdict stage.
colors:
  primary: "#0a1f44"
  primary-2: "#13306b"
  on-primary: "#ffffff"
  on-primary-muted: "#c9d5ee"
  secondary: "#1d3f91"
  navy-fill: "#0a1f44"
  accent: "#ff6b1a"
  accent-hover: "#ff8640"
  on-accent: "#0a1f44"
  accent-ink: "#c2410c"
  success: "#047a48"
  success-soft: "#e2f8ec"
  success-strong: "#17c06b"
  on-success-strong: "#0a1f44"
  danger: "#c81e1e"
  danger-soft: "#fdeceb"
  danger-strong: "#e11d2e"
  on-danger-strong: "#ffffff"
  warning: "#9a5200"
  warning-soft: "#fff3d9"
  warning-strong: "#ffb020"
  on-warning-strong: "#0a1f44"
  background: "#f2f5fb"
  card: "#ffffff"
  foreground: "#0a1f44"
  muted: "#e8edf6"
  muted-foreground: "#46526b"
  border: "#d5ddea"
  border-strong: "#75839c"
  info-soft: "#e8eefb"
  ring: "#1d4ed8"
  scrim: "rgb(5 14 34 / 0.55)"
  tint-on-dark: "rgb(255 255 255 / 0.12)"
  tint-on-dark-strong: "rgb(255 255 255 / 0.2)"
typography:
  display:
    fontFamily: "Bricolage Grotesque Variable, Noto Sans SC, Noto Sans Tamil, Figtree Variable, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  display-money:
    fontFamily: "Bricolage Grotesque Variable, Noto Sans SC, Noto Sans Tamil, Figtree Variable, system-ui, sans-serif"
    fontSize: "min(2.25rem, 11vw)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Bricolage Grotesque Variable, Noto Sans SC, Noto Sans Tamil, Figtree Variable, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque Variable, Noto Sans SC, Noto Sans Tamil, Figtree Variable, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body-lg:
    fontFamily: "Figtree Variable, Noto Sans SC, Noto Sans Tamil, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Figtree Variable, Noto Sans SC, Noto Sans Tamil, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Figtree Variable, Noto Sans SC, Noto Sans Tamil, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Figtree Variable, Noto Sans SC, Noto Sans Tamil, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontFamily: "Figtree Variable, Noto Sans SC, Noto Sans Tamil, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0.01em"
rounded:
  field: "14px"
  btn: "14px"
  card: "20px"
  pill: "999px"
spacing:
  gap: "1rem"
  gutter: "16px"
  card-pad: "20px"
  card-pad-lg: "24px"
  stage-pad: "24px"
  stage-pad-lg: "32px"
  touch: "44px"
  btn-h: "52px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "{spacing.btn-h}"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-navy:
    backgroundColor: "{colors.navy-fill}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "{spacing.btn-h}"
  button-navy-hover:
    backgroundColor: "{colors.primary-2}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "{spacing.btn-h}"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "{spacing.btn-h}"
  button-danger:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.on-danger-strong}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "{spacing.btn-h}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "{spacing.btn-h}"
  chip-risk-pause:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-risk-ask:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-risk-none:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-live-signal:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.on-danger-strong}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  verdict-stage-verified:
    backgroundColor: "{colors.success-strong}"
    textColor: "{colors.on-success-strong}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "{spacing.stage-pad}"
  verdict-stage-risk:
    backgroundColor: "{colors.danger-strong}"
    textColor: "{colors.on-danger-strong}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "{spacing.stage-pad}"
  verdict-stage-caution:
    backgroundColor: "{colors.warning-strong}"
    textColor: "{colors.on-warning-strong}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "{spacing.stage-pad}"
  verdict-stage-paused:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "{spacing.stage-pad}"
  app-header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    padding: "10px 16px"
  bottom-nav-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    height: "32px"
    width: "56px"
  toast:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "10px 20px 10px 12px"
---

# Design System: Verity

## Overview

**Creative North Star: "The Verdict Stage"**

Verity is a deep-navy shell on a cool off-white ground, and its judgement is staged. Whenever a payment, a call or a message is risky, the app answers on a large rounded stage: a scanning ring and a big "Checking…", then a full-strength colour field sweeps in from the left, a round seal stamps down and a display-weight verdict rises. The verdict can be read from the back of a room on a projector, and also by a 68-year-old customer who is being coached over the phone.

The rest of the system stays quiet so the stage carries the weight. Surfaces are white cards with soft, navy-tinted depth. Colour is rationed by meaning, and every hue does one job: orange is the only action colour, green means verified, red means scam or risk, amber means caution, and navy is the shell. Actions are pills, panels have 20px corners, and the type pairs Bricolage Grotesque for verdicts, headings and money with Figtree for everything people read.

Density follows the person. Customer screens are one calm column with 52px actions and generous gaps, and they grow further in Easy Mode (20px base text, 60px buttons, 1.5rem gaps). The staff console runs the same tokens tighter: a navy rail, a stat strip and a sortable table.

**Key Characteristics:**
- Deep blue-navy shell: header, hero bands, the paused stage, the staff rail and the disclaimer strip.
- Full-bleed verdict fields in strong green, red and amber, each with its own AA text colour.
- Vivid orange pill buttons with navy text as the single call to action.
- Bricolage Grotesque at extrabold weight for verdicts and money; Figtree for body text.
- Two soft shadow levels, both tinted from the navy.
- rem-based sizing everywhere, so Easy Mode and the text-size setting scale the whole UI.
- Motion that tells the story (sweep, stamp, rise) and becomes plain fades under reduced motion.

## Colors

A cool navy-and-paper palette with four saturated signal colours, each held to a single meaning.

### Primary
- **Deep Blue-Navy** (primary): the shell. Used for the sticky header, the login hero band, the balance card, the paused verdict stage, the staff rail, toasts and the disclaimer strip. It is also the foreground text colour on light surfaces.
- **Lifted Navy** (primary-2): a layered navy for stages and selects that sit on the shell, the dark-mode balance card and the hover state of navy buttons.
- **Filled Navy** (navy-fill): the fill for navy buttons. It matches the shell in light mode and lifts to the secondary blue in dark mode so a navy button never disappears into the dark ground.
- **Navy Mist** (on-primary-muted): secondary text on navy, such as the stage subtitle, the balance label and the disclaimer.

### Secondary
- **Signal Orange** (accent): action and brand only. Primary buttons, the active bottom-nav pill, the logo's rim, the checker's scanning arc, text selection and the check-message icon. Text on it is always navy (on-accent).
- **Warm Orange** (accent-hover): hover state of orange buttons.
- **Burnt Orange Ink** (accent-ink): orange as a text or control colour on light surfaces (the browser's accent-color for checkboxes and radios).
- **Link Blue** (secondary): links, info icons, progress and the text caret.

### Tertiary (verdict signals)
Each signal has three tiers: an ink for text and icons on light surfaces, a soft tint for chips and banners, and a strong field for verdict stages with its own on-colour.
- **Verified Green**: success ink, success-soft tint, success-strong field with navy text.
- **Scam Red**: danger ink, danger-soft tint, danger-strong field with white text. The strong field is the same vivid red in light and dark mode.
- **Caution Amber**: warning ink, warning-soft tint, warning-strong field with navy text.

### Neutral
- **Cool Paper** (background): the page ground.
- **White Card** (card): cards, fields, outline buttons, the bottom nav and dialogs.
- **Fog** (muted): hover fills, table headers, skeletons and inset text panels.
- **Slate Text** (muted-foreground): helper text and inactive nav labels. Darkens in Easy Mode for stronger contrast.
- **Hairline** (border): card borders and list dividers.
- **Steel Boundary** (border-strong): the 2px boundary on inputs, selects and outline buttons, and the scrollbar.
- **Info Wash** (info-soft): info banners, "me" bubbles in chat and in-call table rows.
- **Focus Blue** (ring): the 3px focus outline.
- **Scrim and tints** (scrim, tint-on-dark, tint-on-dark-strong): the dialog backdrop, and the translucent white fills and borders of controls that sit on navy.

### Named Rules
**The One Job Rule.** Every hue has exactly one meaning: orange is action, green is verified, red is scam or risk, amber is caution, navy is the shell. Orange never signals a warning, and green never decorates.

**The Ink, Soft, Strong Rule.** A signal colour appears in only three forms: ink (text and icons on light), soft (a tinted chip or banner behind foreground text) and strong (a full verdict field). A strong field always takes its matching on-colour.

**The Navy-on-Bright Rule.** Orange, green and amber fills carry navy text. White text appears only on the navy shell, on navy-fill and on danger-strong.

**The Token-Only Rule.** Components never write raw hex. Every colour comes from a CSS variable in tokens.css through the Tailwind preset, and dark mode and Easy Mode work by redefining those variables.

## Typography

**Display Font:** Bricolage Grotesque Variable (with Noto Sans SC, Noto Sans Tamil, Figtree, system-ui)
**Body Font:** Figtree Variable (with Noto Sans SC, Noto Sans Tamil, system-ui, Segoe UI)

**Character:** Bricolage is a characterful grotesque: at 800 weight with tight -0.02em tracking it makes verdicts and amounts read as decisions. Figtree is open and friendly, so plain-language body copy stays easy to read at a reading age of about 12. In Chinese and Tamil, the Noto face leads both stacks and display letter-spacing resets to 0. Tamil body text gets 1.6 line height.

### Hierarchy
- **Display** (800, 2.25rem rising to 3rem from 640px, 1.05): verdict stage titles, the "Checking…" label and the login hero heading. Balanced wrapping.
- **Display Money** (800, min(2.25rem, 11vw), 1, tabular figures): balances and payment amounts. The checker's confidence numeral uses the same face larger, at min(3.75rem, 16vw).
- **Headline** (700, 1.75rem, 1.2): every screen's h1, which takes focus on route change.
- **Title** (700, 1.375rem, 1.3): section h2s and dialog titles. Question prompts step up to 1.75rem and 2.25rem.
- **Body Large** (500, 1.125rem, 1.5): text inside verdict stages, payee names and large buttons.
- **Body** (400, 1rem, 1.55): all reading text. The column is capped at 36rem.
- **Button** (600, 1rem, -0.005em): button labels.
- **Label** (600, 0.875rem, 1.5): field labels in dense contexts, chips, small buttons, helper text and table cells.
- **Caption** (500, 0.8125rem, 0.01em): the disclaimer strip and the NEW and REPORTED status tags.

### Named Rules
**The Stage Voice Rule.** Extrabold Bricolage belongs to verdicts, money and the hero heading. Ordinary headings stay at bold, so the stage is always the loudest thing on screen.

**The Tabular Money Rule.** Every amount uses tabular figures and is written in full ("S$1,500"), so columns align and digits never jump.

**The One Ramp Rule.** There is a single rem-based scale (0.8125, 0.875, 1, 1.125, 1.375, 1.75, 2.25, 3, 3.75rem). Nothing is sized in px, so the browser's text size, the app's four text sizes and Easy Mode all scale it together.

## Layout

Customer screens are a single centred column (max 36rem) with a 16px side gutter and 20px top and bottom padding. Blocks stack with one rhythm token (1rem, or 1.5rem in Easy Mode). A sticky navy header holds the "V" monogram and wordmark, the language select and Help. A fixed four-item bottom nav sits on white with a top hairline and respects the safe-area inset, and main content reserves 6rem beneath it. The disclaimer strip runs full width above the header on every screen.

The first viewport puts the decision first. On the pause screen the navy stage, the payee and amount receipt and the orange Cancel button all fit at 375px. On verify and the message checker the result opens with a full-width verdict stage and scrolls into view.

Grids collapse to one column on phones. Home's two primary actions sit side by side from 640px, but stay stacked in Easy Mode. The payment receipt moves its amount to a right-aligned column from 640px; on phones it sits below a dashed rule. Login uses a navy hero band with the form card pulled up 40px to overlap it.

The staff console uses the same tokens with denser spacing. A 240px navy rail runs on the left from 768px and becomes a horizontally scrolling tab strip below that. Main content has 16px or 24px padding. Six stat tiles run two across, and six across from 1024px. The case table has a 900px minimum width inside a rounded, scrollable card, with a sticky fog header.

Touch targets are at least 44px everywhere. Primary actions and inputs are 52px tall (60px in Easy Mode).

## Elevation & Depth

The system is mostly flat and tonal: the cool ground, white cards and the navy shell create most of the separation. Two soft, layered shadows add lift, both tinted from the navy in light mode and deepened to black in dark mode. There are no hard or offset shadows and no glows.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgb(10 31 68 / 0.06), 0 8px 24px -8px rgb(10 31 68 / 0.16)`): cards, list groups, stat tiles, the header, orange buttons, verdict seals and the logo.
- **Lift** (`box-shadow: 0 2px 4px rgb(10 31 68 / 0.08), 0 18px 40px -12px rgb(10 31 68 / 0.28)`): verdict stages, dialogs and toasts, which are the things that float above the flow.
- In dark mode the same two roles use `0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px -8px rgb(0 0 0 / 0.5)` and `0 2px 4px rgb(0 0 0 / 0.45), 0 18px 40px -12px rgb(0 0 0 / 0.6)`.

### Named Rules
**The Two Levels Rule.** Only card and lift exist. Anything that interrupts (a stage, a dialog, a toast) gets lift, and everything else gets card or no shadow.

## Shapes

Rounded and friendly, never sharp. Actions are full pills (999px): buttons, chips, the bottom-nav active indicator, toasts, seals and icon discs. Containers use generous 20px corners: cards, banners, verdict stages, dialogs, the amount box and the message textarea. Inner elements use a tighter 14px corner: inputs, selects, staff nav items, settings option tiles, chat bubbles and inset panels. Icons sit in circular discs (32 to 40px for reasons and banners, 64 to 80px for the verdict seal). Boundaries are 1px hairlines on cards and 2px steel strokes on controls that take input. The focus outline is a 3px ring offset 3px with 10px corners.

### Named Rules
**The Pill Action Rule.** If it is a button, it is a pill. Corners of 20px are for things that hold content, and 14px is for things you type into or pick from.

## Components

### Buttons
Tactile, confident pills that respond to touch.
- **Shape:** full pill (999px), 52px tall (60px in Easy Mode); small buttons are 44px.
- **Primary:** Signal Orange fill, navy label, semibold, card shadow, 20px horizontal padding (24px with larger text for `lg`). Hover warms to accent-hover.
- **Navy:** navy-fill with a white label for the second-ranked action ("Verify a call"). Hover goes to Lifted Navy, and in dark mode it has a translucent white border.
- **Outline:** white card fill, 2px steel border, navy label. Hover darkens the border to foreground and fills with fog. It is used for every alternative on the pause screen.
- **Ghost:** transparent, with a fog hover.
- **Danger:** danger-strong fill with a white label.
- **Press:** every pressable element scales to 0.97 over 140ms with the out-expo curve. Colours cross-fade over 180ms. Transitions are never `transition: all`.
- **Loading / Disabled:** a spinning loader replaces the icon, `aria-busy` is set and the button sits at 60% opacity.

### Chips
- **Risk chip:** pill with a 1px border in the signal ink, a soft signal fill, a bold 0.875rem label and a leading shield or triangle icon. Pause is red, ask is amber and none is green.
- **NEW payee tag:** an amber pill with a user-plus icon. Staff tables use compact outlined NEW and REPORTED tags.
- **Live signal chip:** solid danger-strong pill with white text and a pinging live dot, shown inside the paused stage ("On a call").
- **Sample and payee chips:** white pills with a steel border and fog hover, used for quick picks.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** white card on the cool ground. Hero cards (balance) use the navy shell with no border.
- **Shadow Strategy:** card level (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 20px, or 24px from 640px.
- **Banners:** 20px rounded, 1px border in the signal ink over its soft tint, with a 36px white icon disc tinted by the tone. Danger banners use `role="alert"`.

### Inputs / Fields
- **Style:** 52px tall, white fill, 2px steel border, 14px corners, 16px horizontal padding, with a semibold label above and muted helper text below the label.
- **Focus:** the global 3px Focus Blue ring with a 3px offset. Hover darkens the border to foreground.
- **Error:** the border turns danger red, and a danger message with a triangle icon is linked by `aria-describedby`.
- **Amount entry:** a centred, 20px-rounded box with a large tabular figure (2.25rem bold) and a muted "S$" prefix.

### Navigation
- **Customer header:** sticky navy bar. Header controls are 44px translucent-white pills on navy.
- **Bottom nav:** four items on white. The active item gets an orange 56×32px pill behind its icon, a heavier icon stroke and a bold label. Inactive items use slate text that turns to foreground on hover.
- **Staff rail:** navy, with 14px-rounded items in white text. The active item has a tint-on-dark-strong fill and hover has the lighter tint. A small green or amber live dot shows connection.

### Dialogs, Sheets and Toasts
- **Dialog:** max 28rem, white, 20px corners, lift shadow, 24px padding, over a navy scrim. It fades up over 180ms. On phones the sheet variant is pinned to the bottom. Focus is trapped and returned on close.
- **Toast:** a navy pill with a lift shadow and a 28px signal-coloured disc holding the tone icon. It sits above the bottom nav and dismisses after 5s.

### Verdict Stage (signature)
The system's defining component: a 20px-rounded section with a lift shadow and 24px padding (32px from 640px).
- **Tones:** verified (success-strong field, navy seal with a green icon), risk (danger-strong field, white card seal with a red icon, white text), caution (warning-strong field, navy seal with an amber icon), paused (navy field, or Lifted Navy in dark mode, with an amber seal holding a hand).
- **Anatomy:** optional live-signal chips across the top, then a 64 to 80px round seal beside a display-weight title, followed by Body Large copy, an optional big numeral and a Read-aloud control.
- **Timeline (GSAP, out-expo):** a navy checking layer with an orange scanning arc and a 2.25 to 3rem "Checking…" label. At 0.85s the checking layer fades out and the colour field sweeps in from the left (scaleX over 0.6s). At 1.0s the seal stamps in (from 0.6 scale and -12° over 0.55s), and at 1.05s the content rises 18px with a 0.06s stagger.
- **Held actions:** while the stage runs it carries `data-stage-running`. Its following siblings (`[data-stage-running] ~ *`) and anything marked `data-after-stage` stay invisible and unclickable, then fade in over 260ms when it settles.
- **Robustness:** the final verdict is always in the DOM and visible by default, because motion only animates it in. Under reduced motion there is no checking phase and no movement.

### Lists and Motion
- **Screen entrance:** an 18px slide-in from the right over 260ms.
- **List stagger:** rows rise 14px over 0.45s, 0.05s apart, with the total stagger capped at 0.3s. Long lists use scroll-triggered batches that start just below the fold. Content is never hidden before the script runs.
- **Skeletons:** fog blocks with 12px corners that pulse opacity between 1 and 0.55. There is no shimmer.
- **Reduced motion:** screens and entrances become a 160ms fade, loops stop and press scaling is removed.

## Do's and Don'ts

### Do:
- **Do** resolve every risky moment on the Verdict Stage: a navy checking state, then a full strong-colour field with a round seal and an extrabold Bricolage title.
- **Do** put navy text on orange, green and amber fills, and reserve white text for navy, navy-fill and danger-strong.
- **Do** keep the verdict in the DOM and visible by default, and hold the actions after the stage (`[data-stage-running] ~ *`, `data-after-stage`) until it settles.
- **Do** set money in Bricolage extrabold with tabular figures, written in full ("S$1,500").
- **Do** size type and spacing in rem from the one ramp so Easy Mode (20px base, 60px buttons, 1.5rem gaps) scales the whole interface.
- **Do** give every pressable control at least 44px, and primary actions and inputs 52px.
- **Do** pair every signal colour with an icon and words in chips, banners, reason lists and stages, so meaning never rests on colour alone.
- **Do** let Noto Sans SC and Noto Sans Tamil lead the font stacks in Chinese and Tamil, with display letter-spacing at 0.
- **Do** keep the navy disclaimer strip at the top of every screen.

### Don't:
- **Don't** use orange for anything other than action and brand: no orange warnings, and no orange text on light surfaces except accent-ink.
- **Don't** put white text on the green or amber strong fields.
- **Don't** use the green shield-check seal as the brand or for anything but a verified state. The brand is the Verity logo (navy shield, amber pause bars, orange rim), which never carries a tick, and the pause screen uses a hand.
- **Don't** write raw hex in components; every colour comes through a token variable.
- **Don't** add shadow levels beyond card and lift, or hard offset shadows.
- **Don't** animate with `transition: all` or background-position shimmer. Animate only transform and opacity.
- **Don't** move or scale anything under reduced motion. Use fades only and stop loops.
