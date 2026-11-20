import { expect, test, type Page } from "@playwright/test";
import { answerAllNo, login, openAs, resetData, startPayment } from "./helpers";

// Screenshots of the key screens for design review: TOUR=1 npx playwright test tour
//   TOUR_DIR=<folder>  output folder (default: screenshots)
//   TOUR_DARK=1        dark mode (customer and staff windows)
//   TOUR_RM=1          prefers-reduced-motion: reduce
// Capture rules: "*-vp" files are viewport-only at the real screen size; full-page files are
// taken after scrolling through the page, with the sticky header / fixed nav made static
// (capture only) so they are not stamped over the content.
test.skip(!process.env.TOUR, "set TOUR=1 to capture screenshots");
const DIR = process.env.TOUR_DIR ?? "screenshots";
const REDUCED = !!process.env.TOUR_RM;
const STATIC_CHROME = "header.sticky, nav.fixed { position: static !important; }";

async function settle(page: Page) {
  await page.waitForFunction(() => !document.querySelector("[data-stage-running]"), null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Scroll to the bottom and back so scroll-triggered entrances have played. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}

/** Two frames of the verdict stage while it plays: ~0.4 s (Checking…) and ~1.1 s (resolving). */
async function stageFrames(page: Page, name: string, width: number) {
  if (REDUCED) return;
  // The verdict card no longer plays a "Checking…" sequence; skip the frames if nothing is running.
  if (!(await page.waitForSelector("[data-stage-running]", { timeout: 1000 }).catch(() => null))) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${width}-${name}-anim-0.4s.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/${width}-${name}-anim-1.1s.png` });
}

for (const width of [375, 1440] as const) {
  test(`visual tour @${width}`, async ({ page, browser }) => {
    test.setTimeout(150_000);
    resetData();
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    if (REDUCED) await page.emulateMedia({ reducedMotion: "reduce" });
    if (process.env.TOUR_DARK) await page.emulateMedia({ colorScheme: "dark" });
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    const vp = async (name: string) => {
      await settle(page);
      await page.screenshot({ path: `${DIR}/${width}-${name}-vp.png` });
    };
    const full = async (name: string) => {
      await settle(page);
      await scrollThrough(page);
      const style = await page.addStyleTag({ content: STATIC_CHROME });
      await page.screenshot({ path: `${DIR}/${width}-${name}.png`, fullPage: true });
      await style.evaluate((el) => el.remove());
    };

    await page.goto("/login");
    await full("00-login");
    await login(page, "ryan.lim");
    await vp("01-home");
    await full("01-home");

    // Verified path: staff calls the customer in-app; the customer verifies it is genuine
    await startPayment(page, "Hospital – NUH Billing", "300", "no");
    await full("02-questions");
    await answerAllNo(page);
    await full("03-review-ask");
    const staff = await openAs(browser, "staff.anna", { width: 1440, height: 900 });
    await staff.getByRole("row", { name: /Ryan Lim/ }).first().click();
    await expect(staff.getByRole("button", { name: /Call customer in-app/ })).toBeEnabled();
    await staff.keyboard.press("c");
    await staff.getByLabel("Note for the audit trail (required)").fill("Verifying the bill.");
    await staff.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("OCBC is calling you")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/customer/verify");
    await stageFrames(page, "04-verify-genuine", width);
    await expect(page.getByText("This is a genuine OCBC call")).toBeVisible();
    await vp("04-verify-genuine");
    await full("04-verify-genuine");

    // Scam path: on a call, MAS safety account
    await startPayment(page, "MAS Safety Account", "1500", "call");
    await answerAllNo(page);
    await stageFrames(page, "05-pause-scam", width);
    await expect(page.getByRole("heading", { name: "Let's pause this payment" })).toBeVisible();
    await vp("05-pause-scam");
    // the "on a call" warning, scrolled clear of the bottom nav
    await page.getByRole("alert").filter({ hasText: "You're on a call" }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${width}-05-pause-scam-callout-vp.png` });
    await full("05-pause-scam");

    await page.goto("/customer/check");
    await page.getByRole("button", { name: "Concert tickets" }).click();
    await page.getByRole("button", { name: "Check message" }).click();
    await stageFrames(page, "06-check-scam", width);
    await expect(page.getByText("Likely scam", { exact: true })).toBeVisible();
    await vp("06-check-scam");
    await full("06-check-scam");
    await page.getByLabel("Message to check").fill("Hey, are we still meeting at the hawker centre at 7 on Friday?");
    await page.getByRole("button", { name: "Check message" }).click();
    await expect(page.getByText("No known warning signs", { exact: true })).toBeVisible();
    await vp("07-check-safe");
    await full("07-check-safe");

    // Staff console: end the in-app call, close the drawer, let toasts clear, then the queue
    if (width === 1440) {
      const end = staff.getByRole("button", { name: "End", exact: true });
      if (await end.isVisible().catch(() => false)) await end.click();
      await staff.keyboard.press("Escape");
      await staff.waitForTimeout(5500); // toasts auto-dismiss after 5 s
      await expect(staff.getByRole("heading", { name: "Case queue" })).toBeVisible();
      await staff.screenshot({ path: `${DIR}/1440-20-staff-queue.png` });
      await staff.getByRole("row", { name: /Ryan Lim/ }).first().click();
      await expect(staff.getByRole("heading", { name: /Case SB-/ })).toBeVisible();
      await staff.waitForTimeout(800);
      await staff.screenshot({ path: `${DIR}/1440-21-staff-case.png` });
    }
    await staff.context().close();
    expect(consoleErrors, "browser console errors on the verified and scam paths").toEqual([]);
  });
}

// Readability pass: the screens the main tour does not reach, plus Easy Mode in 中文 (Mdm Tan's own settings)
// and the trusted-contact view.
for (const width of [375, 1440] as const) {
  test(`readability tour @${width}`, async ({ page, browser }) => {
    test.setTimeout(120_000);
    resetData();
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
    if (process.env.TOUR_DARK) await page.emulateMedia({ colorScheme: "dark" });
    const shot = async (p: Page, name: string, fullPage = false) => {
      await p.waitForTimeout(450);
      const style = fullPage ? await p.addStyleTag({ content: STATIC_CHROME }) : null;
      await p.screenshot({ path: `${DIR}/${width}-${name}.png`, fullPage });
      await style?.evaluate((el) => el.remove());
    };

    await login(page, "ryan.lim");
    await page.goto("/customer/pay");
    await expect(page.getByRole("heading", { name: "New payees – check these carefully" })).toBeVisible();
    await shot(page, "30-payees", true);
    await page.getByRole("button", { name: /SP Group/ }).first().click();
    await shot(page, "31-amount-empty");
    await page.getByLabel("Amount (S$)").fill("1250.50");
    await shot(page, "32-amount-filled");
    await page.goto("/customer/settings");
    await shot(page, "33-settings", true);

    // Mdm Tan: Easy Mode on and Chinese, from her seeded preferences
    const tan = await openAs(browser, "tan.siewlan", { width, height: width === 375 ? 812 : 900 });
    await shot(tan, "40-easy-zh-home", true);
    await tan.goto("/customer/pay");
    await shot(tan, "41-easy-zh-payees", true);
    await tan.context().close();

    const contact = await openAs(browser, "daniel.tan", { width, height: width === 375 ? 812 : 900 });
    await shot(contact, "50-contact-home", true);
    await contact.context().close();
  });
}
