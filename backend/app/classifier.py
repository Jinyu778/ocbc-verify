"""'Is this real?' message checker: rule layer + ML layer (TF-IDF + logistic regression)."""

from __future__ import annotations

import csv
import json
import re
import threading
from dataclasses import dataclass
from pathlib import Path

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATASET = DATA_DIR / "messages.csv"
MODEL_PATH = DATA_DIR / "model.joblib"
METRICS_PATH = DATA_DIR / "model_metrics.json"


@dataclass(frozen=True)
class Rule:
    key: str
    pattern: re.Pattern
    strong: bool
    explanation: str
    requires: tuple = ()  # extra patterns that must ALL also appear somewhere in the message


def _r(p: str) -> re.Pattern:
    return re.compile(p, re.IGNORECASE)


RULES: list[Rule] = [
    Rule("safe_account", _r(r"safe(ty)?[\s-]*account|protected account|government safety|安全账户|akaun selamat"), True,
         "No real bank, MAS or police officer will ever ask you to move money to a 'safe account'."),
    Rule("authority", _r(r"\b(MAS|monetary authority|police|court|warrant|ministry|ICA|inspector|officer|arrest|investigation)\b|警察|逮捕令|金融管理局|polis|waran|pegawai"), False,
         "Scammers pretend to be from MAS, the police or the courts to scare you."),
    Rule("secrecy", _r(r"(do ?n[o']t|don't) (tell|inform)|keep (it |this )?(secret|confidential)|confidential|\bNDA\b|保密|不要告诉|rahsia|jangan beritahu"), True,
         "Being told to keep a payment secret is a big warning sign."),
    Rule("credentials", _r(r"\b(OTP|PIN|password|passcode|6-digit code|one-time|login details)\b|验证码|kod OTP|your login"), True,
         "Never share your OTP, PIN or password. OCBC will never ask for them."),
    Rule("install_app", _r(r"install (the |this )?app|download (the |this )?app|\.apk\b|remote access"), True,
         "Installing an app from a link can let scammers control your phone."),
    Rule("link", _r(r"https?://\S+|www\.\S+|\b[\w-]+\.(info|top|xyz|cc|online|click|shop|work|win)\b"), False,
         "Links in messages can lead to fake websites that steal your details."),
    Rule("urgency", _r(r"\burgent(ly)?\b|immediately|right now|\bnow\b|within (2|24) hours|today|limited (time|slots)|quickly|马上|立即|急需|segera"), False,
         "Scammers rush you so you don't have time to think or check."),
    Rule("gift_crypto_gold", _r(r"gift ?cards?|bitcoin|crypto|\bUSDT\b|gold bars?|investment slot|guaranteed (profit|\d+%)|保证|回报"), True,
         "Requests for gift cards, crypto or gold, or 'guaranteed' profits, are common scams."),
    Rule("upfront_fee", _r(r"deposit|upfront|registration fee|training fee|processing fee|top ?up .{0,20}(unlock|commission)|押金|bayar deposit"), True,
         "Real jobs and prizes never ask you to pay a fee first."),
    Rule("earn_per_day", _r(r"earn \$?\d[\d,]*\s*(per|a|/)\s*(day|week|hour)|\$\d[\d,]*\s*(per|/)\s*(day|hour)|\$\d+-\$\d+ daily|每天赚|sehari"), True,
         "Offers to 'earn $X per day' for easy tasks are almost always scams."),
    Rule("move_chat", _r(r"telegram|whatsapp (us|me)|add me on|move to (telegram|whatsapp)|加我"), False,
         "Scammers move you to Telegram or WhatsApp where they are harder to trace."),
    Rule("paynow_first", _r(r"pay ?now (first|deposit)|transfer first|no meet ?up|no COD|先.{0,4}付款|不见面|tiada jumpa|PayNow dahulu"), True,
         "'Pay first, no meetup' is how most online shopping and ticket scams work."),
    Rule("preorder_scam", _r(r"\bpre-?\s?orders?\b|预购|预订|pra-?tempah"), True,
         "A 'pre-order' you must pay for first, with no meetup, is a common collectibles scam (e.g. Pokémon cards).",
         requires=(_r(r"pay ?now|transfer|deposit|先.{0,4}付款|bayar"),
                   _r(r"no meet ?-?ups?|cannot meet|can't meet|不见面|tiada jumpa"))),
    Rule("family_new_number", _r(r"new number|my phone (broke|is broken)|lost my phone|换了新号码|nombor baru|in trouble|bail money"), True,
         "A 'family member' with a new number asking for money: call their old number first."),
]

STRONG_KEYS = {r.key for r in RULES if r.strong}


def apply_rules(text: str) -> list[dict]:
    flags: list[dict] = []
    for rule in RULES:
        if rule.requires and not all(r.search(text) for r in rule.requires):
            continue
        spans = [(m.start(), m.end()) for m in rule.pattern.finditer(text) if m.end() > m.start()]
        if spans:
            flags.append({"key": rule.key, "strong": rule.strong, "explanation": rule.explanation,
                          "spans": spans[:5], "phrases": list({text[a:b] for a, b in spans})[:5]})
    return flags


# ---------------------------------------------------------------------------------- ML layer
def load_dataset(path: Path = DATASET, with_groups: bool = False):
    texts, labels, groups = [], [], []
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            texts.append(row["text"])
            labels.append(1 if row["label"] == "scam" else 0)
            groups.append(row.get("template_id", ""))
    return (texts, labels, groups) if with_groups else (texts, labels)


def grouped_metrics() -> dict:
    """Harder test: whole templates are held out, so the model never saw the sentence shape."""
    from sklearn.model_selection import GroupShuffleSplit

    texts, labels, groups = load_dataset(with_groups=True)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=7).split(texts, labels, groups))
    pipe = build_pipeline().fit([texts[i] for i in tr], [labels[i] for i in tr])
    y_te = [labels[i] for i in te]
    pred = pipe.predict([texts[i] for i in te])
    return {"n_test": len(te), "accuracy": round(accuracy_score(y_te, pred), 3),
            "precision_scam": round(precision_score(y_te, pred), 3),
            "recall_scam": round(recall_score(y_te, pred), 3)}


def build_pipeline() -> Pipeline:
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=2, sublinear_tf=True)),
    ])
    return Pipeline([("features", features), ("clf", LogisticRegression(max_iter=2000, C=4.0, class_weight="balanced"))])


def train(save: bool = True) -> dict:
    texts, labels = load_dataset()
    x_tr, x_te, y_tr, y_te = train_test_split(texts, labels, test_size=0.25, random_state=7, stratify=labels)
    pipe = build_pipeline().fit(x_tr, y_tr)
    pred = pipe.predict(x_te)
    metrics = {
        "n_total": len(texts), "n_train": len(x_tr), "n_test": len(x_te),
        "accuracy": round(accuracy_score(y_te, pred), 3),
        "precision_scam": round(precision_score(y_te, pred), 3),
        "recall_scam": round(recall_score(y_te, pred), 3),
        "grouped_by_template": grouped_metrics(),
    }
    final = build_pipeline().fit(texts, labels)  # ship a model trained on all data
    if save:
        joblib.dump(final, MODEL_PATH)
        METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    return metrics


_model = None
_lock = threading.Lock()


def get_model():
    global _model
    with _lock:
        if _model is None:
            if not MODEL_PATH.exists():
                train(save=True)
            _model = joblib.load(MODEL_PATH)
        return _model


def ml_probability(text: str) -> float:
    return float(get_model().predict_proba([text])[0][1])


def verdict_for(flags: list[dict], p: float) -> str:
    strong = [f for f in flags if f["strong"]]
    if (strong and (p >= 0.5 or len(flags) >= 2)) or p >= 0.85:
        return "likely_scam"
    if not strong and 0.4 <= p <= 0.6:
        return "not_sure"
    if flags and (strong or p >= 0.3 or len(flags) >= 2) or p > 0.6:
        return "be_careful"
    return "no_signs"


def check(text: str) -> dict:
    flags = apply_rules(text)
    p = ml_probability(text)
    return {"flags": flags, "ml_probability": round(p, 3), "verdict": verdict_for(flags, p)}


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
