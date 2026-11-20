import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { ApiError, Banner, Button, Card, Field, SectionTitle, Skeleton, api } from "@/design";

/** Form that sends a code word. The word is never shown back: the server only says whether one is set. */
function CodeWordForm({ id, isSet, save }: { id: string; isSet: boolean; save: (word: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [word, setWord] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (word.trim().length < 3) return setErr(t("codeWord.errLength"));
    setBusy(true);
    setErr(null);
    try {
      await save(word);
      setWord("");
      setDone(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t("common.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <p className="flex items-center gap-2 font-semibold">
        {isSet ? <CheckCircle2 aria-hidden className="h-5 w-5 text-success" /> : <KeyRound aria-hidden className="h-5 w-5 text-muted-foreground" />}
        {isSet ? t("codeWord.isSet") : t("codeWord.notSet")}
      </p>
      <Field
        id={id}
        label={isSet ? t("codeWord.change") : t("codeWord.label")}
        helper={t("codeWord.helper")}
        type={show ? "text" : "password"}
        autoComplete="off"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        error={err}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        className="inline-flex min-h-touch items-center gap-2 rounded-btn px-2 text-sm font-semibold text-foreground hover:bg-muted"
      >
        {show ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
        {show ? t("codeWord.hide") : t("codeWord.show")}
      </button>
      {done && <Banner tone="success">{t("codeWord.saved")}</Banner>}
      <Button type="submit" variant="success" icon={KeyRound} loading={busy}>
        {t("codeWord.save")}
      </Button>
    </form>
  );
}

/** Customer Settings: set or change the family code word. */
export function CodeWordCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["code-word"], queryFn: () => api<{ is_set: boolean }>("/api/me/code-word") });
  return (
    <Card className="space-y-3">
      <SectionTitle icon={KeyRound} tone="amber">{t("codeWord.title")}</SectionTitle>
      <p>{t("codeWord.intro")}</p>
      {q.isLoading ? (
        <Skeleton className="h-24" label={t("common.loading")} />
      ) : (
        <CodeWordForm
          id="code-word"
          isSet={!!q.data?.is_set}
          save={async (word) => {
            await api("/api/me/code-word", { method: "PUT", body: { code_word: word } });
            qc.invalidateQueries({ queryKey: ["code-word"] });
          }}
        />
      )}
    </Card>
  );
}

/** Trusted-contact Settings: set the code word for each person they look after. */
export function ContactCodeWords() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["contact-customers"],
    queryFn: () => api<{ id: number; display_name: string; code_word_is_set: boolean }[]>("/api/trusted/customers"),
  });
  return (
    <Card className="space-y-3">
      <SectionTitle icon={KeyRound} tone="amber">{t("codeWord.title")}</SectionTitle>
      <p>{t("codeWord.introContact")}</p>
      {q.isLoading ? (
        <Skeleton className="h-24" label={t("common.loading")} />
      ) : !q.data?.length ? (
        <p className="text-muted-foreground">{t("contact.none")}</p>
      ) : (
        q.data.map((c) => (
          <div key={c.id} className="space-y-2 rounded-btn border border-border p-3">
            <p className="font-semibold">{c.display_name}</p>
            <CodeWordForm
              id={`code-word-${c.id}`}
              isSet={c.code_word_is_set}
              save={async (word) => {
                await api(`/api/trusted/customers/${c.id}/code-word`, { method: "PUT", body: { code_word: word } });
                qc.invalidateQueries({ queryKey: ["contact-customers"] });
              }}
            />
          </div>
        ))
      )}
    </Card>
  );
}
