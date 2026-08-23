"""Generate the fixed Swahili-accent narration used by page 4 acknowledgements."""

from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "content" / "i18n" / "en" / "audio"
VOICE = "sw-TZ-RehemaNeural"

NARRATION = (
    "Miss Ivi P Bimbiga, Doctor Kenethi R Nzowa, and Mister Jonathani H Paskali.",
    "Doctor Mikaeli H Mkwizu, Doctor Furaha M Chuma, Doctor Augustino I Msigwa, "
    "Doctor Ahmada O Ali, Doctor Mashaka J Mkandawile, Mister Luwilo D Sanga, "
    "Mister Elikana E Manyilizu, and",
    "Miss Skolastika A Kulanga.",
    "Miss Pamela S Makusi.",
    "Mister Fikiri A Msimbe, Miss Viktoria R Mwinyi, Mister Godwini J Chipenya, "
    "and Mister Gwakisa U Mwandoloma.",
    "Miss Ivi P Bimbiga.",
    "Doctor Anethi A Komba.",
)


async def generate() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, text in enumerate(NARRATION, start=1):
        output = OUTPUT_DIR / f"pg004_swahili_names_{index:02d}.mp3"
        await edge_tts.Communicate(text, VOICE).save(str(output))
        print(f"{output.relative_to(ROOT)}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    asyncio.run(generate())
