import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BadgeCheck, PhoneCall, RefreshCw, ShieldX } from "lucide-react";
import { Banner, Button, Card, Skeleton, api } from "@/design";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { startSafeBankCall } from "../lib/calls";
import type { CallInfo } from "../types";

export function Verify() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["verify"], queryFn: () => api<{ genuine: boolean; call: CallInfo | null }>("/api/calls/active"), staleTime: 0 });
  const genuine = q.data?.genuine && q.data.call;

  return (
    <Screen title={t("verify.title")} back="/customer">
      <p>{t("verify.intro")}</p>
      {q.isLoading || q.isFetching ? (
        <Skeleton className="h-40" label={t("common.loading")} />
      ) : q.isError ? (
        <Banner tone="warning" title={t("common.offlineTitle")}>{t("verify.notCallingBody")}</Banner>
      ) : genuine ? (
        <Card className="space-y-3 border-2 border-success text-center" role="status">
          <BadgeCheck aria-hidden className="mx-auto h-16 w-16 text-success" />
          <h2>{t("verify.genuine")}</h2>
          <p className="text-lg">{t("verify.genuineBody", { name: q.data!.call!.staff?.display_name })}</p>
          <ReadAloud text={`${t("verify.genuine")}. ${t("verify.genuineBody", { name: q.data!.call!.staff?.display_name })}`} className="mx-auto" />
          <Button block onClick={() => nav(`/customer/call/${q.data!.call!.id}`)}>{t("verify.open")}</Button>
        </Card>
      ) : (
        <Card className="space-y-3 border-2 border-danger text-center" role="alert">
          <ShieldX aria-hidden className="mx-auto h-16 w-16 text-danger" />
          <h2>{t("verify.notCalling")}</h2>
          <p className="text-lg">{t("verify.notCallingBody")}</p>
          <ReadAloud text={`${t("verify.notCalling")} ${t("verify.notCallingBody")}`} className="mx-auto" />
        </Card>
      )}
      <div className="flex flex-col gap-3">
        <Button
          icon={PhoneCall}
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              nav(`/customer/call/${(await startSafeBankCall(null)).id}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("verify.callUs")}
        </Button>
        <Button variant="outline" icon={RefreshCw} block onClick={() => q.refetch()}>
          {t("verify.checkAgain")}
        </Button>
      </div>
    </Screen>
  );
}
