"""Publish one-second narration gaps between the page 23 expanded-form items."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
ITEM_IDS = (
    "pg023_n0005",
    "pg023_n0007",
    "pg023_n0009",
    "pg023_n0011",
    "pg023_n0013",
    "pg023_n0015",
    "pg023_n0017",
    "pg023_n0019",
)


def main() -> None:
    page = (ROOT / "pg023_sec001.html").read_text(encoding="utf-8")
    for text_id in ITEM_IDS:
        marker = f'data-id="{text_id}" data-tts-pause-after="1000"'
        if marker not in page:
            raise RuntimeError(f"One-second narration gap missing for {text_id}")

    tts_path = ROOT / "assets" / "accessible-tts.js"
    tts = tts_path.read_text(encoding="utf-8")
    required_runtime_markers = (
        "const ONE_SECOND_PAUSE_MS = 1000;",
        "[[adt_pause_one_second]]",
        "element.dataset.ttsPauseAfter === '1000'",
    )
    if not all(marker in tts for marker in required_runtime_markers):
        raise RuntimeError("One-second narration runtime support is incomplete")

    versioned_html = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("accessible-tts.js?v=30", "accessible-tts.js?v=31")
        updated = updated.replace("offline-preloader.js?v=96", "offline-preloader.js?v=97")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            versioned_html += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=24", "?reader=25"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "102"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rebuild_offline_preloader()
    print(
        {
            "one_second_item_gaps": len(ITEM_IDS),
            "reader": 25,
            "bundle": 102,
            "versioned_html": versioned_html,
        }
    )


if __name__ == "__main__":
    main()
