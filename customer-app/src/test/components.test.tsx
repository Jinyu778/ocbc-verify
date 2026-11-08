import { act, fireEvent, screen, within } from "@testing-library/react";
import { i18n, setLanguage } from "@safebank/ui";
import { TransferFlow } from "../pages/TransferFlow";
import { SignalBanners } from "../components/Screen";
import { LanguageSelect } from "../components/Layout";
import { Settings } from "../pages/Settings";
import { writeSim } from "../signals";
import { mockFetch, renderApp } from "./utils";
import type { Transfer } from "../types";

const base: Transfer = {
  id: 7,
  payee: { id: 3, name: "MAS Safety Account – Lim K.", is_new: true },
  amount: "8000.00",
  status: "paused",
  risk_score: 7,
  risk_tier: "pause",
  reasons: [
    { key: "new_payee", points: 2, text: "" },
    { key: "on_call", points: 2, text: "" },
    { key: "unusual_amount", points: 2, text: "" },
  ],
  signals: {},
  answers: { q_phone: false, q_secret: false, q_online: false, q_chat: false },
  wait_until: null,
  pause_shown_at: new Date().toISOString(),
  continue_anyway_at: new Date(Date.now() + 30000).toISOString(),
  trusted_requested_at: null,
  trusted_timeout_at: null,
  trusted_decision: null,
  trusted_contact_name: "Daniel Tan",
  active_call_id: null,
  next_step: "pause",
  created_at: new Date().toISOString(),
  completed_at: null,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.className = "";
  setLanguage("en");
  mockFetch();
});
afterEach(() => vi.useRealTimers());

const renderPause = (tr: Transfer) =>
  renderApp(<TransferFlow />, { route: `/pay/${tr.id}`, path: "/pay/:id", seed: { [JSON.stringify(["transfer", tr.id])]: tr } });

describe("Pause screen", () => {
  it("shows the calm heading, the reasons and four full-width safe actions", () => {
    renderPause(base);
    expect(screen.getByRole("heading", { level: 1, name: "Let's pause this payment" })).toBeInTheDocument();
    expect(screen.getByText("Nothing has been sent. Your money is still safe.")).toBeInTheDocument();
    expect(screen.getByText("You have never paid this person or account before.")).toBeInTheDocument();
    expect(screen.getByText("This is much larger than your usual payments.")).toBeInTheDocument();
    for (const name of ["Cancel payment", "Save for later", "Call SafeBank in-app", "Ask my trusted contact"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("hides 'Continue anyway' until the 30-second countdown ends", () => {
    renderPause(base);
    expect(screen.getByText(/Continue anyway \(available in \d+ s\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue anyway" })).not.toBeInTheDocument();
  });

  it("after the countdown, opens the 'Are you sure?' sheet with Go back as the primary choice", () => {
    renderPause({ ...base, continue_anyway_at: new Date(Date.now() - 1000).toISOString() });
    fireEvent.click(screen.getByRole("button", { name: "Continue anyway" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Scammers often tell you to ignore warnings. Are you sure?")).toBeInTheDocument();
    const goBack = within(dialog).getByRole("button", { name: "Go back" });
    expect(goBack).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Send anyway" })).toBeInTheDocument();
  });

  it("disables 'Ask my trusted contact' with a plain explanation when none is set", () => {
    renderPause({ ...base, trusted_contact_name: null });
    expect(screen.getByRole("button", { name: "Add a trusted contact in Settings first" })).toBeDisabled();
  });
});

describe("Signal banners", () => {
  it("renders call, chat and screen-share alerts with text (not colour alone)", async () => {
    writeSim({ on_call: true, chatting: true, screen_sharing: true });
    renderApp(<SignalBanners />);
    const alerts = await screen.findAllByRole("alert");
    const text = alerts.map((a) => a.textContent).join(" ");
    expect(text).toContain("You're on a call. Scammers often stay on the line while you pay.");
    expect(text).toContain("Someone is messaging you about this payment.");
    expect(text).toContain("Your screen is being shared. Stop sharing before you pay.");
    alerts.forEach((a) => expect(a.querySelector("svg")).not.toBeNull());
  });

  it("shows nothing when there are no signals", async () => {
    writeSim({ on_call: false, chatting: false, screen_sharing: false, recent_call: false });
    renderApp(<SignalBanners />);
    await act(async () => undefined);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Language switch", () => {
  it("switches the UI to Chinese and sets <html lang>", async () => {
    renderApp(<><LanguageSelect id="l" showLabel /><TransferFlow /></>, {
      route: "/pay/7",
      path: "/pay/:id",
      seed: { [JSON.stringify(["transfer", 7])]: base },
    });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "zh" } });
    expect(await screen.findByRole("heading", { level: 1, name: "我们先暂停这笔付款" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("zh");
    expect(i18n.language).toBe("zh");
  });

  it("has every key from English in each other language (except demo strings)", async () => {
    const en = (await import("@safebank/ui/src/locales/en.json")).default as Record<string, unknown>;
    const flat = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    const enKeys = flat(en).filter((k) => !k.startsWith("demo.") && !k.startsWith("_meta"));
    for (const lng of ["zh", "ms", "ta"]) {
      const other = (await import(`@safebank/ui/src/locales/${lng}.json`)).default as Record<string, unknown>;
      const keys = new Set(flat(other));
      expect(enKeys.filter((k) => !keys.has(k))).toEqual([]);
    }
  });
});

describe("Easy Mode", () => {
  it("toggling Easy Mode adds the 'easy' class (bigger text, taller buttons)", async () => {
    renderApp(<Settings />);
    const sw = screen.getByRole("switch", { name: "Easy Mode" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.classList.contains("easy")).toBe(true);
  });

  it("dark mode option adds the 'dark' class", () => {
    renderApp(<Settings />);
    fireEvent.click(screen.getByLabelText("Dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
