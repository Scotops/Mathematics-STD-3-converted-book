"""Recover the Sassoon bold subset embedded in the source textbook PDF.

The regular face is already bundled as assets/fonts/SassoonPrimary.ttf.  The
source PDF stores its bold face as a raw CFF program, so this script wraps that
program in a standards-compliant OpenType container for browser use.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

from fontTools.agl import toUnicode
from fontTools.cffLib import CFFFontSet
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont, newTable
from pypdf import PdfReader


def extract_bold_cff(pdf_path: Path) -> bytes:
    reader = PdfReader(str(pdf_path))
    for page in reader.pages:
        fonts = (page.get("/Resources") or {}).get("/Font") or {}
        for reference in fonts.values():
            font = reference.get_object()
            if "SassoonPrimary-Bold" not in str(font.get("/BaseFont")):
                continue
            descriptor = font.get("/FontDescriptor").get_object()
            stream = descriptor.get("/FontFile3").get_object()
            return stream.get_data()
    raise RuntimeError("The Sassoon Primary Bold CFF stream was not found")


def wrap_cff_as_otf(cff_data: bytes, output_path: Path) -> None:
    builder = FontBuilder(1000, isTTF=False)
    cff = CFFFontSet()
    cff.decompile(BytesIO(cff_data), builder.font)
    top_dict = cff[cff.fontNames[0]]
    glyph_order = list(top_dict.charset)
    builder.setupGlyphOrder(glyph_order)

    metrics: dict[str, tuple[int, int]] = {}
    cmap: dict[int, str] = {}
    for glyph_name in glyph_order:
        char_string = top_dict.CharStrings[glyph_name]
        pen = BoundsPen(None)
        try:
            char_string.draw(pen)
        except Exception:
            pass
        width = getattr(char_string, "width", None)
        if width is None:
            width = top_dict.Private.defaultWidthX
        left_side_bearing = pen.bounds[0] if pen.bounds else 0
        metrics[glyph_name] = (round(width), round(left_side_bearing))
        try:
            unicode_value = toUnicode(glyph_name)
        except Exception:
            unicode_value = ""
        if len(unicode_value) == 1:
            cmap[ord(unicode_value)] = glyph_name

    builder.setupCharacterMap(cmap)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=865, descent=-264, lineGap=0)
    builder.setupNameTable(
        {
            "familyName": "Sassoon Primary",
            "styleName": "Bold",
            "uniqueFontIdentifier": "Sassoon Primary Bold PDF subset",
            "fullName": "Sassoon Primary Bold",
            "psName": "SassoonPrimary-Bold",
        }
    )
    builder.setupOS2(
        sTypoAscender=865,
        sTypoDescender=-264,
        sTypoLineGap=0,
        usWinAscent=865,
        usWinDescent=264,
        usWeightClass=700,
    )
    builder.setupPost()
    builder.setupMaxp()
    cff.otFont = builder.font
    builder.font["CFF "] = newTable("CFF ")
    builder.font["CFF "].cff = cff

    output_path.parent.mkdir(parents=True, exist_ok=True)
    builder.save(output_path)
    check = TTFont(output_path)
    if len(check.getBestCmap() or {}) < 60:
        raise RuntimeError("Extracted bold font has incomplete character mapping")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_pdf", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/fonts/SassoonPrimary-Bold.otf"),
    )
    args = parser.parse_args()
    wrap_cff_as_otf(extract_bold_cff(args.source_pdf), args.output)
    print(args.output)


if __name__ == "__main__":
    main()
