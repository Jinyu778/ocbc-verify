import { expect, test } from "@playwright/test";
import { answerAllNo, resetDemo, runScenario, staffLogin } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("WebRTC voice connects between customer and staff (fake media devices)", async ({ page, browser }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`customer: ${m.text()}`));
  await runScenario(page, 1);
  await page.getByRole("button", { name: "Review payment" }).click();
  await answerAllNo(page);
  await page.getByRole("button", { name: "Call SafeBank in-app" }).click();
  const staff = await staffLogin(browser);
  staff.on("console", (m) => logs.push(`staff: ${m.text()}`));
  await staff.getByRole("button", { name: "Answer" }).click();
  try {
    await expect(page.getByRole("status").filter({ hasText: "Connected" })).toBeVisible({ timeout: 14_000 });
    await expect(staff.getByText(/Voice connected/)).toBeVisible();
  } finally {
    if (test.info().status !== "passed") console.log(logs.join("\n"));
  }
  await staff.context().close();
});
