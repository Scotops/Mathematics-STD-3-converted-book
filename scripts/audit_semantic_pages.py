#!/usr/bin/env python3
"""Static whole-book audit for screenshot-dependent or non-static page content."""

from __future__ import annotations

import json
import re
from pathlib import Path

from html.parser import HTMLParser
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def physical_page(path: Path) -> int:
    if path.name == "index.html":
        return 1
    match = re.match(r"pg(\d{3})_sec001\.html$", path.name)
    return int(match.group(1)) if match else 9999


def hidden_image(attrs: dict[str, str]) -> bool:
    classes = set(attrs.get("class", "").split())
    return bool({"hidden", "opacity-0", "sr-only"} & classes)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict[str, str]] = []
        self.has_controls = False
        self.has_source_section = False

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if "data-source-section" in values:
            self.has_source_section = True
        if tag == "img":
            self.images.append(values)
        if tag in {"input", "textarea", "select"} or (tag == "button" and values.get("type") == "submit"):
            self.has_controls = True


def main() -> None:
    pages = [ROOT / "index.html", *ROOT.glob("pg???_sec001.html")]
    pages = sorted(set(pages), key=physical_page)
    findings = []

    for page in pages:
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        page_findings = []

        for image in parser.images:
            src = image.get("src", "")
            alt = image.get("alt", "")
            if "pdf-pages/" in src or "pdf-page-facsimile" in image.get("class", "").split():
                page_findings.append({"kind": "full_page_facsimile", "src": src})
                continue
            if hidden_image(image):
                continue
            asset = (ROOT / src).resolve()
            dims = None
            try:
                with Image.open(asset) as opened:
                    dims = list(opened.size)
            except Exception:
                pass
            if re.search(r"\b(example|exercise|activity|question|table|steps?)\b", alt, re.I):
                page_findings.append({
                    "kind": "possible_rasterized_content",
                    "src": src,
                    "alt": alt[:180],
                    "dimensions": dims,
                })

        if parser.has_controls:
            page_findings.append({"kind": "interactive_answer_controls"})

        if not parser.has_source_section:
            page_findings.append({"kind": "missing_source_section"})

        if page_findings:
            findings.append({
                "physical_page": physical_page(page),
                "file": page.name,
                "findings": page_findings,
            })

    output = ROOT / "tmp" / "semantic-audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(findings, indent=2), encoding="utf-8")
    counts = {}
    for page in findings:
        for finding in page["findings"]:
            counts[finding["kind"]] = counts.get(finding["kind"], 0) + 1
    print(json.dumps({"pages_scanned": len(pages), "counts": counts, "report": str(output)}, indent=2))


if __name__ == "__main__":
    main()
