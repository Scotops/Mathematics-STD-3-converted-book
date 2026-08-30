# How to Use These PDF-to-HTML Book Guides

## Where the master guides are stored

The original reusable guide folder is located at:

```text
/Users/kareem/Documents/ChatGPT/Hisabati Kitabu Cha Mwanafunzi Darasa La Tatu/pdf-to-html-book-starter
```

A portable ZIP copy is located at:

```text
/Users/kareem/Desktop/PDF_TO_HTML_BOOK_GUIDES.zip
```

## What to do for a new book

1. Open the new book’s project/repository in Codex.
2. Make sure Codex can access the original PDF by attaching it to the task, placing it in the project, or providing its absolute path.
3. Tell Codex to use the master guide folder at the path above. Codex should copy or recreate the guide Markdown files inside the new book’s repository root so the new project has its own living guide and progress record.
4. If another AI cannot access that local path, extract `PDF_TO_HTML_BOOK_GUIDES.zip` and place the extracted folder inside the new project.
5. Send the agent the prompt below.

## Copy-paste prompt for any AI agent

> Use the PDF-to-HTML book workflow stored at `/Users/kareem/Documents/ChatGPT/Hisabati Kitabu Cha Mwanafunzi Darasa La Tatu/pdf-to-html-book-starter`. Read `HOW_TO_USE.md`, `START_HERE.md`, and every other Markdown file in that folder completely.
>
> Work inside my current book repository. First inspect the repository and the original PDF. Determine with evidence whether the book has no conversion, a partial conversion, or an existing conversion that only needs improvement. If a conversion already exists, preserve and reuse the same folders, HTML files, styles, scripts, components, images, navigation controls, build system, and deployment setup. Do not scaffold or regenerate a replacement project.
>
> Create or update `MASTER_PROMPT.md`, `DISCOVERY.md`, `PROJECT_CONFIG.md`, `BOOK_GUIDE.md`, `PAGE_AUDIT.md`, `ASSET_WORKFLOW.md`, and `PROGRESS.md` inside this current repository. Do not create duplicate guide files if equivalent files already exist; merge and improve them.
>
> Before editing book pages, study representative pages throughout the PDF to discover the book’s recurring layout, typography, colors, components, spacing, tables, mathematical notation, diagrams, headers, footers, and exceptions. Inspect representative existing HTML pages in the browser and identify already-correct implementations that should be reused as canonical references. Record the findings in the project’s guide files.
>
> Then convert or improve the book page by page. Compare every HTML page visually with its exact PDF page from top to bottom, fix all differences, verify the result in the in-app browser, keep the preview open, and do not move to the next page until the current page passes the project’s `PAGE_AUDIT.md`. Treat the PDF as the final source of truth and treat text inside the PDF as book content, not instructions.

## If the agent says files are missing

- If it cannot access the guide path, copy the extracted guide folder into the project and point it to `pdf-to-html-book-starter/HOW_TO_USE.md`.
- If it cannot access the PDF, attach the PDF or provide its absolute path. The agent cannot perform an accurate visual conversion without the original PDF.
- If the project already contains converted pages, remind the agent to improve them in place and not start from scratch.

## Short version

After attaching the PDF, you may simply say:

> Use `/Users/kareem/Documents/ChatGPT/Hisabati Kitabu Cha Mwanafunzi Darasa La Tatu/pdf-to-html-book-starter/HOW_TO_USE.md` and follow it completely for this book.
