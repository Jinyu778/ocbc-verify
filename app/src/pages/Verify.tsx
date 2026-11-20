import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BadgeCheck, PhoneCall, RefreshCw, ShieldX } from "lucide-react";
import { Banner, Button, Skeleton, VerdictStage, api } from "@/design";
import { Screen } from "../components/Screen";
import { ReadAloud } from "../components/ReadAloud";
import { OfficialContacts } from "../components/OfficialContacts";
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
        <div role="status">
          <VerdictStage tone="verified" icon={BadgeCheck} title={t("verify.genuine")} checkingLabel={t("check.checking")}>
            <p className="text-lg font-medium">{t("verify.genuineBody", { name: q.data!.call!.staff?.display_name })}</p>
            <ReadAloud text={`${t("verify.genuine")}. ${t("verify.genuineBody", { name: q.data!.call!.staff?.display_name })}`} />
          </VerdictStage>
          <Button data-after-stage block size="lg" className="mt-4" onClick={() => nav(`/customer/call/${q.data!.call!.id}`)}>{t("verify.open")}</Button>
        </div>
      ) : (
        <div role="alert">
          <VerdictStage tone="risk" icon={ShieldX} title={t("verify.notCalling")} checkingLabel={t("check.checking")}>
            <p className="text-lg font-medium">{t("verify.notCallingBody")}</p>
            <ReadAloud text={`${t("verify.notCalling")} ${t("verify.notCallingBody")}`} />
          </VerdictStage>
        </div>
      )}
      <div data-after-stage className="flex flex-col gap-3">
        <Button
          icon={PhoneCall}
          block
          variant={genuine ? "outline" : "primary"}
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
      {/* A real OCBC call shows up above. Anyone else (MAS, police, "family") is checked by calling back. */}
      <div data-after-stage>
        <OfficialContacts />
      </div>
    </Screen>
  );
}
