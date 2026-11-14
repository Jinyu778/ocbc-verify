"""Family code word: a word agreed between a customer and their family, to unmask voice-clone
"family emergency" calls. Only a bcrypt hash is stored. It is never returned by the API, never
written to the evidence log, and never shown in the staff console."""

from fastapi import HTTPException

from .security import hash_password


def normalize(word: str) -> str:
    return " ".join(word.split()).casefold()


def hash_code_word(word: str) -> str:
    w = normalize(word)
    if not 3 <= len(w) <= 40:
        # The message never echoes what was typed.
        raise HTTPException(422, {"field": "code_word", "message": "Please use a code word of 3 to 40 characters."})
    return hash_password(w)
