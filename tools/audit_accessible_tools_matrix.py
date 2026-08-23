"""Verify every photographed accessible-tools matrix change."""

from __future__ import annotations

import json
from pathlib import Path

from lxml import html
from PIL import Image

from apply_accessible_tools_matrix import OVERLAYS, REPLACEMENTS


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"


def main() -> int:
    texts = json.loads((I18N / "texts.json").read_text(encoding="utf-8"))
    audios = json.loads((I18N / "audios.json").read_text(encoding="utf-8"))
    failures = []
    counts = {text_id: 0 for text_id in REPLACEMENTS}
    for page_path in ROOT.glob("*.html"):
        tree = html.fromstring(page_path.read_text(encoding="utf-8"))
        for text_id, expected in REPLACEMENTS.items():
            for element in tree.xpath(f'//*[@data-id="{text_id}"]'):
                counts[text_id] += 1
                visible = " ".join("".join(element.itertext()).split())
                if visible != expected.visible:
                    failures.append(f"{page_path.name}:{text_id}:visible")
                if element.get("data-tts-text") != expected.spoken:
                    failures.append(f"{page_path.name}:{text_id}:spoken")
    for text_id, expected in REPLACEMENTS.items():
        if texts.get(text_id) != expected.visible:
            failures.append(f"texts.json:{text_id}")
        if counts[text_id] == 0:
            failures.append(f"missing-html:{text_id}")
        filename = audios.get(text_id, "")
        audio_path = I18N / "audio" / filename
        if "accessible_tools_matrix_v1" not in filename or not audio_path.is_file() or audio_path.stat().st_size < 512:
            failures.append(f"audio:{text_id}")
    for overlay in OVERLAYS:
        if overlay.font_size != 16.0:
            failures.append(f"font-size:{overlay.page}:{overlay.font_size}")
    facsimile_pages = sorted({overlay.page for overlay in OVERLAYS})
    for page_number in facsimile_pages:
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as image:
            if image.size != (1085, 1493):
                failures.append(f"image-size:{page_number}:{image.size}")
            image.verify()
    print(json.dumps({
        "matrix_text_ids": len(REPLACEMENTS),
        "html_occurrences": sum(counts.values()),
        "facsimile_pages": len(facsimile_pages),
        "failures": failures,
    }, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
