"""Publish book-wide pauses between distinct numeric narration units."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    tts_path = ROOT / "assets" / "accessible-tts.js"
    tts = tts_path.read_text(encoding="utf-8")
    required = (
        "function isNumericNarrationUnit(value)",
        "    isNumericNarrationUnit,",
        "const oneSecondBoundary = () =>",
        "isNumericNarrationUnit(String(element.textContent || ''))",
        "isRow && /\\d/.test(String(element.textContent || ''))",
        "if (isNumericNarrationUnit(lastSpoken)) oneSecondBoundary();",
        "const ONE_SECOND_PAUSE_MS = 1000;",
        "const MAJOR_PAUSE_MS = 1000;",
    )
    missing = [marker for marker in required if marker not in tts]
    if missing:
        raise RuntimeError(f"Global numeric interval rules are incomplete: {missing}")

    versioned_html = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("accessible-tts.js?v=33", "accessible-tts.js?v=34")
        updated = updated.replace("offline-preloader.js?v=99", "offline-preloader.js?v=100")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            versioned_html += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=27", "?reader=28"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "105"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rebuild_offline_preloader()
    print({"reader": 28, "bundle": 105, "versioned_html": versioned_html})


if __name__ == "__main__":
    main()
