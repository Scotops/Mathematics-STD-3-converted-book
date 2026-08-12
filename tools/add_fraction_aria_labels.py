"""Give every MathML fraction an explicit accessible pronunciation.

The ADT runtime replaces inline MathML with values from texts.json, so the
attribute must be added to both sources.  Screen readers then receive names
such as "3 over 4" instead of choosing a locale-specific fraction reading.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXTS_PATH = ROOT / "content" / "i18n" / "en" / "texts.json"
MFRAC = re.compile(
    r"<mfrac(?![^>]*\baria-label=)([^>]*)>\s*"
    r"(<(?:mn|mrow)\b[^>]*>.*?</(?:mn|mrow)>)\s*"
    r"(<(?:mn|mrow)\b[^>]*>.*?</(?:mn|mrow)>)\s*"
    r"</mfrac>",
    re.IGNORECASE | re.DOTALL,
)
TAG = re.compile(r"<[^>]+>")


def component_words(fragment: str) -> str:
    words = TAG.sub(" ", fragment)
    words = html.unescape(words)
    for symbol, spoken in {
        "+": " plus ",
        "−": " minus ",
        "–": " minus ",
        "-": " minus ",
        "×": " times ",
        "÷": " divided by ",
    }.items():
        words = words.replace(symbol, spoken)
    return re.sub(r"\s+", " ", words).strip()


def label_fractions(value: str) -> tuple[str, int]:
    count = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        attributes, numerator, denominator = match.groups()
        label = f"{component_words(numerator)} over {component_words(denominator)}"
        escaped_label = html.escape(label, quote=True)
        return (
            f'<mfrac aria-label="{escaped_label}"{attributes}>'
            f"{numerator}{denominator}</mfrac>"
        )

    return MFRAC.sub(replace, value), count


def update_texts() -> int:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    total = 0
    for item_id, value in texts.items():
        if not isinstance(value, str) or "<mfrac" not in value:
            continue
        texts[item_id], changed = label_fractions(value)
        total += changed
    TEXTS_PATH.write_text(
        json.dumps(texts, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return total


def update_pages() -> tuple[int, int]:
    changed_files = 0
    total = 0
    for page in ROOT.glob("pg*_sec*.html"):
        source = page.read_text(encoding="utf-8")
        updated, changed = label_fractions(source)
        if not changed:
            continue
        page.write_text(updated, encoding="utf-8")
        changed_files += 1
        total += changed
    return changed_files, total


def main() -> None:
    text_count = update_texts()
    page_count, html_count = update_pages()
    print(
        f"Added {text_count} localized and {html_count} inline fraction labels "
        f"across {page_count} HTML files."
    )


if __name__ == "__main__":
    main()
