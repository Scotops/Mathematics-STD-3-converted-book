"""Refresh the JSON and navigation resources embedded for offline reading."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "offline-preloader.js"
RESOURCES = {
    "./assets/config.json": ROOT / "assets" / "config.json",
    "./assets/interface_translations/en/interface_translations.json": ROOT / "assets" / "interface_translations" / "en" / "interface_translations.json",
    "./content/i18n/en/audios.json": ROOT / "content" / "i18n" / "en" / "audios.json",
    "./content/i18n/en/images.json": ROOT / "content" / "i18n" / "en" / "images.json",
    "./content/i18n/en/texts.json": ROOT / "content" / "i18n" / "en" / "texts.json",
    "./content/i18n/en/timecode/timecode_output.json": ROOT / "content" / "i18n" / "en" / "timecode" / "timecode_output.json",
    "./content/i18n/en/videos.json": ROOT / "content" / "i18n" / "en" / "videos.json",
    "./content/pages.json": ROOT / "content" / "pages.json",
    "./content/toc.json": ROOT / "content" / "toc.json",
    "./content/navigation/nav.html": ROOT / "content" / "navigation" / "nav.html",
}


def load(path: Path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text) if path.suffix == ".json" else text


source = OUTPUT.read_text(encoding="utf-8")
inline = {url: load(path) for url, path in RESOURCES.items()}
replacement = "var INLINE = " + json.dumps(inline, ensure_ascii=False, separators=(",", ":")) + ";\n  var BASE_DIR"
updated, count = re.subn(
    r"var INLINE = \{.*?\};\n  var BASE_DIR",
    lambda _match: replacement,
    source,
    count=1,
    flags=re.DOTALL,
)
if count != 1:
    raise RuntimeError("Could not locate the existing INLINE resource map")
OUTPUT.write_text(updated, encoding="utf-8")
print(f"Updated {OUTPUT.name} with {len(inline)} resources.")
