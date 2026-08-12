/*
 * Keeps converted written calculations readable throughout the book.
 * Only compact groups whose rows contain numbers, an operation sign and/or a
 * horizontal rule are changed.  Narrative text, tables and exercises remain
 * untouched.
 */
(() => {
  const operator = '[+\\-\\u2212\\u2013]';
  // Includes ordinary vertical arithmetic and the shilling/cents layouts used
  // later in the book.  The detector remains deliberately strict so narrative
  // sentences are never reflowed as a calculation.
  const numberRow = new RegExp(`^${operator}?\\s*(?:(?:shs|tsh|tzs)\\s*)?\\d[\\d,.\\s]*(?:cts)?$`, 'i');
  const ruleRow = /^[\-_\u2500\u2014]{3,}$/;
  const headerRow = /^(?:shs\s+)?(?:cts|cst)$/i;

  function addStyles() {
    if (document.getElementById('adt-numerical-alignment-styles')) return;
    const style = document.createElement('style');
    style.id = 'adt-numerical-alignment-styles';
    style.textContent = `
      #content .adt-vertical-arithmetic {
        --adt-digits: 6;
        align-items: stretch !important;
        box-sizing: border-box;
        display: flex !important;
        flex-direction: column !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
        /* Room for an operation sign, its following space and a carry digit. */
        min-width: calc(var(--adt-digits) * 1ch + 2.75ch);
        width: calc(var(--adt-digits) * 1ch + 2.75ch);
        white-space: pre !important;
      }
      #content .adt-vertical-arithmetic > .adt-numeric-row {
        box-sizing: border-box;
        display: block !important;
        min-width: 0;
        padding-left: 0 !important;
        padding-right: 0 !important;
        text-align: right !important;
        width: 100% !important;
      }
      #content .adt-vertical-arithmetic > .adt-calc-line,
      #content .adt-vertical-arithmetic > .adt-calc-rule {
        align-self: flex-end;
        display: block !important;
        max-width: 100%;
        width: 100% !important;
      }
      #content .adt-vertical-arithmetic > .adt-carry-row {
        padding-right: 1ch !important;
      }
      #content .adt-vertical-arithmetic > .adt-currency-header {
        box-sizing: border-box;
        display: block !important;
        min-width: 0;
        padding-left: 0 !important;
        padding-right: 0 !important;
        text-align: right !important;
        width: 100% !important;
      }
      #content .adt-pre-calculation {
        display: inline-flex !important;
        flex-direction: column !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
        line-height: 1.15 !important;
        white-space: normal !important;
      }
      #content .adt-pre-calculation > .adt-calc-row {
        display: grid;
        grid-template-columns: 1.2ch calc(var(--adt-digits) * 1ch);
        min-height: 1.15em;
      }
      #content .adt-pre-calculation .adt-calc-operator { text-align: left; }
      #content .adt-pre-calculation .adt-calc-digits { text-align: right; }
      #content .adt-pre-calculation > .adt-calc-rule {
        display: block;
        text-align: right;
        white-space: nowrap;
      }
      #content table.adt-currency-calculation {
        border-collapse: separate;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
        table-layout: fixed;
      }
      #content table.adt-currency-calculation th,
      #content table.adt-currency-calculation td {
        box-sizing: border-box;
        font-variant-numeric: tabular-nums lining-nums;
        padding-left: .35ch;
        padding-right: .35ch;
        text-align: right !important;
        white-space: nowrap;
      }
    `;
    document.head.append(style);
  }

  function alignCurrencyTables() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('table').forEach((table) => {
      if (table.classList.contains('adt-currency-calculation')) return;
      const rows = Array.from(table.rows);
      if (rows.length < 3 || rows.length > 8) return;
      if (rows.some((row) => row.cells.length < 2 || row.cells.length > 3)) return;

      const text = table.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (!/\bshs?\b/i.test(text) || !/\bcts?\b/i.test(text)) return;
      if (!/[+\-\u2212\u2013]/.test(text)) return;

      const numericRows = rows.filter((row) => /\d/.test(row.textContent));
      if (numericRows.length < 2) return;

      table.classList.add('adt-currency-calculation');
      const columnCount = Math.max(...rows.map((row) => row.cells.length));
      const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
        return Math.max(3, ...rows.map((row) => {
          const cell = row.cells[columnIndex];
          return cell ? cell.textContent.replace(/\s+/g, ' ').trim().length : 0;
        }));
      });

      if (!table.style.width) {
        const total = widths.reduce((sum, width) => sum + width, 0) + columnCount * 1.2;
        table.style.width = `${Math.max(12, total)}ch`;
        table.style.maxWidth = '100%';
      }
    });
  }

  function rowKind(row) {
    const value = row.textContent.replace(/\u00a0/g, ' ').trim();
    if (!value && /(?:^|\s)(?:h-|border-|w-)/.test(row.className || '')) return 'line';
    if (ruleRow.test(value)) return 'rule';
    if (headerRow.test(value)) return 'header';
    if (numberRow.test(value)) return 'number';
    return null;
  }

  function directRows(block) {
    return Array.from(block.children).filter((row) => {
      // Rows may contain a simple span for the TTS data-id, but should not
      // contain a complete table, answer field or explanatory paragraph.
      if (row.querySelector('input, textarea, table, p, ol, ul, section')) return false;
      const value = row.textContent.replace(/\u00a0/g, ' ').trim();
      const isVisibleRule = /(?:^|\s)(?:h-|border-|w-)/.test(row.className || '');
      // Empty placeholder rows are common in exercises; they do not form part
      // of the written calculation and must not prevent its alignment.
      return Boolean(value) || isVisibleRule;
    });
  }

  function alignCalculationBlocks() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('div, pre').forEach((block) => {
      if (block.classList.contains('adt-vertical-arithmetic') || block.classList.contains('adt-pre-calculation')) return;
      const rows = directRows(block);
      if (rows.length < 2 || rows.length > 8) return;

      const kinds = rows.map(rowKind);
      if (kinds.some((kind) => kind === null)) return;
      const numericRows = rows.filter((_, index) => kinds[index] === 'number');
      if (numericRows.length < 2) return;

      const values = numericRows.map((row) => row.textContent.replace(/\u00a0/g, ' ').trim());
      const isCalculation = values.some((value) => new RegExp(`^${operator}`).test(value)) || kinds.includes('rule');
      if (!isCalculation) return;

      const maxDigits = Math.max(...values.map((value) => {
        const match = value.match(new RegExp(`^${operator}?\\s*(.*)$`));
        return (match ? match[1] : value).replace(/[^0-9]/g, '').length;
      }));
      if (!maxDigits) return;

      block.classList.add('adt-vertical-arithmetic');
      block.style.setProperty('--adt-digits', String(maxDigits));
      rows.forEach((row, index) => {
        if (kinds[index] === 'number') row.classList.add('adt-numeric-row');
        if (kinds[index] === 'header') row.classList.add('adt-currency-header');
        if (kinds[index] === 'rule') row.classList.add('adt-calc-rule');
        if (kinds[index] === 'line') row.classList.add('adt-calc-line');
        if (/(text-red|text-rose|text-orange)/.test(row.className)) row.classList.add('adt-carry-row');
      });
    });
  }

  // A few pages store a complete calculation as plain multiline text.  Split
  // those lines into an operator and a digit column so all ones places align.
  function alignPlainMultilineCalculations() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('pre, .font-mono').forEach((block) => {
      if (block.children.length || block.classList.contains('adt-pre-calculation')) return;
      const lines = block.textContent.replace(/\u00a0/g, ' ').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2 || lines.length > 8) return;

      const parsed = lines.map((line) => {
        if (ruleRow.test(line)) return { rule: true };
        const match = line.match(new RegExp(`^(${operator})?\\s*([0-9][0-9,.\\s]*)$`));
        return match ? { operator: match[1] || '', digits: match[2].replace(/\s+/g, '') } : null;
      });
      const numericRows = parsed.filter((row) => row && !row.rule);
      if (numericRows.length < 2 || parsed.some((row) => !row)) return;
      if (!numericRows.some((row) => row.operator) && !parsed.some((row) => row.rule)) return;

      const maxDigits = Math.max(...numericRows.map((row) => row.digits.replace(/[^0-9]/g, '').length));
      block.classList.add('adt-pre-calculation');
      block.style.setProperty('--adt-digits', String(maxDigits));
      block.textContent = '';
      parsed.forEach((row) => {
        const line = document.createElement('span');
        if (row.rule) {
          line.className = 'adt-calc-rule';
          line.textContent = '\u2500'.repeat(maxDigits + 1);
        } else {
          line.className = 'adt-calc-row';
          const sign = document.createElement('span');
          sign.className = 'adt-calc-operator';
          sign.textContent = row.operator;
          const digits = document.createElement('span');
          digits.className = 'adt-calc-digits';
          digits.textContent = row.digits;
          line.append(sign, digits);
        }
        block.append(line);
      });
    });
  }

  // Some converted pages place all rows in a single data-id span instead of
  // individual row elements. Convert only verified arithmetic strings into
  // the same aligned grid used for preformatted calculations.
  function alignLeafMultilineCalculations() {
    const content = document.getElementById('content');
    if (!content) return;

    content.querySelectorAll('[data-id], .whitespace-pre, .whitespace-pre-line').forEach((block) => {
      if (block.classList.contains('adt-pre-calculation') || block.children.length) return;
      const raw = block.textContent.replace(/\u00a0/g, ' ');
      if (!/\r?\n/.test(raw)) return;
      const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length < 2 || lines.length > 8) return;

      const parsed = lines.map((line) => {
        if (ruleRow.test(line)) return { rule: true };
        const match = line.match(new RegExp(`^(${operator})?\\s*((?:(?:shs|tsh|tzs)\\s*)?[0-9][0-9,.\\s]*(?:cts)?)$`, 'i'));
        return match ? { operator: match[1] || '', digits: match[2].replace(/\s+/g, ' ') } : null;
      });
      const numericRows = parsed.filter((row) => row && !row.rule);
      if (numericRows.length < 2 || parsed.some((row) => !row)) return;
      if (!numericRows.some((row) => row.operator) && !parsed.some((row) => row.rule)) return;

      const maxDigits = Math.max(...numericRows.map((row) => row.digits.replace(/[^0-9]/g, '').length));
      block.classList.add('adt-pre-calculation');
      block.style.setProperty('--adt-digits', String(maxDigits));
      block.textContent = '';
      parsed.forEach((row) => {
        const line = document.createElement('span');
        if (row.rule) {
          line.className = 'adt-calc-rule';
          line.textContent = '\u2500'.repeat(maxDigits + 1);
        } else {
          line.className = 'adt-calc-row';
          const sign = document.createElement('span');
          sign.className = 'adt-calc-operator';
          sign.textContent = row.operator;
          const digits = document.createElement('span');
          digits.className = 'adt-calc-digits';
          digits.textContent = row.digits;
          line.append(sign, digits);
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
      addStyles();
      alignCurrencyTables();
      alignCalculationBlocks();
      alignPlainMultilineCalculations();
      alignLeafMultilineCalculations();
    }, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleAlignment);
  else scheduleAlignment();
  window.addEventListener('load', scheduleAlignment);
  window.setTimeout(scheduleAlignment, 800);
  window.setTimeout(scheduleAlignment, 1600);

  const content = document.getElementById('content');
  if (content) new MutationObserver(scheduleAlignment).observe(content, { childList: true, characterData: true, subtree: true });
})();
