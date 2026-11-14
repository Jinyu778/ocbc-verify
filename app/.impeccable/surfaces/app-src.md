---
version: 1
slug: "app-src"
primary_target: "app/src"
related_targets: []
---

# Surface brief: OCBC Verify app (customer, trusted contact, staff)

Scope: the whole app's visual layer (app/src). Mode: Operate. Built code-first. The redesign changes styles, fonts, markup needed for styling, and motion only. Logic, API calls, routes and test-relevant labels are fixed.

Audience: judges watching on a projector first; real customers second (seniors in Easy Mode, young adults, trusted contacts). Staff use a dense desktop console.

## Direction contract

THESIS: Every risky moment resolves on a visible stage: a large "Checking…" that settles into a green Verified seal or a red/amber Warning field, so the product's judgement can be read from the back of a room. It refuses the category default of white cards, a rust accent, and verdicts as a 20 px line in a box.

OWN-WORLD:
- **Ground and shell:** deep blue-navy shell (header, hero fields, staff rail) on a cool off-white ground.
- **Colour roles, one job each:**
  - vivid orange = action (filled, with navy text)
  - bright green = verified
  - vivid red = scam or risk
  - amber = caution
- **Type:** Bricolage Grotesque for display (headings, verdicts, money); Figtree for body. Noto Sans SC and Noto Sans Tamil as fallbacks.
- **Shapes:** pill actions, 20 px rounded panels.
- **Glyphs:** the verified seal is reserved for verified states; pause uses a hand.

STORY: The customer sees at once whether to stop or go: what was caught (live call, new payee, amount) and the one safe action to take. Judges remember the stage.

FIRST VIEWPORT:
- **Pause:** a navy stage with a hand glyph and display heading, a receipt row with the payee, NEW chip and big amount, and an "On a call" chip in the stage. The orange Cancel button sits within the first screen at 375 px.
- **Verify and checker:** a full-width verdict stage at the top of the result.

FORM: pinned brief direction; the roll was skipped because the request pinned the direction: "Deep navy base, vivid orange accent, bright green = verified, vivid red = scam/risk, amber = caution", "a characterful display font for headings and a clean body font", and a hero "Checking…" that resolves into Verified (green) or Warning (red/amber). seed: none (skipped: direction pinned by the user's request)
Signature interaction: the verdict stage (scanning ring, then a colour field sweep and seal stamp). Motion grammar:
- screen slide-in
- button press scale
- one capped stagger per list
- GSAP for the verdict timeline
- under reduced motion, fades only

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
