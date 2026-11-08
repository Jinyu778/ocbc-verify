import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Browser, type Page } from "@playwright/test";
import { E2E_ENV, PY } from "../playwright.config";

export const PASSWORD = "Test1234!";
const backend = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "backend");

/** Same command a tester runs: python -m app.seed --reset (there is no reset button in the app). */
export function resetData() {
  execFileSync(PY, ["-m", "app.seed", "--reset"], { cwd: backend, env: { ...process.env, ...E2E_ENV }, stdio: "pipe" });
}

/** Real login through the login screen. Customers dismiss the first-run guide like a user would. */
export async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel(/^(Username|用户名|Nama pengguna|பயனர் பெயர்)$/).fill(username);
  await page.locator("input[autocomplete='current-password']").fill(PASSWORD);
  await page.locator("form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await expect(page.locator("h1").first()).toBeVisible(); // the app has settled on its first screen
  if (page.url().includes("/customer/guide")) {
    await page.getByRole("button", { name: /^(Skip|跳过|Langkau|தவிர்)$/ }).click();
    await page.waitForURL((u) => !u.pathname.includes("/guide"));
  }
}

/** A second person on another device: new browser context, own login. */
export async function openAs(browser: Browser, username: string, viewport = { width: 375, height: 812 }) {
  const ctx = await browser.newContext({ viewport, permissions: ["microphone"], baseURL: "http://localhost:5173" });
  const p = await ctx.newPage();
  await login(p, username);
  return p;
}

export async function english(page: Page) {
  await page.locator("#lang-header").selectOption("en");
}

/** Home → Pay → choose payee → (live question for new payees) → amount → Review. */
export async function startPayment(page: Page, payee: string, amount: string, live?: "call" | "chatting" | "no") {
  await page.goto("/customer/pay");
  await page.getByRole("button", { name: new RegExp(payee.replace(/[()]/g, "\\$&")) }).first().click();
  if (live) {
    await expect(page.getByRole("heading", { name: /on a phone call or chatting/ })).toBeVisible();
    const label = { call: "Yes – I'm on a call", chatting: "Yes – someone is messaging me", no: "No" }[live];
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await page.getByLabel("Amount (S$)").fill(amount);
  await page.getByRole("button", { name: "Review payment" }).click();
}

export async function answerAllNo(page: Page, no = "No", progress = (i: number) => `Question ${i} of 4`) {
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(progress(i))).toBeVisible();
    await page.getByRole("button", { name: no, exact: true }).click();
  }
}
