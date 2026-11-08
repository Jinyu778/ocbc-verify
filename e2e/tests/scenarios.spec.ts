import { expect, test } from "@playwright/test";
import { API, answerAllNo, openAs, resetDemo, runScenario, staffLogin } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("Scenario 3 – everyday payment has zero friction", async ({ page }) => {
  await runScenario(page, 3);
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByText("Looks safe")).toBeVisible();
  await page.getByRole("button", { name: "Send S$45" }).click();
  await expect(page.getByRole("heading", { name: "Payment sent" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page.getByText("S$41,955")).toBeVisible();
});

test("Scenario 3 in 中文 – same flow works in Chinese", async ({ page }) => {
  await runScenario(page, 3, "zh");
  await page.getByRole("button", { name: "查看付款" }).click();
  await expect(page.getByText("看起来安全")).toBeVisible();
  await page.getByRole("button", { name: "发送 S$45" }).click();
  await expect(page.getByRole("heading", { name: "付款已发送" })).toBeVisible();
});

test("Scenario 1 – fake MAS officer: pause → call SafeBank in-app → staff escalates", async ({ page, browser }) => {
  await runScenario(page, 1);
  await expect(page.getByRole("alert").filter({ hasText: "You're on a call" })).toBeVisible();
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(page.getByText("This is much larger than your usual payments.")).toBeVisible();
  await page.getByRole("button", { name: "Call SafeBank in-app" }).click();
  await expect(page.getByText("Calling SafeBank")).toBeVisible();

  const staff = await staffLogin(browser);
  await staff.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByText("Anna Koh")).toBeVisible();
  await expect(page.getByText("Verified SafeBank Fraud Team")).toBeVisible();

  const row = staff.getByRole("row", { name: /Mdm Tan Siew Lan/ }).first();
  await expect(row).toContainText("In verification call");
  await row.click();
  await expect(staff.getByRole("heading", { name: /Case SB-/ })).toBeVisible();
  await expect(staff.getByText("verification call requested")).toBeVisible();
  await expect(staff.getByRole("button", { name: /Hold & escalate/ })).toBeEnabled();
  await staff.keyboard.press("e");
  await staff.getByLabel("Note for the audit trail (required)").fill("Caller claimed to be MAS; customer confirmed. Referred to ASC.");
  await staff.getByRole("button", { name: "Confirm" }).click();
  await expect(staff.getByText("escalated anti scam centre")).toBeVisible();

  await page.getByRole("button", { name: "End call" }).click();
  await page.getByRole("button", { name: "Back" }).last().click();
  await expect(page.getByRole("heading", { name: "Payment held for your safety" })).toBeVisible();
  await staff.context().close();
});

test("Scenario 2 – genuine urgent bill: ask → all No → save for later → send now", async ({ page }) => {
  await runScenario(page, 2);
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByText("Check first")).toBeVisible();
  await page.getByRole("button", { name: "Save for later" }).click();
  await page.getByRole("button", { name: "1 hour" }).click();
  await expect(page.getByText(/You can send this in/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  await page.getByRole("button", { name: "Skip timer (demo only)" }).click();
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByRole("heading", { name: "Payment sent" })).toBeVisible();
});

test("Scenario 4 – customer answers No to everything but is still paused", async ({ page }) => {
  await runScenario(page, 4);
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(page.getByText("A new payee while you are on a call or chat is a common scam pattern.").or(page.getByText("You are on a phone call right now."))).toBeVisible();
  // Continue anyway is held back for 30 seconds
  await expect(page.getByText(/Continue anyway \(available in/)).toBeVisible();
});

test("Scenario 5 – fake job deposit: trusted contact stops it → staff review", async ({ page, browser }) => {
  await runScenario(page, 5);
  await expect(page.getByRole("alert").filter({ hasText: "Someone is messaging you" })).toBeVisible();
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await page.getByRole("button", { name: "Ask my trusted contact" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for Mrs Lim" })).toBeVisible();

  const mom = await openAs(browser, "mrs.lim");
  await expect(mom.getByText("Ryan Lim wants to make a payment")).toBeVisible();
  await expect(mom.getByText("S$100 – S$1,000")).toBeVisible();
  await expect(mom.getByText("a NEW payee")).toBeVisible();
  await expect(mom.getByText("2,800")).toHaveCount(0); // never the balance
  await mom.getByRole("button", { name: "Stop this payment" }).click();
  await expect(mom.getByText("You asked to stop it")).toBeVisible();

  await expect(page.getByRole("heading", { name: "SafeBank is reviewing this payment" })).toBeVisible();
  const staff = await staffLogin(browser);
  await expect(staff.getByRole("row", { name: /Ryan Lim/ }).first()).toContainText("Needs staff review");
  await mom.context().close();
  await staff.context().close();
});

test("Scenario 6 – ticket scam message is flagged with highlighted phrases", async ({ page }) => {
  await runScenario(page, 6);
  await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /no meetup/ }).first()).toBeVisible();
  const flagged = page.getByRole("button", { name: /^PayNow first/ });
  await expect(flagged).toBeVisible();
  await flagged.click();
  await expect(page.getByText("'Pay first, no meetup' is how most online shopping and ticket scams work.")).toBeVisible();
  await page.getByRole("button", { name: "Report this to SafeBank" }).click();
  await expect(page.getByText("Reported. Thank you")).toBeVisible();
});

test("Scenario 7 – SafeBank server down: fails safe and never sends", async ({ page, request }) => {
  await runScenario(page, 7);
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("heading", { name: "We can't check this payment right now" })).toBeVisible();
  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByText("Saved on this phone. Nothing was sent.")).toBeVisible();
  // Nothing reached the server
  const login = await (await request.post(`${API}/api/auth/login`, { data: { username: "tan.siewlan", password: "Demo1234!" } })).json();
  const act = await (await request.get(`${API}/api/me/activity`, { headers: { Authorization: `Bearer ${login.access_token}` } })).json();
  expect(act.filter((t: { is_seed?: boolean; created_at: string }) => Date.now() - Date.parse(t.created_at) < 60_000)).toHaveLength(0);
});

test("Failure – real network failure on /api/transfers fails safe", async ({ page }) => {
  await runScenario(page, 3);
  await page.route("**/api/transfers", (r) => r.abort("connectionrefused"));
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("heading", { name: "We can't check this payment right now" })).toBeVisible();
  await page.unroute("**/api/transfers");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Looks safe")).toBeVisible();
});

test("Failure – backend slower than 5 s fails safe", async ({ page }) => {
  await runScenario(page, 3);
  await page.route("**/api/transfers", async (r) => {
    await new Promise((res) => setTimeout(res, 6500));
    await r.continue().catch(() => undefined);
  });
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("heading", { name: "We can't check this payment right now" })).toBeVisible({ timeout: 9000 });
});

test("Failure – invalid amount shows an inline error next to the field", async ({ page }) => {
  await runScenario(page, 3);
  await page.getByLabel("Amount (S$)").fill("999999");
  await page.getByRole("button", { name: "Review payment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This is more than your balance" })).toBeVisible();
  await expect(page.getByLabel("Amount (S$)")).toHaveAttribute("aria-invalid", "true");
});

test("Verify a call – nobody is calling", async ({ page }) => {
  await runScenario(page, 3);
  await page.goto("/verify");
  await expect(page.getByText("SafeBank is NOT calling you right now.")).toBeVisible();
});

test("Staff calls customer in-app; mic denied falls back to text chat", async ({ page, browser }) => {
  await runScenario(page, 2);
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  const staff = await staffLogin(browser);
  await staff.getByRole("row", { name: /Mdm Tan Siew Lan/ }).first().click();
  await expect(staff.getByRole("button", { name: /Call customer in-app/ })).toBeEnabled();
  await staff.keyboard.press("c");
  await staff.getByLabel("Note for the audit trail (required)").fill("Calling to verify hospital bill.");
  await staff.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("SafeBank is calling you")).toBeVisible();
  await page.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByText("Anna Koh").first()).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible({ timeout: 14_000 });
  await page.getByRole("button", { name: "Use text chat instead" }).click();
  await expect(page.getByText("We switched to text chat")).toBeVisible();
  await page.getByLabel("Type a message").fill("Is this really SafeBank?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(staff.getByText("Is this really SafeBank?")).toBeVisible();
  await staff.getByLabel("Message to customer").fill("Yes – check the Verified badge in your app.");
  await staff.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Yes – check the Verified badge in your app.")).toBeVisible();
  await staff.context().close();
});
