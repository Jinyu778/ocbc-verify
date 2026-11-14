# OCBC Verify – Test plan

> Student prototype for OCBC IGNITE 2026, not an official OCBC product.

Everything is tested the way a real user would use it. You log in with a test account, make real transfers, answer the real questions, wait for the real timers, and approve or review from the real trusted-contact and staff accounts. The app has **no** demo buttons, auto-login, skip-timer or fake signal switches.

## Before you start

| | |
|---|---|
| App | http://localhost:5173 (or `http://<laptop-IP>:5173` from a phone on the same Wi-Fi) |
| Password for every test account | `Test1234!` |
| Reset all data | `npm run reset-data` (or `make reset-data`, or `cd backend && python -m app.seed --reset`) |

**Short timers for testing.** Put these in `.env` and restart the API, so you don't have to wait hours:
```
SAVE_FOR_LATER_OPTIONS_MINUTES=1,3,5
TRUSTED_CONTACT_TIMEOUT_MINUTES=2
```
The app reads them from the API and shows the real values, for example "1 minute / 3 minutes / 5 minutes".

**Several people at once.** Each browser tab keeps its own login. Use two devices, or one normal plus one private window, or separate tabs. That way the customer, the trusted contact and staff (`staff.anna`, best on a laptop at 1440 px) can all be signed in together.

**First login of a customer** shows a 3-card "How you're protected" guide. Tap **Skip** or read through it.

| Account | Role | Notes |
|---|---|---|
| `tan.siewlan` | customer | 68, S$42,000, opens in 中文 with Easy Mode. Trusted contact: `daniel.tan` |
| `ryan.lim` | customer | 21, S$2,800, English. Trusted contact: `mrs.lim` |
| `aisha.rahman` | customer | 41, S$15,500, Bahasa Melayu, no trusted contact |
| `daniel.tan` | trusted contact | Mdm Tan's son |
| `mrs.lim` | trusted contact | Ryan's mother |
| `staff.anna` | staff | fraud officer, sees the fraud console |

To read Mdm Tan's screens in English, use the language menu at the top. The choice is saved to her profile.

---

## 1. Fake MAS officer (real phone call)
**Devices:** an Android phone with the OCBC Verify app (see README → Android build), logged in as `tan.siewlan`; a second phone; a laptop logged in as `staff.anna`.

| # | Step | Expected result |
|---|---|---|
| 1 | Phone: Settings → Call detection → **Allow**. Accept the Android permission. | Status shows "On (Android)". The explanation says we only check whether you're on a call. |
| 2 | Call the OCBC Verify phone from the second phone and **stay on the line**. | – |
| 3 | Pay → "MAS Safety Account – Lim K." (NEW chip) → amount `8000` → Review. | Red banner: "You're on a call. Scammers often stay on the line…". No live-call question appears, because the phone detected the call. |
| 4 | Answer **No** to all 4 safety questions. | "Let's pause this payment" with reasons: new payee, on a call, large payment, much larger than usual. Nothing sent. |
| 5 | Tap **Call OCBC in-app**. | "Calling OCBC…". The laptop console rings: "Verification call: Mdm Tan Siew Lan". |
| 6 | Laptop: **Answer**. | Phone shows *Verified OCBC Fraud Team · Anna Koh*, a timer and "Connected". Voice works both ways. |
| 7 | Laptop: open the Mdm Tan case → **Hold & escalate to ASC** (or press E) → note → Confirm. | Timeline shows "escalated anti scam centre". **Referral (printable)** opens the referral with masked contact details. |
| 8 | Phone: End call → Back. | "Payment held for your safety". Balance still S$42,000. |

**In a browser instead of Android:** at step 3 the app asks "Are you on a phone call or chatting with someone about this payment right now?". Tap **Yes – I'm on a call**. The rest is the same. The staff timeline shows "signals from: customer answer".

## 2. Genuine urgent bill
**Account:** `tan.siewlan`, no call.

| # | Step | Expected result |
|---|---|---|
| 1 | Pay → "Hospital – NUH Billing" → live-call question → **No** → amount `3200` → Review. | Safety questions start (score 5 = "ask"). |
| 2 | Answer **No** ×4. | "Check and send", chip **Check first**, with reasons: new payee, large payment, much larger than usual. |
| 3 | **Save for later** → choose the shortest option (e.g. "1 minute"). | "Payment saved for later" with a live countdown. **Send now** is disabled. |
| 4 | Sign out, sign in again. | Home shows a **Saved for later** card. It survives logout. |
| 5 | Open it and wait until the countdown reaches 0. | "The waiting time is over…". **Send now** becomes enabled, because the server unlocks it only when the time has passed. |
| 6 | **Send now**. | "Payment sent". Home balance **S$38,800**. |

## 3. Everyday payment
**Account:** `tan.siewlan`. Pay → **SP Group** → `45` → Review → **Send S$45**.
**Expected:** "Looks safe" with no questions and no live-call question (known payee) → "Payment sent" → balance S$41,955.
*Young-adult fast path:* `ryan.lim` taps the **Mrs Lim (mother)** chip on Home → amount → Review → Send. That's 3 taps.

## 4. Customer lies
**Account:** `tan.siewlan`. On a real call (Android), or answer **Yes – I'm on a call** in the browser. Pay S$8,000 to "MAS Safety Account – Lim K." → answer **No** to every safety question.
**Expected:** still **"Let's pause this payment"**. New payee plus a live call always pauses. "Continue anyway" only appears after a visible 30-second countdown, and then opens "Scammers often tell you to ignore warnings. Are you sure?" with **Go back** as the main button.

**4b. Coached victim who denies everything (browser).** Same payment, but answer **No** to "Are you on a phone call or chatting…?" and **No** to every safety question.
**Expected:** still **"Let's pause this payment"**, with the reason "A large, unusual payment to someone new is how most scams end. We always pause these." A new payee + an amount far above her usual + S$5,000 or more always pauses. Answers can only raise risk.

## 5. Fake job deposit (trusted contact)
**Windows:** A = `ryan.lim`, B = `mrs.lim`, C = `staff.anna`.

| # | Step | Expected result |
|---|---|---|
| 1 | A: Pay → **Add a new payee** → name "HR Onboarding – J. Wong", any account number (e.g. `5501223344`) → Save payee. | The payee is saved as NEW, and the live-call question appears. |
| 2 | A: **Yes – someone is messaging me** → amount `600` → Review → **No** ×4. | Chat banner. Then "Let's pause this payment". |
| 3 | A: **Ask my trusted contact**. | "Waiting for Mrs Lim" with the time left for a reply. |
| 4 | B: (already signed in) | A toast "New request from Ryan Lim". The card shows only: name, "S$100 – S$1,000", "a NEW payee", the reasons, and "Please call them before you decide". **No balance or account numbers.** |
| 5 | B: **Pause for OCBC review**. | B: "You paused it for OCBC review" (the note under the button says it never blocks the payment permanently). A updates live to "OCBC is reviewing this payment". |
| 6 | C: Case queue. | The Ryan Lim case shows "Needs staff review". Staff can **Mark as genuine** or **Approve** (with a note) after talking to Ryan. That counts as a false positive in Impact. |

## 6. Ticket scam message
**Account:** `ryan.lim` → **Check** tab → paste a concert-ticket message (or tap the **Concert tickets** sample) → **Check message**.
**Expected:** **Likely scam**, with "PayNow first", "no meetup" and "now" underlined with a warning icon. Tapping one explains why. Safe actions appear: Call OCBC in-app, ScamShield Helpline 1799, and **Report this to OCBC**. After reporting, `staff.anna` → **Reported messages** shows the message (phone numbers hidden, links shortened to the domain) and can mark it reviewed or escalate it.
*Low confidence:* a vague message with no red flags can give **"Not sure – check through an official channel"**.

## 7. Verify a call
| # | Step | Expected result |
|---|---|---|
| 1 | `tan.siewlan` Home → **Verify a call**. | "OCBC is NOT calling you right now. If someone says they're from OCBC, MAS or the Police, hang up and call us in-app." |
| 2 | Mdm Tan starts any risky payment (e.g. scenario 2 up to the questions), so staff have a case. `staff.anna` opens it → **Call customer in-app** (C) → note → Confirm. | Mdm Tan sees "OCBC is calling you". |
| 3 | Close that popup, then Home → **Verify a call**. | "This is a genuine OCBC call – Anna Koh from the OCBC Fraud Team…" → **Go to the call** → Answer. |
| 4 | Optional: deny the microphone, or tap **Use text chat instead**. | Text chat with the same verified badge. The fallback is logged in the case timeline. |

## 8. Trusted contact change
**Account:** `tan.siewlan` → Settings → Trusted contact → Daniel Tan → **Remove**.
**Expected:** "Will be removed on <date/time>" plus the notice "Changes take effect after 24 hours…" (or whatever `CONTACT_CHANGE_COOLING_MINUTES` is set to). Until then, "Ask my trusted contact" still goes to Daniel. Adding a different contact also waits for the cooling period. A customer's *first* contact (try `aisha.rahman` → add `mrs.lim`) is active immediately.

## 9. Inclusivity
**Account:** `aisha.rahman` (opens in Bahasa Melayu).
1. **Tetapan** (Settings) → turn on **Mod Mudah** (Easy Mode). Text gets bigger and buttons taller (≥ 56 px). **Baca amaran dengan kuat** (Read aloud) is on.
2. Do scenario 2 in Malay: Bayar → Hospital – NUH Billing → **Tidak** → 3200 → Semak bayaran → **Tidak** ×4 → Simpan untuk kemudian → "1 minit" → wait → **Hantar sekarang** → "Bayaran dihantar".
3. Tap **Baca kuat** on a question or warning. It reads the text in Malay, or shows "Baca kuat tidak tersedia pada peranti ini" if the device has no Malay voice.
4. Also try: dark mode, text size *Extra large*, browser zoom 200 %, and keyboard only (Tab / Enter / Esc). Nothing should scroll sideways at 375 px.

## 10. Backend down
Start a payment (Pay → a payee → amount). **Before tapping Review**, stop the API (`docker compose stop api`, or Ctrl+C on `npm run dev`). Then tap **Review payment**.
**Expected:** "We can't check this payment right now. So we have NOT sent it…" with **Try again / Save for later / Cancel payment**. Save for later keeps it on the phone only ("Not sent – saved on this phone…" on Home). Restart the API → Home → **Check it now** → it goes through the normal checks. The balance never changes while the API is down.
*Slow server:* if the API takes longer than 5 s to answer, the same safe screen appears.

---

## 11. Family code word (AI voice-clone defence)
| # | Step | Expected result |
|---|---|---|
| 1 | `daniel.tan` → Settings → **Family code word** → Mdm Tan Siew Lan → type a word → **Save code word**. (Or `tan.siewlan` → Settings → Family code word.) | "Saved…". The card now says "A code word is set". The word is never shown again. |
| 2 | `tan.siewlan`: Pay → "MAS Safety Account – Lim K." → **Yes – I'm on a call** → 8000 → Review → **No** ×4. | Pause screen shows **"Ask the caller for your family code word."** with "If they can't say it, hang up. Voices can be faked with AI." |
| 3 | `staff.anna` opens the case. | Nothing about the code word appears anywhere in the console, timeline or referral. |
| 4 | Try with no code word set (`npm run reset-data` first). | The pause screen says she hasn't set one yet and points to Settings. |

## 12. Attach a scam message to a payment, and payee intelligence
| # | Step | Expected result |
|---|---|---|
| 1 | `ryan.lim`: Pay → "HR Onboarding – J. Wong" → **Yes – someone is messaging me** → 600 → Review → **No** ×4 → paused. | – |
| 2 | Ryan: **Check** tab → paste the job message (or the **Part-time job** sample) → **Check message** → in **Add this message to my payment**, choose the HR Onboarding payment → **Add message to this payment**. | "Added. OCBC staff will see this message…". |
| 3 | `staff.anna` opens Ryan's case. | **Messages the customer attached** shows the message with phone numbers hidden and links shortened. The timeline has a "message attached" event. It also appears under **Reported messages**. |
| 4 | `aisha.rahman`: Pay → "HR Onboarding – J. Wong" (the same mule account) → **No** → **50** → Review → **No** ×4. | Even for S$50, the pause screen shows **"This account was reported by other customers."** (+4 risk). The staff queue shows a **REPORTED** chip on Aisha's case. |
| 5 | Optional: staff **Hold & escalate** a case on "MAS Safety Account – Lim K.", then another customer pays that payee. | Also flagged as reported. A customer's own earlier cases never count as "other customers". |

## 13. Pokémon card pre-order (young adults)
`ryan.lim` → **Check** → tap the **Pokémon card pre-order** sample → **Check message**.
**Expected:** **Likely scam**, with flags "Pay-first pre-order, no meetup" and "'Pay first, no meetup'". A genuine shop pre-order ("pay when you collect in store") is not flagged.

## Other failure checks
| Situation | How to test | Expected |
|---|---|---|
| Invalid amount | Amount `0`, `-5`, `1.234`, or more than the balance | Red error under the amount field saying what to fix |
| Wrong password ×5 | Log in with a wrong password 5 times | "Too many tries. Please wait N seconds" |
| Trusted contact doesn't answer | Scenario 5 without tapping anything in window B; wait `TRUSTED_CONTACT_TIMEOUT_MINUTES` | "Mrs Lim hasn't answered yet" → Save for later / Call OCBC still available |
| Call permission denied (Android) | Deny phone permission | The app asks the live-call question instead and logs "signal unavailable" |
| WebRTC fails | Block the microphone in the browser | Text chat fallback with verified badge; "call fallback text chat" in the timeline |
| System wrong | Staff → **Mark as genuine** on a paused genuine payment | Released; Impact → "Released as genuine" and false positives go up |
| Session idle | Leave the app idle ~9 minutes | "Are you still there?" with **Stay signed in** |

## Automated version
`npm run test:e2e` runs scenarios 2–10 (scenario 1 in its browser form) through the real login screen, with 1-minute timers set only in the test server's environment, plus axe accessibility scans. See the README for the latest results.
