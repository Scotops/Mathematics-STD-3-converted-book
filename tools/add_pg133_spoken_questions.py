"""Add deterministic spoken expressions to the fraction revision questions."""

from __future__ import annotations

import html
import re
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "pg133_sec001.html"
LABEL = re.compile(
    r'(<label\b(?![^>]*\bdata-tts-text=)[^>]*\bdata-id="pg133_n\d+"[^>]*)(>)'
    r'(\s*<math>.*?</math>)',
    re.IGNORECASE | re.DOTALL,
)
FRACTION_LABEL = re.compile(r'aria-label="([^"]+\s+over\s+[^"]+)"', re.IGNORECASE)


def add_spoken_text(source: str) -> tuple[str, int]:
    count = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal count
        opening, close, mathml = match.groups()
        fractions = FRACTION_LABEL.findall(mathml)
        if len(fractions) != 2:
            return match.group(0)
        operator = "plus" if "<mo>+</mo>" in mathml else "minus"
        spoken = f"{fractions[0]} {operator} {fractions[1]} equals"
        count += 1
        return f'{opening} data-tts-text="{html.escape(spoken, quote=True)}"{close}{mathml}'

    return LABEL.sub(replace, source), count


def main() -> None:
    source = PAGE.read_text(encoding="utf-8")
    updated, count = add_spoken_text(source)
    if count != 23:
        raise RuntimeError(f"Expected 23 arithmetic questions, updated {count}.")
    PAGE.write_text(updated, encoding="utf-8")
    print(f"Added exact spoken expressions to {count} questions.")


if __name__ == "__main__":
    main()
