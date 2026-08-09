/*
 * Normalise converted vertical calculations without changing narrative text.
 * A candidate consists only of short numeric rows (for example 2361, + 3899,
 * 6260), so calendars, tables and normal exercise prose are left untouched.
 */
(() => {
  const numericRow = /^[+\-−–]?\s*\d+(?:[,.]\d+)?$/;

  function alignCalculationBlocks() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('div').forEach((block) => {
      if (block.classList.contains('adt-vertical-arithmetic')) return;

      const rows = Array.from(block.children).filter(
        (row) => row.matches('[data-id]') && row.textContent.trim()
      );
      if (rows.length < 2 || rows.length > 8) return;

      const values = rows.map((row) => row.textContent.trim());
      const numberRows = values.filter((value) => numericRow.test(value));
      if (numberRows.length < 2 || numberRows.length !== values.length) return;

      // A vertical operation has either an operator row, a carrying row, or
      // three or more number rows (minuend, subtrahend and answer).
      const looksLikeCalculation =
        values.some((value) => /^[+\-−–]/.test(value)) || rows.length >= 3;
      if (!looksLikeCalculation) return;

      block.classList.add('adt-vertical-arithmetic');
      rows.forEach((row) => {
        if (/(text-red|text-rose|text-orange)/.test(row.className)) {
          row.classList.add('adt-carry-row');
        }
      });
    });
  }

  /* Some converted pages store a whole vertical calculation as one multiline
   * text block (often a <pre>).  In that format a minus sign and its following
   * space shift every digit to the right.  Split it into an operator column and
   * a right-aligned digit column so the ones place is always shared. */
  function alignMultilineCalculations() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('pre, .font-mono').forEach((block) => {
      if (block.querySelector(':scope > .adt-calc-row')) return;

      const lines = block.textContent
        .replace(/\u00a0/g, ' ')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length < 2 || lines.length > 8) return;

      const parsed = lines.map((line) => {
        if (/^[─—_\-]{3,}$/.test(line)) return { rule: true };
        const match = line.match(/^([+\-−–])?\s*([0-9][0-9,.\s]*)$/);
        if (!match) return null;
        return { operator: match[1] || '', digits: match[2].replace(/\s+/g, '') };
      });
      const numericRows = parsed.filter((row) => row && !row.rule);
      if (numericRows.length < 2 || parsed.some((row) => !row)) return;
      if (!numericRows.some((row) => row.operator) && !parsed.some((row) => row.rule)) return;

      const maxDigits = Math.max(...numericRows.map((row) => row.digits.length));
      block.classList.add('adt-pre-calculation');
      block.style.setProperty('--adt-digits', String(maxDigits));
      block.textContent = '';

      parsed.forEach((row) => {
        const line = document.createElement('span');
        if (row.rule) {
          line.className = 'adt-calc-rule';
          line.textContent = '─'.repeat(maxDigits + 1);
        } else {
          line.className = 'adt-calc-row';
          const operator = document.createElement('span');
          operator.className = 'adt-calc-operator';
          operator.textContent = row.operator;
          const digits = document.createElement('span');
          digits.className = 'adt-calc-digits';
          digits.textContent = row.digits;
          line.append(operator, digits);
        }
        block.append(line);
      });
    });
  }

  let queued = false;
  function scheduleAlignment() {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      alignCalculationBlocks();
      alignMultilineCalculations();
    }, 80);
  }

  document.addEventListener('DOMContentLoaded', scheduleAlignment);
  window.addEventListener('load', scheduleAlignment);
  window.setTimeout(scheduleAlignment, 800);
  window.setTimeout(scheduleAlignment, 1600);

  const content = document.getElementById('content');
  if (content) {
    new MutationObserver(scheduleAlignment).observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
})();
