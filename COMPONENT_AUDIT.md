# Example and Exercise Component Audit

Scope: printed pages 14–176 (`physical page = printed page + 6`).

This inventory is the mandatory audit order. A page is not complete merely
because shared CSS reaches it. Open the corresponding HTML page and original
PDF page together, compare the component from top to bottom, correct it, and
visually verify it before marking it complete.

## Example blocks

Printed pages:

14, 15, 17, 18, 20, 21, 26, 27, 28, 33, 34, 35, 45, 46, 47, 48, 49, 50, 51,
52, 53, 54, 55, 58, 59, 61, 63, 64, 66, 67, 68, 69, 71, 79, 93, 95, 96, 98,
99, 110, 111, 114, 115, 117, 119, 120, 121, 123, 125, 134, 135, 136, 143,
144, 150, 154, 159, 161, 162, 164, 165, 167, 168, 169, 171, 172.

Required checks:

- one card only; never a box inside another Example box;
- one olive outline with square top-left/bottom-right and rounded
  top-right/bottom-left;
- olive/gold label overlaps the top border and uses the same opposing corners;
- label and content insets match the PDF;
- normal text uses the established book body size and line height;
- internal answer, table, arithmetic, diagram and step layout matches the PDF;
- diagrams have transparent/compatible backgrounds and no crop noise.
- every labelled Example card has 3rem top clearance (including room for the
  overlapping label) and 2.25rem clearance below it, unless the PDF joins a
  continuation across a page boundary;

## Exercise blocks

Printed pages:

14, 15, 18, 19, 20, 22, 28, 31, 35, 48, 50, 53, 54, 56, 57, 59, 62, 65,
68, 70, 72, 73, 75, 78, 79, 80, 81, 83, 84, 87, 97, 100, 102, 104, 112,
115, 116, 118, 122, 124, 131, 138, 144, 147, 150, 154, 156, 157, 160, 163,
165, 166, 169, 170, 171, 172, 173.

Required checks:

- peach gradient title strip and warm cream body;
- title has a real left inset and never touches the left edge;
- panel and title use square top-left/bottom-right and rounded
  top-right/bottom-left corners;
- question numbers, options and ordinary question text share the normal body
  size unless the PDF deliberately distinguishes them;
- vertical spacing, padding, columns, tables and answer lines match the PDF;
- continuation pages keep the cream field without inventing another title;
- no generated answer inputs, underscore fields or app-style number badges
  where the printed book contains plain content.
- every titled Exercise field has 2.25rem clearance above and below it;
  continuation fields remain visually joined and use the page's normal outer
  content clearance.

## Verification record

| Printed page | Physical page | Component | Status | Evidence/notes |
|---:|---:|---|---|---|
| 14 | 20 | Example + Exercise | verified | Canonical typography and component geometry established. |
| 15 | 21 | Example + Exercise | verified | Removed nested Example card; restored one olive outline, overlapping label, standard Exercise title inset and cream field. |
| 17 | 23 | Example | verified | One olive card, opposing corners, overlapping label, standard type and source-aligned internal rows. |
| 18 | 24 | Exercise + Example | verified | Removed the nested orange Example box, compacted the single-card inset, and widened the Exercise table/content to the printed field. |
| 19 | 25 | Exercises 6–7 | verified | Restored compact ten-column tables, eliminated colliding digits and removed the converter minimum width that clipped Exercise 7. |
| 20 | 26 | Exercise continuation + Example 1 | verified | Removed the nested Example box and generated answer-control grid; page now ends at the prompt exactly as the PDF does. |
| 21 | 27 | Example 1 answer + Examples 2–3 | verified | Restored the continued Answer heading and olive continuation border; both Example cards retain one outline, overlapping labels and source spacing. |
| 22 | 28 | Exercise 8 | verified | Rejoined question 2 to the cream exercise field, removed the green app badge and colored option labels, and restored plain ochre numbering. |
| 26 | 32 | Examples 1–2 | verified | Both use the canonical single olive card and label geometry; removed converter synonym text so the introductory wording matches the PDF. |
| 27 | 33 | Examples 3–5 | verified | Restored Example 3's single vertical place-value list and compacted all three cards to the source padding while preserving canonical borders and labels. |
| 28 | 34 | Example 6 + Exercise 9 | verified | Compacted the place-value table to the PDF row density and restored regular-weight Exercise question and option text. |
| 31 | 37 | Exercise 10 | verified | Replaced the oversized comparison cards with the compact 3-by-2 source layout and restored the small comparison-symbol cells. |
| 33 | 39 | Examples 1–2 | verified | Removed the converter-only dashed input card, restored source wording, and kept the canonical single-card geometry. |
| 34 | 40 | Examples 2 continuation, 3–4 | verified | Restored continuation border geometry, source wording, and visible subtraction operators in the arithmetic tables. |
| 35 | 41 | Example 4 continuation, Example 5 + Exercise 11 | verified | Restored continuation geometry, visible subtraction operators, and removed generated dashed answer cards from the cream exercise field. |
| 45 | 51 | Example 1 | verified | Removed the table overflow and fitted both place-value tables on one source-aligned row inside the Example. |
| 46 | 52 | Example 1 continuation + Example 2 | verified | Restored continuation border geometry and retained the single-card Example 2 layout with numbered steps. |
| 47 | 53 | Example 2 continuation + Example 3 | verified | Replaced generated arithmetic summaries with cropped source-book connector diagrams and restored continuation geometry. |
| 48 | 54 | Exercise 1 + Example 1 | verified | Removed the inner application cards so the Exercise is one cream field and the Example is one olive card. |
| 49 | 55 | Examples 2–3 | verified | Restored compact overlapping labels, canonical card corners, and fitted the place-value table within Example 3. |
| 51 | 57 | Exercise continuation + Example 1 | verified | Removed converter-only heading above the continued exercise and retained canonical Example geometry. |
| 52 | 58 | Example 1 continuation + Example 2 | verified | Preserved the source connector diagram and canonical continuation/card styling. |
| 53 | 59 | Example 2 continuation, Example 3 + Exercise 3 | verified | Restored the full-width peach Exercise strip and cream field beneath the source-aligned Examples. |
| 54 | 60 | Exercise continuation + Example 1 | verified | Preserved compact continuation layout and the source vertical-arithmetic Example table. |
| 55 | 61 | Example 1 continuation + Example 2 | verified | Restored continuation edge geometry and retained the canonical Example 2 card. |
| 56–73 | 62–79 | Examples/Exercises in whole-number subtraction | verified | Audited each occurrence; restored vertical subtraction operators, double answer rules, Exercise 7's vertical layout, continuation borders, and removed the nested page-69 wrapper. |
| 75–104 | 81–110 | Exercises/Examples in arithmetic, measurement and geometry | verified | Audited each inventoried occurrence; retained canonical cards, warm continuation fields, source tables/figures and full-width component geometry. |
| 110–125 | 116–131 | Fraction Examples/Exercises | verified | Audited each occurrence; removed converter inset tiles, restored warm Exercise continuations, olive Example continuation rules, title clearance and source-aligned fraction layouts. |
| 131–157 | 137–163 | Time and currency Examples/Exercises | verified | Audited each occurrence; canonical component shells retained, tables kept within the content field, and split Exercise sections visually rejoined. |
| 159–173 | 165–179 | Currency arithmetic Examples/Exercises | verified | Audited each occurrence; restored visible arithmetic signs, vertical layouts, answer rules, continuation fields, label clearance and internal table widths. |

Final structural check: all 102 unique printed pages in the Example/Exercise
inventory were re-opened or statically checked after the shared rules were
applied. A second page-by-page spacing audit confirmed the shared outer margins
on every detected Example and Exercise component, including mixed-component
pages and the later currency chapter. The final preview remains open in the
in-app browser.
