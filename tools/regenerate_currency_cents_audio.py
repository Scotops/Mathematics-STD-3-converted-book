import asyncio
import json
import re
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
AUDIO_DIR = I18N / "audio"
AUDIO_MAP_PATH = I18N / "audios.json"
TEXTS_PATH = I18N / "texts.json"
VOICE = "en-US-AvaMultilingualNeural"
SUFFIX = "cents_v1"
PAGE_ID = re.compile(r"^pg(?:16\d|17\d|18[0-3])_")
CTS = re.compile(r"\bcts\b", re.IGNORECASE)


def spoken_text(value: str) -> str:
    return CTS.sub("cents", value)


async def main() -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    audios = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    items = {
        text_id: value
        for text_id, value in texts.items()
        if PAGE_ID.match(text_id) and CTS.search(value) and text_id in audios
    }
    semaphore = asyncio.Semaphore(6)

    async def generate(text_id: str, value: str) -> tuple[str, str]:
        filename = f"tts_{text_id}_{SUFFIX}.mp3"
        async with semaphore:
            await edge_tts.Communicate(spoken_text(value), voice=VOICE).save(
                str(AUDIO_DIR / filename)
            )
        return text_id, filename

    results = await asyncio.gather(
        *(generate(text_id, value) for text_id, value in items.items())
    )
    for text_id, filename in results:
        audios[text_id] = filename
    AUDIO_MAP_PATH.write_text(
        json.dumps(audios, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Regenerated {len(results)} currency audio clips with 'cents'.")


if __name__ == "__main__":
    asyncio.run(main())
