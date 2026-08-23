from __future__ import annotations

from pathlib import Path
import sys

from lxml import html


ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8")
PAGES = [
    "index.html",
    "pg004_sec001.html",
    "pg010_sec001.html",
    "pg015_sec001.html",
    "pg016_sec001.html",
    "pg017_sec001.html",
    "pg020_sec001.html",
    "pg021_sec001.html",
    "pg022_sec001.html",
    "pg023_sec001.html",
    "pg024_sec001.html",
    "pg030_sec001.html",
    "pg033_sec001.html",
    "pg037_sec001.html",
    "pg039_sec001.html",
    "pg042_sec001.html",
]


selected_pages = sys.argv[1:] or PAGES

for filename in selected_pages:
    document = html.fromstring((ROOT / filename).read_text(encoding="utf-8"))
    print(f"\n### {filename}")
    elements = document.xpath("//*[@id='content']//*[@data-id or @data-tts-text]")
    for element in elements:
        text = " ".join("".join(element.itertext()).split())
        tts = element.get("data-tts-text", "")
        if text or tts:
            print(
                element.tag,
                element.get("data-id", "-"),
                "TEXT=", repr(text),
                "TTS=", repr(tts),
            )
