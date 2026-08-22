"""Audit the final 184-page ADT against its source and runtime contract."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from lxml import html
from PIL import Image
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "content" / "i18n" / "en"
SOURCE_PDF = Path(r"C:\Book to convert\MATHEMATICS STD III PB\MATHEMATICS STD III PB (SEPT 2025).pdf")
NUMBER = re.compile(r"\d[\d,.:/]*")
NARRATABLE = re.compile(r"[A-Za-z0-9]")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def meta_value(tree, name: str) -> str:
    value = tree.xpath(f'//meta[@name="{name}"]/@content')
    return value[0] if value else ""


def normal_numbers(value: str) -> set[str]:
    return {token.rstrip(".,:") for token in NUMBER.findall(value) if token.rstrip(".,:")}


def main() -> int:
    manifest = read_json(ROOT / "content" / "pages.json")
    texts = read_json(I18N / "texts.json")
    audios = read_json(I18N / "audios.json")
    runtime_path = ROOT / "tmp" / "runtime-audit.json"
    runtime = read_json(runtime_path) if runtime_path.exists() else []

    report: dict[str, object] = {
        "manifest_count": len(manifest),
        "missing_page_files": [],
        "meta_mismatches": [],
        "missing_source_renders": [],
        "bad_source_dimensions": [],
        "missing_fidelity_assets": [],
        "missing_text_entries": [],
        "unmapped_audio_ids": [],
        "missing_audio_files": [],
        "missing_image_descriptions": [],
        "bad_fraction_labels": [],
        "inline_submit_buttons": [],
        "runtime_failures": [],
        "low_pdf_number_coverage": [],
    }

    referenced_ids: set[str] = set()
    narratable_ids: set[str] = set()
    source_files: list[Path] = []

    for index, entry in enumerate(manifest, 1):
        href = entry["href"].split("?", 1)[0]
        page_path = ROOT / href
        source_files.append(page_path)
        if not page_path.exists():
            report["missing_page_files"].append(href)
            continue

        tree = html.fromstring(page_path.read_text(encoding="utf-8"))
        actual_index = meta_value(tree, "page-section-id")
        actual_title = meta_value(tree, "title-id")
        if actual_index != str(index) or actual_title != entry["section_id"]:
            report["meta_mismatches"].append(
                {"page": index, "file": href, "index": actual_index, "title": actual_title}
            )

        render_path = ROOT / "images" / "source-pages" / f"pg{index:03d}.png"
        if not render_path.exists():
            report["missing_source_renders"].append(str(render_path.relative_to(ROOT)))
        else:
            with Image.open(render_path) as image:
                if image.size != (674, 957):
                    report["bad_source_dimensions"].append(
                        {"page": index, "size": list(image.size)}
                    )

        markup = page_path.read_text(encoding="utf-8")
        if "assets/typography-consistency.css?v=3" not in markup or "assets/offline-preloader.js?v=79" not in markup:
            report["missing_fidelity_assets"].append(href)

        for element in tree.xpath('//*[@data-id]'):
            item_id = (element.get("data-id") or "").strip()
            if item_id:
                referenced_ids.add(item_id)
                inline = " ".join(part.strip() for part in element.itertext() if part.strip())
                accessible = " ".join(
                    filter(
                        None,
                        [
                            element.get("data-tts-text", "").strip(),
                            element.get("aria-label", "").strip(),
                            element.get("alt", "").strip(),
                            element.get("value", "").strip(),
                            inline,
                            str(texts.get(item_id, "")).strip(),
                        ],
                    )
                )
                if element.get("data-tts-ignore") is None and NARRATABLE.search(accessible):
                    narratable_ids.add(item_id)

        for image in tree.xpath("//img"):
            if image.get("aria-hidden") == "true":
                continue
            item_id = (image.get("data-id") or "").strip()
            description = (
                (image.get("data-tts-text") or "").strip()
                or (texts.get(item_id, "") if item_id else "").strip()
                or (image.get("alt") or "").strip()
            )
            if not description:
                report["missing_image_descriptions"].append(
                    {"page": index, "file": href, "src": image.get("src", ""), "id": item_id}
                )

        for fraction in tree.xpath("//mfrac"):
            label = (fraction.get("aria-label") or "").strip()
            if " over " not in f" {label.lower()} ":
                report["bad_fraction_labels"].append(
                    {"page": index, "file": href, "label": label}
                )

        for button in tree.xpath("//button"):
            label = " ".join(button.itertext()).strip()
            if label.lower() == "submit":
                report["inline_submit_buttons"].append({"page": index, "file": href})

    report["missing_text_entries"] = sorted(
        item_id for item_id in narratable_ids if item_id not in texts
    )
    narrated_ids = {
        item_id
        for item_id in narratable_ids
        if NARRATABLE.search(str(texts.get(item_id, "")))
    }
    report["unmapped_audio_ids"] = sorted(item_id for item_id in narrated_ids if item_id not in audios)
    report["missing_audio_files"] = sorted(
        item_id
        for item_id in narrated_ids
        if item_id in audios and not (I18N / "audio" / audios[item_id]).exists()
    )

    if len(runtime) != len(manifest):
        report["runtime_failures"].append(
            {"kind": "runtime_count", "expected": len(manifest), "actual": len(runtime)}
        )
    else:
        for expected, item in enumerate(runtime, 1):
            source = item.get("source") or {}
            if not item.get("ready"):
                report["runtime_failures"].append({"page": expected, "kind": "tts_not_ready"})
            if len(str(item.get("spoken", "")).strip()) < 2:
                report["runtime_failures"].append({"page": expected, "kind": "empty_narration"})
            if (
                not source.get("present")
                or not source.get("complete")
                or source.get("w") != 674
                or source.get("h") != 957
                or f"pg{expected:03d}.png" not in str(source.get("src", ""))
            ):
                report["runtime_failures"].append({"page": expected, "kind": "source_render"})
            if item.get("submitCount"):
                report["runtime_failures"].append({"page": expected, "kind": "submit_control"})

    if SOURCE_PDF.exists() and len(runtime) == len(manifest):
        pdf = PdfReader(SOURCE_PDF)
        for index, (pdf_page, item) in enumerate(zip(pdf.pages, runtime), 1):
            expected = normal_numbers(pdf_page.extract_text() or "")
            actual = normal_numbers(str(item.get("raw", "")))
            if not expected:
                continue
            coverage = len(expected & actual) / len(expected)
            if coverage < 0.65:
                report["low_pdf_number_coverage"].append(
                    {
                        "page": index,
                        "coverage": round(coverage, 3),
                        "missing": sorted(expected - actual)[:30],
                    }
                )

    critical_keys = [
        "missing_page_files",
        "meta_mismatches",
        "missing_source_renders",
        "bad_source_dimensions",
        "missing_fidelity_assets",
        "missing_text_entries",
        "unmapped_audio_ids",
        "missing_audio_files",
        "missing_image_descriptions",
        "bad_fraction_labels",
        "inline_submit_buttons",
        "runtime_failures",
    ]
    report["critical_failure_count"] = sum(len(report[key]) for key in critical_keys)
    report["referenced_text_ids"] = len(referenced_ids)
    report["source_render_count"] = len(list((ROOT / "images" / "source-pages").glob("pg*.png")))

    destination = ROOT / "tmp" / "final-audit.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    summary = {
        "pages": len(manifest),
        "source_renders": report["source_render_count"],
        "text_ids": report["referenced_text_ids"],
        "critical_failures": report["critical_failure_count"],
        "unmapped_audio_ids": len(report["unmapped_audio_ids"]),
        "missing_audio_files": len(report["missing_audio_files"]),
        "low_pdf_number_coverage_pages": len(report["low_pdf_number_coverage"]),
    }
    print(json.dumps(summary, indent=2))
    return 1 if report["critical_failure_count"] else 0


if __name__ == "__main__":
    sys.exit(main())
