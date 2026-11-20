"""'Is this real?' message checker: rule layer + ML layer (TF-IDF + logistic regression)."""

from __future__ import annotations

import csv
import json
import re
import threading
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import joblib
import yaml
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, brier_score_loss, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import GroupShuffleSplit, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATASET = DATA_DIR / "messages.csv"
MODEL_PATH = DATA_DIR / "model.joblib"
METRICS_PATH = DATA_DIR / "model_metrics.json"


# ------------------------------------------------------------------------------ rule layer
# The rules live in data/scam_patterns.yaml (every pattern cites a source) and
# data/official_domains.yaml (link allow-list). Nothing here ever opens or fetches a link.
@dataclass(frozen=True)
class Rule:
    key: str
    family: str
    scam_type: str | None
    critical: bool
    strong: bool
    weight: int
    pattern: re.Pattern
    explanation: str
    requires: tuple = ()  # extra patterns that must ALL also appear somewhere in the message
    unless_before: re.Pattern | None = None  # ignore a match preceded by this (protective advice)
    only_after: re.Pattern | None = None  # a match only counts when this request wording comes just before it
    channel: str | None = None
    source: str = ""


def _r(p: str) -> re.Pattern:
    return re.compile(p, re.IGNORECASE)


def _load_rules() -> tuple[list[Rule], dict]:
    pack = yaml.safe_load((DATA_DIR / "scam_patterns.yaml").read_text(encoding="utf-8"))
    rules = [Rule(
        key=p["id"], family=p["family"], scam_type=p.get("scam_type"), critical=bool(p.get("critical")),
        strong=bool(p.get("critical")) or p.get("weight", 1) >= 3, weight=p.get("weight", 1),
        pattern=_r(p["pattern"]), explanation=p["explanation"],
        requires=tuple(_r(x) for x in p.get("requires", [])),
        unless_before=_r(p["unless_before"] + r"$") if p.get("unless_before") and not p["unless_before"].endswith("$") else (_r(p["unless_before"]) if p.get("unless_before") else None),
        only_after=_r(p["only_after"]) if p.get("only_after") else None,
        channel=p.get("channel"), source=p.get("source", "")) for p in pack["patterns"]]
    return rules, pack


RULES, PACK = _load_rules()
SCAM_TYPES: dict = PACK["scam_types"]
FAMILIES: dict = PACK["families"]
STRONG_KEYS = {r.key for r in RULES if r.strong}
CRITICAL_KEYS = {r.key for r in RULES if r.critical}
RULE_BY_KEY = {r.key: r for r in RULES}
_DOMAINS = yaml.safe_load((DATA_DIR / "official_domains.yaml").read_text(encoding="utf-8"))
SHORTENERS = set(_DOMAINS["shorteners"])

ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿­"), None)
URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>\"')]+|\b(?:[a-z0-9-]+\.)+(?:com|sg|net|org|info|top|xyz|cc|online|click|shop|work|win|vip|icu|live|co|io|link|ly|gl|is)(?:/[^\s<>\"')]*)?", re.IGNORECASE)
SPACED_RE = re.compile(r"(?<![A-Za-z0-9])(?:[A-Za-z] ){3,}[A-Za-z](?![A-Za-z0-9])")


def normalise(text: str) -> tuple[str, list[int]]:
    """Layer 0. NFKC (full-width to normal), drop zero-width characters, undo hxxp / [.] obfuscation
    and spaced-out letters. Returns the clean text and, for each clean character, its index in the
    original text so highlights can still be drawn on what the customer pasted."""
    chars: list[str] = []
    index: list[int] = []
    for i, ch in enumerate(text):
        for c in unicodedata.normalize("NFKC", ch).translate(ZERO_WIDTH):
            chars.append(c)
            index.append(i)
    clean = "".join(chars)

    def collapse(m: re.Match) -> tuple[int, int, str]:
        return m.start(), m.end(), m.group().replace(" ", "")

    edits = [collapse(m) for m in SPACED_RE.finditer(clean)]
    for pat, rep in ((r"hxxp", "http"), (r"\[\.\]|\(\.\)|\s\(dot\)\s", "."), (r"\[:\]", ":")):
        for m in re.finditer(pat, clean, re.IGNORECASE):
            edits.append((m.start(), m.end(), rep))
    out_chars: list[str] = []
    out_index: list[int] = []
    pos = 0
    for a, b, rep in sorted(edits):
        if a < pos:
            continue
        out_chars.extend(clean[pos:a]); out_index.extend(index[pos:a])
        out_chars.extend(rep); out_index.extend([index[a]] * len(rep))
        pos = b
    out_chars.extend(clean[pos:]); out_index.extend(index[pos:])
    return "".join(out_chars), out_index


def _edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _registered(host: str) -> str:
    parts = host.split(".")
    return ".".join(parts[-3:] if len(parts) >= 3 and parts[-2] in {"com", "gov", "org", "edu", "co"} else parts[-2:])


def _is_official(host: str) -> bool:
    for org in _DOMAINS["organisations"]:
        for d in org["domains"]:
            if host == d or host.endswith("." + d):
                return True
    return False


def _claimed_org(text_lower: str) -> dict | None:
    for org in _DOMAINS["organisations"]:
        if any(re.search(rf"\b{re.escape(k)}\b", text_lower) for k in org["keywords"]):
            return org
    return None


def link_findings(text: str) -> list[dict]:
    """Entity checks on every link in the text, as text only. Returns {key, span, explanation}."""
    found: list[dict] = []
    low = text.lower()
    for m in URL_RE.finditer(text):
        raw = m.group().rstrip(".,;")
        host = re.sub(r"^(https?://)?(www\.)?", "", raw.lower()).split("/")[0].split("?")[0].split(":")[0]
        span = (m.start(), m.start() + len(raw))
        if host in SHORTENERS:
            found.append({"key": "short_link", "span": span, "explanation": "A shortened link hides where it really goes. Real banks and agencies do not hide their links."})
        elif re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", host):
            found.append({"key": "lookalike_link", "span": span, "explanation": "This link is a bare number address, not a normal website name."})
        elif "xn--" in host or _lookalike(host):
            found.append({"key": "lookalike_link", "span": span, "explanation": "This link looks like an official website but is not the real address. We did not open it."})
        elif not _is_official(host):
            org = _claimed_org(low)
            # Government is checked by the domain itself (_lookalike); words like "MOM" or "MAS" are too common to treat as a claim.
            if org and org["name"] != "Singapore Government" and not any(host.endswith(d) for d in org["domains"]):
                found.append({"key": "lookalike_link", "span": span, "explanation": f"The message says it is from {org['name']}, but the link is not {org['name']}'s website."})
    return found


def _lookalike(host: str) -> bool:
    if _is_official(host):
        return False
    reg = _registered(host)
    for org in _DOMAINS["organisations"]:
        for d in org["domains"]:
            if 0 < _edit_distance(reg, d) <= 2 and len(d) > 6:
                return True
        label = host.split(".")[0]
        if any(k in re.split(r"[-_.]", host) or (len(k) > 3 and k in label) for k in org["keywords"]) and not _is_official(host):
            if org["name"] != "Singapore Government" or "gov" in host:
                return True
    return False


def _unless(rule: Rule, text: str, start: int) -> bool:
    before = text[max(0, start - 70):start]
    return bool(rule.unless_before and rule.unless_before.search(before)) or bool(rule.only_after and not rule.only_after.search(before))


def apply_rules(text: str, source: str | None = None) -> list[dict]:
    clean, index = normalise(text)

    def to_original(a: int, b: int) -> tuple[int, int]:
        return index[a], index[min(b, len(index)) - 1] + 1

    flags: list[dict] = []
    for rule in RULES:
        if rule.channel and rule.channel != source:
            continue
        if rule.requires and not all(r.search(clean) for r in rule.requires):
            continue
        spans = [to_original(m.start(), m.end()) for m in rule.pattern.finditer(clean)
                 if m.end() > m.start() and not _unless(rule, clean, m.start())]
        if spans:
            flags.append({"key": rule.key, "strong": rule.strong, "critical": rule.critical, "family": rule.family,
                          "scam_type": rule.scam_type, "explanation": rule.explanation, "source": rule.source,
                          "spans": spans[:5], "phrases": list({text[a:b] for a, b in spans})[:5]})
    for lf in link_findings(clean):
        a, b = to_original(*lf["span"])
        flags.append({"key": lf["key"], "strong": lf["key"] == "lookalike_link", "critical": False, "family": "mismatch",
                      "scam_type": "phishing", "explanation": lf["explanation"], "source": "GovTech TechNews 30 Jul 2024",
                      "spans": [(a, b)], "phrases": [text[a:b]]})
    # Channel rule: Singapore banks and SingPost have not sent clickable links by SMS since early 2022.
    if source == "sms" and _claimed_org(clean.lower()) and any(f["key"] in {"link", "lookalike_link", "short_link"} for f in flags):
        spans = [s for f in flags if f["key"] in {"link", "lookalike_link", "short_link"} for s in f["spans"]]
        flags.append({"key": "bank_sms_link", "strong": True, "critical": True, "family": "mismatch", "scam_type": "phishing",
                      "explanation": "Singapore banks and SingPost stopped sending clickable links in SMS in 2022, so an SMS like this with a link is a strong warning sign.",
                      "source": "MAS and ABS, 19 Jan 2022; GovTech TechNews 30 Jul 2024", "spans": spans[:3], "phrases": []})
    return flags


LOCAL_ORG_RE = _r(r"\b(ocbc|dbs|posb|uob|singpost|singapore post|police|spf|mas|iras|cpf|ica|mom|singpass|gov|ministry|town council|sp group)\b")


def sender_flags(text: str, sender: str | None, claimed: str | None) -> list[dict]:
    """Checks on what the customer typed about the sender. We never read their inbox or contacts."""
    flags: list[dict] = []
    claim = f"{claimed or ''} {text}"
    sender = (sender or "").strip()
    if sender and re.match(r"^\+(?!65)\d", sender.replace(" ", "")) and LOCAL_ORG_RE.search(claim):
        flags.append({"key": "foreign_sender", "strong": True, "critical": False, "family": "mismatch", "scam_type": "phishing",
                      "explanation": "The sender number has a foreign country code, but the message says it is from a Singapore organisation. (A +65 number is not proof either, because numbers can be faked.)",
                      "source": "GovTech TechNews 30 Jul 2024 (red flag: +63 number)", "spans": [], "phrases": [sender]})
    for generic, real in (("singapore post", "SingPost"), ("ocbc bank official", "OCBC"), ("dbs bank official", "DBS")):
        if claimed and generic in claimed.lower():
            flags.append({"key": "sender_name_mismatch", "strong": False, "critical": False, "family": "mismatch", "scam_type": "phishing",
                          "explanation": f"The sender calls itself \"{claimed.strip()}\", which is not how {real} names itself in messages.",
                          "source": "GovTech TechNews 30 Jul 2024 (red flag: 'Singapore Post' instead of 'SingPost')", "spans": [], "phrases": [claimed.strip()]})
            break
    if sender and "@" in sender and claimed:
        dom = sender.split("@")[-1].lower()
        for org in _DOMAINS["organisations"]:
            if any(re.search(rf"\b{re.escape(k)}\b", claimed.lower()) for k in org["keywords"]) and not any(dom == d or dom.endswith("." + d) for d in org["domains"]):
                flags.append({"key": "email_domain_mismatch", "strong": True, "critical": False, "family": "mismatch", "scam_type": "phishing",
                              "explanation": f"The email address does not end in {org['name']}'s own domain.",
                              "source": "ScamShield", "spans": [], "phrases": [sender]})
                break
    return flags


PROTECTIVE_RE = _r(r"(never|do not|don't|will not|won't)\s+(ask|share|send|disclose|click)|(we|bank|ocbc|dbs|uob)\s+(will\s+)?never|jangan kongsi|切勿|不会(向您)?索取")
PAYMENT_RE = _r(r"\$|s\$|sgd|paynow|transfer|pay\b|payment|deposit|fee\b|bank account|crypto|gift ?card|转账|付款")


def counter_evidence(text: str, flags: list[dict]) -> list[str]:
    """What looks normal about the message. Shown so "No obvious signs" is explained, never as proof of safety."""
    keys = {f["key"] for f in flags}
    out = []
    if not URL_RE.search(text):
        out.append("no_link")
    if not PAYMENT_RE.search(text):
        out.append("no_payment")
    if PROTECTIVE_RE.search(text):
        out.append("protective_advice")
    if "urgency" not in keys and "secrecy" not in keys:
        out.append("no_pressure")
    for m in URL_RE.finditer(text):
        host = re.sub(r"^(https?://)?(www\.)?", "", m.group().lower()).split("/")[0]
        if _is_official(host):
            out.append("official_domain")
            break
    return out


def scam_type_for(flags: list[dict]) -> str | None:
    """Name the likely scam type only when the evidence for one type is clear."""
    score: dict[str, int] = {}
    for f in flags:
        if f.get("scam_type"):
            rule = RULE_BY_KEY.get(f["key"])
            score[f["scam_type"]] = score.get(f["scam_type"], 0) + (rule.weight if rule else 2)
    if not score:
        return None
    best, top = max(score.items(), key=lambda kv: kv[1])
    critical_for_best = any(f.get("critical") and f.get("scam_type") == best for f in flags)
    return best if top >= 4 or (critical_for_best and top >= 3) else None


# ---------------------------------------------------------------------------------- ML layer
UNSEEN = DATA_DIR / "unseen_tactics.csv"


def load_rows(path: Path = DATASET) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_dataset(path: Path = DATASET, with_groups: bool = False):
    rows = load_rows(path)
    texts = [r["text"] for r in rows]
    labels = [1 if r["label"] == "scam" else 0 for r in rows]
    groups = [r.get("template_family", "") for r in rows]
    return (texts, labels, groups) if with_groups else (texts, labels)


def build_pipeline() -> Pipeline:
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True)),
    ])
    lr = LogisticRegression(max_iter=3000, C=4.0, class_weight="balanced")
    return Pipeline([("features", features), ("clf", CalibratedClassifierCV(lr, method="sigmoid", cv=5))])


def _scores(y: list[int], pred: list[int]) -> dict:
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {"accuracy": round(accuracy_score(y, pred), 3), "precision_scam": round(precision_score(y, pred, zero_division=0), 3),
            "recall_scam": round(recall_score(y, pred, zero_division=0), 3), "f1_scam": round(f1_score(y, pred, zero_division=0), 3),
            "false_positive_rate": round(fp / max(1, fp + tn), 3),
            "confusion_matrix": {"true_legit": int(tn), "false_scam": int(fp), "missed_scam": int(fn), "caught_scam": int(tp)}}


def _calibration(y: list[int], proba: list[float]) -> dict:
    bins = []
    for lo in (0.0, 0.2, 0.4, 0.6, 0.8):
        idx = [i for i, p in enumerate(proba) if lo <= p < lo + 0.2 or (lo == 0.8 and p == 1.0)]
        if idx:
            bins.append({"bin": f"{lo:.1f}-{lo + 0.2:.1f}", "n": len(idx), "mean_predicted": round(sum(proba[i] for i in idx) / len(idx), 3),
                         "share_scam": round(sum(y[i] for i in idx) / len(idx), 3)})
    return {"brier": round(brier_score_loss(y, proba), 4), "bins": bins}


def grouped_metrics() -> dict:
    """The honest test: whole template families are held out, so the model never saw the sentence shape."""
    rows = load_rows()
    texts, labels, groups = load_dataset(with_groups=True)
    tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=7).split(texts, labels, groups))
    pipe = build_pipeline().fit([texts[i] for i in tr], [labels[i] for i in tr])
    proba = list(pipe.predict_proba([texts[i] for i in te])[:, 1])
    pred = [int(p >= 0.5) for p in proba]
    y = [labels[i] for i in te]
    out = {"n_test": len(te), **_scores(y, pred), "calibration": _calibration(y, proba)}
    hard = [k for k, i in enumerate(te) if rows[i]["label"] == "legit" and rows[i]["difficulty"] == "hard"]
    out["hard_negative_false_positive_rate"] = round(sum(pred[k] for k in hard) / max(1, len(hard)), 3)
    out["n_hard_negatives"] = len(hard)
    per_type = {}
    for k, i in enumerate(te):
        st = rows[i]["scam_type"]
        if st:
            n, hit = per_type.get(st, (0, 0))
            per_type[st] = (n + 1, hit + pred[k])
    out["recall_by_scam_type"] = {st: {"n": n, "recall": round(hit / n, 3)} for st, (n, hit) in sorted(per_type.items())}
    out["checker"] = checker_metrics([rows[i] for i in te], proba)
    return out


def checker_metrics(rows: list[dict], proba: list[float]) -> dict:
    """What customers see (rules + model). "Flagged" = Likely scam or Be careful."""
    verdicts = [verdict_for(apply_rules(r["text"]), p) for r, p in zip(rows, proba)]
    y = [1 if r["label"] == "scam" else 0 for r in rows]
    out = _scores(y, [int(v in {"likely_scam", "be_careful"}) for v in verdicts])

    def share(pick, verdict_set):
        vs = [v for r, v in zip(rows, verdicts) if pick(r)]
        return round(sum(v in verdict_set for v in vs) / max(1, len(vs)), 3)

    out["legit_shown_likely_scam"] = share(lambda r: r["label"] == "legit", {"likely_scam"})
    out["legit_shown_be_careful"] = share(lambda r: r["label"] == "legit", {"be_careful"})
    out["hard_negative_shown_likely_scam"] = share(lambda r: r["label"] == "legit" and r.get("difficulty") == "hard", {"likely_scam"})
    out["hard_negative_flagged"] = share(lambda r: r["label"] == "legit" and r.get("difficulty") == "hard", {"likely_scam", "be_careful"})
    out["scam_shown_likely_scam"] = share(lambda r: r["label"] == "scam", {"likely_scam"})
    out["verdict_split"] = {v: verdicts.count(v) for v in ("likely_scam", "be_careful", "not_sure", "no_signs")}
    return out


def unseen_metrics(pipe) -> dict:
    """Hand-written messages with new wording, obfuscation and mixed language. Never used for training.
    Reports the model alone and the full checker (rules + model), which is what customers see."""
    rows = load_rows(UNSEEN)
    y = [1 if r["label"] == "scam" else 0 for r in rows]
    proba = list(pipe.predict_proba([r["text"] for r in rows])[:, 1])
    return {"n": len(rows), "model_only": _scores(y, [int(p >= 0.5) for p in proba]), "checker": checker_metrics(rows, proba)}


def train(save: bool = True) -> dict:
    texts, labels = load_dataset()
    x_tr, x_te, y_tr, y_te = train_test_split(texts, labels, test_size=0.25, random_state=7, stratify=labels)
    pred = build_pipeline().fit(x_tr, y_tr).predict(x_te)
    final = build_pipeline().fit(texts, labels)  # ship a model trained on all data
    metrics = {"n_total": len(texts), "n_train": len(x_tr), "n_test": len(x_te), **_scores(y_te, list(pred)),
               "grouped_by_template": grouped_metrics(), "unseen_tactics": unseen_metrics(final),
               "rule_pack_version": PACK["version"]}
    if save:
        joblib.dump(final, MODEL_PATH)
        METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    return metrics


_model = None
_model_failed = False
_lock = threading.Lock()


def get_model():
    """Loads once. If the model is missing or broken the checker carries on with rules only."""
    global _model, _model_failed
    with _lock:
        if _model is None and not _model_failed:
            try:
                if not MODEL_PATH.exists():
                    train(save=True)
                _model = joblib.load(MODEL_PATH)
            except Exception:  # noqa: BLE001 - any load failure means rules-only mode
                _model_failed = True
        return _model


def ml_probability(text: str) -> float | None:
    model = get_model()
    return None if model is None else float(model.predict_proba([text])[0][1])


def verdict_for(flags: list[dict], p: float) -> str:
    """One weak signal never makes "Likely scam". It takes a critical rule, two different signal
    families, or a very confident model. Protective wording ("never share your OTP") never counts,
    because those rules are dropped before this point."""
    families = {f.get("family", f["key"]) for f in flags}
    strong = [f for f in flags if f["strong"]]
    critical = [f for f in flags if f.get("critical", f["strong"] and f["key"] in CRITICAL_KEYS)]
    if critical or (strong and len(families) >= 2 and p >= 0.5) or (len(families) >= 3 and p >= 0.5) or (flags and p >= 0.85):
        return "likely_scam"
    if not flags:  # the model alone can raise caution, never a "Likely scam"
        return "be_careful" if p >= 0.9 else "not_sure" if p >= 0.4 else "no_signs"
    if not strong and 0.4 <= p <= 0.6 and len(families) < 2:
        return "not_sure"
    if strong or p >= 0.3 or len(families) >= 2:
        return "be_careful"
    return "no_signs"


def check(text: str, source: str | None = None, sender: str | None = None, claimed: str | None = None) -> dict:
    flags = apply_rules(text, source) + sender_flags(text, sender, claimed)
    p = ml_probability(text)
    if p is None:  # model unavailable: rules only, and never more certain than "Not sure" without a critical rule
        verdict = verdict_for(flags, 0.5) if any(f.get("critical") for f in flags) else ("be_careful" if flags else "not_sure")
        p_out = None
    else:
        verdict = verdict_for(flags, p)
        p_out = round(p, 3)
    st = scam_type_for(flags) if verdict in {"likely_scam", "be_careful"} else None
    return {"flags": flags, "ml_probability": p_out, "model_available": p is not None, "verdict": verdict, "scam_type": st,
            "scam_type_label": SCAM_TYPES[st]["label"] if st else None,
            "advice": SCAM_TYPES[st]["advice"] if st else [],
            "counter_evidence": counter_evidence(text, flags) if verdict in {"no_signs", "not_sure", "be_careful"} else [],
            "rule_pack_version": PACK["version"]}


if __name__ == "__main__":
    print(json.dumps(train(), indent=2))
