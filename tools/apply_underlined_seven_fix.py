"""Publish the page 20 correction for the underlined digit in 4765."""

from __future__ import annotations

import json
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
CORRECT_MARKUP = (
    'text-[#222]">4<span style="text-decoration: underline; '
    'text-underline-offset: 0.16em;">7</span>65</span>'
)


def main() -> None:
    page = ROOT / "pg020_sec001.html"
    if CORRECT_MARKUP not in page.read_text(encoding="utf-8"):
        raise RuntimeError("Page 20 does not underline digit 7 in 4765")

    versioned_html = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("offline-preloader.js?v=94", "offline-preloader.js?v=95")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            versioned_html += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=22", "?reader=23"), encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "100"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rebuild_offline_preloader()
    print({"underlined_digit": 7, "number": 4765, "versioned_html": versioned_html})


if __name__ == "__main__":
    main()
