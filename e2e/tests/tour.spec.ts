import { expect, test } from "@playwright/test";
import { answerAllNo, resetDemo, runScenario, staffLogin } from "./helpers";

// Visual tour: saves screenshots of key screens to e2e/screenshots for manual review.
test.skip(!process.env.TOUR, "set TOUR=1 to capture screenshots");

test("visual tour", async ({ page, browser, request }) => {
  await resetDemo(request);
  const shot = (name: string) => page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  await runScenario(page, 1, "keep"); // Mdm Tan: 中文 + Easy Mode
  await shot("01-pay-zh-easy");
  await page.locator("#lang-header").selectOption("en");
  await page.getByRole("button", { name: "Review payment" }).click();
  await shot("02-question-easy");
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await page.waitForTimeout(400);
  await shot("03-pause-easy");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);
  await shot("04-pause-dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "Call SafeBank in-app" }).click();
  const staff = await staffLogin(browser);
  await staff.getByRole("button", { name: "Answer" }).click();
  await page.waitForTimeout(1500);
  await shot("05-call");
  await staff.getByRole("row", { name: /Mdm Tan/ }).first().click();
  await staff.waitForTimeout(800);
  await staff.screenshot({ path: "screenshots/06-staff-case-1440.png" });
  await staff.keyboard.press("Escape");
  await staff.screenshot({ path: "screenshots/07-staff-queue-1440.png" });
  await runScenario(page, 6);
  await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
  await shot("08-check-ryan");
  await page.goto("/");
  await shot("09-home-ryan");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.screenshot({ path: "screenshots/10-home-1440.png" });
  await staff.context().close();
});
