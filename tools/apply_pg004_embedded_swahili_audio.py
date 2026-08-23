"""Publish the page 4 embedded Swahili narration and refresh bundle caches."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "content" / "i18n" / "en" / "audio"
AUDIO_NAMES = [f"pg004_swahili_names_{index:02d}.mp3" for index in range(1, 8)]


def replace_required(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if old not in source:
        raise RuntimeError(f"{path.name}: expected {old!r}")
    path.write_text(source.replace(old, new), encoding="utf-8")


def main() -> None:
    missing = [name for name in AUDIO_NAMES if not (AUDIO_DIR / name).is_file()]
    if missing:
        raise RuntimeError(f"Missing generated narration: {missing}")

    html_files = sorted(ROOT.glob("*.html"))
    for path in html_files:
        source = path.read_text(encoding="utf-8")
        updated = source.replace("assets/accessible-tts.js?v=35", "assets/accessible-tts.js?v=36")
        updated = updated.replace("assets/offline-preloader.js?v=101", "assets/offline-preloader.js?v=102")
        if updated != source:
            path.write_text(updated, encoding="utf-8")

    for relative in ("content/pages.json", "content/toc.json"):
        replace_required(ROOT / relative, "?reader=29", "?reader=30")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if config.get("bundleVersion") not in {"106", "107"}:
        raise RuntimeError("Expected bundleVersion 106 or 107")
    config["bundleVersion"] = "107"
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest_path = ROOT / "imsmanifest.xml"
    manifest = manifest_path.read_text(encoding="utf-8")
    manifest_entries = "\n".join(
        f'      <file href="content/i18n/en/audio/{name}"/>' for name in AUDIO_NAMES
    )
    if "pg004_swahili_names_01.mp3" not in manifest:
        marker = "    </resource>"
        if marker not in manifest:
            raise RuntimeError("SCORM resource closing tag not found")
        manifest = manifest.replace(marker, f"{manifest_entries}\n{marker}", 1)
        manifest_path.write_text(manifest, encoding="utf-8")

    rebuild_offline_preloader()
    print(f"Updated {len(html_files)} HTML files; reader=30; bundleVersion=107")


if __name__ == "__main__":
    main()
