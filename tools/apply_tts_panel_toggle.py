"""Publish the voice-button playback-panel toggle and refresh bundle caches."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]


def replace_required(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if old not in source:
        raise RuntimeError(f"{path.name}: expected {old!r}")
    path.write_text(source.replace(old, new), encoding="utf-8")


def main() -> None:
    html_files = sorted(ROOT.glob("*.html"))
    for path in html_files:
        source = path.read_text(encoding="utf-8")
        updated = source.replace("assets/accessible-tts.js?v=37", "assets/accessible-tts.js?v=38")
        updated = updated.replace("assets/offline-preloader.js?v=103", "assets/offline-preloader.js?v=104")
        if updated != source:
            path.write_text(updated, encoding="utf-8")

    for relative in ("content/pages.json", "content/toc.json"):
        replace_required(ROOT / relative, "?reader=31", "?reader=32")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if config.get("bundleVersion") not in {"108", "109"}:
        raise RuntimeError("Expected bundleVersion 108 or 109")
    config["bundleVersion"] = "109"
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    rebuild_offline_preloader()
    print(f"Updated {len(html_files)} HTML files; reader=32; bundleVersion=109")


if __name__ == "__main__":
    main()
