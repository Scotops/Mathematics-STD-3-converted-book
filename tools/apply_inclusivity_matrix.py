"""Apply the Phase 2 inclusivity matrix to the ADT and page facsimiles."""

from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
TEXTS_PATH = ROOT / "content" / "i18n" / "en" / "texts.json"
FONT_PATH = ROOT / "assets" / "fonts" / "SassoonPrimary.ttf"
PDF_WIDTH = 557.906
PDF_HEIGHT = 767.669


@dataclass(frozen=True)
class InclusiveText:
    visible: str
    spoken: str


TEXT_REPLACEMENTS = {
    "pg009_n0003": InclusiveText(
        "Identify / determine / find / state the place value of each digit in the following whole numbers:",
        "Identify, determine, find, or state the place value of each digit in the following whole numbers.",
    ),
    "pg010_n0020": InclusiveText(
        "Identify / determine / find / state the place value of each digit in the following whole numbers:",
        "Identify, determine, find, or state the place value of each digit in the following whole numbers.",
    ),
    "pg010_sec002_q6_heading": InclusiveText(
        "6. Identify / determine / find / state the place value of each digit in the following whole numbers:",
        "Question 6. Identify, determine, find, or state the place value of each digit in the following whole numbers.",
    ),
    "pg017_n0004": InclusiveText(
        "Carefully study / examine / explore / analyze the abaci 1 to 6, then write the number represented by each.",
        "Carefully study, examine, explore, or analyze the abaci 1 to 6, then write the number represented by each.",
    ),
    "pg030_n0084": InclusiveText(
        "Study / review / analyze / examine figure 1 and 2, read / interpret / access / review their captions, and then answer the questions that follow:",
        "Study, review, analyze, or examine figure 1 and 2; read, interpret, access, or review their captions; and then answer the questions that follow.",
    ),
    "pg032_n0004": InclusiveText(
        "In order to easily read or write whole numbers exceeding 10000, identify / determine / find / state the place value of each digit of a given whole number.",
        "In order to easily read or write whole numbers exceeding 10000, identify, determine, find, or state the place value of each digit of a given whole number.",
    ),
    "pg038_n0019": InclusiveText(
        "Carefully study / consider / count / assess the number of bottle tops in group A, B and C.",
        "Carefully study, consider, count, or assess the number of bottle tops in group A, B and C.",
    ),
    "pg039_n0046": InclusiveText(
        "This sequence shows / indicates / demonstrates / displays that the numbers are increasing by 2 in each step.",
        "This sequence shows, indicates, demonstrates, or displays that the numbers are increasing by 2 in each step.",
    ),
    "pg040_n0028": InclusiveText(
        "This sequence shows / indicates / demonstrates / displays that the numbers decrease by 2 in each step.",
        "This sequence shows, indicates, demonstrates, or displays that the numbers decrease by 2 in each step.",
    ),
    "pg080_n0018": InclusiveText(
        "Read / process / review / examine the problem to identify the mathematical operations involved.",
        "Read, process, review, or examine the problem to identify the mathematical operations involved.",
    ),
    "pg082_n0026": InclusiveText(
        "The following picture shows / illustrates / presents / depicts a pupil measuring the length of a table by handspan.",
        "The following picture shows, illustrates, presents, or depicts a pupil measuring the length of a table by handspan.",
    ),
    "pg083_n0028": InclusiveText(
        "The following picture shows / illustrates / presents / depicts some of the standard tools for measuring length.",
        "The following picture shows, illustrates, presents, or depicts some of the standard tools for measuring length.",
    ),
    "pg088_n0003": InclusiveText(
        "The following picture shows / illustrates / presents / depicts two buckets that contain rice.",
        "The following picture shows, illustrates, presents, or depicts two buckets that contain rice.",
    ),
    "pg088_n0015": InclusiveText(
        "The following picture shows / illustrates / presents / depicts examples of weighing balances.",
        "The following picture shows, illustrates, presents, or depicts examples of weighing balances.",
    ),
    "pg090_n0031": InclusiveText(
        "The following picture shows / depicts / represents / illustrates pupils measuring the volume of water by using cups and buckets.",
        "The following picture shows, depicts, represents, or illustrates pupils measuring the volume of water by using cups and buckets.",
    ),
    "pg091_n0035": InclusiveText(
        "The following picture shows / illustrates / presents / depicts some of the standard tools used for measuring volume.",
        "The following picture shows, illustrates, presents, or depicts some of the standard tools used for measuring volume.",
    ),
    "pg092_n0037": InclusiveText(
        "Read / measure / determine / record the volume of water in the cylinder.",
        "Read, measure, determine, or record the volume of water in the cylinder.",
    ),
    "pg093_n0043": InclusiveText(
        "Observe / note / check / examine the following jugs and then write the highest amount each jug can hold.",
        "Observe, note, check, or examine the following jugs and then write the highest amount each jug can hold.",
    ),
    "pg094_n0011": InclusiveText(
        "Observe / experience / note / explore the way people measure lengths, masses and volumes of different items.",
        "Observe, experience, note, or explore the way people measure lengths, masses and volumes of different items.",
    ),
    "pg099_n0025": InclusiveText(
        "Draw / create / represent / construct / model a line which is longer than 10 cm from point A to point B.",
        "Draw, create, represent, construct, or model a line which is longer than 10 centimetres from point A to point B.",
    ),
}


@dataclass(frozen=True)
class Overlay:
    page: int
    text: str
    font_size: float
    # Two values select a background sample point in PDF coordinates; three
    # values provide an exact RGB fill for subtly tinted activity panels.
    background_sample: tuple[float, ...]
    slots: tuple[tuple[float, float, float, float], ...]


OVERLAYS = [
    Overlay(9, TEXT_REPLACEMENTS["pg009_n0003"].visible, 11.0, (480, 145), ((89, 112, 485, 129), (89, 131, 485, 148))),
    Overlay(10, TEXT_REPLACEMENTS["pg010_n0020"].visible, 11.0, (475, 650), ((101, 617, 484, 635), (101, 635, 484, 653))),
    Overlay(17, TEXT_REPLACEMENTS["pg017_n0004"].visible, 11.0, (480, 143), ((89, 110, 484, 128), (89, 128, 484, 146))),
    Overlay(30, TEXT_REPLACEMENTS["pg030_n0084"].visible, 9.1, (475, 615), ((101, 583, 484, 601), (101, 601, 484, 619))),
    Overlay(32, "identify / determine / find / state the place value of each digit of a given whole number.", 10.4, (500, 143), ((72, 128, 484, 146),)),
    Overlay(38, TEXT_REPLACEMENTS["pg038_n0019"].visible, 10.4, (500, 497), ((72, 480, 484, 499),)),
    Overlay(39, TEXT_REPLACEMENTS["pg039_n0046"].visible, 10.0, (480, 660), ((86, 626, 484, 644), (86, 645, 484, 663))),
    Overlay(40, TEXT_REPLACEMENTS["pg040_n0028"].visible, 10.0, (480, 336), ((72, 302, 484, 320), (72, 320, 484, 338))),
    Overlay(80, TEXT_REPLACEMENTS["pg080_n0018"].visible, 10.3, (245, 243, 248), ((130, 236, 470, 255), (130, 255, 470, 274))),
    Overlay(82, TEXT_REPLACEMENTS["pg082_n0026"].visible, 9.0, (500, 676), ((346, 641, 484, 660), (72, 660, 484, 679))),
    Overlay(83, TEXT_REPLACEMENTS["pg083_n0028"].visible, 10.4, (500, 670), ((86, 635, 484, 653), (86, 654, 484, 672))),
    Overlay(88, TEXT_REPLACEMENTS["pg088_n0003"].visible, 9.4, (500, 119), ((384, 83, 484, 102), (72, 103, 484, 122))),
    Overlay(88, TEXT_REPLACEMENTS["pg088_n0015"].visible, 10.2, (500, 389), ((328, 353, 484, 372), (72, 372, 484, 391))),
    Overlay(90, TEXT_REPLACEMENTS["pg090_n0031"].visible, 10.2, (500, 438), ((157, 403, 484, 422), (72, 422, 484, 441))),
    Overlay(91, TEXT_REPLACEMENTS["pg091_n0035"].visible, 10.8, (500, 543), ((395, 488, 484, 507), (86, 507, 484, 526), (86, 526, 484, 545))),
    Overlay(92, TEXT_REPLACEMENTS["pg092_n0037"].visible, 9.3, (239, 250, 254), ((101, 655, 470, 674),)),
    Overlay(93, TEXT_REPLACEMENTS["pg093_n0043"].visible, 10.6, (247, 243, 231), ((115, 394, 484, 413), (115, 413, 484, 432))),
    Overlay(94, TEXT_REPLACEMENTS["pg094_n0011"].visible, 10.5, (239, 250, 254), ((122, 172, 484, 191), (122, 191, 484, 210))),
    Overlay(99, TEXT_REPLACEMENTS["pg099_n0025"].visible, 10.0, (500, 579), ((86, 544, 484, 563), (86, 563, 484, 582))),
]


def update_texts() -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    missing = sorted(set(TEXT_REPLACEMENTS) - set(texts))
    if missing:
        raise KeyError(f"Missing text IDs: {missing}")
    for text_id, replacement in TEXT_REPLACEMENTS.items():
        texts[text_id] = replacement.visible
    TEXTS_PATH.write_text(
        json.dumps(texts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def replace_element(page_html: str, text_id: str, replacement: InclusiveText) -> tuple[str, int]:
    escaped_id = re.escape(text_id)
    pattern = re.compile(
        rf"(<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)\b(?=[^>]*\bdata-id=(?:\"{escaped_id}\"|'{escaped_id}'))[^>]*>)(?P<body>.*?)(</(?P=tag)>)",
        flags=re.DOTALL,
    )

    def apply(match: re.Match[str]) -> str:
        start = re.sub(r"\s+data-tts-text=(?:\"[^\"]*\"|'[^']*')", "", match.group(1))
        start = start[:-1] + f' data-tts-text="{html.escape(replacement.spoken, quote=True)}">'
        return start + html.escape(replacement.visible, quote=False) + match.group(4)

    return pattern.subn(apply, page_html)


def update_html() -> dict[str, int]:
    counts = {text_id: 0 for text_id in TEXT_REPLACEMENTS}
    for path in sorted(ROOT.glob("*.html")):
        source = path.read_text(encoding="utf-8")
        updated = source
        for text_id, replacement in TEXT_REPLACEMENTS.items():
            updated, count = replace_element(updated, text_id, replacement)
            counts[text_id] += count
        updated = updated.replace("?reader=15", "?reader=16")
        updated = updated.replace("pdf-facsimile.js?v=1", "pdf-facsimile.js?v=2")
        updated = updated.replace("offline-preloader.js?v=87", "offline-preloader.js?v=88")
        if updated != source:
            path.write_text(updated, encoding="utf-8")
    # pg010_n0020 is a retained localization alias; the rendered page uses the
    # corrected pg010_sec002_q6_heading element instead.
    localization_only = {"pg010_n0020"}
    missing = [
        text_id
        for text_id, count in counts.items()
        if count == 0 and text_id not in localization_only
    ]
    if missing:
        raise RuntimeError(f"No HTML element found for text IDs: {missing}")
    return counts


def update_manifests() -> None:
    for relative_path in ("content/pages.json", "content/toc.json"):
        path = ROOT / relative_path
        source = path.read_text(encoding="utf-8")
        path.write_text(source.replace("?reader=15", "?reader=16"), encoding="utf-8")
    config_path = ROOT / "assets" / "config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    config["bundleVersion"] = "93"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    script_path = ROOT / "assets" / "pdf-facsimile.js"
    source = script_path.read_text(encoding="utf-8")
    script_path.write_text(source.replace(".jpg?v=1`", ".jpg?v=2`"), encoding="utf-8")


def rebuild_offline_preloader() -> None:
    """Synchronize the offline fetch shim with the current localization data."""
    preloader_path = ROOT / "assets" / "offline-preloader.js"
    source = preloader_path.read_text(encoding="utf-8")
    resource_paths = [
        "./assets/config.json",
        "./assets/interface_translations/en/interface_translations.json",
        "./content/i18n/en/audios.json",
        "./content/i18n/en/images.json",
        "./content/i18n/en/texts.json",
        "./content/i18n/en/timecode/timecode_output.json",
        "./content/i18n/en/videos.json",
        "./content/pages.json",
        "./content/toc.json",
        "./content/navigation/nav.html",
    ]
    inline = {}
    for resource_path in resource_paths:
        disk_path = ROOT / resource_path.removeprefix("./")
        if disk_path.suffix == ".json":
            inline[resource_path] = json.loads(disk_path.read_text(encoding="utf-8"))
        else:
            inline[resource_path] = disk_path.read_text(encoding="utf-8")
    compact = json.dumps(inline, ensure_ascii=False, separators=(",", ":"))
    updated, count = re.subn(
        r"var INLINE = \{.*?\};\s*var BASE_DIR",
        f"var INLINE = {compact};\n  var BASE_DIR",
        source,
        count=1,
        flags=re.DOTALL,
    )
    if count != 1:
        raise RuntimeError("Could not replace offline preloader data")
    preloader_path.write_text(updated, encoding="utf-8")


def sample_background(image: Image.Image, point: tuple[float, float]) -> tuple[int, int, int]:
    scale_x = image.width / PDF_WIDTH
    scale_y = image.height / PDF_HEIGHT
    x = round(point[0] * scale_x)
    y = round(point[1] * scale_y)
    crop = image.crop((x - 4, y - 4, x + 5, y + 5))
    return tuple(round(value) for value in ImageStat.Stat(crop).median[:3])


def wrap_for_slots(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, widths: list[int]) -> list[str]:
    words = text.split()
    lines: list[str] = []
    position = 0
    for width in widths:
        line: list[str] = []
        while position < len(words):
            candidate = " ".join([*line, words[position]])
            if draw.textlength(candidate, font=font) <= width or not line:
                line.append(words[position])
                position += 1
            else:
                break
        lines.append(" ".join(line))
    if position != len(words):
        remaining = " ".join(words[position:])
        raise ValueError(f"Inclusive overlay does not fit: {remaining}")
    return lines


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
            lines = wrap_for_slots(draw, overlay.text, font, [slot[2] for slot in pixel_slots])
            for line, (x, y, _, height) in zip(lines, pixel_slots, strict=True):
                bbox = draw.textbbox((0, 0), line, font=font, anchor="lt")
                text_height = bbox[3] - bbox[1]
                draw.text(
                    (x, y + max(0, (height - text_height) // 2)),
                    line,
                    font=font,
                    fill=(39, 36, 36),
                    anchor="lt",
                )
        image.save(image_path, format="JPEG", quality=92, optimize=True, progressive=True)
        changed_pages.append(page_number)
    return changed_pages


def main() -> None:
    update_texts()
    html_counts = update_html()
    update_manifests()
    rebuild_offline_preloader()
    changed_pages = render_overlays()
    print(
        {
            "text_ids": len(TEXT_REPLACEMENTS),
            "html_elements": sum(html_counts.values()),
            "facsimile_pages": changed_pages,
            "matrix_examples_absent_from_book": ["speak", "listen", "tell"],
        }
    )


if __name__ == "__main__":
    main()
