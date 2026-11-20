# OCBC Verify – 70-second live presentation

Real app, real accounts, no shortcuts. Order: **Scenario 3 → 1 → 5**.

## Who holds what
| Person | Device | Signed in as |
|---|---|---|
| Presenter A | Android phone with the OCBC Verify app (or a phone browser) | `tan.siewlan`, then `ryan.lim` (second tab) |
| Presenter B | Laptop on the projector, 1440 px | `staff.anna` |
| Presenter C | Second phone | makes the "scam" call; also signed in as `mrs.lim` in a browser |

Password for all: `Test1234!`. All devices on the same Wi-Fi; the app is at `http://<laptop-IP>:5173`.

## 10 minutes before
1. `npm run reset-data`, then `npm run dev` (or `docker compose up`).
2. Sign everyone in. On each customer phone, tap **Skip** on the first-run guide. Switch Mdm Tan to English with the language menu if the audience needs it.
3. Phone A: Settings → Call detection → **Allow** (Android).
4. Laptop: allow the microphone. Check the green **Live** dot in the sidebar.
5. Phone C: dial Phone A, but don't connect yet.

## The 70 seconds
| Time | Say | Do |
|---|---|---|
| 0–10 s | "Everyday payments stay instant." | A (Mdm Tan): Pay → **SP Group** → 45 → Review → **Send S$45** → *Payment sent*. |
| 10–40 s | "Now a fake MAS officer calls her and says move S$8,000 to a 'safety account'." | C calls A; A answers and stays on the line. A: Pay → **MAS Safety Account – Lim K.** → 8000 → Review. The red call banner shows. **No** ×4 → *Let's pause this payment*. Point at **Hang up. Call back on a number you already know** and, at the bottom, **Hang up first** (Continue anyway is locked while she is on the call). Then **Call OCBC in-app**. |
| | "We never trust the caller. A voice can be cloned, so the app only offers numbers built into it, and *Continue anyway* stays locked until she hangs up. One tap reaches the real bank, with a verified badge." | B: **Answer** → voice connects, *Verified OCBC Fraud Team · Anna Koh*. B opens the case, presses **E**, types "Caller claimed MAS", Confirm. A: End call → *Payment held for your safety*. |
| 40–70 s | "Young people are targeted too. Ryan is being messaged about a 'job deposit'." | A (Ryan tab): Pay → **HR Onboarding – J. Wong** → **Yes – someone is messaging me** → 600 → Review → **No** ×4 → **Ask my trusted contact**. C (Mrs Lim) gets the request live, sees only the amount band and "a NEW payee", and taps **Pause for OCBC review** (it can pause for staff review, never block permanently). A shows *OCBC is reviewing*; B's queue shows *Needs staff review*. |

Close with: "We don't try to detect the deepfake, because soon nobody can. We never trust an inbound contact and always verify through a channel you already know. Friction only when the risk is real, never a permanent block, and every step goes into an evidence log." B clicks **Impact**.

**No Android phone?** At the MAS step the browser asks "Are you on a phone call or chatting…?". Tap **Yes – I'm on a call**. Everything else is identical.

## Backup plan if Wi-Fi fails
Everything runs on the laptop. Fonts are bundled, and the voice call is peer-to-peer. **No internet is needed.**
1. Run all roles on the laptop: one normal window (`tan.siewlan` / `ryan.lim`), one private window (`mrs.lim`) and one more tab (`staff.anna`), all at `http://localhost:5173`.
2. Use the browser answer **Yes – I'm on a call** instead of a real call.
3. If voice won't connect, tap **Use text chat instead**. It has the same verified badge, and the fallback is logged, which is part of the story.
4. If the API crashes: Ctrl+C, then `npm run dev`. Data stays. Run `npm run reset-data` only between rehearsals.
5. Last resort: show `e2e/screenshots/` (made with `TOUR=1 npx playwright test tour`) and the Playwright HTML report (`npx playwright show-report` in `e2e/`).
