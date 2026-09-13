# Project Configuration — Mathematics Pupil's Book Standard Three

## Conversion state

- Classification: `existing conversion needing improvement`
- Evidence: complete ADT reader, 184-entry reading manifest, `index.html`, 183 numbered page files, 42 quiz files, shared CSS/JS, navigation controls, fonts, audio/sign-language support, and extracted assets.
- Preserve: root page files; `assets/`; `content/`; `images/`; `index.html`; `cover.png`; ADT controls; accessibility runtime; deployment configuration.
- Missing implementation: no replacement application is needed. Improve page fidelity in place and create only missing or corrected assets.
- Initial canonical reference: physical page 7 / printed page 1 / `pg007_sec001.html` for chapter card, introduction panel, shell, gradients, typography, and page number, pending detailed audit.

## Book

- Title: `Mathematics Pupil's Book Standard Three`
- Original PDF: `/Users/kareem/Downloads/MATHEMATICS STD III PB (SEPT 2025).pdf`
- Repository: `/Users/kareem/Documents/ChatGPT/Mathematics STD 3 English Book`
- Page files: repository root, `pgNNN_sec001.html`
- Images: `images/`

## Page mapping

- Physical PDF/HTML pages: 184
- `index.html` represents physical page 1; `pg002_sec001.html`–`pg184_sec001.html` represent pages 2–184.
- Printed-page offset: `6`
- Formula: `physical page = printed page + 6`
- Printed page 1 → physical page 7 → `pg007_sec001.html`

Always state whether a number is printed or physical.

## Local preview

- Start: `python3 -m http.server 4175`
- URL: `http://127.0.0.1:4175/`
- Cache busting: append a descriptive query such as `?audit=page-1-r1`.

## Shared implementation

- Generated styles: `content/tailwind_output.css`
- Typography: `assets/typography-consistency.css`, `assets/fonts.css`
- Source visual system: `assets/source-book-theme.css`, `assets/source-book-theme.js`
- Fidelity corrections: `assets/pdf-facsimile.js`
- Layout helpers: `assets/numerical-alignment.js` and related scripts in `assets/`
- ADT runtime: preserve `assets/base.bundle.local.js` unless a verified reader bug requires change.

## Validation

```bash
git diff --check
node --check assets/source-book-theme.js
node --check assets/pdf-facsimile.js
```

## Deployment

- Remote: `https://github.com/Scotops/Mathematics-STD-3-converted-book.git`
- Branch: `main`
- Hosting: existing static/GitHub Pages-compatible bundle
- Commit, push, or deploy only when explicitly requested.
