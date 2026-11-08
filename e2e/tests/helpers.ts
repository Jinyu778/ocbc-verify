import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const API = "http://127.0.0.1:8000";
export const STAFF = "http://localhost:5174";

export async function resetDemo(request: APIRequestContext) {
  const r = await request.post(`${API}/api/demo/reset`);
  expect(r.ok()).toBeTruthy();
}

/** Clicks a scenario on /demo, then switches the UI to English so assertions are stable. */
export async function runScenario(page: Page, n: number, lang: "en" | "zh" | "keep" = "en") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Run ${n}`, exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/demo"));
  if (lang !== "keep") await page.locator("#lang-header").selectOption(lang);
}

export async function answerAllNo(page: Page) {
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(`Question ${i} of 4`)).toBeVisible();
    await page.getByRole("button", { name: "No", exact: true }).click();
  }
}

export async function openAs(browser: Browser, username: string) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await ctx.newPage();
  await p.goto(`/login?as=${username}`);
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  return p;
}

export async function staffLogin(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["microphone"] });
  const p = await ctx.newPage();
  await p.goto(STAFF);
  await p.getByLabel("Staff username").fill("staff.anna");
  await p.getByLabel("Password").fill("Demo1234!");
  await p.getByRole("button", { name: "Sign in" }).click();
  await expect(p.getByRole("heading", { name: "Case queue" })).toBeVisible();
  return p;
}
