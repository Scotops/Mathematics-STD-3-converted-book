"""Fill missing text/audio mappings for every narrated element in the spine."""

from __future__ import annotations

import argparse
import asyncio
import html as html_module
import json
import re
from pathlib import Path

import edge_tts
from lxml import html


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
TEXTS_PATH = I18N / "texts.json"
AUDIO_MAP_PATH = I18N / "audios.json"
AUDIO_DIR = I18N / "audio"
VOICE = "en-US-GuyNeural"
MFRAC = re.compile(r"<mfrac\b([^>]*)>.*?</mfrac>", re.IGNORECASE | re.DOTALL)
ARIA_LABEL = re.compile(r'aria-label=["\']([^"\']+)["\']', re.IGNORECASE)
TAG = re.compile(r"<[^>]+>")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", html_module.unescape(value)).strip()


def element_text(element) -> str:
    explicit = (element.get("data-tts-text") or "").strip()
    if explicit:
        return clean(explicit)
    tag = element.tag.lower()
    if tag == "img":
        return clean(element.get("alt") or "")
    if tag in {"input", "textarea", "select"}:
        return clean(
            element.get("value")
            or element.get("aria-label")
            or element.get("placeholder")
            or ""
        )
    return clean(" ".join(element.itertext()))


def spoken_text(value: str) -> str:
    def fraction(match: re.Match[str]) -> str:
        label = ARIA_LABEL.search(match.group(1))
        return f" {label.group(1)} " if label else " fraction "

    value = MFRAC.sub(fraction, value)
    value = re.sub(r"(?<!\d)(\d+)\s*/\s*(\d+)(?!\d)", r" \1 over \2 ", value)
    value = TAG.sub(" ", value)
    value = html_module.unescape(value)
    value = re.sub(r"\(\s*([a-j])\s*\)", lambda match: f"{match.group(1).upper()},", value)
    replacements = {
        "÷": " divided by ",
        "×": " times ",
        "−": " minus ",
        "–": " minus ",
        "+": " plus ",
        "=": " equals ",
    }
    for symbol, words in replacements.items():
        value = value.replace(symbol, words)
    value = re.sub(r"\bshs\b", "shillings", value, flags=re.IGNORECASE)
    value = re.sub(r"\bcts\b", "cents", value, flags=re.IGNORECASE)
    return clean(value)


async def render(item_id: str, value: str, semaphore: asyncio.Semaphore) -> tuple[str, str]:
    filename = f"tts_{item_id}_coverage_v1.mp3"
    destination = AUDIO_DIR / filename
    async with semaphore:
        for attempt in range(5):
            try:
                await edge_tts.Communicate(spoken_text(value), voice=VOICE).save(str(destination))
                if destination.stat().st_size < 512:
                    raise RuntimeError("generated audio was unexpectedly small")
                return item_id, filename
            except Exception:
                if attempt == 4:
                    raise
                await asyncio.sleep(2 + attempt * 2)
    raise RuntimeError("unreachable")


async def main(dry_run: bool) -> None:
    manifest = load(ROOT / "content" / "pages.json")
    texts = load(TEXTS_PATH)
    audios = load(AUDIO_MAP_PATH)
    referenced: dict[str, str] = {}

    for entry in manifest:
        page_path = ROOT / entry["href"].split("?", 1)[0]
        tree = html.fromstring(page_path.read_text(encoding="utf-8"))
        for element in tree.xpath('//*[@data-id]'):
            item_id = (element.get("data-id") or "").strip()
            if not item_id or item_id in referenced:
                continue
            value = element_text(element)
            if value:
                referenced[item_id] = value

    additions = {item_id: value for item_id, value in referenced.items() if item_id not in texts}
    merged_texts = dict(texts)
    merged_texts.update(additions)
    required = {
        item_id: merged_texts[item_id]
        for item_id in referenced
        if item_id in merged_texts and re.search(r"[A-Za-z0-9]", str(merged_texts[item_id]))
    }
    pending = {
        item_id: value for item_id, value in required.items() if item_id not in audios
    }

    print(f"Text entries to add: {len(additions)}")
    for item_id, value in additions.items():
        print(f"  {item_id}: {value}")
    print(f"Audio clips to generate: {len(pending)}")
    for item_id, value in pending.items():
        print(f"  {item_id}: {spoken_text(str(value))}")
    if dry_run:
        return

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(6)
    generated = await asyncio.gather(
        *(render(item_id, str(value), semaphore) for item_id, value in pending.items())
    )
    merged_audios = dict(audios)
    merged_audios.update(dict(generated))
    TEXTS_PATH.write_text(
        json.dumps(merged_texts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    AUDIO_MAP_PATH.write_text(
        json.dumps(merged_audios, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Added {len(additions)} text entries and generated {len(generated)} audio clips.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
