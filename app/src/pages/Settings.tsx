import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Info, LogOut, PhoneCall, UserPlus, Users } from "lucide-react";
import { ApiError, Banner, Button, Card, Field, Skeleton, api, cx, formatMinutes } from "@/design";
import { usePrefs, type TextSize, type Theme } from "../state/prefs";
import { savePrefsToServer, useSession } from "../state/session";
import { LanguageSelect } from "../components/Layout";
import { Screen } from "../components/Screen";
import { setGuideDone } from "./Guide";
import { signalProvider, type PermissionStatus } from "../signals";
import { CodeWordCard, ContactCodeWords } from "../components/CodeWord";

function Toggle({ id, label, desc, checked, onChange }: { id: string; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        {desc && <p id={`${id}-d`} className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={desc ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className={cx("relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors duration-200", checked ? "border-accent bg-accent" : "border-border-strong bg-muted")}
      >
        <span className={cx("inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-6" : "translate-x-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

function Segmented<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => (
          <label key={o.v} className={cx("flex min-h-touch cursor-pointer items-center justify-center rounded-btn border-2 px-2 text-center font-medium", value === o.v ? "border-accent bg-accent text-on-accent" : "border-border-strong bg-card")}>
            <input type="radio" className="sr-only" name={legend} checked={value === o.v} onChange={() => onChange(o.v)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface TC {
  id: number;
  contact_display_name: string;
  contact_username: string;
  relationship: string;
  active_from: string;
  pending_removal_at: string | null;
  is_active: boolean;
}

function TrustedContacts() {
  const { t, i18n } = useTranslation();
  const { config } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["trusted"], queryFn: () => api<{ contacts: TC[]; change_delay_hours: number }>("/api/me/trusted-contacts") });
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState("");
  const [rel, setRel] = useState("parent");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const contacts = q.data?.contacts ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErr(t("settings.contactUsername"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api<TC>("/api/me/trusted-contacts", { method: "POST", body: { contact_username: username, relationship: rel } });
      setMsg(t("settings.saved", { note: r.is_active ? t("settings.activeNow") : t("settings.pendingActive", { when: fmt(r.active_from) }) }));
      setAdding(false);
      setUsername("");
      qc.invalidateQueries({ queryKey: ["trusted"] });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg"><Users aria-hidden className="h-5 w-5" />{t("settings.trustedContact")}</h2>
      <p className="text-sm text-muted-foreground">{t("settings.trustedHelper")}</p>
      {q.isLoading ? <Skeleton className="h-16" label={t("common.loading")} /> : contacts.length === 0 ? <p>{t("settings.noContact")}</p> : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-border p-3">
              <div>
                <p className="font-semibold">{c.contact_display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`settings.relationships.${c.relationship}`)} ·{" "}
                  {c.pending_removal_at
                    ? t("settings.pendingRemoval", { when: fmt(c.pending_removal_at) })
                    : c.is_active
                      ? t("settings.activeNow")
                      : t("settings.pendingActive", { when: fmt(c.active_from) })}
                </p>
              </div>
              {!c.pending_removal_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await api(`/api/me/trusted-contacts/${c.id}`, { method: "DELETE" });
                    qc.invalidateQueries({ queryKey: ["trusted"] });
                  }}
                >
                  {t("settings.remove")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <Banner tone="success">{msg}</Banner>}
      <Banner tone="info" icon={Info}>
        {t("settings.delayNotice", { time: formatMinutes(t, config?.contact_change_cooling_minutes ?? 1440) })}
      </Banner>
      {adding ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label={t("settings.contactUsername")} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" error={err} />
          <div>
            <label htmlFor="rel" className="mb-1 block font-semibold">{t("settings.relationship")}</label>
            <select id="rel" value={rel} onChange={(e) => setRel(e.target.value)} className="min-h-btn w-full rounded-btn border-2 border-border-strong bg-card px-3 text-foreground">
              {["parent", "child", "sibling", "spouse", "friend", "other"].map((r) => (
                <option key={r} value={r}>{t(`settings.relationships.${r}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>{t("settings.save")}</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" icon={UserPlus} onClick={() => setAdding(true)}>
          {contacts.some((c) => c.is_active) ? t("settings.changeContact") : t("settings.addContact")}
        </Button>
      )}
    </Card>
  );
}

function CallDetection() {
  const { t } = useTranslation();
  const [perm, setPerm] = useState<PermissionStatus | null>(null);
  useEffect(() => {
    signalProvider.permission().then(setPerm);
  }, []);
  const status = signalProvider.kind === "browser" ? "browser" : perm === "granted" ? "native" : perm === "unavailable" ? "unavailable" : "denied";
  return (
    <Card className="space-y-2">
      <h2 className="flex items-center gap-2 text-lg"><PhoneCall aria-hidden className="h-5 w-5" />{t("settings.callDetection")}</h2>
      <p>{t("settings.callDetectionDesc")}</p>
      <p className="font-semibold">{t("settings.callDetectionStatus", { status: t(`settings.callStatus.${status}`) })}</p>
      {signalProvider.kind === "native" && perm !== "granted" && (
        <div className="space-y-2 rounded-btn bg-muted p-3">
          <p className="font-semibold">{t("signals.permissionTitle")}</p>
          <p>{t("signals.permissionBody")}</p>
          <Button onClick={async () => setPerm(await signalProvider.requestPermission())}>{t("signals.allow")}</Button>
        </div>
      )}
    </Card>
  );
}

export function Settings() {
  const { t } = useTranslation();
  const { prefs, update } = usePrefs();
  const { user, logout } = useSession();
  const nav = useNavigate();
  const customer = user?.role === "customer";
  return (
    <Screen title={t("settings.title")}>
      <Card className="space-y-5">
        <h2 className="text-lg">{t("settings.display")}</h2>
        <LanguageSelect id="lang-settings" showLabel />
        <Toggle
          id="easy"
          label={t("settings.easyMode")}
          desc={t("settings.easyModeDesc")}
          checked={prefs.easy}
          onChange={(v) => {
            update({ easy: v });
            savePrefsToServer({ easy_mode: v });
          }}
        />
        <Toggle id="read" label={t("settings.readAloud")} desc={t("settings.readAloudDesc")} checked={prefs.readAloud} onChange={(v) => update({ readAloud: v })} />
        <Segmented<TextSize>
          legend={t("settings.textSize")}
          value={prefs.textSize}
          onChange={(v) => update({ textSize: v })}
          options={(["s", "m", "l", "xl"] as const).map((v) => ({ v, label: t(`settings.sizes.${v}`) }))}
        />
        <Segmented<Theme>
          legend={t("settings.darkMode")}
          value={prefs.theme}
          onChange={(v) => update({ theme: v })}
          options={(["system", "light", "dark"] as const).map((v) => ({ v, label: t(`settings.theme.${v}`) }))}
        />
      </Card>
      {customer && <TrustedContacts />}
      {customer && <CodeWordCard />}
      {user?.role === "trusted_contact" && <ContactCodeWords />}
      {customer && <CallDetection />}
      <Card className="space-y-3">
        <h2 className="text-lg">{t("settings.account")}</h2>
        <p className="text-muted-foreground">{user?.display_name} ({user?.username})</p>
        {customer && (
          <Button
            variant="outline"
            icon={BookOpen}
            block
            onClick={() => {
              if (user) setGuideDone(user.username, false);
              nav("/customer/guide");
            }}
          >
            {t("settings.replayGuide")}
          </Button>
        )}
        <Button
          variant="outline"
          icon={LogOut}
          block
          onClick={() => {
            logout();
            nav("/login");
          }}
        >
          {t("common.signOut")}
        </Button>
      </Card>
    </Screen>
  );
}
