"""Regenerate the eight Example 2 narration files on page 21."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
VOICE = "en-US-AvaMultilingualNeural"
SPEECH = {
    "pg021_n0011": "A. Four thousand plus five hundred plus thirty plus one equals blank.",
    "pg021_n0012": "B. Four thousand plus eight hundred plus forty plus two equals blank.",
    "pg021_n0013": "C. Nine thousand plus seven hundred plus zero plus two equals blank.",
    "pg021_n0014": "D. Five thousand plus zero plus zero plus one equals blank.",
    "pg021_n0016": "A. Four thousand plus five hundred plus thirty plus one equals four thousand five hundred and thirty-one.",
    "pg021_n0017": "B. Four thousand plus eight hundred plus forty plus two equals four thousand eight hundred and forty-two.",
    "pg021_n0018": "C. Nine thousand plus seven hundred plus zero plus two equals nine thousand seven hundred and two.",
    "pg021_n0019": "D. Five thousand plus zero plus zero plus one equals five thousand and one.",
}


async def main() -> None:
    audios = json.loads((I18N / "audios.json").read_text(encoding="utf-8"))
    missing = [text_id for text_id in SPEECH if text_id not in audios]
    if missing:
        raise KeyError(f"Missing audio mappings: {missing}")

    async def render(text_id: str, spoken: str) -> None:
        output = I18N / "audio" / audios[text_id]
        await edge_tts.Communicate(spoken, voice=VOICE).save(str(output))

    for text_id, spoken in SPEECH.items():
        await render(text_id, spoken)
    print({"audio_files": len(SPEECH), "page": 21, "example": 2})


if __name__ == "__main__":
    asyncio.run(main())
