"""Audit numeric narration boundaries across every page in the reading order."""

from __future__ import annotations

import json
import re
from pathlib import Path

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
SPACE = re.compile(r"\s+")
ITEM_MARKER = re.compile(r"^(?:\([a-z]\)|[a-z][.),]|\d+[.)])\s*", re.IGNORECASE)
ALLOWED_WORDS = re.compile(
    r"\b(?:shillings?|shs?|cents?|cts?|a\.?m\.?|p\.?m\.?|blank|over|plus|minus|equals|times|divided\s+by)\b",
    re.IGNORECASE,
)
NUMERIC_SYMBOLS = re.compile(r"^[\d\s,.:;+×✕÷∕⟌=<>≤≥/()_\-−–—]+$")


def visible_text(element) -> str:
    return SPACE.sub(" ", "".join(element.itertext())).strip()


def is_numeric_unit(value: str) -> bool:
    if not re.search(r"\d", value):
        return False
    remaining = ITEM_MARKER.sub("", value, count=1)
    remaining = ALLOWED_WORDS.sub("", remaining)
    return bool(remaining.strip()) and bool(NUMERIC_SYMBOLS.fullmatch(remaining.strip()))


def main() -> None:
    manifest = json.loads((ROOT / "content" / "pages.json").read_text(encoding="utf-8"))
    filenames = list(dict.fromkeys(entry["href"].split("?", 1)[0] for entry in manifest))
    candidates: list[tuple[str, str, str]] = []
    rows: list[tuple[str, str]] = []
    explicit = 0
    explicit_multi_item = 0
    unsafe_explicit_transitions: list[tuple[str, str, str]] = []
    risky_split_groups: list[tuple[str, str]] = []

    for filename in filenames:
        document = html.fromstring((ROOT / filename).read_text(encoding="utf-8"))
        for element in document.xpath('//*[@data-tts-pause-after="1000"]'):
            explicit += 1
        for element in document.xpath('//*[@data-tts-text]'):
            spoken = SPACE.sub(" ", element.get("data-tts-text", "")).strip()
            item_labels = re.findall(r"(?:\([a-z]\)|\b[A-Z],)", spoken)
            if len(item_labels) >= 2:
                explicit_multi_item += 1
            if re.search(r"\d\s+(?=(?:\([a-z]\)|[A-Z],)\s*\d)", spoken):
                unsafe_explicit_transitions.append(
                    (filename, element.get("data-id", element.tag), spoken[:240])
                )
        for row in document.xpath("//tr"):
            text = visible_text(row)
            if re.search(r"\d", text):
                rows.append((filename, text[:160]))
        for element in document.xpath('//*[@data-id and not(ancestor::tr)]'):
            text = visible_text(element)
            if not is_numeric_unit(text):
                continue
            candidates.append((filename, element.get("data-id", ""), text[:160]))

        for parent in document.xpath("//*[count(*[@data-id]) > 1 and not(self::tr) and not(ancestor::tr)]"):
            direct = [child for child in parent if child.get("data-id") and is_numeric_unit(visible_text(child))]
            if len(direct) < 2:
                continue
            text = visible_text(parent)
            if re.search(r"[+×✕÷∕⟌=<>≤≥]", text) and not re.search(r"\([a-z]\)", text, re.IGNORECASE):
                risky_split_groups.append((filename, text[:200]))

    payload = {
        "pages": len(filenames),
        "pages_with_numeric_units": len({item[0] for item in candidates}),
        "numeric_units_outside_tables": len(candidates),
        "pages_with_numeric_table_rows": len({item[0] for item in rows}),
        "numeric_table_rows": len(rows),
        "existing_explicit_one_second_gaps": explicit,
        "explicit_multi_item_narrations": explicit_multi_item,
        "unsafe_explicit_numeric_transitions": unsafe_explicit_transitions,
        "global_runtime_rules": {
            "standalone_numeric_units": True,
            "numeric_table_rows": True,
            "numbered_questions": True,
            "numeric_line_breaks": True,
        },
        "potential_split_expression_groups": risky_split_groups[:25],
        "sample_numeric_units": candidates[:25],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
