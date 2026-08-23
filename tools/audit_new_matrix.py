"""Audit every row from MATH THREE NEW MATRIX.docx."""

from __future__ import annotations

import json
import re
from pathlib import Path

from lxml import html
from PIL import Image

from generate_new_matrix_audio import (
    EXPLICIT_SPEECH,
    TIME_PAGES,
    TIME_PATTERN,
    normalize_time_abbreviations,
)
from render_new_matrix_overlays import OVERLAYS


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"


VISIBLE = {
    "pg107_n0003": "11. How many rays can you draw or mention from a single point?",
    "pg109_n0024": "Use accessible tools. Identify a computer programme for drawing plane figures.",
    "pg116_n0034": "Use accessible tools. Take a knife, marker pen, and an orange or watermelon.",
    "pg122_n0018": "Answer the following questions by using assistive devices and drawings:",
    "pg125_n0030": "Use drawings that include assistive devices to find the correct answer to the following question:",
    "pg126_n0028": "Use accessible tools and drawings to find the answer to the following question:",
    "pg131_n0027": "Use assistive devices. Draw different shapes and divide them into equal parts.",
    "pg146_n0003": "Use assistive devices. Draw arrows on the following clock faces to show the time indicated:",
    "pg147_n0003": "Use an assistive device. Draw digital and analogue clock faces to show each of the following times:",
    "pg156_n0023": "Instructions: Use accessible tools and basic drawing software (for example, Paint) to create a digital timetable illustrating your daily activities.",
}


def main() -> int:
    texts = json.loads((I18N / "texts.json").read_text(encoding="utf-8"))
    audios = json.loads((I18N / "audios.json").read_text(encoding="utf-8"))
    failures: list[str] = []
    occurrences = {text_id: 0 for text_id in VISIBLE}
    page_trees = {}

    for path in ROOT.glob("*.html"):
        source = path.read_text(encoding="utf-8")
        tree = html.fromstring(source)
        page_trees[path.name] = tree
        for text_id, expected in VISIBLE.items():
            for element in tree.xpath(f'//*[@data-id="{text_id}"]'):
                occurrences[text_id] += 1
                visible = " ".join("".join(element.itertext()).split())
                if visible != expected:
                    failures.append(f"{path.name}:{text_id}:visible")
                if element.get("data-tts-text") != EXPLICIT_SPEECH[text_id]:
                    failures.append(f"{path.name}:{text_id}:spoken")

    for text_id, expected in VISIBLE.items():
        if texts.get(text_id) != expected:
            failures.append(f"texts:{text_id}")
        if occurrences[text_id] == 0:
            failures.append(f"html-missing:{text_id}")

    # Page 59: ten separately identified questions plus a TTS pause rule for
    # combined number/equation spans.
    page59 = page_trees["pg059_sec001.html"]
    for index in range(1, 11):
        text_id = f"pg059_n{index + 10:04d}"
        if not page59.xpath(f'//*[@data-id="{text_id}"]'):
            failures.append(f"page59-question:{index}")
    tts_source = (ROOT / "assets" / "accessible-tts.js").read_text(encoding="utf-8")
    if "by one instead of as one continuous string" not in tts_source:
        failures.append("page59-pause-rule")

    # Page 96: the identical image alt and printed object label are narrated
    # once, while non-identical descriptive alts remain available.
    if "Printed object labels often repeat an immediately adjacent image alt" not in tts_source:
        failures.append("page96-adjacent-dedup")
    for text_id in ("pg096_im001", "pg096_n0017", "pg096_im002", "pg096_n0025", "pg096_im003", "pg096_n0033"):
        if text_id not in texts:
            failures.append(f"page96:{text_id}")

    # Rows already solved by the previous matrix must remain solved.
    retained = {
        "pg112_n0037": "Use accessible tools.",
        "pg112_n0039": "Use accessible tools.",
        "pg118_n0005": "Use accessible tools.",
        "pg140_n0004": "Use accessible tools.",
    }
    for text_id, prefix in retained.items():
        if not texts.get(text_id, "").startswith(prefix):
            failures.append(f"retained:{text_id}")
    for image_id in ("pg118_im001", "pg118_im002", "pg118_im003"):
        if image_id not in texts:
            failures.append(f"page118-drawing:{image_id}")

    # Page 155: the calendar detail block must be available to narration, and
    # every printed public holiday must be present after the calendar grids.
    page155 = page_trees["pg155_sec001.html"]
    calendar = page155.xpath('//*[@data-tts-calendar-details="true"]')
    if not calendar or calendar[0].get("hidden") is not None or calendar[0].get("aria-hidden") == "true":
        failures.append("page155-calendar-hidden")
    holiday_ids = ["pg155_n0174", *[f"pg155_n{number:04d}" for number in range(177, 210, 2)]]
    for text_id in holiday_ids:
        if not page155.xpath(f'//*[@data-id="{text_id}"]'):
            failures.append(f"page155-holiday:{text_id}")

    # Pages 149-151 and 158: both live TTS and every mapped fallback recording
    # use explicit A M / P M speech.
    if normalize_time_abbreviations("4:00 p.m.") != "4:00 P M":
        failures.append("time-normalizer:pm")
    if normalize_time_abbreviations("8:10 am") != "8:10 A M":
        failures.append("time-normalizer:am")
    if "Time abbreviations must be spoken as letters" not in tts_source:
        failures.append("runtime-time-normalizer")
    time_ids = {
        text_id
        for text_id, value in texts.items()
        if text_id.startswith(TIME_PAGES) and TIME_PATTERN.search(value)
    }
    for text_id in sorted(time_ids | set(EXPLICIT_SPEECH)):
        filename = audios.get(text_id, "")
        audio_path = I18N / "audio" / filename
        if not filename or not audio_path.is_file() or audio_path.stat().st_size < 512:
            failures.append(f"audio:{text_id}")

    overlay_pages = sorted({overlay.page for overlay in OVERLAYS})
    for overlay in OVERLAYS:
        if overlay.font_size != 16.0:
            failures.append(f"font-size:{overlay.page}")
    for page_number in overlay_pages:
        image_path = ROOT / "images" / "pdf-pages" / f"pg-{page_number:03d}.jpg"
        with Image.open(image_path) as image:
            if image.size != (1085, 1493):
                failures.append(f"page-image:{page_number}:{image.size}")
            image.verify()

    print(
        json.dumps(
            {
                "matrix_rows": 21,
                "changed_text_ids": len(VISIBLE),
                "html_occurrences": sum(occurrences.values()),
                "time_audio_files": len(time_ids),
                "facsimile_pages": overlay_pages,
                "failures": failures,
            },
            indent=2,
        )
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
