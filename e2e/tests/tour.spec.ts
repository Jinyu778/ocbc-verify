import { expect, test } from "@playwright/test";
import { answerAllNo, english, login, openAs, resetData, startPayment } from "./helpers";

// Screenshots of key screens for manual review: TOUR=1 npx playwright test tour
test.skip(!process.env.TOUR, "set TOUR=1 to capture screenshots");

test("visual tour", async ({ page, browser }) => {
  resetData();
  const shot = (name: string) => page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  await login(page, "tan.siewlan"); // 中文 + Easy Mode
  await page.waitForTimeout(400);
  await shot("01-home-zh-easy");
  await english(page);
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: /MAS Safety Account/ }).click();
  await page.waitForTimeout(400);
  await shot("02-live-question-easy");
  await page.getByRole("button", { name: "Yes – I'm on a call" }).click();
  await page.getByLabel("Amount (S$)").fill("8000");
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await page.waitForTimeout(400);
  await shot("03-pause-easy");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  await shot("04-pause-dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Call SafeBank in-app" }).click();
  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("button", { name: "Answer" }).click();
  await page.waitForTimeout(1500);
  await shot("05-call");
  await staff.getByRole("row", { name: /Mdm Tan/ }).first().click();
  await staff.waitForTimeout(800);
  await staff.screenshot({ path: "screenshots/06-staff-case-1440.png" });
  const ryan = await openAs(browser, "ryan.lim");
  await ryan.goto("/customer/pay");
  await ryan.getByRole("button", { name: "Add a new payee" }).click();
  await ryan.waitForTimeout(400);
  await ryan.screenshot({ path: "screenshots/07-add-payee.png", fullPage: true });
  await startPayment(ryan, "SP Group", "30");
  await ryan.waitForTimeout(400);
  await ryan.screenshot({ path: "screenshots/08-review-ryan.png", fullPage: true });
  await staff.context().close();
  await ryan.context().close();
});
