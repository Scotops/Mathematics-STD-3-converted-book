"""Publish exact narration for page 21, Example 2."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "pg021_n0011": "(a) 4000 + 500 + 30 + 1 = blank.",
    "pg021_n0012": "(b) 4000 + 800 + 40 + 2 = blank.",
    "pg021_n0013": "(c) 9000 + 700 + 0 + 2 = blank.",
    "pg021_n0014": "(d) 5000 + 0 + 0 + 1 = blank.",
    "pg021_n0016": "(a) 4000 + 500 + 30 + 1 = 4531.",
    "pg021_n0017": "(b) 4000 + 800 + 40 + 2 = 4842.",
    "pg021_n0018": "(c) 9000 + 700 + 0 + 2 = 9702.",
    "pg021_n0019": "(d) 5000 + 0 + 0 + 1 = 5001.",
}


def main() -> None:
    page = (ROOT / "pg021_sec001.html").read_text(encoding="utf-8")
    for text_id, spoken in EXPECTED.items():
        marker = f'data-id="{text_id}" data-tts-text="{spoken}"'
        if marker not in page:
            raise RuntimeError(f"Exact narration missing for {text_id}")

    versioned_html = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("offline-preloader.js?v=95", "offline-preloader.js?v=96")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            versioned_html += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=23", "?reader=24"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "101"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rebuild_offline_preloader()
    print({"exact_narration_items": len(EXPECTED), "reader": 24, "bundle": 101, "versioned_html": versioned_html})


if __name__ == "__main__":
    main()
