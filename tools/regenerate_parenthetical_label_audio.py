"""Regenerate male read-aloud clips for parenthetical list items.

The ADT reader plays the MP3 mapped to each data-id. It does not use browser
speech synthesis, so the recorded narration must contain clear label words.
This utility keeps the existing male book voice while narrating ``(a)`` as
the English letter ``A,``, ``(b)`` as ``B,``, and so on. Display text is
never changed here.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
TEXTS_PATH = I18N / "texts.json"
AUDIO_MAP_PATH = I18N / "audios.json"
AUDIO_DIR = I18N / "audio"
VOICE = "en-US-GuyNeural"
# Bump the filename whenever a narration correction is published. This keeps
# readers from receiving an older clip from their browser cache.
AUDIO_SUFFIX = "labels_v3"
LABEL = re.compile(r"^\s*\(([A-Za-z])\)\s*")
# List labels can also appear inside one narration item, for example
# "Answer: (a) ...; (b) ...". Limit this to school-list labels so units such
# as "(m)" are not changed.
LIST_LABEL = re.compile(r"(?<![A-Za-z0-9])\(([a-j])\)(?![A-Za-z0-9])", re.IGNORECASE)
BLANK = re.compile(r"\[\[blank(?::[^\]]+)?\]\]")

# These visual diagrams need a complete, natural explanation in the existing
# male narration rather than having their line labels read in screen order.
EXPLICIT_OVERRIDES = {
    "pg009_n0003": "Identify the place value of each digit in the following whole numbers.",
    # Example 5 must say the list label as an English letter, then the number.
    # Writing the number out avoids the speech service interpreting a short
    # label-plus-digits phrase in an unexpected language or reading style.
    "pg009_n0004": "A, four thousand six hundred and twenty-eight.",
    "pg009_n0005": "B, three thousand four hundred and fifty-six.",
    "pg009_n0006": "C, seven thousand three hundred and four.",
    "pg009_n0007": "D, nine thousand.",
    "pg009_n0009": "A, four thousands, six hundreds, two tens, and eight ones.",
    "pg009_n0015": "B, three thousands, four hundreds, five tens, and six ones.",
    "pg009_n0021": "C, seven thousands, three hundreds, zero tens, and four ones.",
    "pg009_n0027": "D, nine thousands, zero hundreds, zero tens, and zero ones.",
    # Keep the complete instruction together in one clear clip for question 7.
    "pg011_n0003": "Write the place value of the shaded digit in the following whole numbers.",
}


def spoken_text(value: str) -> str:
    """Return the text that should be spoken without changing displayed text."""
    # A comma forces the English voice to say the letter by itself before the
    # question. A full stop can make short labels sound like an article or be
    # swallowed by some speech engines.
    value = LIST_LABEL.sub(lambda match: f"{match.group(1).upper()}, ", value)
    value = BLANK.sub("dash", value)
    for symbol, words in {
        "\u00f7": " divided by ",
        "\u00d7": " times ",
        "\u2212": " minus ",
        "\u2013": " minus ",
        "+": " plus ",
        "=": " equals ",
    }.items():
        value = value.replace(symbol, words)
    return re.sub(r"\s+", " ", value).strip()


async def write_clip(item_id: str, value: str, semaphore: asyncio.Semaphore) -> tuple[str, str]:
    # A new filename prevents a browser from replaying its cached v1 clip.
    filename = f"tts_{item_id}_{AUDIO_SUFFIX}.mp3"
    destination = AUDIO_DIR / filename
    async with semaphore:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(spoken_text(value), voice=VOICE).save(str(destination))
                if destination.stat().st_size < 512:
                    raise RuntimeError("generated audio was unexpectedly small")
                return item_id, filename
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(1 + attempt)
    raise RuntimeError("unreachable")


async def main(
    limit: int | None,
    offset: int,
    overrides_only: bool,
    embedded_only: bool,
    item_ids: list[str] | None,
) -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    audios = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    if item_ids:
        candidates = [
            (item_id, EXPLICIT_OVERRIDES.get(item_id, texts[item_id]))
            for item_id in item_ids
        ]
    elif overrides_only:
        candidates = list(EXPLICIT_OVERRIDES.items())
    elif embedded_only:
        candidates = [
            (item_id, value)
            for item_id, value in texts.items()
            if isinstance(value, str) and not LABEL.match(value) and LIST_LABEL.search(value)
        ]
    else:
        candidates = [
            (item_id, value)
            for item_id, value in texts.items()
            if isinstance(value, str) and LABEL.match(value)
        ]
        candidates.extend(EXPLICIT_OVERRIDES.items())
    candidates = candidates[offset:]
    if limit is not None:
        candidates = candidates[:limit]
    print(f"Regenerating {len(candidates)} clips with {VOICE}.")
    semaphore = asyncio.Semaphore(5)
    for item_id, filename in await asyncio.gather(
        *(write_clip(item_id, value, semaphore) for item_id, value in candidates)
    ):
        audios[item_id] = filename
    AUDIO_MAP_PATH.write_text(json.dumps(audios, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--overrides-only", action="store_true")
    parser.add_argument("--embedded-only", action="store_true")
    parser.add_argument("--ids", nargs="+", help="Regenerate only the named text IDs.")
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.offset, args.overrides_only, args.embedded_only, args.ids))
