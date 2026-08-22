"""Create a contact sheet of every revised inclusivity phrase for visual QA."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "inclusivity-font-contact-sheet.jpg"
PDF_WIDTH = 557.906
PDF_HEIGHT = 767.669
CROPS = (
    (9, 105, 155),
    (10, 610, 660),
    (17, 85, 150),
    (30, 575, 625),
    (32, 118, 152),
    (38, 470, 505),
    (39, 615, 670),
    (40, 292, 345),
    (80, 226, 280),
    (82, 630, 685),
    (83, 625, 680),
    (88, 73, 128),
    (88, 343, 398),
    (90, 393, 448),
    (91, 478, 552),
    (92, 645, 680),
    (93, 384, 438),
    (94, 162, 216),
    (99, 534, 588),
)


def main() -> None:
    rows = []
    for page, top, bottom in CROPS:
        path = ROOT / "images" / "pdf-pages" / f"pg-{page:03d}.jpg"
        with Image.open(path) as source:
            image = source.convert("RGB")
        scale_y = image.height / PDF_HEIGHT
        crop = image.crop((0, round((top - 8) * scale_y), image.width, round((bottom + 8) * scale_y)))
        crop.thumbnail((1000, 145), Image.Resampling.LANCZOS)
        row = Image.new("RGB", (1080, 165), "white")
        ImageDraw.Draw(row).text((12, 12), f"p{page}", fill=(0, 0, 0))
        row.paste(crop, (70, max(0, (165 - crop.height) // 2)))
        rows.append(row)
    sheet = Image.new("RGB", (1080, 165 * len(rows)), (225, 225, 225))
    for index, row in enumerate(rows):
        sheet.paste(row, (0, index * 165))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT, quality=94)
    print(OUTPUT)


if __name__ == "__main__":
    main()
