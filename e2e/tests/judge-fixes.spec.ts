import { expect, test } from "@playwright/test";
import { answerAllNo, english, login, openAs, resetData, startPayment } from "./helpers";

// Judge findings, tested through the real UI with real logins.
test.beforeEach(() => resetData());

test("4b – coached victim: says 'not on a call' and No to everything, S$8,000 to a new payee still pauses", async ({ page }) => {
  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "MAS Safety Account", "8000", "no");
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(page.getByText(/We always pause these/)).toBeVisible();
});

test("11 – family code word: trusted contact sets it; pause screen asks for it; never shown to staff", async ({ page, browser }) => {
  const dan = await openAs(browser, "daniel.tan");
  await dan.getByRole("button", { name: "Settings" }).click();
  await dan.getByLabel("New code word").fill("Kopi Peng Uncle");
  await dan.getByRole("button", { name: "Save code word" }).click();
  await expect(dan.getByText(/Saved\. Tell your family/)).toBeVisible();
  await expect(dan.getByText("A code word is set")).toBeVisible();
  await expect(dan.getByText("Kopi Peng Uncle")).toHaveCount(0);

  await login(page, "tan.siewlan");
  await english(page);
  await startPayment(page, "MAS Safety Account", "8000", "call");
  await answerAllNo(page);
  await expect(page.getByText("Ask the caller for your family code word.")).toBeVisible();

  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("row", { name: /Mdm Tan Siew Lan/ }).first().click();
  await expect(staff.getByRole("heading", { name: /Case SB-/ })).toBeVisible();
  expect((await staff.locator("body").innerText()).toLowerCase()).not.toContain("kopi");
  await dan.context().close();
  await staff.context().close();
});

test("12 – attach a checked message to a case; another customer paying that account sees 'reported'", async ({ page, browser }) => {
  await login(page, "ryan.lim");
  await startPayment(page, "HR Onboarding – J. Wong", "600", "chatting");
  await answerAllNo(page);
  await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await page.getByRole("link", { name: "Check a message" }).click();
  await page.getByLabel("Message to check").fill(
    "HR Onboarding: you're hired! Pay an upfront training fee of $600 before your first day. WhatsApp 9123 4567 now.",
  );
  await page.getByRole("button", { name: "Check message" }).click();
  await expect(page.getByLabel("Which payment?")).toContainText("HR Onboarding");
  await page.getByRole("button", { name: "Add message to this payment" }).click();
  await expect(page.getByText(/OCBC staff will see this message/)).toBeVisible();

  const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
  await staff.getByRole("row", { name: /Ryan Lim/ }).first().click();
  await expect(staff.getByText("Messages the customer attached")).toBeVisible();
  await expect(staff.getByText(/upfront training fee/).first()).toBeVisible();
  const visible = await staff.locator("body").innerText();
  expect(visible).not.toContain("9123 4567");
  expect(visible).toContain("[phone hidden]");
  await expect(staff.getByText("message attached")).toBeVisible();

  const aisha = await openAs(browser, "aisha.rahman");
  await aisha.locator("#lang-header").selectOption("en");
  await startPayment(aisha, "HR Onboarding – J. Wong", "50", "no");
  await answerAllNo(aisha);
  await expect(aisha.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
  await expect(aisha.getByText("This account was reported by other customers.").first()).toBeVisible();
  await staff.keyboard.press("Escape");
  await expect(staff.getByRole("row", { name: /Aisha Rahman/ }).first()).toContainText("REPORTED");
  await staff.context().close();
  await aisha.context().close();
});

test("13 – Pokémon card pre-order sample is a likely scam with the pre-order flag", async ({ page }) => {
  await login(page, "ryan.lim");
  await page.getByRole("link", { name: "Check a message" }).click();
  await page.getByRole("button", { name: "Pokémon card pre-order" }).click();
  await page.getByRole("button", { name: "Check message" }).click();
  await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
  // Each flag is listed with its explanation and source (no longer a toggle button).
  await expect(page.locator("#flag-preorder_scam").getByText("Pay-first pre-order, no meetup", { exact: true })).toBeVisible();
  await expect(page.getByText("This looks like an online shopping or ticket scam.")).toBeVisible();
});
