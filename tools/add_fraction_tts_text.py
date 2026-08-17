"""Add explicit spoken text to every localized HTML block containing fractions.

The attribute is a browser-TTS fallback. Recorded audio remains the primary
reader path, but browsers that use Web Speech receive the same unambiguous
"numerator over denominator" wording without depending on MathJax's DOM.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from regenerate_fraction_audio import contains_fraction, spoken_text


ROOT = Path(__file__).resolve().parents[1]
TEXTS = json.loads(
    (ROOT / "content" / "i18n" / "en" / "texts.json").read_text(encoding="utf-8")
)
PAGES = json.loads((ROOT / "content" / "pages.json").read_text(encoding="utf-8"))
OPENING_TAG = re.compile(
    r"<(?P<tag>[a-z][a-z0-9:-]*)(?P<attrs>[^>]*\bdata-id=(?P<quote>[\"'])(?P<id>[^\"']+)(?P=quote)[^>]*)>",
    re.IGNORECASE,
)
TTS_ATTRIBUTE = re.compile(r"\sdata-tts-text=(?:\"[^\"]*\"|'[^']*')", re.IGNORECASE)


def update_page(path: Path) -> int:
    source = path.read_text(encoding="utf-8")
    changed = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal changed
        item_id = match.group("id")
        value = TEXTS.get(item_id)
        if not isinstance(value, str) or not contains_fraction(value):
            return match.group(0)
        spoken = html.escape(spoken_text(value), quote=True)
        attrs = TTS_ATTRIBUTE.sub("", match.group("attrs"))
        changed += 1
        return f'<{match.group("tag")}{attrs} data-tts-text="{spoken}">'

    updated = OPENING_TAG.sub(replace, source)
    if changed:
        path.write_text(updated, encoding="utf-8")
    return changed


def main() -> None:
    files = 0
    blocks = 0
    for entry in PAGES:
        path = ROOT / entry["href"].split("?", 1)[0]
        if not path.exists() or path.suffix.lower() != ".html":
            continue
        count = update_page(path)
        if count:
            files += 1
            blocks += count
    print(f"Added explicit fraction speech to {blocks} blocks across {files} canonical pages.")


if __name__ == "__main__":
    main()
