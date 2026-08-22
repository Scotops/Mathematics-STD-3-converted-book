"""Build exact, watermark-free page facsimiles from the source textbook PDF.

The source PDF stores the diagonal reading watermark as a separate Form
XObject that uses Arial-Black.  Removing only calls to that form preserves the
underlying page artwork, text, diagrams, rules, colours, and page numbers.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(
    r"C:\Book to convert\MATHEMATICS STD III PB\MATHEMATICS STD III PB (SEPT 2025).pdf"
)
DEFAULT_CLEAN_PDF = ROOT / "tmp" / "pdfs" / "mathematics-std3-watermark-free.pdf"
DEFAULT_IMAGE_DIR = ROOT / "images" / "pdf-pages"
DEFAULT_PDFTOPPM = Path(
    r"C:\Users\SALMA\.cache\codex-runtimes\codex-primary-runtime\dependencies"
    r"\native\poppler\Library\bin\pdftoppm.exe"
)


def object_uses_watermark_font(obj, seen: set[tuple[int, int]]) -> bool:
    """Return True when a Form XObject contains the watermark font."""
    identity = getattr(obj, "indirect_reference", None)
    key = (
        getattr(identity, "idnum", id(obj)),
        getattr(identity, "generation", 0),
    )
    if key in seen:
        return False
    seen.add(key)

    resources = obj.get("/Resources") or {}
    for reference in (resources.get("/Font") or {}).values():
        font = reference.get_object()
        if "ARIAL-BLACK" in str(font.get("/BaseFont", "")).upper():
            return True

    for reference in (resources.get("/XObject") or {}).values():
        child = reference.get_object()
        if str(child.get("/Subtype", "")) == "/Form" and object_uses_watermark_font(child, seen):
            return True
    return False


def watermark_form_names(page) -> set[str]:
    resources = page.get("/Resources") or {}
    names: set[str] = set()
    for name, reference in (resources.get("/XObject") or {}).items():
        obj = reference.get_object()
        if str(obj.get("/Subtype", "")) == "/Form" and object_uses_watermark_font(obj, set()):
            names.add(str(name))
    return names


def build_clean_pdf(source: Path, destination: Path) -> tuple[int, list[int]]:
    reader = PdfReader(str(source))
    writer = PdfWriter()
    removed_calls = 0
    pages_without_detected_watermark: list[int] = []

    for page_number, page in enumerate(reader.pages, start=1):
        watermark_names = watermark_form_names(page)
        if not watermark_names:
            pages_without_detected_watermark.append(page_number)
        content = ContentStream(page.get_contents(), reader)
        kept_operations = []
        for operands, operator in content.operations:
            is_watermark_call = (
                operator == b"Do"
                and operands
                and str(operands[0]) in watermark_names
            )
            if is_watermark_call:
                removed_calls += 1
            else:
                kept_operations.append((operands, operator))
        content.operations = kept_operations
        page.replace_contents(content)
        writer.add_page(page)

    if reader.metadata:
        metadata = {
            key: str(value)
            for key, value in reader.metadata.items()
            if value is not None
        }
        writer.add_metadata(metadata)

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        writer.write(output)
    return removed_calls, pages_without_detected_watermark


def render_pages(clean_pdf: Path, image_dir: Path, pdftoppm: Path, dpi: int) -> list[Path]:
    image_dir.mkdir(parents=True, exist_ok=True)
    prefix = image_dir / "pg"
    subprocess.run(
        [
            str(pdftoppm),
            "-jpeg",
            "-r",
            str(dpi),
            "-jpegopt",
            "quality=90,optimize=y,progressive=y",
            str(clean_pdf),
            str(prefix),
        ],
        check=True,
    )
    return sorted(image_dir.glob("pg-*.jpg"))


def verify_images(images: list[Path], expected_pages: int) -> tuple[tuple[int, int], tuple[int, int]]:
    if len(images) != expected_pages:
        raise RuntimeError(f"Expected {expected_pages} page images, found {len(images)}")
    dimensions = []
    for image_path in images:
        with Image.open(image_path) as image:
            image.verify()
        with Image.open(image_path) as image:
            dimensions.append(image.size)
    return min(dimensions), max(dimensions)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--clean-pdf", type=Path, default=DEFAULT_CLEAN_PDF)
    parser.add_argument("--image-dir", type=Path, default=DEFAULT_IMAGE_DIR)
    parser.add_argument("--pdftoppm", type=Path, default=DEFAULT_PDFTOPPM)
    parser.add_argument("--dpi", type=int, default=140)
    arguments = parser.parse_args()

    if not arguments.source.is_file():
        raise FileNotFoundError(arguments.source)
    if not arguments.pdftoppm.is_file():
        raise FileNotFoundError(arguments.pdftoppm)

    reader = PdfReader(str(arguments.source))
    expected_pages = len(reader.pages)
    removed_calls, pages_without_detected_watermark = build_clean_pdf(
        arguments.source, arguments.clean_pdf
    )
    images = render_pages(
        arguments.clean_pdf, arguments.image_dir, arguments.pdftoppm, arguments.dpi
    )
    minimum_size, maximum_size = verify_images(images, expected_pages)

    print(
        {
            "pages": expected_pages,
            "removed_watermark_calls": removed_calls,
            "pages_without_detected_watermark": pages_without_detected_watermark,
            "images": len(images),
            "minimum_image_size": minimum_size,
            "maximum_image_size": maximum_size,
            "clean_pdf": str(arguments.clean_pdf),
            "image_dir": str(arguments.image_dir),
        }
    )


if __name__ == "__main__":
    main()
