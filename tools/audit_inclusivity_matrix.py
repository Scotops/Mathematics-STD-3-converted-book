"""Verify every applied Phase 2 inclusivity-matrix change."""

from __future__ import annotations

import json
from pathlib import Path

from lxml import html
from PIL import Image

from apply_inclusivity_matrix import OVERLAYS, TEXT_REPLACEMENTS
from apply_accessible_tools_matrix import REPLACEMENTS as ACCESSIBLE_TOOLS_REPLACEMENTS


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    expected_replacements = dict(TEXT_REPLACEMENTS)
    # The later accessible-tools matrix intentionally adds a prefix to two
    # earlier inclusive-language sentences while preserving their alternatives.
    expected_replacements.update(
        {
            text_id: replacement
            for text_id, replacement in ACCESSIBLE_TOOLS_REPLACEMENTS.items()
            if text_id in expected_replacements
        }
    )
    texts = json.loads(
        (ROOT / "content" / "i18n" / "en" / "texts.json").read_text(encoding="utf-8")
    )
    failures = []
    html_counts = {text_id: 0 for text_id in expected_replacements}
    for page_path in ROOT.glob("*.html"):
        tree = html.fromstring(page_path.read_text(encoding="utf-8"))
        for text_id, expected in expected_replacements.items():
            for element in tree.xpath(f'//*[@data-id="{text_id}"]'):
                html_counts[text_id] += 1
                visible = " ".join("".join(element.itertext()).split())
                if visible != expected.visible:
                    failures.append(f"{page_path.name}:{text_id}:visible")
                if element.get("data-tts-text") != expected.spoken:
                    failures.append(f"{page_path.name}:{text_id}:spoken")

    for text_id, expected in expected_replacements.items():
        if texts.get(text_id) != expected.visible:
            failures.append(f"texts.json:{text_id}")
        if not html_counts[text_id] and text_id != "pg010_n0020":
            failures.append(f"missing-html:{text_id}")

    facsimile_pages = sorted({overlay.page for overlay in OVERLAYS})
    for overlay in OVERLAYS:
        if overlay.font_size != 16.0:
            failures.append(f"wrong-overlay-font-size:{overlay.page}:{overlay.font_size}")
    for page_number in facsimile_pages:
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as image:
            if image.size != (1085, 1493):
                failures.append(f"bad-image-size:{page_number}:{image.size}")
            image.verify()

    report = {
        "matrix_text_ids": len(TEXT_REPLACEMENTS),
        "html_occurrences": sum(html_counts.values()),
        "visible_facsimile_pages": len(facsimile_pages),
        "matrix_rows_without_source_sentence": ["speak", "listen", "tell"],
        "failures": failures,
    }
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
