"""Consolidate the ADT spine to one navigable screen per physical PDF page.

The script is deliberately conservative: source section files remain on disk, while
their rendered content, styles, scripts, and activity metadata are copied into a
canonical pgNNN_sec001.html file.  This makes the operation recoverable in Git and
keeps every existing text/audio data-id available to the reader runtime.
"""

from __future__ import annotations

import copy
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit

from lxml import html as lxml_html


ROOT = Path(__file__).resolve().parents[1]
PAGES_PATH = ROOT / "content" / "pages.json"
TOC_PATH = ROOT / "content" / "toc.json"
SOURCE_SPINE_PATH = ROOT / "tools" / "source_spine_294.json"


CONTENT_RE = re.compile(
    r'(<(?:div|main)\b[^>]*\bid=["\']content["\'][^>]*>)(.*?)'
    r'(</(?:div|main)>\s*(?:</main>\s*)?'
    r'(?:<script\b[^>]*>.*?</script>\s*)*'
    r'<div\b[^>]*\bid=["\']interface-container["\'])',
    re.I | re.S,
)
STYLE_RE = re.compile(r"<style\b[^>]*>.*?</style>", re.I | re.S)
LINK_RE = re.compile(r"<link\b[^>]*>", re.I | re.S)
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.I | re.S)
SRC_RE = re.compile(r'\bsrc=["\']([^"\']+)["\']', re.I)


CONSOLIDATED_STYLE = """<style id="adt-source-page-consolidation">
  /* One reader screen now corresponds to one physical source-PDF page. */
  #content.adt-source-page { width: 100%; max-width: 112rem; margin: 0 auto; }
  #content.adt-source-page > .adt-source-page-part { width: 100%; }
  #content.adt-source-page > .adt-source-page-part + .adt-source-page-part {
    margin-top: clamp(1rem, 2.5vw, 2.5rem);
  }
  #content.adt-source-page > .adt-source-page-part > section { margin-left: auto; margin-right: auto; }
  @media (max-width: 640px) {
    #content.adt-source-page > .adt-source-page-part + .adt-source-page-part { margin-top: 1rem; }
  }
</style>"""


def href_file(href: str) -> str:
    return Path(urlsplit(href).path).name


def page_prefix(section_id: str, href: str) -> str:
    match = re.match(r"(pg\d{3})", section_id) or re.match(r"(pg\d{3})", href_file(href))
    if not match:
        raise ValueError(f"Cannot identify physical page for {section_id!r} / {href!r}")
    return match.group(1)


def extract_content(document: str, source_name: str) -> tuple[str, str, str]:
    match = CONTENT_RE.search(document)
    if not match:
        raise ValueError(f"Could not find #content in {source_name}")
    return match.group(1), match.group(2), match.group(3)


def original_section_content(content_inner: str, section_id: str) -> str:
    """Return only this source section when re-running an existing consolidation."""
    if "adt-source-page-part" not in content_inner:
        return content_inner
    fragment = lxml_html.fragment_fromstring(content_inner, create_parent="div")
    matches = fragment.xpath(
        ".//*[contains(concat(' ', normalize-space(@class), ' '), ' adt-source-page-part ') "
        "and @data-source-section=$section_id]",
        section_id=section_id,
    )
    if not matches:
        raise ValueError(f"Consolidated markup does not contain source section {section_id}")
    # Take the deepest matching wrapper. Older interrupted runs can contain nested
    # copies of the same wrapper; the deepest one is the original source section.
    wrapper = matches[-1]
    return "".join(lxml_html.tostring(child, encoding="unicode") for child in wrapper)


def namespace_activity_markup(markup: str, section_id: str) -> str:
    """Prevent answer keys from colliding after formerly separate pages are merged."""
    prefix = section_id.replace("-", "_")
    markup = re.sub(r"(?<![\w-])item-(\d+)(?![\w-])", rf"{prefix}-item-\1", markup)
    markup = re.sub(r"(?<![\w-])aria-(\d+(?:-\d+)*)(?![\w-])", rf"{prefix}-aria-\1", markup)
    return markup


def content_open_with_classes(open_tag: str) -> str:
    class_match = re.search(r'class=["\']([^"\']*)["\']', open_tag, re.I)
    classes = class_match.group(1).split() if class_match else []
    classes = [c for c in classes if c != "opacity-0"]
    for required in ("opacity-0", "adt-source-page"):
        if required not in classes:
            classes.append(required)
    value = " ".join(classes)
    if class_match:
        return open_tag[: class_match.start(1)] + value + open_tag[class_match.end(1) :]
    return open_tag[:-1] + f' class="{value}">'


def wrapper_classes(open_tag: str) -> str:
    match = re.search(r'class=["\']([^"\']*)["\']', open_tag, re.I)
    classes = match.group(1).split() if match else []
    remove = {"opacity-0", "container", "mx-auto"}
    classes = [c for c in classes if c not in remove and not c.startswith("max-w-")]
    return " ".join(["adt-source-page-part", *classes])


def transform_inline_script(script: str, section_id: str) -> str:
    script = namespace_activity_markup(script, section_id)
    # Rebuild every answer-key assignment from its quoted JSON payload. Doing
    # this in one pass is both idempotent and repairs extra/missing parentheses
    # left by an interrupted earlier consolidation pass.
    answer_assignment = re.compile(
        r"window\.correctAnswers\s*=.*?JSON\.parse\(\s*"
        r"(?P<payload>'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\")"
        r"\s*,?\s*\)\s*\)*\s*;",
        re.S,
    )
    script = answer_assignment.sub(
        lambda match: (
            "window.correctAnswers = Object.assign(window.correctAnswers || {}, "
            f"JSON.parse({match.group('payload')}));"
        ),
        script,
    )
    for element_id in ("quiz-correct-answers", "quiz-explanations"):
        script = script.replace(f'id="{element_id}"', f'id="{section_id}-{element_id}"')
        script = script.replace(f"id='{element_id}'", f"id='{section_id}-{element_id}'")
    return script


def consolidate_group(prefix: str, entries: list[dict], index: int) -> tuple[str, dict[str, str]]:
    selected_files = [href_file(entry["href"]) for entry in entries]
    source_docs = [(ROOT / name).read_text(encoding="utf-8") for name in selected_files]
    primary = source_docs[0]
    primary_open, _, primary_tail = extract_content(primary, selected_files[0])

    parts: list[str] = []
    styles: list[str] = []
    links: list[str] = []
    scripts: list[str] = []
    seen_styles: set[str] = set()
    seen_links: set[str] = set()
    seen_script_src: set[str] = set()
    seen_inline_scripts: set[str] = set()

    for entry, name, document in zip(entries, selected_files, source_docs):
        section_id = entry["section_id"]
        content_open, content_inner, _ = extract_content(document, name)
        content_inner = original_section_content(content_inner, section_id)
        content_inner = namespace_activity_markup(content_inner, section_id)
        parts.append(
            f'<div class="{wrapper_classes(content_open)}" data-source-section="{section_id}">\n'
            f"{content_inner.strip()}\n</div>"
        )
        for style in STYLE_RE.findall(document):
            normalized = re.sub(r"\s+", " ", style).strip()
            if normalized not in seen_styles and 'id="adt-source-page-consolidation"' not in style:
                seen_styles.add(normalized)
                styles.append(style)
        for link in LINK_RE.findall(document):
            normalized = re.sub(r"\s+", " ", link).strip()
            if normalized not in seen_links:
                seen_links.add(normalized)
                links.append(link)
        for script in SCRIPT_RE.findall(document):
            src_match = SRC_RE.search(script)
            if src_match:
                src = src_match.group(1)
                # Ignore cache-busting query differences when de-duplicating.
                key = src.split("?", 1)[0]
                if key not in seen_script_src:
                    seen_script_src.add(key)
                    scripts.append(script)
            else:
                transformed = transform_inline_script(script, section_id)
                normalized = re.sub(r"\s+", " ", transformed).strip()
                if normalized not in seen_inline_scripts:
                    seen_inline_scripts.add(normalized)
                    scripts.append(transformed)

    new_open = content_open_with_classes(primary_open)
    new_content = new_open + "\n" + "\n".join(parts) + "\n" + primary_tail
    primary = CONTENT_RE.sub(lambda _: new_content, primary, count=1)

    # Use every distinct stylesheet/style required by any merged section.
    primary = STYLE_RE.sub("", primary)
    primary = LINK_RE.sub("", primary)
    head_additions = "\n".join([*links, *styles, CONSOLIDATED_STYLE])
    primary = primary.replace("</head>", head_additions + "\n</head>", 1)

    # Replace all body scripts with a merged, de-duplicated list in source order.
    primary = SCRIPT_RE.sub("", primary)
    primary = primary.replace("</body>", "\n" + "\n".join(scripts) + "\n</body>", 1)

    canonical_id = f"{prefix}_sec001"
    primary = re.sub(
        r'(<meta\b[^>]*\bname=["\']title-id["\'][^>]*\bcontent=["\'])[^"\']*',
        rf"\g<1>{canonical_id}",
        primary,
        count=1,
        flags=re.I,
    )
    primary = re.sub(
        r'(<meta\b[^>]*\bname=["\']page-section-id["\'][^>]*\bcontent=["\'])[^"\']*',
        rf"\g<1>{index}",
        primary,
        count=1,
        flags=re.I,
    )
    canonical_file = "index.html" if prefix == "pg001" else f"{canonical_id}.html"
    primary = "\n".join(line.rstrip() for line in primary.splitlines()) + "\n"
    (ROOT / canonical_file).write_text(primary, encoding="utf-8")
    mapping = {name: canonical_file for name in selected_files}
    return canonical_file, mapping


def create_blank_page(index: int) -> None:
    document = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="title-id" content="pg006_sec001">
  <meta name="page-section-id" content="6">
  <link href="./content/tailwind_output.css" rel="stylesheet">
  <link href="./assets/libs/fontawesome/css/all.min.css" rel="stylesheet">
  <link href="./assets/fonts.css" rel="stylesheet">
  <title>Preliminary page vi</title>
</head>
<body class="min-h-screen flex items-center justify-center bg-white">
  <div id="content" class="container mx-auto px-6 py-8 opacity-0 adt-source-page">
    <section role="article" data-section-type="text" data-section-id="pg006_sec001"
      class="mx-auto flex min-h-[70vh] max-w-5xl items-end justify-center pb-4">
      <span aria-hidden="true" class="text-sm text-gray-500">vi</span>
    </section>
  </div>
  <div id="interface-container"></div>
  <div id="nav-container"></div>
<script src="./assets/offline-preloader.js?v=69"></script>
  <script src="./assets/scorm.js"></script>
<script src="./assets/accessible-tts.js?v=22"></script>
  <script src="./assets/base.bundle.local.js"></script>
  <script src="./assets/numerical-alignment.js?v=5"></script>
</body>
</html>
"""
    document = document.replace('content="6"', f'content="{index}"')
    (ROOT / "pg006_sec001.html").write_text(document, encoding="utf-8")


def rewrite_links(value, file_mapping: dict[str, str]):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key == "href" and isinstance(item, str):
                parsed = urlsplit(item)
                name = Path(parsed.path).name
                if name in file_mapping:
                    suffix = f"?{parsed.query}" if parsed.query else "?reader=10"
                    item = file_mapping[name] + suffix
                else:
                    page_match = re.match(r"(pg\d{3})_sec\d{3}(?:_v\d+)?\.html$", name)
                    if page_match:
                        suffix = f"?{parsed.query}" if parsed.query else "?reader=10"
                        item = f"{page_match.group(1)}_sec001.html{suffix}"
            result[key] = rewrite_links(item, file_mapping)
        return result
    if isinstance(value, list):
        return [rewrite_links(item, file_mapping) for item in value]
    return value


def main() -> None:
    old_pages = json.loads(PAGES_PATH.read_text(encoding="utf-8"))
    (ROOT / "tmp").mkdir(exist_ok=True)
    audit_path = ROOT / "tmp" / "source-content-audit.json"
    if len(old_pages) == 184 and SOURCE_SPINE_PATH.exists():
        # Reconstruct the original selected-file spine for safe/idempotent reruns.
        source_files = json.loads(SOURCE_SPINE_PATH.read_text(encoding="utf-8"))
        rebuilt = []
        for filename in source_files:
            document = (ROOT / filename).read_text(encoding="utf-8")
            title = re.search(
                r'<meta\b[^>]*\bname=["\']title-id["\'][^>]*\bcontent=["\']([^"\']+)',
                document,
                re.I,
            )
            section_id = title.group(1) if title else re.sub(r"(?:_v\d+)?\.html$", "", filename)
            prefix = page_prefix(section_id, filename)
            entry = {"section_id": section_id, "href": filename + "?reader=10"}
            if prefix >= "pg007":
                entry["page_number"] = int(prefix[2:]) - 6
            rebuilt.append(entry)
        old_pages = rebuilt
    else:
        (ROOT / "tmp" / "pages-before-184-consolidation.json").write_text(
            json.dumps(old_pages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

    groups: dict[str, list[dict]] = defaultdict(list)
    order: list[str] = []
    for entry in old_pages:
        prefix = page_prefix(entry["section_id"], entry["href"])
        if prefix not in groups:
            order.append(prefix)
        groups[prefix].append(entry)

    # Physical PDF page 6 (roman numeral vi) is intentionally blank and was the
    # only source page omitted by the pipeline.
    if "pg006" not in groups:
        insert_at = order.index("pg007") if "pg007" in order else 5
        order.insert(insert_at, "pg006")

    expected = [f"pg{n:03d}" for n in range(1, 185)]
    if order != expected:
        missing = sorted(set(expected) - set(order))
        extra = sorted(set(order) - set(expected))
        raise RuntimeError(f"Unexpected physical-page sequence. Missing={missing}, extra={extra}")

    new_pages: list[dict] = []
    file_mapping: dict[str, str] = {}
    for index, prefix in enumerate(order, start=1):
        if prefix == "pg006":
            create_blank_page(index)
            canonical_file = "pg006_sec001.html"
        else:
            canonical_file, mapping = consolidate_group(prefix, groups[prefix], index)
            file_mapping.update(mapping)
        entry: dict[str, object] = {
            "section_id": f"{prefix}_sec001",
            "href": canonical_file if prefix == "pg001" else canonical_file + "?reader=10",
        }
        if prefix >= "pg007":
            entry["page_number"] = int(prefix[2:]) - 6
        new_pages.append(entry)

    if len(new_pages) != 184:
        raise RuntimeError(f"Expected 184 pages, built {len(new_pages)}")
    PAGES_PATH.write_text(json.dumps(new_pages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if TOC_PATH.exists():
        toc = json.loads(TOC_PATH.read_text(encoding="utf-8"))
        toc = rewrite_links(toc, file_mapping)
        TOC_PATH.write_text(json.dumps(toc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Consolidated {len(old_pages)} reader entries into {len(new_pages)} physical pages.")
    print(f"Canonical HTML pages written: {len(new_pages)}")


if __name__ == "__main__":
    main()
