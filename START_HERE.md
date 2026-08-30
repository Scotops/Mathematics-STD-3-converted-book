# Start Here — Bootstrap Prompt

Copy and send the following prompt to Codex from inside the target book repository:

> Set up this repository for a source-faithful PDF-to-HTML book conversion or improvement audit.
>
> First inspect the current repository and determine whether it contains a complete conversion, a partial conversion, or no meaningful conversion. Do not scaffold a replacement if existing book files are present. Reuse and edit the current folders, HTML pages, styles, scripts, components, images, navigation controls, build system, and deployment setup.
>
> Search the repository, workspace roots, files explicitly attached to this task, and paths mentioned by me for the original PDF. Do not say the PDF is missing until those locations have been checked. If it still cannot be found, create the setup documents and then tell me the exact missing input: the PDF file or its absolute path. Do not begin visual conversion without the PDF.
>
> In the root of this same repository, create or update—never duplicate—the following files: `MASTER_PROMPT.md`, `DISCOVERY.md`, `PROJECT_CONFIG.md`, `BOOK_GUIDE.md`, `PAGE_AUDIT.md`, `ASSET_WORKFLOW.md`, and `PROGRESS.md`. Use the supplied starter-kit templates as their basis. If equivalent guide or handoff files already exist under different names, read and merge their useful information instead of discarding it.
>
> Complete `DISCOVERY.md` before changing book pages. Study representative PDF pages across the entire book to identify repeated page shells, typography, colors, chapter headers, examples, exercises, activities, reminders, tables, mathematical layouts, image treatments, page numbers, and exceptions. Inspect representative existing HTML pages in the browser and identify already-correct implementations that should become canonical references.
>
> Populate `PROJECT_CONFIG.md`, initialize the book-specific `BOOK_GUIDE.md`, and record the conversion classification and first audit target in `PROGRESS.md`. Then report the discovered state and proposed in-place strategy. Do not start broad page edits until discovery is complete.

## Required input

Codex needs access to the original PDF. Supply it in one of these ways:

1. Attach the PDF to the first task message.
2. Put the PDF inside the project repository.
3. Give Codex its absolute local path.

The PDF cannot be reconstructed from the starter kit. It is the source of truth required for visual comparison.
