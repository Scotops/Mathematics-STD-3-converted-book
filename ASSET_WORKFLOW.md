# Illustration and Diagram Asset Workflow

Use images only for genuine source artwork or diagrams whose labels/artwork are inseparable. Ordinary text, tables, dialogs, answer lines, and arithmetic should remain HTML/CSS.

## Extraction

1. Render the exact PDF page at sufficient resolution (usually 150–300 DPI).
2. Crop the figure by measured PDF coordinates or from the high-resolution render.
3. Include all integral labels, connector lines, arrowheads, and small details.
4. Exclude nearby prose, watermarks, crop marks, and unrelated borders.
5. Save a lossless master before background removal.

Example:

```bash
pdftoppm -f PAGE -l PAGE -png -r 200 ORIGINAL.pdf tmp/page
```

## Cleaning

- Remove only the true paper/background color.
- Preserve anti-aliased colored edges and thin connector lines.
- Do not threshold colored artwork into black silhouettes.
- Remove isolated noise and stray crop lines without erasing source detail.
- Tighten transparent bounds after cleaning.
- Never use CSS filters as a substitute for a clean asset when they alter colors.

## Verification

- Compare the cleaned image side by side with the PDF crop.
- View it against the actual section background, not only against white.
- Confirm that it is not predominantly black or missing lines.
- Confirm that no HTML label duplicates a label already baked into the image.
- Match its rendered width, height, aspect ratio, and alignment to the PDF.
- Ensure it remains inside its designated dialog/content area.

## Naming

Prefer predictable names:

```text
images/page-[printed]-[section]-[item]-clean.png
```

Document replacements in `PROGRESS.md`, including the source page and reason for re-extraction.
