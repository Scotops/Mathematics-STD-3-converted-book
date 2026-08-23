"""Create a contact sheet of the photographed matrix changes for visual QA."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "accessible-tools-contact-sheet.jpg"
PDF_HEIGHT = 767.669
CROPS = (
    (92, 645, 681),
    (94, 162, 216),
    (100, 245, 300),
    (103, 102, 139),
    (112, 489, 542),
    (112, 538, 574),
    (118, 102, 158),
    (140, 106, 144),
    (157, 101, 157),
    (166, 118, 191),
    (166, 422, 477),
    (167, 72, 127),
)


def main() -> None:
    rows = []
    for page, top, bottom in CROPS:
        path = ROOT / "images" / "pdf-pages" / f"pg-{page:03d}.jpg"
        with Image.open(path) as source:
            image = source.convert("RGB")
        scale_y = image.height / PDF_HEIGHT
        crop = image.crop((0, round((top - 6) * scale_y), image.width, round((bottom + 6) * scale_y)))
        crop.thumbnail((1000, 150), Image.Resampling.LANCZOS)
        row = Image.new("RGB", (1080, 170), "white")
        ImageDraw.Draw(row).text((12, 12), f"p{page}", fill=(0, 0, 0))
        row.paste(crop, (70, max(0, (170 - crop.height) // 2)))
        rows.append(row)
    sheet = Image.new("RGB", (1080, 170 * len(rows)), (225, 225, 225))
    for index, row in enumerate(rows):
        sheet.paste(row, (0, index * 170))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT, quality=94)
    print(OUTPUT)


if __name__ == "__main__":
    main()
