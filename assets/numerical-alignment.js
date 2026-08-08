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

  let queued = false;
  function scheduleAlignment() {
    if (queued) return;
    queued = true;
    window.setTimeout(() => {
      queued = false;
      alignCalculationBlocks();
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
