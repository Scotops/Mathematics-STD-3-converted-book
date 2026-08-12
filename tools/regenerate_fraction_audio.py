"""Regenerate every mapped book clip containing a fraction.

The display keeps proper stacked MathML fractions. The recorded narration is
made explicit as "numerator over denominator" for blind learners.
"""

from __future__ import annotations

import argparse
import asyncio
import html
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
SUFFIX = "fractions_v3"
PAGE_ID = re.compile(r"^pg\d{3}_")
MFRAC = re.compile(r"<mfrac\b([^>]*)>.*?</mfrac>", re.IGNORECASE | re.DOTALL)
ARIA_LABEL = re.compile(r'aria-label=["\']([^"\']+)["\']', re.IGNORECASE)
NUMERIC_SLASH = re.compile(r"(?<!\d)(\d+)\s*/\s*(\d+)(?!\d)")
DATE_SLASH = re.compile(r"\b\d{1,2}/\d{1,2}/\d{4}\b")
TAG = re.compile(r"<[^>]+>")


def contains_fraction(value: str) -> bool:
    without_dates = DATE_SLASH.sub("", value)
    return "<mfrac>" in value or bool(NUMERIC_SLASH.search(without_dates))


def spoken_text(value: str) -> str:
    def replace_fraction(match: re.Match[str]) -> str:
        label = ARIA_LABEL.search(match.group(1))
        if not label:
            raise ValueError(f"Fraction is missing an aria-label: {match.group(0)[:120]}")
        return f" {html.unescape(label.group(1))} "

    value = MFRAC.sub(replace_fraction, value)
    value = NUMERIC_SLASH.sub(lambda match: f" {match.group(1)} over {match.group(2)} ", value)
    value = TAG.sub(" ", value)
    value = html.unescape(value)
    value = re.sub(r"\(\s*([a-j])\s*\)", lambda match: f"{match.group(1).upper()},", value)
    for symbol, words in {
        "÷": " divided by ",
        "×": " times ",
        "−": " minus ",
        "–": " minus ",
        "+": " plus ",
        "=": " equals ",
    }.items():
        value = value.replace(symbol, words)
    return re.sub(r"\s+", " ", value).strip()


async def write_clip(item_id: str, value: str, semaphore: asyncio.Semaphore) -> tuple[str, str]:
    filename = f"tts_{item_id}_{SUFFIX}.mp3"
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


async def main(dry_run: bool) -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    audios = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    candidates = [
        (item_id, value)
        for item_id, value in texts.items()
        if item_id in audios
        and PAGE_ID.match(item_id)
        and isinstance(value, str)
        and contains_fraction(value)
    ]
    if dry_run:
        print(f"Validated {len(candidates)} fraction clips.")
        for item_id, value in candidates[:12]:
            print(f"{item_id}: {spoken_text(value)}")
        return

    print(f"Regenerating {len(candidates)} fraction clips with {VOICE}.")
    semaphore = asyncio.Semaphore(8)
    for item_id, filename in await asyncio.gather(
        *(write_clip(item_id, value, semaphore) for item_id, value in candidates)
    ):
        audios[item_id] = filename
    AUDIO_MAP_PATH.write_text(
        json.dumps(audios, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
