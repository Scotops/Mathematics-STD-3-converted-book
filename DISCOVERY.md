# Book and Repository Discovery — English Standard Three Mathematics

## Repository evidence

- Repository: `/Users/kareem/Documents/ChatGPT/Mathematics STD 3 English Book`
- Branch/remote: `main` → `https://github.com/Scotops/Mathematics-STD-3-converted-book.git`
- Clone baseline: `cd6a707c` (`feat: Added sign videos`)
- Existing conversion: `index.html`, `pg002_sec001.html`–`pg184_sec001.html`, 184 manifest entries, 42 quiz files, shared styles/scripts, fonts, navigation, accessibility, audio/sign-language support, and images.
- Original PDF: `/Users/kareem/Downloads/MATHEMATICS STD III PB (SEPT 2025).pdf`, 184 pages, approximately 557.9 × 767.7 points.
- Local preview: `python3 -m http.server 4175` → `http://127.0.0.1:4175/`.

## Conversion-state decision

Classification: **existing conversion needing improvement**.

The complete reader already exists. Preserve and improve it in place. Do not scaffold, regenerate, or replace the application, page set, controls, or asset organization.

Critical discovery: the original runtime used `assets/pdf-facsimile.js` to prepend a full-page JPEG and add `pdf-facsimile-accessible-source` to the real HTML, making the screenshot the visible page. This does not satisfy the project goal. The facsimile injection is disabled, and every page must now be audited using its visible semantic HTML/CSS.

## Initial PDF pattern study

Representative physical PDF pages inspected: 1, 3, 7, 10, 50, 100, 150, and 184.

| Pattern | Initial observation |
|---|---|
| Page shell | Fixed portrait page with centered content and cyan texture/gradient at the far top and bottom. |
| Typography | Rounded handwritten-style body face, bold black labels, bright blue content headings. |
| Chapter opener | Full-width pale-blue rounded card, centered blue chapter label, larger bold black title, lower/right shadow. |
| Introduction | Pale peach panel with bold black heading and compact body copy. |
| Example | White card, thin olive border, raised olive/gold label with white text. |
| Exercise | Pale cream body with peach gradient title strip and aligned numbered questions. |
| Activity | Pale blue body with blue heading/divider and restrained shadow. |
| Page number | Cyan rounded tab near the upper edge of the lower gradient. |

These findings are provisional. Study multiple occurrences before changing a shared rule.

## Existing conversion baseline

| HTML page | PDF page | Baseline |
|---|---|---|
| `pg007_sec001.html` | physical 7 / printed 1 | Previous visual baseline was the PDF facsimile; semantic HTML must be re-audited after disabling it. |
| `pg050_sec001.html` | physical 50 / printed 44 | Pending browser comparison of exercise continuation and spacing. |
| `pg100_sec001.html` | physical 100 / printed 94 | Pending activity and geometry-diagram comparison. |
| `pg150_sec001.html` | physical 150 / printed 144 | Pending example/exercise and time-layout comparison. |

## In-place strategy

- Preserve all page shells, manifests, controls, accessibility features, fonts, and verified assets.
- Reuse already-correct components only after PDF verification.
- Use shared fixes only for repeated confirmed mismatches.
- Use page-specific fixes for source exceptions.
- Create assets only when the existing extraction is missing, corrupt, noisy, or wrongly cropped.
- Begin the detailed audit at physical page 1 and proceed page by page unless the user selects another start.

## Discovery gate

- [x] conversion classified with evidence
- [x] architecture documented
- [x] representative PDF patterns initially studied
- [x] canonical starting page identified
- [x] configuration and progress initialized
- [x] in-place strategy recorded

Pattern discovery remains ongoing throughout the audit.
