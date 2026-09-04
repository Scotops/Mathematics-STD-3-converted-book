"""Split the supplied print cover and install it as the ADT front/back covers."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

from apply_inclusivity_matrix import rebuild_offline_preloader


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Book to convert\MATHEMATICS STD III PB\Mathematics Standard 3 PB Cover NOT4SALE.pdf")
INTERIOR = Path(r"C:\Book to convert\MATHEMATICS STD III PB\MATHEMATICS STD III PB (SEPT 2025).pdf")
DPI = 240


def replace_required(path: Path, old: str, new: str) -> None:
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    if old not in source:
        raise RuntimeError(f"{path.name}: expected {old!r}")
    path.write_text(source.replace(old, new), encoding="utf-8")


def render_and_split() -> tuple[int, int]:
    renderer = shutil.which("pdftoppm")
    if not renderer:
        raise RuntimeError("pdftoppm is required")

    scratch = ROOT / "tmp" / "pdfs" / "cover-not4sale"
    scratch.mkdir(parents=True, exist_ok=True)
    prefix = scratch / "spread-240"
    subprocess.run(
        [renderer, "-f", "1", "-singlefile", "-r", str(DPI), "-png", str(SOURCE), str(prefix)],
        check=True,
    )

    cover_page = PdfReader(str(SOURCE)).pages[0]
    interior_page = PdfReader(str(INTERIOR)).pages[0]
    media = cover_page.mediabox
    trim = cover_page.trimbox
    page_width = float(interior_page.trimbox.width)
    page_height = float(interior_page.trimbox.height)
    if abs(float(trim.height) - page_height) > 0.1:
        raise RuntimeError("Cover and interior trim heights do not agree")

    with Image.open(prefix.with_suffix(".png")) as spread:
        scale_x = spread.width / float(media.width)
        scale_y = spread.height / float(media.height)
        top = round((float(media.top) - float(trim.top)) * scale_y)
        bottom = round((float(media.top) - float(trim.bottom)) * scale_y)
        back_left = round(float(trim.left) * scale_x)
        back_right = round((float(trim.left) + page_width) * scale_x)
        front_left = round((float(trim.right) - page_width) * scale_x)
        front_right = round(float(trim.right) * scale_x)

        back = spread.crop((back_left, top, back_right, bottom)).convert("RGB")
        front = spread.crop((front_left, top, front_right, bottom)).convert("RGB")
        width = min(front.width, back.width)
        height = min(front.height, back.height)
        front = front.crop((0, 0, width, height))
        back = back.crop((0, 0, width, height))

        destination = ROOT / "images" / "pdf-pages"
        front.save(destination / "pg-001.jpg", quality=95, subsampling=0, progressive=True)
        back.save(destination / "pg-185.jpg", quality=95, subsampling=0, progressive=True)
        front.save(ROOT / "cover.png", optimize=True)
    return width, height


def update_manifests() -> None:
    pages_path = ROOT / "content" / "pages.json"
    pages = json.loads(pages_path.read_text(encoding="utf-8"))
    for entry in pages:
        if entry["section_id"] == "pg184_sec001":
            entry["href"] = entry["href"].replace("?reader=32", "?reader=33")
    if pages[-1]["section_id"] != "pg185_sec001":
        pages.append({"section_id": "pg185_sec001", "href": "pg185_sec001.html?reader=33"})
    pages_path.write_text(json.dumps(pages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    toc_path = ROOT / "content" / "toc.json"
    toc = json.loads(toc_path.read_text(encoding="utf-8"))
    for entry in toc:
        if entry["section_id"] == "pg184_sec001":
            entry["href"] = entry["href"].replace("?reader=32", "?reader=33")
    if not any(entry["section_id"] == "pg185_sec001" for entry in toc):
        toc.append(
            {
                "section_id": "pg185_sec001",
                "href": "pg185_sec001.html?reader=33",
                "title": "Back cover",
                "chapter_id": "pg185_sec001",
            }
        )
    toc_path.write_text(json.dumps(toc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_bundle() -> None:
    for path in (ROOT / "index.html", ROOT / "pg184_sec001.html", ROOT / "pg185_sec001.html"):
        source = path.read_text(encoding="utf-8")
        source = source.replace("assets/offline-preloader.js?v=104", "assets/offline-preloader.js?v=105")
        source = source.replace("assets/pdf-facsimile.js?v=6", "assets/pdf-facsimile.js?v=7")
        path.write_text(source, encoding="utf-8")

    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if config.get("bundleVersion") not in {"109", "110"}:
        raise RuntimeError("Expected bundleVersion 109 or 110")
    config["bundleVersion"] = "110"
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    manifest_path = ROOT / "imsmanifest.xml"
    manifest = manifest_path.read_text(encoding="utf-8")
    if '<file href="pg185_sec001.html"/>' not in manifest:
        manifest = manifest.replace(
            '      <file href="pg184_sec001.html"/>',
            '      <file href="pg184_sec001.html"/>\n      <file href="pg185_sec001.html"/>\n      <file href="images/pdf-pages/pg-185.jpg"/>',
        )
        manifest_path.write_text(manifest, encoding="utf-8")

    rebuild_offline_preloader()


def main() -> None:
    if not SOURCE.is_file() or not INTERIOR.is_file():
        raise RuntimeError("The supplied cover or interior PDF is missing")
    width, height = render_and_split()
    update_manifests()
    update_bundle()
    print(f"Installed {width} x {height} front and back covers; reader=33; bundleVersion=110")


if __name__ == "__main__":
    main()
