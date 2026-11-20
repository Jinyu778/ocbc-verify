/** Small fetch client: 5-second timeout, bearer tokens per browser tab, one silent refresh. */

export type Role = "customer" | "trusted_contact" | "staff";
export interface User {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  age: number | null;
  preferred_language: "en" | "zh" | "ms" | "ta";
  easy_mode: boolean;
}
interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
}

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/**
 * Where the API lives.
 *  - VITE_API_URL if set (e.g. the Android app pointing at a laptop on the LAN).
 *  - GitHub Codespaces (*.app.github.dev): each port has its own address, so the app calls its own
 *    origin and the Vite dev server forwards /api (and the WebSocket) to the backend.
 *  - Hosted (Render etc.): the page is on a standard port (80/443, so location.port is empty) and the API shares
 *    its origin, so the app calls its own origin.
 *  - Otherwise the same host on port 8000 (local development).
 */
export function apiBaseFor(loc: { protocol: string; hostname: string; origin: string; port?: string } | undefined, configured?: string): string {
  if (configured) return configured;
  if (!loc) return "http://localhost:8000";
  if (loc.hostname.endsWith(".app.github.dev")) return loc.origin;
  if (loc.port === "" && loc.hostname !== "localhost" && loc.hostname !== "127.0.0.1") return loc.origin;
  return `${loc.protocol}//${loc.hostname}:8000`;
}
export const API_BASE: string = apiBaseFor(typeof location !== "undefined" ? location : undefined, env.VITE_API_URL);

export const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  status: number;
  field?: string | null;
  kind: "http" | "offline" | "timeout";
  constructor(message: string, status: number, kind: ApiError["kind"] = "http", field?: string | null) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.field = field;
  }
  get unreachable() {
    return this.kind !== "http" || this.status >= 502;
  }
}

let storageKey = "sb.session";
export function setSessionNamespace(ns: string) {
  storageKey = `sb.session.${ns}`;
}

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  try {
    const raw = store()?.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null) {
  try {
    if (s) store()?.setItem(storageKey, JSON.stringify(s));
    else store()?.removeItem(storageKey);
  } catch {
    /* storage blocked: session lives in memory only for this page */
  }
  listeners.forEach((l) => l(s));
}
type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();
export function onSessionChange(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

async function rawFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new ApiError("The server took too long to answer.", 0, "timeout");
    }
    throw new ApiError("We can't reach OCBC right now.", 0, "offline");
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefresh(): Promise<boolean> {
  const s = getSession();
  if (!s) return false;
  try {
    const r = await rawFetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    }, DEFAULT_TIMEOUT_MS);
    if (!r.ok) return false;
    saveSession(await r.json());
    return true;
  } catch {
    return false;
  }
}

export interface RequestOpts {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, auth = true } = opts;
  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const s = getSession();
    if (auth && s) headers.Authorization = `Bearer ${s.access_token}`;
    return rawFetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, timeoutMs);
  };
  let res = await doFetch();
  if (res.status === 401 && auth && getSession()) {
    if (await tryRefresh()) res = await doFetch();
    else saveSession(null);
  }
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* not json */
    }
    if (detail && typeof detail === "object" && "message" in (detail as Record<string, unknown>)) {
      const d = detail as { message: string; field?: string };
      throw new ApiError(d.message, res.status, "http", d.field);
    }
    const msg = typeof detail === "string" ? detail : res.status >= 500 ? "Something went wrong at OCBC." : `Request failed (${res.status}).`;
    throw new ApiError(msg, res.status, "http");
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function apiText(path: string): Promise<string> {
  const s = getSession();
  const res = await rawFetch(path, { headers: s ? { Authorization: `Bearer ${s.access_token}` } : {} }, 10000);
  if (!res.ok) throw new ApiError("Could not load the document.", res.status);
  return res.text();
}

export async function login(username: string, password: string): Promise<User> {
  const s = await api<Session>("/api/auth/login", { method: "POST", body: { username, password }, auth: false });
  saveSession(s);
  return s.user;
}
export function logout() {
  saveSession(null);
}

/** Real values from the server's .env; the UI displays them as they are. */
export interface AppConfig {
  save_for_later_options_minutes: number[];
  trusted_contact_timeout_minutes: number;
  contact_change_cooling_minutes: number;
  continue_anyway_seconds: number;
  hang_up_wait_minutes: number;
}
export const getConfig = () => api<AppConfig>("/api/config", { auth: false });
