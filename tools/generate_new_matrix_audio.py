"""Regenerate narration affected by MATH THREE NEW MATRIX.docx."""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
VOICE = "en-US-AvaMultilingualNeural"


EXPLICIT_SPEECH = {
    "pg107_n0003": "Question 11. How many rays can you draw or mention from a single point?",
    "pg109_n0024": "Use accessible tools. Identify a computer programme for drawing plane figures.",
    "pg116_n0034": "Use accessible tools. Take a knife, marker pen, and an orange or watermelon.",
    "pg122_n0018": "Answer the following questions by using assistive devices and drawings.",
    "pg125_n0030": "Use drawings that include assistive devices to find the correct answer to the following question.",
    "pg126_n0028": "Use accessible tools and drawings to find the answer to the following question.",
    "pg131_n0027": "Use assistive devices. Draw different shapes and divide them into equal parts.",
    "pg146_n0003": "Use assistive devices. Draw arrows on the following clock faces to show the time indicated.",
    "pg147_n0003": "Use an assistive device. Draw digital and analogue clock faces to show each of the following times.",
    "pg156_n0023": "Instructions. Use accessible tools and basic drawing software, for example Paint, to create a digital timetable illustrating your daily activities.",
}


TIME_PAGES = ("pg149_", "pg150_", "pg151_", "pg158_")
TIME_PATTERN = re.compile(r"(?i)(?:\b[ap]\s*\.\s*m\.?|\b(?:am|pm)\b)")


def normalize_time_abbreviations(text: str) -> str:
    text = re.sub(
        r"(?i)\b([ap])\s*\.\s*m\.?",
        lambda match: f"{match.group(1).upper()} M",
        text,
    )
    text = re.sub(r"(?i)\bpm\b", "P M", text)
    text = re.sub(r"\bAM\b", "A M", text)
    text = re.sub(
        r"(?i)(\b\d{1,2}(?::\d{2})?\s*)am\b",
        lambda match: f"{match.group(1)}A M",
        text,
    )
    return text


async def main() -> None:
    texts = json.loads((I18N / "texts.json").read_text(encoding="utf-8"))
    audios = json.loads((I18N / "audios.json").read_text(encoding="utf-8"))
    speech = dict(EXPLICIT_SPEECH)
    for text_id, value in texts.items():
        if text_id.startswith(TIME_PAGES) and TIME_PATTERN.search(value):
            speech[text_id] = normalize_time_abbreviations(value)

    missing = sorted(text_id for text_id in speech if text_id not in audios)
    if missing:
        raise KeyError(f"Audio mappings missing for: {missing}")

    semaphore = asyncio.Semaphore(8)

    async def render(text_id: str, spoken: str) -> None:
        async with semaphore:
            output = I18N / "audio" / audios[text_id]
            await edge_tts.Communicate(spoken, voice=VOICE).save(str(output))

    await asyncio.gather(*(render(text_id, spoken) for text_id, spoken in speech.items()))
    print({"audio_files": len(speech), "explicit_matrix_items": len(EXPLICIT_SPEECH)})


if __name__ == "__main__":
    asyncio.run(main())
