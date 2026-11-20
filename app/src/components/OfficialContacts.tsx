import { useTranslation } from "react-i18next";
import { Phone, PhoneOff, Users } from "lucide-react";
import { Card, cx } from "@/design";
import { OFFICIAL_CONTACTS, type CallBackTarget } from "../lib/officialContacts";
import { ReadAloud } from "./ReadAloud";

/**
 * "Hang up. Call back on a number you already know."
 * A voice, caller ID, photo or video can be faked with AI, so an inbound contact is never proof.
 * Every number here is built into the app; none comes from the caller.
 */
export function OfficialContacts({ onPick, className }: { onPick?: (target: CallBackTarget) => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <Card className={cx("space-y-3", className)} aria-labelledby="callback-title">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-danger-soft text-danger">
          <PhoneOff className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="callback-title" className="text-lg">{t("callback.title")}</h2>
          <p className="mt-1">{t("callback.body")}</p>
        </div>
      </div>
      <ul className="space-y-2">
        {OFFICIAL_CONTACTS.map((c) => (
          <li key={c.target}>
            <a
              href={`tel:${c.tel}`}
              onClick={() => onPick?.(c.target)}
              className="sb-press flex min-h-btn items-center gap-3 rounded-btn border border-border-strong bg-card px-3 py-2 text-foreground no-underline hover:bg-muted"
            >
              <Phone aria-hidden className="h-5 w-5 shrink-0 text-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {t(`callback.${c.target}`)} <span className="tabular whitespace-nowrap">{c.number}</span>
                </span>
                <span className="block text-sm text-muted-foreground">{t(`callback.${c.target}Note`)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-2">
        <Users aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
        <span>
          <strong>{t("callback.family")}</strong> {t("callback.familyNote")}
        </span>
      </p>
      <ReadAloud text={`${t("callback.title")} ${t("callback.body")} ${t("callback.family")} ${t("callback.familyNote")}`} />
    </Card>
  );
}
