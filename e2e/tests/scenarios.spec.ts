import { expect, test } from "@playwright/test";
import { answerAllNo, english, login, openAs, resetData, startPayment } from "./helpers";

// Every test: real login, real taps, real server timers (1-minute options from the test server's .env).
test.beforeEach(() => resetData());

test("Scenario 3 – everyday payment: SP Group S$45, no extra steps", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "SP Group", "45"); // known payee: no live-call question
  await expect(page.getByText("Looks safe")).toBeVisible();
  await page.getByRole("button", { name: "Send S$45" }).click();
  await expect(page.getByRole("heading", { name: "Payment sent" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page.getByText("S$41,955")).toBeVisible();
});

test("Scenario 3 fast path – known payee from Home in ≤ 3 taps", async ({ page }) => {
  await login(page, "ryan.lim");
  await page.getByRole("link", { name: "Mrs Lim (mother)", exact: true }).click(); // tap 1
  await page.getByLabel("Amount (S$)").fill("20");
  await page.getByRole("button", { name: "Review payment" }).click(); // tap 2
  await page.getByRole("button", { name: "Send S$20" }).click(); // tap 3
  await expect(page.getByRole("heading", { name: "Payment sent" })).toBeVisible();
});

test("Scenario 1 (browser) – fake MAS officer: answers 'on a call' → pause → Call SafeBank → staff escalates", async ({ page, browser }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "MAS Safety Account", "8000", "call");
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "You're on a call" })).toBeVisible();
  await page.getByRole("button", { name: "Call SafeBank in-app" }).click();
  await expect(page.getByText("Calling SafeBank")).toBeVisible();

  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByText("Anna Koh").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible({ timeout: 14_000 });

  await staff.getByRole("row", { name: /Mdm Tan Siew Lan/ }).first().click();
  await expect(staff.getByText("signals from: customer answer")).toBeVisible();
  await expect(staff.getByRole("button", { name: /Hold & escalate/ })).toBeEnabled();
  await staff.keyboard.press("e");
  await staff.getByLabel("Note for the audit trail (required)").fill("Caller claimed to be MAS; customer confirmed.");
  await staff.getByRole("button", { name: "Confirm" }).click();
  await expect(staff.getByText("escalated anti scam centre")).toBeVisible();
  await page.getByRole("button", { name: "End call" }).click();
  await page.getByRole("button", { name: "Back" }).last().click();
  await expect(page.getByRole("heading", { name: "Payment held for your safety" })).toBeVisible();
  await staff.context().close();
});

test("Scenario 2 – genuine urgent bill: ask → all No → save for 1 minute → really wait → Send now", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "Hospital – NUH Billing", "3200", "no");
  await answerAllNo(page);
  await expect(page.getByText("Check first")).toBeVisible();
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByRole("button", { name: "1 minute", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "3 minutes" })).toBeVisible();
  await page.getByRole("button", { name: "1 minute", exact: true }).click();
  await expect(page.getByText(/You can send this in 0:\d\d/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  // survives logout/login and shows on Home
  await page.goto("/customer/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "tan.siewlan");
  await english(page);
  await expect(page.getByText("Saved for later", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("button", { name: "Send now" })).toBeEnabled({ timeout: 75_000 });
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByRole("heading", { name: "Payment sent" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page.getByText("S$38,800")).toBeVisible();
});

test("Scenario 4 – customer answers 'on a call', then No to everything → still paused", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "MAS Safety Account", "8000", "call");
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(page.getByText(/Continue anyway \(available in/)).toBeVisible();
});

test("Scenario 5 – fake job deposit: Ryan adds the payee, chatting, trusted contact stops it → staff", async ({ page, browser }) => {
  await login(page, "ryan.lim");
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: "Add a new payee" }).click();
  await page.getByLabel("Payee name").fill("HR Onboarding – J. Wong");
  await page.getByLabel("Account number").fill("5501 2233 44");
  await page.getByRole("button", { name: "Save payee" }).click();
  await expect(page.getByRole("heading", { name: /on a phone call or chatting/ })).toBeVisible();
  await page.getByRole("button", { name: "Yes – someone is messaging me" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Someone is messaging you" })).toBeVisible();
  await page.getByLabel("Amount (S$)").fill("600");
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await page.getByRole("button", { name: "Ask my trusted contact" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for Mrs Lim" })).toBeVisible();

  const mom = await openAs(browser, "mrs.lim");
  await expect(mom.getByText("Ryan Lim wants to make a payment")).toBeVisible();
  await expect(mom.getByText("S$100 – S$1,000")).toBeVisible();
  await expect(mom.getByText("a NEW payee")).toBeVisible();
  await expect(mom.getByText("2,800")).toHaveCount(0);
  await mom.getByRole("button", { name: "Stop this payment" }).click();
  await expect(mom.getByText("You asked to stop it")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SafeBank is reviewing this payment" })).toBeVisible();

  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await expect(staff.getByRole("row", { name: /Ryan Lim/ }).first()).toContainText("Needs staff review");
  await mom.context().close();
  await staff.context().close();
});

test("Scenario 6 – ticket scam message: Likely scam, flags, report → staff sees it", async ({ page, browser }) => {
  await login(page, "ryan.lim");
  await page.getByRole("link", { name: "Check a message" }).click();
  await page.getByLabel("Message to check").fill(
    "Selling 2x Coldplay tickets Cat 1, below price! Many people asking, PayNow first, no meetup. Last 2 left, decide now!",
  );
  await page.getByRole("button", { name: "Check message" }).click();
  await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^PayNow first/ }).click();
  await expect(page.getByText("'Pay first, no meetup' is how most online shopping and ticket scams work.")).toBeVisible();
  await page.getByRole("button", { name: "Report this to SafeBank" }).click();
  await expect(page.getByText("Reported. Thank you")).toBeVisible();
  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("link", { name: "Reported messages" }).click();
  await expect(staff.getByText(/Coldplay tickets/)).toBeVisible();
  await staff.getByRole("button", { name: "Mark reviewed" }).click();
  await staff.getByLabel("Note (required)").fill("Known ticket-scam pattern.");
  await staff.getByRole("button", { name: "Confirm" }).click();
  await expect(staff.getByText("reviewed", { exact: true })).toBeVisible();
  await staff.context().close();
});

test("Scenario 7 – Verify a call: NOT calling, then genuine after staff starts an in-app call", async ({ page, browser }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await page.getByRole("button", { name: "Verify a call" }).click();
  await expect(page.getByText("SafeBank is NOT calling you right now.")).toBeVisible();

  // a case is needed for staff to call: Mdm Tan starts a risky payment
  await startPayment(page, "Hospital – NUH Billing", "3200", "no");
  await answerAllNo(page);
  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("row", { name: /Mdm Tan Siew Lan/ }).first().click();
  await expect(staff.getByRole("button", { name: /Call customer in-app/ })).toBeEnabled();
  await staff.keyboard.press("c");
  await staff.getByLabel("Note for the audit trail (required)").fill("Calling to verify the hospital bill.");
  await staff.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("SafeBank is calling you")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/customer/verify");
  await expect(page.getByText("This is a genuine SafeBank call")).toBeVisible();
  await expect(page.getByText(/Anna Koh from the SafeBank Fraud Team/)).toBeVisible();
  await page.getByRole("button", { name: "Go to the call" }).click();
  await page.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible({ timeout: 14_000 });
  await page.getByRole("button", { name: "Use text chat instead" }).click();
  await expect(page.getByText("We switched to text chat")).toBeVisible();
  await page.getByLabel("Type a message").fill("Is this really SafeBank?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(staff.getByText("Is this really SafeBank?")).toBeVisible();
  await staff.context().close();
});

test("Scenario 8 – removing a trusted contact only takes effect after the cooling period", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Daniel Tan")).toBeVisible();
  await expect(page.getByText(/Changes take effect after 24 hours/)).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/Will be removed on/)).toBeVisible();
  // still protects her today
  await startPayment(page, "MAS Safety Account", "8000", "call");
  await answerAllNo(page);
  await expect(page.getByRole("button", { name: "Ask my trusted contact" })).toBeEnabled();
});

test("Scenario 9 – Aisha in Bahasa Melayu with Easy Mode and Read aloud completes scenario 2", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page, "aisha.rahman");
  await expect(page.getByRole("heading", { name: "Helo, Aisha Rahman" })).toBeVisible();
  await page.getByRole("link", { name: "Tetapan" }).click();
  await page.getByRole("switch", { name: "Mod Mudah" }).click();
  await expect(page.getByRole("switch", { name: "Mod Mudah" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("switch", { name: "Baca amaran dengan kuat" })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => document.documentElement.classList.contains("easy"))).toBe(true);

  await page.goto("/customer/pay");
  await page.getByRole("button", { name: /Hospital – NUH Billing/ }).click();
  await page.getByRole("button", { name: "Tidak", exact: true }).click();
  await page.getByLabel("Jumlah (S$)").fill("3200");
  await page.getByRole("button", { name: "Semak bayaran" }).click();
  await answerAllNo(page, "Tidak", (i) => `Soalan ${i} daripada 4`);
  await expect(page.getByRole("button", { name: "Baca kuat" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Simpan untuk kemudian" }).click();
  await page.getByRole("button", { name: "1 minit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hantar sekarang" })).toBeEnabled({ timeout: 75_000 });
  await page.getByRole("button", { name: "Hantar sekarang" }).click();
  await expect(page.getByRole("heading", { name: "Bayaran dihantar" })).toBeVisible();
});

test("Scenario 10 – backend goes down mid-transfer: fails safe, never sends", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: /Tan Wei Ming/ }).click();
  await page.getByLabel("Amount (S$)").fill("120");
  await page.route("**/api/**", (r) => r.abort("connectionrefused")); // the API is unreachable from here on
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("heading", { name: "We can't check this payment right now" })).toBeVisible();
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByText("Saved on this phone. Nothing was sent.")).toBeVisible();
  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await expect(page.getByText("Not sent – saved on this phone")).toBeVisible();
  await expect(page.getByText("S$42,000")).toBeVisible(); // nothing moved
});

test("Failure – backend slower than 5 s fails safe", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: /SP Group/ }).click();
  await page.getByLabel("Amount (S$)").fill("45");
  await page.route("**/api/transfers", async (r) => {
    await new Promise((res) => setTimeout(res, 6500));
    await r.continue().catch(() => undefined);
  });
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("heading", { name: "We can't check this payment right now" })).toBeVisible({ timeout: 9000 });
});

test("Failure – trusted contact doesn't answer: timeout path after TRUSTED_CONTACT_TIMEOUT_MINUTES", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page, "ryan.lim");
  await startPayment(page, "Carousell Seller – ticketsg88", "300", "chatting");
  await answerAllNo(page);
  await page.getByRole("button", { name: "Ask my trusted contact" }).click();
  await expect(page.getByText(/Time left for a reply: 0:\d\d/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mrs Lim hasn't answered yet" })).toBeVisible({ timeout: 75_000 });
  await expect(page.getByRole("button", { name: "Save for later" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Call SafeBank in-app" })).toBeVisible();
});

test("Failure – invalid amount shows an inline error next to the field", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: /SP Group/ }).click();
  await page.getByLabel("Amount (S$)").fill("999999");
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This is more than your balance" })).toBeVisible();
  await expect(page.getByLabel("Amount (S$)")).toHaveAttribute("aria-invalid", "true");
});

test("Roles – each account only reaches its own area", async ({ page }) => {
  await login(page, "mrs.lim");
  await expect(page).toHaveURL(/\/contact$/);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/contact$/);
  await page.goto("/customer/pay");
  await expect(page).toHaveURL(/\/contact$/);
});
