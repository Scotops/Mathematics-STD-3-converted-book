"""Apply the photographed accessible-tools matrix to the ADT bundle."""

from __future__ import annotations

import asyncio
import html
import json
import re
from dataclasses import dataclass
from pathlib import Path

import edge_tts
from PIL import Image, ImageDraw, ImageFont

from apply_inclusivity_matrix import (
    FONT_PATH,
    PDF_HEIGHT,
    PDF_WIDTH,
    Overlay,
    draw_fitted_line,
    partition_for_slots,
    rebuild_offline_preloader,
    sample_background,
)


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
TEXTS_PATH = I18N / "texts.json"
AUDIO_MAP_PATH = I18N / "audios.json"
AUDIO_DIR = I18N / "audio"
VOICE = "en-US-AvaMultilingualNeural"
AUDIO_SUFFIX = "accessible_tools_matrix_v1"


@dataclass(frozen=True)
class MatrixText:
    visible: str
    spoken: str


REPLACEMENTS = {
    "pg092_n0037": MatrixText(
        "Use accessible tools. Read / measure / determine / record the volume of water in the cylinder.",
        "Use accessible tools. Read, measure, determine, or record the volume of water in the cylinder.",
    ),
    "pg094_n0011": MatrixText(
        "Use accessible tools. Observe / experience / note / explore the way people measure lengths, masses and volumes of different items.",
        "Use accessible tools. Observe, experience, note, or explore the way people measure lengths, masses and volumes of different items.",
    ),
    "pg100_n0011": MatrixText(
        "Use accessible tools. Connect points A and B, C and D, and E and F, using a pencil and free hand.",
        "Use accessible tools. Connect points A and B, C and D, and E and F, using a pencil and free hand.",
    ),
    "pg103_n0005": MatrixText(
        "Use accessible tools. Draw line segments of the following lengths:",
        "Use accessible tools. Draw line segments of the following lengths.",
    ),
    "pg112_n0037": MatrixText(
        "Use accessible tools. Draw and label two line segments of length 4 cm and 5 cm, respectively.",
        "Use accessible tools. Draw and label two line segments of length 4 centimetres and 5 centimetres, respectively.",
    ),
    "pg112_n0039": MatrixText(
        "Use accessible tools. Draw a ray PQ.",
        "Use accessible tools. Draw a ray P Q.",
    ),
    "pg118_n0005": MatrixText(
        "Use accessible tools. Draw a circle and then divide it and shade it to show the following fractions:",
        "Use accessible tools. Draw a circle and then divide it and shade it to show the following fractions.",
    ),
    "pg140_n0004": MatrixText(
        "Use accessible tools. Draw an analogue clock face that shows 04:00.",
        "Use accessible tools. Draw an analogue clock face that shows four o'clock.",
    ),
    "pg157_n0005": MatrixText(
        "Draw / identify the face of an analogue clock for each of the following times:",
        "Draw or identify the face of an analogue clock for each of the following times.",
    ),
    "pg166_n0008": MatrixText(
        "Read / identify and write in words the value of money written in short form in the following table.",
        "Read or identify and write in words the value of money written in short form in the following table.",
    ),
    "pg166_n0080": MatrixText(
        "Read / identify and write in short form the value of money written in words.",
        "Read or identify and write in short form the value of money written in words.",
    ),
    "pg167_n0003": MatrixText(
        "Read / identify and write the currency in short form in the following table.",
        "Read or identify and write the currency in short form in the following table.",
    ),
}


OVERLAYS = (
    Overlay(92, REPLACEMENTS["pg092_n0037"].visible, 16.0, (239, 250, 254), ((101, 655, 470, 674),)),
    Overlay(94, REPLACEMENTS["pg094_n0011"].visible, 16.0, (239, 250, 254), ((122, 172, 484, 191), (122, 191, 484, 210))),
    Overlay(100, REPLACEMENTS["pg100_n0011"].visible, 16.0, (239, 250, 254), ((101, 255, 484, 274), (101, 274, 484, 293))),
    Overlay(103, REPLACEMENTS["pg103_n0005"].visible, 16.0, (247, 243, 231), ((115, 112, 484, 131),)),
    Overlay(112, REPLACEMENTS["pg112_n0037"].visible, 16.0, (239, 250, 254), ((101, 499, 484, 518), (101, 518, 484, 537))),
    Overlay(112, REPLACEMENTS["pg112_n0039"].visible, 16.0, (239, 250, 254), ((101, 548, 484, 567),)),
    Overlay(118, REPLACEMENTS["pg118_n0005"].visible, 16.0, (247, 243, 231), ((101, 112, 484, 131), (101, 131, 484, 150))),
    Overlay(140, REPLACEMENTS["pg140_n0004"].visible, 16.0, (500, 125), ((72, 116, 484, 136),)),
    Overlay(157, REPLACEMENTS["pg157_n0005"].visible, 16.0, (239, 250, 254), ((115, 111, 484, 130), (115, 130, 484, 149))),
    Overlay(166, REPLACEMENTS["pg166_n0008"].visible, 16.0, (247, 243, 231), ((101, 128, 484, 147), (101, 147, 484, 166), (101, 166, 484, 185))),
    Overlay(166, REPLACEMENTS["pg166_n0080"].visible, 16.0, (247, 243, 231), ((101, 432, 484, 451), (101, 451, 484, 470))),
    Overlay(167, REPLACEMENTS["pg167_n0003"].visible, 16.0, (247, 243, 231), ((120, 82, 484, 101), (120, 101, 484, 120))),
)


def replace_element(source: str, text_id: str, replacement: MatrixText) -> tuple[str, int]:
    escaped_id = re.escape(text_id)
    pattern = re.compile(
        rf"(<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)\b(?=[^>]*\bdata-id=(?:\"{escaped_id}\"|'{escaped_id}'))[^>]*>)(?P<body>.*?)(</(?P=tag)>)",
        flags=re.DOTALL,
    )

    def apply(match: re.Match[str]) -> str:
        start = re.sub(r"\s+data-tts-text=(?:\"[^\"]*\"|'[^']*')", "", match.group(1))
        start = start[:-1] + f' data-tts-text="{html.escape(replacement.spoken, quote=True)}">'
        return start + html.escape(replacement.visible, quote=False) + match.group(4)

    return pattern.subn(apply, source)


def update_text_and_html() -> dict[str, int]:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    missing = sorted(set(REPLACEMENTS) - set(texts))
    if missing:
        raise KeyError(f"Missing text IDs: {missing}")
    for text_id, replacement in REPLACEMENTS.items():
        texts[text_id] = replacement.visible
    TEXTS_PATH.write_text(json.dumps(texts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = {text_id: 0 for text_id in REPLACEMENTS}
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source
        for text_id, replacement in REPLACEMENTS.items():
            updated, count = replace_element(updated, text_id, replacement)
            counts[text_id] += count
        updated = updated.replace("?reader=17", "?reader=18")
        updated = updated.replace("pdf-facsimile.js?v=3", "pdf-facsimile.js?v=4")
        updated = updated.replace("offline-preloader.js?v=89", "offline-preloader.js?v=90")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
    missing_html = [text_id for text_id, count in counts.items() if count == 0]
    if missing_html:
        raise RuntimeError(f"No HTML element found for text IDs: {missing_html}")
    return counts


def update_manifests() -> None:
    for relative_path in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative_path
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=17", "?reader=18"), encoding="utf-8")
    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "95"
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    facsimile_path = ROOT / "assets" / "pdf-facsimile.js"
    source = facsimile_path.read_text(encoding="utf-8")
    facsimile_path.write_text(source.replace(".jpg?v=3`", ".jpg?v=4`"), encoding="utf-8")


def render_overlays() -> list[int]:
    by_page: dict[int, list[Overlay]] = {}
    for overlay in OVERLAYS:
        by_page.setdefault(overlay.page, []).append(overlay)
    changed_pages = []
    for page_number, overlays in sorted(by_page.items()):
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as original:
            image = original.convert("RGB")
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
                box = (
                    round((x0 - 1.2) * scale_x),
                    round((top - 1.0) * scale_y),
                    round((x1 + 1.2) * scale_x),
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
        changed_pages.append(page_number)
    return changed_pages


async def regenerate_audio() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    mappings = json.loads(AUDIO_MAP_PATH.read_text(encoding="utf-8"))
    for text_id, replacement in REPLACEMENTS.items():
        filename = f"tts_{text_id}_{AUDIO_SUFFIX}.mp3"
        await edge_tts.Communicate(replacement.spoken, voice=VOICE).save(str(AUDIO_DIR / filename))
        mappings[text_id] = filename
    AUDIO_MAP_PATH.write_text(
        json.dumps(mappings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


async def main() -> None:
    counts = update_text_and_html()
    update_manifests()
    pages = render_overlays()
    await regenerate_audio()
    rebuild_offline_preloader()
    print({"text_ids": len(REPLACEMENTS), "html_elements": sum(counts.values()), "facsimile_pages": pages})


if __name__ == "__main__":
    asyncio.run(main())
