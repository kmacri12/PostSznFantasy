"""One place that cleans user-typed free text before it is validated or stored."""

import unicodedata
from typing import Annotated

from pydantic import BeforeValidator

# Newlines and tabs are real content in multi-line notes; every other control
# character (and the bidi overrides) only exists to spoof or break layouts.
_KEPT_IN_MULTILINE = "\n\t"
_BIDI_OVERRIDES = "‪‫‬‭‮⁦⁧⁨⁩"


def clean_text(value: str, *, multiline: bool = False) -> str:
    """NFC-normalize, drop control characters, trim. Single-line text also has its
    inner whitespace runs (including newlines) collapsed to one space."""
    text = unicodedata.normalize("NFC", value).replace("\r\n", "\n").replace("\r", "\n")
    text = "".join(
        ch
        for ch in text
        if ch not in _BIDI_OVERRIDES
        and (
            unicodedata.category(ch) != "Cc" or (multiline and ch in _KEPT_IN_MULTILINE)
        )
        or (not multiline and ch in "\n\t")
    )
    if multiline:
        return text.strip()
    return " ".join(text.split())


def _single_line(value: object) -> object:
    return clean_text(value) if isinstance(value, str) else value


def _multi_line(value: object) -> object:
    return clean_text(value, multiline=True) if isinstance(value, str) else value


# Cleaned before the Field length checks run, so "   " fails min_length=1.
CleanLine = Annotated[str, BeforeValidator(_single_line)]
CleanNote = Annotated[str, BeforeValidator(_multi_line)]
