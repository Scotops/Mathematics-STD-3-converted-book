"""Add explicit, natural 24-hour-time narration to Chapter Six pages."""

import html
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXTS_PATH = ROOT / "content/i18n/en/texts.json"
PAGE_RANGE = (*range(147, 154), 158)

ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
TEENS = {
    10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
    15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen",
}
TENS = {20: "twenty", 30: "thirty", 40: "forty", 50: "fifty"}


def number_words(value: int) -> str:
    if value < 10:
        return ONES[value]
    if value < 20:
        return TEENS[value]
    tens, ones = divmod(value, 10)
    return TENS[tens * 10] + (f"-{ONES[ones]}" if ones else "")


def spoken_24_hour(value: str) -> str:
    hour, minute = int(value[:2]), int(value[2:])
    if hour == 0:
        hour_words = "zero zero"
    elif hour < 10:
        hour_words = f"zero {number_words(hour)}"
    else:
        hour_words = number_words(hour)

    if minute == 0:
        return "zero zero zero zero hours" if hour == 0 else f"{hour_words} hundred hours"
    if minute < 10:
        minute_words = f"zero {number_words(minute)}"
    else:
        minute_words = number_words(minute)
    return f"{hour_words} {minute_words} hours"


FOUR_DIGIT_TIME = re.compile(r"(?<!\d)([0-2]\d[0-5]\d)(?:\s+hours?)?(?!\d)", re.I)


def speech_text(value: str) -> str:
    return FOUR_DIGIT_TIME.sub(lambda match: spoken_24_hour(match.group(1)), value)


def set_tts_attribute(source: str, text_id: str, spoken: str) -> tuple[str, int]:
    escaped_id = re.escape(text_id)
    pattern = re.compile(rf'(<[^>]+\bdata-id="{escaped_id}")([^>]*)(>)')

    def replace(match: re.Match[str]) -> str:
        prefix, attributes, close = match.groups()
        attributes = re.sub(r'\s+data-tts-text="[^"]*"', "", attributes)
        return f'{prefix}{attributes} data-tts-text="{html.escape(spoken, quote=True)}"{close}'

    return pattern.subn(replace, source, count=1)


def main() -> None:
    texts = json.loads(TEXTS_PATH.read_text(encoding="utf-8"))
    total = 0
    missing = []
    for page_number in PAGE_RANGE:
        prefix = f"pg{page_number:03d}_"
        page_ids = {
            key: speech_text(value)
            for key, value in texts.items()
            if key.startswith(prefix) and FOUR_DIGIT_TIME.search(value)
        }
        for page_path in sorted(ROOT.glob(f"pg{page_number:03d}_sec*.html")):
            source = page_path.read_text(encoding="utf-8")
            changed = 0
            for text_id, spoken in page_ids.items():
                source, count = set_tts_attribute(source, text_id, spoken)
                changed += count
            source = re.sub(
                r'aria-label="([^"]*[0-2]\d[0-5]\d(?:\s+hours?)?[^"]*)"',
                lambda match: f'aria-label="{html.escape(speech_text(html.unescape(match.group(1))), quote=True)}"',
                source,
            )
            if changed:
                page_path.write_text(source, encoding="utf-8")
                total += changed
        for text_id in page_ids:
            if not any(f'data-id="{text_id}"' in p.read_text(encoding="utf-8") for p in ROOT.glob(f"pg{page_number:03d}_sec*.html")):
                missing.append(text_id)

    # The semantic conversion table uses narration-only rows; update both its
    # accessible labels and its explicit TTS text to grouped 24-hour readings.
    table_path = ROOT / "pg148_sec001.html"
    table = table_path.read_text(encoding="utf-8")
    table_times = [
        "0000", "0001", "0100", "0200", "0300", "0400", "0500", "0600", "0700",
        "0800", "0900", "1000", "1100", "1200", "1201", "1300", "1400", "1500",
    ]
    for row, time_value in enumerate(table_times, start=1):
        text_id = f"pg148_tbl_r{row:02d}"
        visible = texts[text_id]
        twelve_hour_value = visible.split(" corresponds to ", 1)[0]
        spoken = f"{twelve_hour_value} corresponds to {spoken_24_hour(time_value)} in 24-hour format."
        table = re.sub(
            rf'(<tr\s+aria-label=")[^"]*("[^>]*>\s*<td>\s*<span[^>]+data-id="{text_id}"[^>]*data-tts-text=")[^"]*(")',
            lambda m: m.group(1) + html.escape(spoken, quote=True) + m.group(2) + html.escape(spoken, quote=True) + m.group(3),
            table,
            count=1,
        )
    table_path.write_text(table, encoding="utf-8")
    print(f"Updated {total} four-digit time narration elements.")
    if missing:
        print("Text IDs without HTML elements:", ", ".join(missing))


if __name__ == "__main__":
    main()
