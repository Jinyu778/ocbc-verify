# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

One React app in the browser, also wrapped as an Android app with Capacitor. The Android build uses the same web design language, not native Material styling.

## Users

- **Judges (primary audience for presentation work):** OCBC IGNITE 2026 judges watching a 5-minute pitch with a 70-second live demo on a projector. They need to understand at a glance what is happening and believe it works.
- **Customers (primary audience for daily use):**
  - Seniors such as "Mdm Tan", 68, often in Chinese, Malay or Tamil, sometimes in Easy Mode, who may be on the phone with a scammer while paying.
  - Young adults such as "Ryan", 21, targeted by job-deposit, ticket and Pokémon-card pre-order scams.
  - Working adults such as "Aisha", 41, in Bahasa Melayu.
- **Trusted contacts:** family members (an adult child, a parent) who receive a request and decide OK or pause for review.
- **Bank staff:** OCBC fraud officers triaging cases at a desktop console.

## Product Purpose

Protect customers from AI-powered scams at the moment they would send money themselves. Most losses are authorised payments that passwords and OTPs can't stop. Success means risky payments get a useful pause and a safe next step, while everyday payments stay instant.

## Positioning

OCBC Verify adds friction only at the moment of payment, and only when the context is risky (a live call, a new payee, an unusual amount). It gives the customer safe actions inside the bank app: a verified in-app call, a trusted contact and a family code word. Answers can only raise risk, and nothing is blocked permanently.

## Operating Context

- A live pitch on a projector: a laptop at 1440 px for the staff console and a phone or 375 px window for the customer. The room may be bright, and projector colour is unknown.
- Real use: a customer paying from a phone, possibly while a scammer is on the line coaching them; a trusted contact reacting to a notification; an officer working a dense queue all day.

## Capabilities and Constraints

- Six features: Safe-Exit Pause, call/chat-aware trigger, verified in-app call and "Verify a call", staff triage console, trusted contact co-sign, and "Is this real?" message checker. Plus family code word, payee intelligence and an Impact panel.
- Logic, API calls, the risk engine, routes and test-relevant labels are final. Presentation work changes only the visual layer.
- Must keep working: Easy Mode, 4 text sizes, dark mode, and English, 中文, Bahasa Melayu and தமிழ்.
- Tests: pytest, Vitest and Playwright with axe accessibility scans.

## Brand Commitments

- Name: **OCBC Verify**.
- The label "Student prototype for OCBC IGNITE 2026, not an official OCBC product" must stay visible on every screen.
- No OCBC logo or trademarked artwork.
- Plain-language, calm voice: short sentences, no jargon, reading age about 12, money written in full ("S$8,000").

## Evidence on Hand

- Working app with synthetic accounts (see README.md and TEST_PLAN.md).
- Automated test results recorded in README.md.
- No real customers, testimonials, partners or usage data exist. Do not invent any.

## Product Principles

1. Friction only when the risk is real; everyday payments stay instant.
2. The customer always has a safe next step, and is never blocked permanently.
3. Never alarm; be calm and clear, and say what to do next.
4. Privacy first: call state only, never audio, numbers, contacts or chat content.
5. Built for every generation, including someone 68 years old under pressure.

## Accessibility & Inclusion

WCAG 2.2 AA (contrast, focus, keyboard, screen-reader labels, no colour-only meaning, reduced motion). Easy Mode for seniors (20 px base text, buttons at least 56 px). Read aloud in the user's language. Layout must survive 200 % zoom at 375 px.
