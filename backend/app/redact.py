import re

PHONE_RE = re.compile(r"(?<!\w)(?:\+?65[\s-]?)?[3689]\d{3}[\s-]?\d{4}(?!\w)|(?<!\w)\+?\d[\d\s-]{7,}\d(?!\w)")
URL_RE = re.compile(r"\b(?:https?://|www\.)([^\s/]+)[^\s]*", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")


def redact(text: str) -> str:
    """Mask phone numbers and emails; keep URLs as domain only."""
    text = URL_RE.sub(lambda m: f"[link: {m.group(1).lower()}]", text)
    text = EMAIL_RE.sub("[email hidden]", text)
    text = PHONE_RE.sub("[phone hidden]", text)
    return text
