"""Regenerate the table-of-contents clips with explicit page-number wording."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
TEXTS_PATH = I18N / "texts.json"
AUDIO_MAP_PATH = I18N / "audios.json"
AUDIO_DIR = I18N / "audio"
VOICE = "en-US-AvaMultilingualNeural"
IDS = (
    "pg003_n0005",
    "pg003_n0007",
    "pg003_n0010",
    "pg003_n0013",
    "pg003_n0016",
    "pg003_n0019",
    "pg003_n0022",
    "pg003_n0025",
    "pg003_n0028",
)


async def main() -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    audios = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    semaphore = asyncio.Semaphore(5)

    async def generate(text_id: str) -> tuple[str, str]:
        filename = f"tts_{text_id}_page_number_v1.mp3"
        destination = AUDIO_DIR / filename
        async with semaphore:
            await edge_tts.Communicate(texts[text_id], voice=VOICE).save(str(destination))
        if destination.stat().st_size < 512:
            raise RuntimeError(f"Generated audio is unexpectedly small: {destination}")
        return text_id, filename

    results = await asyncio.gather(*(generate(text_id) for text_id in IDS))
    audios.update(results)
    AUDIO_MAP_PATH.write_text(
        json.dumps(audios, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Regenerated {len(results)} table-of-contents audio clips.")


if __name__ == "__main__":
    asyncio.run(main())
