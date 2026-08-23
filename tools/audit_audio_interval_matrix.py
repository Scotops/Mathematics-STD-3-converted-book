"""Audit MATRIX MATHE STD 3 SALMAXXXXXXX (2).docx corrections."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AFFECTED_PAGES = [
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


def require(condition: bool, message: str, failures: list[str]) -> None:
    if not condition:
        failures.append(message)


def main() -> None:
    failures: list[str] = []
    tts = (ROOT / "assets" / "accessible-tts.js").read_text(encoding="utf-8")
    require("const STRUCTURAL_PAUSE_MS = 320;" in tts, "structural pause duration missing", failures)
    require("'DIV', 'P', 'LI'" in tts, "div-based number cells are not structural blocks", failures)
    require("[[adt_pause_short]]" in tts, "short structural pause token missing", failures)
    require("nextChunk.duration || MAJOR_PAUSE_MS" in tts, "pause duration is not used in playback", failures)
    require(
        "[[adt_pause]] ${numberedItemKind(element)} ${visibleText} [[adt_pause]]" in tts,
        "numbered questions do not have a pause before and after",
        failures,
    )

    for filename in AFFECTED_PAGES:
        source = (ROOT / filename).read_text(encoding="utf-8")
        require(
            "assets/accessible-tts.js?v=30" in source,
            f"{filename}: TTS v30 missing",
            failures,
        )

    for relative in ("content/pages.json", "content/toc.json"):
        manifest = (ROOT / relative).read_text(encoding="utf-8")
        require("?reader=23" not in manifest, f"{relative}: stale reader 23 link", failures)
        require("?reader=24" in manifest, f"{relative}: reader 24 links missing", failures)
        require(
            "assets/offline-preloader.js?v=96" in source,
            f"{filename}: offline preloader v96 missing",
            failures,
        )

    page4 = (ROOT / "pg004_sec001.html").read_text(encoding="utf-8")
    require("University of Dar es Salaam, U D S M" in page4, "page 4 institution pronunciation missing", failures)
    require(page4.count('lang="sw-TZ" data-tts-text=') >= 6, "page 4 personal-name pronunciations missing", failures)

    page16 = (ROOT / "pg016_sec001.html").read_text(encoding="utf-8")
    require("representing five thousand and eighty" in page16, "page 16 value 5080 narration missing", failures)
    require("representing six thousand and four" in page16, "page 16 value 6004 narration missing", failures)

    page20 = (ROOT / "pg020_sec001.html").read_text(encoding="utf-8")
    require(
        'text-[#222]">4<span style="text-decoration: underline; text-underline-offset: 0.16em;">7</span>65</span>' in page20,
        "page 20 must underline digit 7 in 4765",
        failures,
    )

    page21 = (ROOT / "pg021_sec001.html").read_text(encoding="utf-8")
    exact_example2 = [
        "(a) 4000 + 500 + 30 + 1 = blank.",
        "(b) 4000 + 800 + 40 + 2 = blank.",
        "(c) 9000 + 700 + 0 + 2 = blank.",
        "(d) 5000 + 0 + 0 + 1 = blank.",
        "(a) 4000 + 500 + 30 + 1 = 4531.",
        "(b) 4000 + 800 + 40 + 2 = 4842.",
        "(c) 9000 + 700 + 0 + 2 = 9702.",
        "(d) 5000 + 0 + 0 + 1 = 5001.",
    ]
    require(
        all(f'data-tts-text="{spoken}"' in page21 for spoken in exact_example2),
        "page 21 Example 2 exact narration is incomplete",
        failures,
    )

    page10 = (ROOT / "pg010_sec001.html").read_text(encoding="utf-8")
    page10_blanks = re.findall(
        r'<label for="pg010_sec002-item-\d+" class="sr-only">'
        r'Blank for the (?:thousands|hundreds|tens|ones) place of \d+</label>',
        page10,
    )
    require(len(page10_blanks) == 16, f"page 10 has {len(page10_blanks)} clear blank labels, expected 16", failures)

    page22 = (ROOT / "pg022_sec001.html").read_text(encoding="utf-8")
    page22_blanks = re.findall(
        r'<label for="field\d+" class="sr-only">'
        r'Blank for the (?:thousands|hundreds|tens|ones) place of \d+</label>',
        page22,
    )
    require(len(page22_blanks) == 16, f"page 22 has {len(page22_blanks)} clear blank labels, expected 16", failures)
    require(
        not re.search(r'<label[^>]+class="sr-only"><span data-id="pg022_', page22),
        "page 22 still repeats row-number text in blank cells",
        failures,
    )

    config = json.loads((ROOT / "assets" / "config.json").read_text(encoding="utf-8"))
    require(config.get("bundleVersion") == "101", "bundle version 101 missing", failures)

    print(
        json.dumps(
            {
                "matrix_rows": 20,
                "general_audio_rule": 1,
                "affected_pages": len(AFFECTED_PAGES),
                "page10_blank_labels": len(page10_blanks),
                "page22_blank_labels": len(page22_blanks),
                "failures": failures,
            },
            indent=2,
        )
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
