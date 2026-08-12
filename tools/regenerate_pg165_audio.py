import asyncio
import json
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
AUDIO_DIR = I18N / "audio"
AUDIO_MAP = I18N / "audios.json"
VOICE = "en-US-AvaMultilingualNeural"
SUFFIX = "page_order_v1"

SPOKEN = {
    "pg165_n0002": "Example 1.",
    "pg165_n0003": "A. How many fifty-cent amounts are there in one shilling?",
    "pg165_n0004": "B. Write five hundred shillings and fifty cents in short form.",
    "pg165_n0005": "Solution.",
    "pg165_n0006": "A. One hundred cents equals one shilling.",
    "pg165_n0007": "Since one hundred cents equals fifty cents plus fifty cents, and one shilling equals one hundred cents, which equals fifty cents plus fifty cents, it follows that one shilling is the same as two fifty-cent amounts.",
    "pg165_n0008": "Therefore, there are two fifty-cent amounts in one shilling.",
    "pg165_n0009": "B. In short form, it is written as five hundred shillings and fifty cents.",
    "pg165_n0011": "Example 2.",
    "pg165_n0012": "A. Write seven hundred shillings in words.",
    "pg165_n0013": "B. Write one thousand two hundred shillings and seventy cents in short form.",
    "pg165_n0014": "Answer.",
    "pg165_n0015": "A. Seven hundred shillings is written in words as seven hundred shillings.",
    "pg165_n0016": "B. One thousand two hundred shillings and seventy cents is written in short form as shillings one thousand two hundred, seventy cents.",
}


async def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    mappings = json.loads(AUDIO_MAP.read_text(encoding="utf-8"))
    for text_id, spoken in SPOKEN.items():
        filename = f"tts_{text_id}_{SUFFIX}.mp3"
        await edge_tts.Communicate(spoken, voice=VOICE).save(str(AUDIO_DIR / filename))
        mappings[text_id] = filename
    AUDIO_MAP.write_text(json.dumps(mappings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
