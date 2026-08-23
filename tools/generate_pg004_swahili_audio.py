"""Generate the fixed Swahili-accent narration used by page 4 acknowledgements."""

from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "content" / "i18n" / "en" / "audio"
VOICE = "sw-TZ-RehemaNeural"

NARRATION = (
    "Bi Ivi P Bimbiga, Daktari Kenethi R Nzowa, na Bwana Jonathani H Paskali.",
    "Daktari Mikaeli H Mkwizu, Daktari Furaha M Chuma, Daktari Augustino I Msigwa, "
    "Daktari Ahmada O Ali, Daktari Mashaka J Mkandawile, Bwana Luwilo D Sanga, "
    "Bwana Elikana E Manyilizu,",
    "na Bi Skolastika A Kulanga.",
    "Bi Pamela S Makusi.",
    "Bwana Fikiri A Msimbe, Bi Viktoria R Mwinyi, Bwana Godwini J Chipenya, "
    "na Bwana Gwakisa U Mwandoloma.",
    "Bi Ivi P Bimbiga.",
    "Daktari Anethi A Komba.",
)


async def generate() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, text in enumerate(NARRATION, start=1):
        output = OUTPUT_DIR / f"pg004_swahili_names_{index:02d}.mp3"
        await edge_tts.Communicate(text, VOICE).save(str(output))
        print(f"{output.relative_to(ROOT)}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    asyncio.run(generate())
