import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PauseCircle, PhoneCall, ShieldOff } from "lucide-react";
import { Button, Card } from "@/design";
import { useSession } from "../state/session";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";

const key = (u: string) => `sb.guide.done.${u}`;
export function guideDone(username: string) {
  try {
    return localStorage.getItem(key(username)) === "1";
  } catch {
    return true;
  }
}
export function setGuideDone(username: string, done = true) {
  try {
    if (done) localStorage.setItem(key(username), "1");
    else localStorage.removeItem(key(username));
  } catch {
    /* ignore */
  }
}

export function Guide() {
  const { t } = useTranslation();
  const { user } = useSession();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const cards = [
    { icon: PauseCircle, title: t("guide.c1Title"), body: t("guide.c1Body") },
    { icon: ShieldOff, title: t("guide.c2Title"), body: t("guide.c2Body") },
    { icon: PhoneCall, title: t("guide.c3Title"), body: t("guide.c3Body") },
  ];
  const finish = () => {
    if (user) setGuideDone(user.username);
    nav("/customer", { replace: true });
  };
  const c = cards[i];
  const Icon = c.icon;
  return (
    <Screen title={t("guide.label")}>
      <p className="text-muted-foreground" aria-live="polite">
        {t("guide.step", { n: i + 1, total: cards.length })}
      </p>
      <Card key={i} className="sb-fade-up space-y-4 text-center">
        <Icon aria-hidden className="mx-auto h-16 w-16 text-secondary" />
        <h2>{c.title}</h2>
        <p className="text-lg">{c.body}</p>
        <ReadAloud text={`${c.title}. ${c.body}`} className="mx-auto" />
      </Card>
      <div className="flex flex-col gap-3">
        {i < cards.length - 1 ? (
          <Button block size="lg" onClick={() => setI(i + 1)}>
            {t("guide.next")}
          </Button>
        ) : (
          <Button block size="lg" onClick={finish}>
            {t("guide.done")}
          </Button>
        )}
        {i > 0 && (
          <Button variant="outline" block onClick={() => setI(i - 1)}>
            {t("common.back")}
          </Button>
        )}
        {i < cards.length - 1 && (
          <Button variant="ghost" block onClick={finish}>
            {t("guide.skip")}
          </Button>
        )}
      </div>
    </Screen>
  );
}
