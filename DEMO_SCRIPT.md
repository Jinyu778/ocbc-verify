# SafeBank Shield – 70-second live demo

Order: **Scenario 3 → 1 → 5 → 2**. Two windows side by side:
- **Left (phone-sized, 375 px):** customer app at `http://<laptop>:5173/demo`
- **Right:** staff console at `http://<laptop>:5174`, signed in as `staff.anna` / `Demo1234!`

## Before you go on stage (2 min)
1. `npm run dev` (or `docker compose up`). Open both windows.
2. On `/demo`, click **Reset demo data**.
3. Sign the staff console in. The sidebar should show the green **Live** dot.
4. Allow microphone access in both windows (needed for the voice call).
5. Turn the laptop volume down to avoid echo, or use headphones.

## The 70 seconds

| Time | Say | Tap |
|---|---|---|
| 0–10 s | "Most payments should feel instant. Here's Mdm Tan paying her electricity bill." | **Run 3** → **Review payment** → **Send S$45** → *Payment sent* |
| 10–35 s | "Now a scammer posing as MAS keeps her on the phone and tells her to move S$8,000 to a 'safety account'." | **Run 1** (red call banner shows) → **Review payment** → **No ×4** → *Let's pause this payment* → **Call SafeBank in-app** |
| | "She can't be rushed past this, and she reaches the real bank in one tap." | Right window: **Answer** → voice connects, *Verified SafeBank Fraud Team · Anna Koh* |
| | "Anna sees exactly why it was paused, and escalates." | Click the Mdm Tan row → press **E** → type "Caller claimed MAS" → **Confirm**. Left: **End call** → **Back** → *Payment held for your safety* |
| 35–55 s | "Young people get hit too. Ryan is being messaged about a 'job deposit'." | **Run 5** → **Review payment** → **No ×4** → **Ask my trusted contact** |
| | "His mum gets a request. She sees only what she needs, never his balance." | Open the **Mrs Lim** role tab from `/demo` (prepare it beforehand) → **Stop this payment**. Left: *SafeBank is reviewing* |
| 55–70 s | "And if it's genuine? A hospital bill gets a short pause, not a block." | **Run 2** → **Review payment** → **No ×4** → **Save for later** → **1 hour** → **Skip timer (demo only)** → **Send now** → *Payment sent* |

Close with: "Friction only when it's needed, no permanent blocks, and every step is in an evidence log. That's the Impact tab." Click **Impact** on the right.

## Tips
- Open the Mrs Lim tab before you start (`/demo` → *Mrs Lim (trusted contact for Ryan)*), so you only switch tabs during Scenario 5.
- Mdm Tan's account is set to 中文 with Easy Mode on. After **Reset demo data**, run Scenario 3 once and switch the header language menu to English. That choice is saved to her profile until the next reset. Or keep 中文 for a few seconds to show the multi-language support.
- Keyboard in the staff console: **A** approve · **C** call · **E** escalate · **G** genuine · **Esc** close.

## Backup plan if Wi-Fi fails
Everything runs on one laptop: API, both apps, fonts (bundled), and the voice call (peer-to-peer on localhost). **No internet is needed.**
1. Run both windows on the laptop itself (`localhost`). Don't use phones.
2. If the voice call won't connect (no mic, or blocked), tap **Use text chat instead**. It shows the same verified badge and is logged as a fallback, which is itself part of the story.
3. If the API crashes: restart with `npm run dev`, then click **Reset demo data**.
4. Last resort: show `e2e/screenshots/` (captured with `TOUR=1 npx playwright test tour`) and the Playwright report (`npx playwright show-report` in `e2e/`).
5. To show fail-safe live without stopping anything: **Run 7** → **Review payment** → *We can't check this payment right now* (nothing is sent).
