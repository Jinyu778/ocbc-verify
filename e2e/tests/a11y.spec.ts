import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { answerAllNo, openAs, resetDemo, runScenario, staffLogin } from "./helpers";

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
test.beforeEach(async ({ request }) => resetDemo(request));

for (const theme of ["light", "dark"] as const) {
  test(`customer screens have no serious/critical axe violations (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/login");
    await scan(page, "login");
    await page.goto("/demo");
    await scan(page, "demo");
    await runScenario(page, 1);
    await scan(page, "pay amount");
    await page.goto("/");
    await scan(page, "home (easy mode)");
    await page.goto("/pay");
    await scan(page, "payee list");
    await runScenario(page, 1);
    await page.getByRole("button", { name: "Review payment" }).click();
    await expect(page.getByText("Question 1 of 4")).toBeVisible();
    await scan(page, "questions");
    await answerAllNo(page);
    await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
    await scan(page, "pause");
    await page.getByRole("button", { name: "Save for later" }).click();
    await scan(page, "save sheet");
    await page.getByRole("button", { name: "1 hour" }).click();
    await scan(page, "saved");
    await page.goto("/check?sample=ticket");
    await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
    await scan(page, "check result");
    await page.goto("/verify");
    await expect(page.getByText("SafeBank is NOT calling you right now.")).toBeVisible();
    await scan(page, "verify");
    await page.goto("/settings");
    await scan(page, "settings");
    await page.goto("/guide");
    await scan(page, "guide");
  });
}

test("trusted contact and staff console have no serious/critical axe violations", async ({ page, browser }) => {
  await runScenario(page, 5);
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await page.getByRole("button", { name: "Ask my trusted contact" }).click();
  await scan(page, "waiting for trusted contact");
  const mom = await openAs(browser, "mrs.lim");
  await expect(mom.getByText("Ryan Lim wants to make a payment")).toBeVisible();
  await scan(mom, "trusted contact home");
  const staff = await staffLogin(browser);
  await scan(staff, "staff queue");
  await staff.getByRole("row", { name: /Ryan Lim/ }).first().click();
  await expect(staff.getByRole("heading", { name: /Case SB-/ })).toBeVisible();
  await scan(staff, "staff case drawer");
  await staff.keyboard.press("Escape");
  await staff.getByRole("button", { name: "Impact" }).click();
  await scan(staff, "staff impact");
  await staff.getByRole("button", { name: "Reported messages" }).click();
  await scan(staff, "staff messages");
  await mom.context().close();
  await staff.context().close();
});

test("layout has no horizontal scroll at 375px with extra-large text", async ({ page }) => {
  await runScenario(page, 1);
  await page.evaluate(() => {
    localStorage.setItem("sb.prefs", JSON.stringify({ theme: "light", easy: true, textSize: "xl", readAloud: true }));
  });
  for (const path of ["/", "/pay", "/check", "/settings", "/verify"]) {
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
