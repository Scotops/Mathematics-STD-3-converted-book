"""Regenerate male read-aloud clips for parenthetical list items.

The ADT reader plays the MP3 mapped to each data-id. It does not use browser
speech synthesis, so the recorded narration must contain clear label words.
This utility keeps the existing male book voice while narrating ``(a)`` as
``A.``, ``(b)`` as ``B.``, and so on. Display text is never changed here.
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
LABEL = re.compile(r"^\s*\(([A-Za-z])\)\s*")
BLANK = re.compile(r"\[\[blank(?::[^\]]+)?\]\]")

# These visual diagrams need a complete, natural explanation in the existing
# male narration rather than having their line labels read in screen order.
EXPLICIT_OVERRIDES = {
    "pg009_n0003": "Identify the place value of each digit in the following whole numbers.",
    "pg009_n0009": "A. Four thousands, six hundreds, two tens, and eight ones.",
    "pg009_n0015": "B. Three thousands, four hundreds, five tens, and six ones.",
    "pg009_n0021": "C. Seven thousands, three hundreds, zero tens, and four ones.",
    "pg009_n0027": "D. Nine thousands, zero hundreds, zero tens, and zero ones.",
}


def spoken_text(value: str) -> str:
    """Return the text that should be spoken without changing displayed text."""
    match = LABEL.match(value)
    if match:
        value = f"{match.group(1).upper()}. " + value[match.end():]
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
    filename = f"tts_{item_id}_labels_v1.mp3"
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


async def main(limit: int | None, offset: int, overrides_only: bool) -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    audios = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    if overrides_only:
        candidates = list(EXPLICIT_OVERRIDES.items())
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
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.offset, args.overrides_only))
