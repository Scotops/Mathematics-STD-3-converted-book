# Page Audit Checklist

Complete this checklist for every page. Visual inspection of both the PDF and rendered HTML is mandatory.

## Identification

- [ ] Printed page, physical PDF page, and HTML filename are correctly mapped.
- [ ] The correct PDF page is open/rendered.
- [ ] The correct HTML page is open in the in-app browser.

## Top-to-bottom comparison

- [ ] Page canvas and top decoration match.
- [ ] First content begins at the correct vertical position.
- [ ] Page title/section heading text, size, color, and alignment match.
- [ ] Every paragraph has exact wording, punctuation, emphasis, wrapping, and indentation.
- [ ] Every dialog has the correct type, width, background, border, label, padding, and spacing.
- [ ] Numbered questions align with their first text line.
- [ ] Wrapped question text aligns with the statement, not the number column.
- [ ] Options and continuation items are complete and correctly aligned.
- [ ] Tables match in row/column count, widths, fills, borders, weights, and alignment.
- [ ] Arithmetic symbols, place-value alignment, rules, answers, carries, and borrow marks are complete.
- [ ] Fractions and mathematical notation are complete, correctly sized, and baseline-aligned.
- [ ] Genuine images use the correct source crop, scale, transparency, and placement.
- [ ] No image has black corruption, missing connectors, stray lines, labels duplicated in HTML, or background noise.
- [ ] Final content ends at a source-matching position.
- [ ] Page number has the standard design, size, and placement.
- [ ] Bottom decoration matches and does not overlap content.

## Technical verification

- [ ] The visible page is rendered from semantic HTML/CSS, not a full-page screenshot, canvas, facsimile image, or hidden overlay.
- [ ] Ordinary text, tables, dialogs, lists, and mathematical layouts are selectable/inspectable HTML.
- [ ] No horizontal overflow.
- [ ] No vertical content overflow beyond the page canvas.
- [ ] No answer inputs, textareas, submit buttons, or unintended interaction.
- [ ] No duplicate titles/labels from both HTML and pseudo-elements/images.
- [ ] No missing image/font requests.
- [ ] Computed font family and size are correct.
- [ ] Cache-busted reload displays the latest code.
- [ ] Shared changes were regression-checked on representative earlier pages.

## Completion record

Add a row to `PROGRESS.md` only after all applicable checks pass. If something remains uncertain, mark the page `needs review`, describe the uncertainty, and do not call it complete.
