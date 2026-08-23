"""Apply MATRIX MATHE STD 3 SALMAXXXXXXX (2).docx audio corrections."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
READER_FROM = "21"
READER_TO = "22"
BUNDLE_TO = "99"


def replace_exact(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if old not in source:
        raise RuntimeError(f"Expected text not found in {path.name}: {old}")
    path.write_text(source.replace(old, new), encoding="utf-8")


def repair_pg010_blank_labels() -> int:
    path = ROOT / "pg010_sec001.html"
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'<label for="(pg010_sec002-item-\d+)" class="sr-only">'
        r'(\d+) (Thousands|Hundreds|Tens|Ones)</label>'
    )

    def replacement(match: re.Match[str]) -> str:
        control, number, place = match.groups()
        return (
            f'<label for="{control}" class="sr-only">'
            f'Blank for the {place.lower()} place of {number}</label>'
        )

    updated, count = pattern.subn(replacement, source)
    if count != 16:
        raise RuntimeError(f"Expected 16 page 10 blank labels, found {count}")
    path.write_text(updated, encoding="utf-8")
    return count


def repair_pg022_blank_labels() -> int:
    path = ROOT / "pg022_sec001.html"
    source = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r'<label for="field(\d+)" class="sr-only">'
        r'<span data-id="pg022_n\d+">(\d+)</span></label>'
    )
    places = ("thousands", "hundreds", "tens", "ones")

    def replacement(match: re.Match[str]) -> str:
        field_number = int(match.group(1))
        number = match.group(2)
        place = places[(field_number - 1) % 4]
        return (
            f'<label for="field{field_number}" class="sr-only">'
            f'Blank for the {place} place of {number}</label>'
        )

    updated, count = pattern.subn(replacement, source)
    if count != 16:
        raise RuntimeError(f"Expected 16 page 22 blank labels, found {count}")
    path.write_text(updated, encoding="utf-8")
    return count


def bump_release_versions() -> int:
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = (
            source.replace(f"?reader={READER_FROM}", f"?reader={READER_TO}")
            .replace("accessible-tts.js?v=29", "accessible-tts.js?v=30")
            .replace("offline-preloader.js?v=93", "offline-preloader.js?v=94")
        )
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1

    for relative in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative
        source = path.read_text(encoding="utf-8")
        path.write_text(
            source.replace(f"?reader={READER_FROM}", f"?reader={READER_TO}"),
            encoding="utf-8",
        )

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = BUNDLE_TO
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return changed


def main() -> None:
    page10_labels = repair_pg010_blank_labels()
    page22_labels = repair_pg022_blank_labels()
    html_files = bump_release_versions()
    rebuild_offline_preloader()
    print(
        {
            "page10_blank_labels": page10_labels,
            "page22_blank_labels": page22_labels,
            "versioned_html_files": html_files,
            "reader": READER_TO,
            "bundle": BUNDLE_TO,
        }
    )


if __name__ == "__main__":
    main()
