"""Remove background tabs left by accessible-text overlays at panel edges."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from apply_accessible_tools_matrix import REPLACEMENTS
from apply_inclusivity_matrix import (
    FONT_PATH,
    PDF_HEIGHT,
    PDF_WIDTH,
    Overlay,
    draw_fitted_line,
    partition_for_slots,
    rebuild_offline_preloader,
    restore_page_from_clean_pdf,
    sample_background,
)


ROOT = Path(__file__).resolve().parents[1]


# These panels end at about x=477 in PDF coordinates. Text is kept inside
# x=474; the original clean edge/border is restored from the watermark-free
# source PDF from x=475 onward.
REPAIRED_OVERLAYS = (
    Overlay(94, REPLACEMENTS["pg094_n0011"].visible, 16.0, (239, 250, 254), ((122, 172, 474, 191), (122, 191, 474, 210))),
    Overlay(100, REPLACEMENTS["pg100_n0011"].visible, 16.0, (239, 250, 254), ((101, 255, 474, 274), (101, 274, 474, 293))),
    Overlay(112, REPLACEMENTS["pg112_n0037"].visible, 16.0, (239, 250, 254), ((101, 499, 474, 518), (101, 518, 474, 537))),
    Overlay(112, REPLACEMENTS["pg112_n0039"].visible, 16.0, (239, 250, 254), ((101, 548, 474, 567),)),
    Overlay(118, REPLACEMENTS["pg118_n0005"].visible, 16.0, (247, 243, 231), ((101, 112, 474, 131), (101, 131, 474, 150))),
    Overlay(140, REPLACEMENTS["pg140_n0004"].visible, 16.0, (500, 125), ((72, 116, 473, 136),)),
    Overlay(166, REPLACEMENTS["pg166_n0008"].visible, 16.0, (247, 243, 231), ((101, 128, 474, 147), (101, 147, 474, 166), (101, 166, 474, 185))),
    Overlay(166, REPLACEMENTS["pg166_n0080"].visible, 16.0, (247, 243, 231), ((101, 432, 474, 451), (101, 451, 474, 470))),
)

EDGE_STRIPS = {
    94: ((475, 169, 493, 213),),
    100: ((475, 252, 493, 296),),
    112: ((475, 496, 493, 540), (475, 545, 493, 570)),
    118: ((475, 109, 493, 153),),
    140: ((474, 113, 493, 139),),
    166: ((475, 125, 493, 188), (475, 429, 493, 473)),
}


def pixel_box(image: Image.Image, box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    scale_x = image.width / PDF_WIDTH
    scale_y = image.height / PDF_HEIGHT
    x0, y0, x1, y1 = box
    return (round(x0 * scale_x), round(y0 * scale_y), round(x1 * scale_x), round(y1 * scale_y))


def repair_images() -> list[int]:
    by_page: dict[int, list[Overlay]] = {}
    for overlay in REPAIRED_OVERLAYS:
        by_page.setdefault(overlay.page, []).append(overlay)

    changed = []
    for page_number, overlays in sorted(by_page.items()):
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as current:
            image = current.convert("RGB")
        clean = restore_page_from_clean_pdf(page_number)

        # Restore only the original panel edge and surrounding white margin.
        for strip in EDGE_STRIPS[page_number]:
            box = pixel_box(image, strip)
            image.paste(clean.crop(box), box)

        draw = ImageDraw.Draw(image)
        scale_x = image.width / PDF_WIDTH
        scale_y = image.height / PDF_HEIGHT
        for overlay in overlays:
            font = ImageFont.truetype(str(FONT_PATH), round(overlay.font_size * scale_y))
            background = (
                tuple(int(value) for value in overlay.background_sample)
                if len(overlay.background_sample) == 3
                else sample_background(image, (overlay.background_sample[0], overlay.background_sample[1]))
            )
            pixel_slots = []
            for x0, top, x1, bottom in overlay.slots:
                # Stop the repaint exactly at the text boundary; never extend
                # the fill across the restored panel edge.
                box = (
                    round((x0 - 1.2) * scale_x),
                    round((top - 1.0) * scale_y),
                    round(x1 * scale_x),
                    round((bottom + 1.0) * scale_y),
                )
                draw.rectangle(box, fill=background)
                pixel_slots.append(
                    (
                        round(x0 * scale_x),
                        round(top * scale_y),
                        round((x1 - x0) * scale_x),
                        round((bottom - top) * scale_y),
                    )
                )
            lines = partition_for_slots(draw, overlay.text, font, [slot[2] for slot in pixel_slots])
            for line, slot in zip(lines, pixel_slots, strict=True):
                draw_fitted_line(image, line, font, slot)

        image.save(image_path, format="JPEG", quality=92, optimize=True, progressive=True)
        changed.append(page_number)
    return changed


def publish_versions() -> int:
    changed = 0
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source.replace("?reader=19", "?reader=20")
        updated = updated.replace("pdf-facsimile.js?v=4", "pdf-facsimile.js?v=5")
        updated = updated.replace("offline-preloader.js?v=91", "offline-preloader.js?v=92")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    for relative_path in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative_path
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=19", "?reader=20"), encoding="utf-8")
    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "97"
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    facsimile_path = ROOT / "assets" / "pdf-facsimile.js"
    source = facsimile_path.read_text(encoding="utf-8")
    facsimile_path.write_text(source.replace(".jpg?v=4`", ".jpg?v=5`"), encoding="utf-8")
    rebuild_offline_preloader()
    return changed


def main() -> None:
    pages = repair_images()
    html_files = publish_versions()
    print({"repaired_pages": pages, "html_files": html_files, "reader": 20, "bundle": 97})


if __name__ == "__main__":
    main()
