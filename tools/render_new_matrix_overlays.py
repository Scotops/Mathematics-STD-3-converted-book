"""Render the visible wording required by MATH THREE NEW MATRIX.docx.

The reader shows watermark-free PDF facsimiles, so semantic HTML corrections
must also be painted into the corresponding facsimile. This renderer starts
from the current images to preserve all previously approved matrix overlays.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from apply_inclusivity_matrix import (
    FONT_PATH,
    PDF_HEIGHT,
    PDF_WIDTH,
    Overlay,
    draw_fitted_line,
    partition_for_slots,
    restore_page_from_clean_pdf,
    sample_background,
)


ROOT = Path(__file__).resolve().parents[1]


OVERLAYS = (
    Overlay(
        107,
        "How many rays can you draw or mention from a single point?",
        16.0,
        (247, 243, 231),
        ((115, 82, 484, 103),),
    ),
    Overlay(
        109,
        "Use accessible tools. Identify a computer programme for drawing plane figures.",
        16.0,
        (239, 250, 254),
        ((115, 465, 484, 486),),
    ),
    Overlay(
        116,
        "Use accessible tools. Take a knife, marker pen, and an orange or watermelon.",
        16.0,
        (239, 250, 254),
        ((101, 521, 474, 542),),
    ),
    Overlay(
        122,
        "Answer the following questions by using assistive devices and drawings:",
        16.0,
        (247, 243, 231),
        ((101, 371, 474, 393),),
    ),
    Overlay(
        125,
        "Use drawings that include assistive devices to find the correct answer to the following question:",
        16.0,
        (500, 520),
        ((86, 502, 484, 522), (86, 522, 484, 542)),
    ),
    Overlay(
        126,
        "Use accessible tools and drawings to find the answer to the following question:",
        16.0,
        (500, 550),
        ((72, 540, 474, 562),),
    ),
    Overlay(
        131,
        "Use assistive devices. Draw different shapes and divide them into equal parts. Shade and label the fractions.",
        16.0,
        (239, 250, 254),
        ((189, 568, 484, 591), (189, 592, 484, 615)),
    ),
    Overlay(
        146,
        "Use assistive devices. Draw arrows on the following clock faces to show the time indicated:",
        16.0,
        (247, 243, 231),
        ((101, 80, 474, 101), (101, 101, 474, 122)),
    ),
    Overlay(
        147,
        "Use an assistive device. Draw digital and analogue clock faces to show each of the following times:",
        16.0,
        (247, 243, 231),
        ((115, 80, 484, 101), (115, 101, 484, 122)),
    ),
    Overlay(
        156,
        "Use accessible tools and basic drawing software (for example, Paint) to create a digital timetable illustrating your daily activities. Draw both analogue and digital clock faces to depict the times you engage in each activity.",
        16.0,
        (239, 250, 254),
        (
            (155, 318, 474, 336),
            (155, 337, 474, 355),
            (155, 356, 474, 374),
            (155, 375, 474, 393),
            (155, 394, 474, 412),
        ),
    ),
)


EDGE_STRIPS = {
    116: ((475, 518, 493, 545),),
    122: ((475, 368, 493, 396),),
    126: ((475, 537, 493, 565),),
    146: ((475, 77, 493, 125),),
    156: ((475, 315, 493, 415),),
}


def pixel_box(
    image: Image.Image,
    box: tuple[float, float, float, float],
) -> tuple[int, int, int, int]:
    scale_x = image.width / PDF_WIDTH
    scale_y = image.height / PDF_HEIGHT
    x0, y0, x1, y1 = box
    return (
        round(x0 * scale_x),
        round(y0 * scale_y),
        round(x1 * scale_x),
        round(y1 * scale_y),
    )


def main() -> None:
    by_page: dict[int, list[Overlay]] = defaultdict(list)
    for overlay in OVERLAYS:
        by_page[overlay.page].append(overlay)

    for page_number, overlays in sorted(by_page.items()):
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as source:
            image = source.convert("RGB")
        if page_number in EDGE_STRIPS:
            clean = restore_page_from_clean_pdf(page_number)
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
                else sample_background(
                    image,
                    (overlay.background_sample[0], overlay.background_sample[1]),
                )
            )
            pixel_slots = []
            for x0, top, x1, bottom in overlay.slots:
                draw.rectangle(
                    (
                        round((x0 - 0.8) * scale_x),
                        round((top - 0.8) * scale_y),
                        round(x1 * scale_x),
                        round((bottom + 0.8) * scale_y),
                    ),
                    fill=background,
                )
                pixel_slots.append(
                    (
                        round(x0 * scale_x),
                        round(top * scale_y),
                        round((x1 - x0) * scale_x),
                        round((bottom - top) * scale_y),
                    )
                )
            lines = partition_for_slots(
                draw,
                overlay.text,
                font,
                [slot[2] for slot in pixel_slots],
            )
            for line, slot in zip(lines, pixel_slots, strict=True):
                draw_fitted_line(image, line, font, slot)

        image.save(
            image_path,
            format="JPEG",
            quality=92,
            optimize=True,
            progressive=True,
        )

    print({"pages": sorted(by_page), "overlays": len(OVERLAYS)})


if __name__ == "__main__":
    main()
