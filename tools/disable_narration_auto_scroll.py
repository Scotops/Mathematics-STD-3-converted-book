"""Publish the no-auto-scroll narration runtime across the ADT bundle."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("?reader=18", "?reader=19")
        updated = updated.replace("accessible-tts.js?v=27", "accessible-tts.js?v=28")
        updated = updated.replace("offline-preloader.js?v=90", "offline-preloader.js?v=91")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1

    for relative_path in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative_path
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=18", "?reader=19"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "96"
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rebuild_offline_preloader()
    print({"html_files": changed, "reader": 19, "bundle": 96})


if __name__ == "__main__":
    main()
