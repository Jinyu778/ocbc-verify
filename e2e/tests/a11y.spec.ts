import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { answerAllNo, english, login, openAs, resetData, startPayment } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
  await page.waitForTimeout(300); // let entry animations finish
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(name, JSON.stringify(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target).slice(0, 5) })), null, 2));
  expect(bad, `${name}: serious/critical axe violations`).toEqual([]);
}

test.describe.configure({ timeout: 180_000 });
test.beforeEach(() => resetData());

for (const theme of ["light", "dark"] as const) {
  test(`customer screens: no serious/critical axe violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/login");
    await scan(page, "login");
    await login(page, "tan.siewlan"); // Easy Mode account
    await english(page);
    await scan(page, "home (easy mode)");
    await page.goto("/customer/pay");
    await scan(page, "payee list");
    await page.getByRole("button", { name: "Add a new payee" }).click();
    await scan(page, "add payee");
    await page.goto("/customer/pay");
    await page.getByRole("button", { name: /MAS Safety Account/ }).click();
    await scan(page, "live-call question");
    await page.getByRole("button", { name: "Yes – I'm on a call" }).click();
    await page.getByLabel("Amount (S$)").fill("8000");
    await scan(page, "amount + call banner");
    await page.getByRole("button", { name: "Review payment" }).click();
    await expect(page.getByText("Question 1 of 4")).toBeVisible();
    await scan(page, "questions");
    await answerAllNo(page);
    await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
    await scan(page, "pause");
    await page.getByRole("button", { name: "Save for later" }).click();
    await scan(page, "save sheet");
    await page.getByRole("button", { name: "1 minute", exact: true }).click();
    await scan(page, "saved");
    await page.goto("/customer/check");
    await page.getByRole("button", { name: "Concert tickets" }).click();
    await page.getByRole("button", { name: "Check message" }).click();
    await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
    await scan(page, "check result");
    await page.goto("/customer/verify");
    await expect(page.getByText("SafeBank is NOT calling you right now.")).toBeVisible();
    await scan(page, "verify");
    await page.goto("/customer/settings");
    await scan(page, "settings");
    await page.goto("/customer/guide");
    await scan(page, "guide");
  });
}

test("trusted contact and staff console: no serious/critical axe violations", async ({ page, browser }) => {
  await login(page, "ryan.lim");
  await startPayment(page, "HR Onboarding – J. Wong", "600", "chatting");
  await answerAllNo(page);
  await page.getByRole("button", { name: "Ask my trusted contact" }).click();
  await scan(page, "waiting for trusted contact");
  const mom = await openAs(browser, "mrs.lim");
  await expect(mom.getByText("Ryan Lim wants to make a payment")).toBeVisible();
  await scan(mom, "trusted contact home");
  await mom.getByRole("button", { name: "Settings" }).click();
  await scan(mom, "trusted contact settings");
  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await scan(staff, "staff queue");
  await staff.getByRole("row", { name: /Ryan Lim/ }).first().click();
  await expect(staff.getByRole("heading", { name: /Case SB-/ })).toBeVisible();
  await scan(staff, "staff case drawer");
  await staff.keyboard.press("Escape");
  for (const tab of ["Impact", "Reported messages", "Audit trail"]) {
    await staff.getByRole("link", { name: tab }).click();
    await scan(staff, `staff ${tab}`);
  }
  await mom.context().close();
  await staff.context().close();
});

test("no horizontal scroll at 375px with Easy Mode and extra-large text", async ({ page }) => {
  await login(page, "tan.siewlan");
  await page.evaluate(() => localStorage.setItem("sb.prefs", JSON.stringify({ theme: "light", easy: true, textSize: "xl", readAloud: true })));
  for (const path of ["/customer", "/customer/pay", "/customer/check", "/customer/settings", "/customer/verify"]) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const { overflow, culprits } = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const culprits = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.getBoundingClientRect().right > w + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName}.${(el as HTMLElement).className}`.slice(0, 120));
      return { overflow: document.documentElement.scrollWidth - w, culprits };
    });
    expect(overflow, `${path} horizontal overflow: ${culprits.join(" | ")}`).toBeLessThanOrEqual(0);
  }
});
