/* Apply the recurring visual grammar of the printed Mathematics book. */
(() => {
  'use strict';

  /* These pages are proportionally fitted after their images and generated
     components are measurable. Hide that pre-fit frame so refresh presents
     one finished page instead of flashing the oversized converter version. */
  const initialRoot = document.querySelector('#content');
  const initialSectionId = document.querySelector('meta[name="title-id"]')?.content || '';
  const initialPageMatch = initialSectionId.match(/^pg(\d{3})_/);
  if (initialRoot && initialPageMatch) {
    const physical = Number.parseInt(initialPageMatch[1], 10);
    if (physical >= 7 && physical <= 184) initialRoot.classList.add('book-fit-pending');
  }

  const PATTERNS = [
    ['revision', /^Revision exercise$/i],
    ['exercise', /^Exercise(?:\s+\d+)?$/i],
    ['example', /^Example(?:\s+\d+)?$/i],
    ['activity', /^Activity(?:\s*\d+)?\s*(?::.*)?$/i],
    ['summary', /^Summary$/i],
    ['vocabulary', /^Vocabulary$/i],
    ['chapter', /^Chapter\s+(?:One|Two|Three|Four|Five|Six|Seven)$/i],
  ];

  function kindFor(text) {
    for (const [kind, pattern] of PATTERNS) {
      if (pattern.test(text)) return kind;
    }
    return '';
  }

  function hasVisualSurface(element) {
    const style = getComputedStyle(element);
    const hasBackground = style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      && style.backgroundColor !== 'transparent';
    const fullBorder = ['Top', 'Right', 'Bottom', 'Left']
      .every((side) => Number.parseFloat(style[`border${side}Width`]) > 0);
    return hasBackground || fullBorder;
  }

  function findCard(heading, root) {
    const headingLength = heading.textContent.trim().length;
    let structuralFallback = null;
    for (let node = heading.parentElement; node && node !== root; node = node.parentElement) {
      const contentLength = node.textContent.trim().length;
      if (contentLength <= headingLength + 12) continue;
      if (!structuralFallback && node.matches('article, aside, section, [class*="overflow-hidden"], [class*="rounded"]')) {
        structuralFallback = node;
      }
      // Prefer the nearest meaningful card wrapper over a page-level section
      // whose white page surface also happens to count as a background.
      if (structuralFallback && node !== structuralFallback && node.matches('section')) {
        return structuralFallback;
      }
      if (hasVisualSurface(node)) return node;
    }
    return structuralFallback || heading.closest('section, article, aside');
  }

  function applySourceTheme() {
    const root = document.querySelector('#content');
    if (!root) return;
    normalizePrintedPage4(root);
    normalizePrintedPages5To8(root);
    normalizePrintedPage15(root);
    normalizePrintedPages140To141(root);
    window.setTimeout(() => normalizePrintedPages140To141(root), 800);
    normalizePrintedPages132To136(root);
    normalizePrintedPage147(root);
    normalizePrintedPage148(root);
    normalizePrintedPage149(root);
    normalizePrintedPage150(root);
    window.setTimeout(() => normalizePrintedPage150(root), 750);
    normalizePrintedPage151(root);
    window.setTimeout(() => normalizePrintedPage151(root), 750);
    normalizePrintedPage160(root);
    normalizePrintedPage161(root);
    window.setTimeout(() => normalizePrintedPage160Text(root), 1200);
    window.setTimeout(() => normalizePrintedPage161(root), 1200);
    normalizePrintedPage163(root);
    window.setTimeout(() => normalizePrintedPage163(root), 1000);
    normalizePrintedPage164(root);
    normalizePrintedPage165(root);
    normalizePrintedPage166(root);
    normalizePrintedPage167(root);
    normalizePrintedPage168(root);
    normalizePrintedPage169(root);
    normalizePrintedPage171(root);
    const candidates = root.querySelectorAll('[data-id], h1, h2, h3, h4');
    candidates.forEach((heading) => {
      if (heading.dataset.sourceThemeProcessed === 'true') return;
      const text = heading.textContent.replace(/\s+/g, ' ').trim();
      const kind = kindFor(text);
      if (!kind) return;
      // The contents page lists the chapter names; they are entries, not the
      // full-width chapter-title panel used at the start of each chapter.
      if (kind === 'chapter' && heading.closest('[data-source-section="pg003_sec001"]')) return;
      heading.dataset.sourceThemeProcessed = 'true';
      heading.dataset.sourceHeading = kind;
      heading.classList.add(`book-${kind}-heading`);
      if (kind === 'chapter') {
        heading.parentElement.dataset.sourceHeadingWrap = 'chapter';
        return;
      }
      const card = findCard(heading, root);
      if (card && (!card.dataset.sourceKind || card.dataset.sourceKind === kind)) {
        card.dataset.sourceKind = kind;
        card.classList.add(kind === 'example' ? 'book-example-card' : `book-${kind}-panel`);
        if (heading.parentElement !== card) {
          heading.parentElement.dataset.sourceHeadingWrap = kind;
          heading.parentElement.classList.add(`book-${kind}-heading-wrap`);
        }
        if (kind === 'example' || kind === 'exercise') markConverterInnerShells(card, heading);
      }
    });
    normalizeExerciseHeadingBands(root);
    window.setTimeout(() => normalizeExerciseHeadingBands(root), 120);
    window.setTimeout(() => normalizeExerciseHeadingBands(root), 900);
    normalizeExampleCardWidths(root);
    window.setTimeout(() => normalizeExampleCardWidths(root), 120);
    window.setTimeout(() => normalizeExampleCardWidths(root), 900);
    classifyPrintedPage(root);
    normalizeBlueContentHeadings(root);
    normalizeContentWidthAndBodyType(root);
    addPrintedPageFooter(root);
    normalizeArithmeticMinusSigns(root);
    window.setTimeout(() => normalizeArithmeticMinusSigns(root), 850);
    normalizeSubtractionExerciseSeven(root);
    window.setTimeout(() => normalizeSubtractionExerciseSeven(root), 900);
    window.setTimeout(() => normalizePrintedPage15(root), 1000);
    fitBackwardAuditBatch72To131(root);
    finishBackwardAuditFit(root);
    stabilizeSourcePageFit(root);
  }

  /* Exercise title bands in the source PDF always run from one edge of the
     coloured exercise field to the other. Generated pages use several
     different wrappers, so measure the immediate panel inset and cancel it
     instead of maintaining fragile page-specific offsets. */
  function normalizeExerciseHeadingBands(root) {
    root.querySelectorAll(
      '[data-source-heading="exercise"], [data-source-heading="revision"]'
    ).forEach((heading) => {
      if (heading.classList.contains('sr-only')) return;
      const kind = heading.dataset.sourceHeading;
      const wrap = heading.closest(`[data-source-heading-wrap="${kind}"]`);
      const band = wrap || heading;
      const parent = band.parentElement;
      if (!parent || !root.contains(parent)) return;
      const style = getComputedStyle(parent);
      const left = Number.parseFloat(style.paddingLeft) || 0;
      const right = Number.parseFloat(style.paddingRight) || 0;
      const panel = band.closest('.book-exercise-panel, .book-revision-panel');
      const targetWidth = panel?.clientWidth || parent.clientWidth;
      band.style.setProperty('--book-heading-inset-left', `${left}px`);
      band.style.setProperty('--book-heading-inset-right', `${right}px`);
      band.style.setProperty('width', `${targetWidth}px`, 'important');
      band.style.setProperty('max-width', `${targetWidth}px`, 'important');
      band.style.setProperty('margin-left', '0px', 'important');
      band.style.setProperty('margin-right', '0px', 'important');
      if (panel) {
        const offset = panel.getBoundingClientRect().left - band.getBoundingClientRect().left;
        band.style.setProperty('margin-left', `${offset}px`, 'important');
      }
      band.classList.add('book-full-width-exercise-heading');
    });
  }

  function normalizeExampleCardWidths(root) {
    root.querySelectorAll('.book-example-card').forEach((card) => {
      if (card.querySelector(':scope > .book-example-card')) return;
      const section = card.closest('[data-section-id]');
      if (!section) return;
      const targetWidth = section.clientWidth;
      card.style.setProperty('width', `${targetWidth}px`, 'important');
      card.style.setProperty('max-width', `${targetWidth}px`, 'important');
      card.style.setProperty('margin-left', '0px', 'important');
      card.style.setProperty('margin-right', '0px', 'important');
      const offset = section.getBoundingClientRect().left - card.getBoundingClientRect().left;
      card.style.setProperty('margin-left', `${offset}px`, 'important');
    });
  }

  /* Keep the same page-range hooks used by the Hisabati repository. The
     converter filenames are six pages ahead of the printed page number. */
  function classifyPrintedPage(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    const match = sectionId.match(/^pg(\d{3})_/);
    if (!match) return;
    const printed = Math.max(1, Number.parseInt(match[1], 10) - 6);
    root.classList.add(`book-print-page-${printed}`);
    if (printed > 13) root.classList.add('book-after-page13');
    if (printed > 18) root.classList.add('book-after-page18');
    if (printed >= 60) root.classList.add('book-from-print-page60');
  }

  function normalizeBlueContentHeadings(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    const match = sectionId.match(/^pg(\d{3})_/);
    if (!match || Number.parseInt(match[1], 10) < 23) return;
    root.querySelectorAll('h1, h2, h3, h4, [data-id]').forEach((node) => {
      const classes = typeof node.className === 'string' ? node.className : '';
      if (!/(?:text-(?:sky|blue|cyan)-\d+)/.test(classes)) return;
      if (node.closest('[data-source-kind], table, .source-book-page-footer')) return;
      const weight = Number.parseInt(getComputedStyle(node).fontWeight, 10) || 400;
      if (weight < 600 || node.textContent.trim().length < 3) return;
      const target = getComputedStyle(node).display === 'inline' ? node.parentElement : node;
      target?.classList.add('book-blue-content-heading');
    });
  }

  function normalizeContentWidthAndBodyType(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    const match = sectionId.match(/^pg(\d{3})_/);
    if (!match || Number.parseInt(match[1], 10) < 23) return;
    root.classList.add('book-standard-content-from-page17');
    const compactCalendar = !!root.querySelector(
      '[data-section-id="pg154_sec001"], [data-section-id="pg155_sec001"]'
    );
    root.querySelectorAll('[data-id], p, li, td, th, label').forEach((node) => {
      if (!node.textContent.trim()) return;
      if (node.closest(
        'h1, h2, h3, h4, h5, h6, [data-source-heading], '
        + '[data-source-heading-wrap], .source-book-page-footer, .sr-only'
      )) return;
      node.classList.add('book-standard-body-text');
      if (!compactCalendar) {
        // Typography is controlled by the shared stylesheet and page-parity
        // rules. Inline !important values prevented dense source layouts from
        // being calibrated and caused content to overflow after page load.
        node.style.removeProperty('font-size');
        node.style.removeProperty('line-height');
      }
    });
  }

  /* Several early pages contain large extracted diagrams without intrinsic
     HTML dimensions.  Measure again after those assets decode, while keeping
     the unfinished frame hidden, so a page cannot grow into either gradient
     or flash a second layout after refresh. */
  function stabilizeSourcePageFit(root) {
    const wrapper = root.querySelector(':scope > .book-source-autofit');
    if (!wrapper) return;
    const images = [...wrapper.querySelectorAll('img')];
    const pending = images.filter((image) => !image.complete);
    const refit = () => {
      wrapper.style.removeProperty('--book-fit-scale');
      wrapper.style.removeProperty('width');
      wrapper.style.removeProperty('height');
      const top = wrapper.getBoundingClientRect().top;
      const meaningful = [...wrapper.querySelectorAll(
        'p, h1, h2, h3, h4, li, table, figure, img, [data-id], [data-source-heading]'
      )].filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      const bottom = meaningful.length
        ? Math.max(...meaningful.map((node) => node.getBoundingClientRect().bottom))
        : top;
      const naturalHeight = Math.max(1, bottom - top + 24);
      const scale = Math.min(1, 1136 / naturalHeight);
      wrapper.style.setProperty('--book-fit-scale', scale.toFixed(4));
      wrapper.style.width = `${(100 / scale).toFixed(4)}%`;
      wrapper.style.height = `${Math.ceil(naturalHeight * scale)}px`;
      wrapper.dataset.fitScale = scale.toFixed(4);
      root.dataset.fitFinalized = 'true';
      root.classList.remove('book-fit-pending');
    };
    if (!pending.length) {
      refit();
      return;
    }
    root.classList.add('book-fit-pending');
    Promise.all(pending.map((image) => new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    }))).then(refit);
  }

  function finishBackwardAuditFit(root) {
    if (root.dataset.fitFinalized === 'true') return;
    const wrapper = root.querySelector(':scope > .book-source-autofit');
    if (!wrapper || root.getBoundingClientRect().height <= 1315) return;
    root.dataset.fitFinalized = 'true';
    const currentScale = Number.parseFloat(wrapper.dataset.fitScale || '1');
    const factor = Math.min(1, 1285 / root.getBoundingClientRect().height);
    const scale = currentScale * factor;
    wrapper.style.setProperty('--book-fit-scale', scale.toFixed(4));
    wrapper.style.width = `${(100 / scale).toFixed(4)}%`;
    wrapper.style.height = `${Math.ceil(wrapper.scrollHeight * scale)}px`;
    wrapper.dataset.fitScale = scale.toFixed(4);
  }

  function fitBackwardAuditBatch72To131(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    const match = sectionId.match(/^pg(\d{3})_/);
    if (!match || root.dataset.batch102Fit === 'true') return;
    const physical = Number.parseInt(match[1], 10);
    if (physical < 7 || physical > 184) return;

    const parts = [...root.children].filter((node) => node.classList.contains('adt-source-page-part'));
    if (!parts.length) {
      root.classList.remove('book-fit-pending');
      return;
    }
    root.dataset.batch102Fit = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'book-source-autofit';
    root.insertBefore(wrapper, parts[0]);
    parts.forEach((part) => wrapper.append(part));

    const wrapperTop = wrapper.getBoundingClientRect().top;
    const meaningful = parts.flatMap((part) => [...part.querySelectorAll(
      'p, h1, h2, h3, h4, li, table, figure, img, [data-id], [data-source-heading]'
    )]).filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    });
    const contentBottom = Math.max(...meaningful.map((node) => node.getBoundingClientRect().bottom));
    const naturalHeight = Math.max(1, contentBottom - wrapperTop + 32);
    const availableHeight = 1136;
    const scale = Math.min(1, availableHeight / naturalHeight);
    if (scale >= .985) {
      root.classList.remove('book-fit-pending');
      return;
    }
    wrapper.style.setProperty('--book-fit-scale', scale.toFixed(4));
    wrapper.style.width = `${(100 / scale).toFixed(4)}%`;
    wrapper.style.height = `${Math.ceil(naturalHeight * scale)}px`;
    wrapper.dataset.fitScale = scale.toFixed(4);
    root.classList.remove('book-fit-pending');
  }

  function normalizePrintedPages140To141(root) {
    const q3 = root.querySelector('[data-id="pg146_n0003"]');
    if (q3) {
      q3.textContent = 'Draw arrows on the following clock faces to show the time indicated:';
      q3.dataset.ttsText = q3.textContent;
    }
    const q5 = root.querySelector('[data-id="pg147_n0003"]');
    if (q5) {
      q5.textContent = 'Draw digital and analogue clock faces to show each of the following times:';
      q5.dataset.ttsText = q5.textContent;
    }
    const typo = root.querySelector('[data-id="pg147_n0024"]');
    if (typo) typo.textContent = '(b) Twenty-five minutes past four';
  }

  function normalizePrintedPages132To136(root) {
    const accessiblePrompt = root.querySelector('[data-id="pg140_n0004"]');
    if (accessiblePrompt) {
      accessiblePrompt.textContent = 'Draw an analogue clock face that shows 04:00.';
      accessiblePrompt.dataset.ttsText = accessiblePrompt.textContent;
    }
  }

  function normalizePrintedPage147(root) {
    const section = root.querySelector('[data-section-id="pg153_sec001"]');
    const table = section?.querySelector('table');
    if (!table || table.classList.contains('book-months-source-table')) return;
    const months = [
      ['January', 'February', 'March', 'April', 'May', 'June'],
      ['July', 'August', 'September', 'October', 'November', 'December'],
    ];
    const numbers = [['1','2','3','4','5','6'], ['7','8','9','10','11','12']];
    const days = [['31 days','28 or 29 days','31 days','30 days','31 days','30 days'], ['31 days','31 days','30 days','31 days','30 days','31 days']];
    table.className = 'book-months-source-table';
    table.innerHTML = `<tbody>${months.map((row, index) => `<tr class="month-row">${row.map(value => `<th>${value}</th>`).join('')}</tr><tr>${numbers[index].map(value => `<td>${value}</td>`).join('')}</tr><tr>${days[index].map(value => `<td>${value}</td>`).join('')}</tr>${index === 0 ? '<tr class="month-separator"><td colspan="6"></td></tr>' : ''}`).join('')}</tbody>`;
  }

  function normalizePrintedPage148(root) {
    const section = root.querySelector('[data-section-id="pg154_sec001"]');
    const image = section?.querySelector('img[data-id="pg154_im001"]');
    if (!section || !image || section.dataset.calendarNormalized === 'true') return;
    section.dataset.calendarNormalized = 'true';
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const redDates = new Set(['0-1','0-12','3-7','3-19','3-21','3-22','3-26','4-1','5-4','6-7','7-8','7-11','9-14','10-9','11-9','11-25','11-26']);
    const monthTable = (month, index) => {
      const first = new Date(2019, index, 1).getDay();
      const count = new Date(2019, index + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i += 1) cells.push('<td></td>');
      for (let day = 1; day <= count; day += 1) {
        const holiday = redDates.has(`${index}-${day}`) ? ' class="is-holiday"' : '';
        cells.push(`<td${holiday}>${day}</td>`);
      }
      while (cells.length % 7) cells.push('<td></td>');
      const rows = [];
      for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
      return `<table class="book-calendar-month"><caption>${month}</caption><thead><tr>${['S','M','T','W','T','F','S'].map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    };
    const holidays = [
      ["Jan 1 New Year's Day", 'Jan 12 Zanzibar Revolution Day', 'Apr 7 Karume Day', 'Apr 19 Good Friday', 'Apr 21 Easter Sunday', 'Apr 22 Easter Monday'],
      ['Apr 26 Union Day', 'May 1 Labour Day', 'Jun 4 End of Ramadan (Eid al-Fitr)', 'Jul 7 Saba Saba Day', 'Aug 8 Nane Nane Day', 'Aug 11 Feast of the Sacrifice (Eid al-Adha)'],
      ['Oct 14 Nyerere Day', 'Nov 9 Maulid Day', 'Dec 9 Independence Day', 'Dec 25 Christmas Day', 'Dec 26 Boxing Day'],
    ];
    const calendar = document.createElement('div');
    calendar.className = 'book-calendar-2020';
    calendar.innerHTML = `<header><h1>2019</h1><strong>Tanzania</strong></header><div class="book-calendar-grid">${months.map(monthTable).join('')}</div><div class="book-calendar-holidays"><div><strong>2019 Holidays for Tanzania</strong>${holidays[0].map(x => `<span>${x}</span>`).join('')}</div>${holidays.slice(1).map(column => `<div>${column.map(x => `<span>${x}</span>`).join('')}</div>`).join('')}</div>`;
    calendar.querySelectorAll('.book-calendar-month :is(th, td)').forEach((cell) => cell.style.setProperty('font-size', '12px', 'important'));
    image.closest('.mt-8')?.replaceWith(calendar);
  }

  function normalizePrintedPage149(root) {
    const section = root.querySelector('[data-section-id="pg155_sec001"]');
    if (!section || section.dataset.calendarNormalized === 'true') return;
    section.dataset.calendarNormalized = 'true';
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const redDates = new Set(['0-1','0-12','3-7','3-10','3-12','3-13','3-26','4-1','4-24','6-7','6-31','7-8','9-14','9-29','11-9','11-25','11-26']);
    const monthTable = (month, index) => {
      const first = new Date(2020, index, 1).getDay();
      const count = new Date(2020, index + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i += 1) cells.push('<td></td>');
      for (let day = 1; day <= count; day += 1) {
        const holiday = redDates.has(`${index}-${day}`) ? ' class="is-holiday"' : '';
        cells.push(`<td${holiday}>${day}</td>`);
      }
      while (cells.length % 7) cells.push('<td></td>');
      const rows = [];
      for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
      return `<table class="book-calendar-month"><caption>${month}</caption><thead><tr>${['S','M','T','W','T','F','S'].map(day => `<th>${day}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
    };
    const holidays = [
      ["Jan 1 New Year's Day", 'Jan 12 Zanzibar Revolution', 'Apr 7 Karume Day', 'Apr 10 Good Friday', 'Apr 12 Easter Sunday', 'Apr 13 Easter Monday'],
      ['Apr 26 Union Day', 'May 1 Labour Day', 'May 24 End of Ramadan (Eid al-Fitr)', 'Jul 7 Saba Saba Day', 'Jul 31 Feast of the Sacrifice (Eid al-Adha)', 'Aug 8 Nane Nane'],
      ['Oct 14 Nyerere Day', 'Oct 29 Maulid Day', 'Dec 9 Independence Day', 'Dec 25 Christmas Day', 'Dec 26 Boxing Day'],
    ];
    section.innerHTML = `<div class="book-calendar-2020"><header><h1>2020</h1><strong>Tanzania</strong></header><div class="book-calendar-grid">${months.map(monthTable).join('')}</div><div class="book-calendar-holidays"><div><strong>2020 Holidays for Tanzania</strong>${holidays[0].map(x => `<span>${x}</span>`).join('')}</div>${holidays.slice(1).map(column => `<div>${column.map(x => `<span>${x}</span>`).join('')}</div>`).join('')}</div></div>`;
    section.querySelectorAll('.book-calendar-month :is(th, td)').forEach((cell) => cell.style.setProperty('font-size', '12px', 'important'));
  }

  function normalizePrintedPage150(root) {
    const title = root.querySelector('[data-id="pg156_n0021"]');
    const instructions = root.querySelector('[data-id="pg156_n0023"]');
    if (!title || !instructions) return;
    title.innerHTML = '<strong>Activity:</strong> My day in clocks';
    instructions.innerHTML = '<strong>Instructions:</strong> Use a basic drawing software (example, Paint) to create a digital timetable illustrating your daily activities.';
    instructions.dataset.ttsText = 'Instructions. Use a basic drawing software, for example Paint, to create a digital timetable illustrating your daily activities.';
  }

  function normalizePrintedPage151(root) {
    const statement = root.querySelector('[data-id="pg157_n0005"]');
    if (!statement) return;
    statement.textContent = 'Draw the face of an analogue clock for each of the following times:';
    statement.dataset.ttsText = 'Draw the face of an analogue clock for each of the following times.';
  }

  function normalizePrintedPage160(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg166_sec001' || root.dataset.page160Normalized === 'true') return;
    const firstSection = root.querySelector('[data-section-id="pg166_sec001"]');
    const continuationSection = root.querySelector('[data-section-id="pg166_sec002"]');
    const continuationBody = continuationSection?.children?.[1];
    if (!firstSection || !continuationSection || !continuationBody) return;

    normalizePrintedPage160Text(root);
    const questionTwo = root.querySelector('[data-id="pg166_n0008"]');
    const questionThree = root.querySelector('[data-id="pg166_n0080"]');
    if (questionTwo) {
      questionTwo.textContent = 'Read and write in words the value of money written in short form in the following table.';
      questionTwo.dataset.ttsText = questionTwo.textContent;
    }
    if (questionThree) {
      questionThree.textContent = 'Read and write in short form the value of money written in words.';
      questionThree.dataset.ttsText = questionThree.textContent;
    }

    root.dataset.page160Normalized = 'true';
    const panel = document.createElement('article');
    panel.className = 'book-page160-panel';
    Array.from(firstSection.children).forEach((node) => panel.append(node));
    Array.from(continuationBody.children).forEach((question) => {
      question.classList.add('book-page160-question');
      panel.append(question);
    });
    firstSection.append(panel);
    continuationSection.closest('.adt-source-page-part')?.remove();
  }

  function normalizePrintedPage160Text(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg166_sec001') return;
    const questionTwo = root.querySelector('[data-id="pg166_n0008"]');
    const questionThree = root.querySelector('[data-id="pg166_n0080"]');
    if (questionTwo) {
      questionTwo.textContent = 'Read and write in words the value of money written in short form in the following table.';
      questionTwo.dataset.ttsText = questionTwo.textContent;
    }
    if (questionThree) {
      questionThree.textContent = 'Read and write in short form the value of money written in words.';
      questionThree.dataset.ttsText = questionThree.textContent;
    }
  }

  function normalizePrintedPage161(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg167_sec001') return;
    const instruction = root.querySelector('[data-id="pg167_n0003"]');
    if (!instruction) return;
    instruction.textContent = 'Read and write the currency in short form in the following table.';
    instruction.dataset.ttsText = instruction.textContent;
  }

  function normalizePrintedPage163(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg169_sec001') return;
    root.dataset.page163Normalized = 'true';
    ['pg169_n0006','pg169_n0009','pg169_n0012','pg169_n0015','pg169_n0018','pg169_n0021']
      .forEach((nodeId) => {
        const node = root.querySelector(`[data-id='${nodeId}']`);
        if (node) node.textContent = node.textContent.replace(/\s*_+\s*$/, '');
      });
    root.querySelectorAll("[data-section-id='pg169_sec001'] [data-tts-text] > div[aria-hidden='true']")
      .forEach((grid) => {
        const arithmetic = grid.parentElement;
        if (!arithmetic.querySelector('.book-page163-answer-rule')) {
          const rule = document.createElement('i');
          rule.className = 'book-page163-answer-rule';
          rule.setAttribute('aria-hidden', 'true');
          arithmetic.append(rule);
        }
      });
  }

  function normalizePrintedPage164(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg170_sec001' || root.dataset.page164Normalized === 'true') return;
    root.dataset.page164Normalized = 'true';
    const add = (number, aShs, aCts, bShs, bCts, simple = false) => `
      <div class="book-page164-problem">
        <b>${number}.</b>
        <div class="book-page164-addition ${simple ? 'is-simple' : ''}">
          ${simple ? `<div><span>shs</span><span>${aShs}</span></div><div class="is-plus"><span>shs</span><span>${bShs}</span></div>` : `<div class="head"><span>shs</span><span>cts</span></div><div><span>${aShs}</span><span>${aCts}</span></div><div class="is-plus"><span>${bShs}</span><span>${bCts}</span></div>`}
          <i></i><i></i>
        </div>
      </div>`;
    root.innerHTML = `
      <div class="adt-source-page-part" data-source-section="pg170_sec001">
        <section data-section-id="pg170_sec001" class="book-page164">
          <div class="book-page164-continuation">
            ${add('13','433270','55','433865','45')}
            ${add('14','385534','05','453057','45')}
            ${add('15','60250','','28970','',true)}
          </div>
          <h1 class="book-page164-topic">Word problems involving addition of Tanzanian currency</h1>
          <article class="book-page164-example">
            <div class="book-page164-chip">Example 1</div>
            <div class="book-page164-example-body">
              <p>Sabina sold two chicks. The first was sold at 33,620 shillings and the second at 22,350 Tanzanian shillings. How much money did Sabina get?</p>
              <h2>Solution</h2>
              <div class="book-page164-solution" aria-label="33620 plus 22350 equals 55970 shillings">
                <div><span></span><span>shs</span><span>33620</span></div>
                <div><span>+</span><span>shs</span><span>22350</span></div>
                <i></i>
                <div><span></span><span>shs</span><span>55970</span></div>
                <i></i>
              </div>
              <p>Therefore, Sabina got 55,970 Tanzanian shillings.</p>
            </div>
          </article>
        </section>
      </div>`;
    const page = root.querySelector('.book-page164');
    ['width','max-width'].forEach((name) => page?.style.setProperty(name, '100%', 'important'));
    ['padding-left','padding-right'].forEach((name) => page?.style.setProperty(name, '0', 'important'));
  }

  function normalizePrintedPage165(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg171_sec001' || root.dataset.page165Normalized === 'true') return;
    root.dataset.page165Normalized = 'true';
    const questions = [
      ['1.', 'Saidi decided to sell two chickens. If the first chicken was sold for 13,600 Tanzanian shillings and the second was for 16,250 Tanzanian shillings. How much money did Saidi get altogether?'],
      ['2.', 'A vegetable vendor got 5000, 2000 and 1000 Tanzanian shillings notes and 200 Tanzanian shillings coin after selling vegetables. Find the total money the vendor got.'],
      ['3.', 'Yohana sold eggs for 8,600 shillings and a chicken for 17,500 Tanzanian shillings. How much money did he get?'],
      ['4.', 'Maria deposited 230,000 Tanzanian shillings in the bank. The bank added 4,550 shillings and 75 cents to her as a profit. How many shillings does Maria have in total?'],
    ];
    root.innerHTML = `
      <div class="adt-source-page-part" data-source-section="pg171_sec001">
        <section data-section-id="pg171_sec001" class="book-page165">
          <article class="book-page165-example">
            <div class="book-page165-chip">Example 2</div>
            <div class="book-page165-example-body">
              <p>Mapunda spent 245,950 Tanzanian shillings for buying milk, and 152,850 Tanzanian shillings for transport. How much money did he spend on milk and transport altogether?</p>
              <h2>Solution</h2>
              <div class="book-page165-sum" aria-label="245950 plus 152850 equals 398800 Tanzanian shillings">
                <div><span></span><span>shs</span><span>245950</span></div>
                <div><span>+</span><span>shs</span><span>152850</span></div>
                <i></i>
                <div><span></span><span>shs</span><span>398800</span></div>
                <i></i>
              </div>
              <p>Therefore, Mapunda spent 398,800 Tanzanian shillings.</p>
            </div>
          </article>
          <section class="book-page165-exercise" aria-labelledby="page165-exercise-title">
            <div class="book-page165-exercise-title" id="page165-exercise-title">Exercise 6</div>
            <div class="book-page165-questions">
              ${questions.map(([number, text]) => `<div><b>${number}</b><p>${text}</p></div>`).join('')}
            </div>
          </section>
        </section>
      </div>`;
    const page = root.querySelector('.book-page165');
    if (page) {
      page.style.setProperty('width', '100%', 'important');
      page.style.setProperty('max-width', '100%', 'important');
      page.style.setProperty('padding-left', '0', 'important');
      page.style.setProperty('padding-right', '0', 'important');
    }
    root.querySelectorAll('.book-page165-example-body p, .book-page165-questions p, .book-page165-questions b')
      .forEach((node) => {
        node.style.setProperty('font-size', '1.5rem', 'important');
        node.style.setProperty('line-height', '1.42', 'important');
      });
  }

  function normalizePrintedPage166(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg172_sec001') return;
    const section = root.querySelector("[data-section-id='pg172_sec002']");
    const exercise = root.querySelector("[data-section-id='pg172_sec001']");
    if (exercise) {
      exercise.style.setProperty('padding-top', '1.25rem', 'important');
      exercise.style.setProperty('padding-right', '.75rem', 'important');
      exercise.style.setProperty('padding-bottom', '1.5rem', 'important');
      exercise.style.setProperty('padding-left', '.75rem', 'important');
    }
    if (!section) return;
    [section, ...section.querySelectorAll('div, h1, p')].forEach((node) => {
      node.style.setProperty('width', '100%', 'important');
      node.style.setProperty('max-width', '100%', 'important');
      node.style.setProperty('margin-left', '0', 'important');
      node.style.setProperty('margin-right', '0', 'important');
      node.style.setProperty('padding-left', '0', 'important');
      node.style.setProperty('padding-right', '0', 'important');
    });
  }

  function normalizePrintedPage167(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg173_sec001' || root.dataset.page167Normalized === 'true') return;
    root.dataset.page167Normalized = 'true';
    const money = (answer = '', label = '') => `
      <div class="book-page167-money" aria-label="${label}">
        <div class="book-page167-money-head"><span>shs</span><span>cts</span></div>
        <div><span>83721</span><span>85</span></div>
        <div class="book-page167-minus"><span>61510</span><span>40</span></div>
        ${answer ? `<div class="book-page167-result"><span>${answer.split('|')[0]}</span><span>${answer.split('|')[1]}</span></div>` : '<i></i>'}
      </div>`;
    root.innerHTML = `
      <div class="adt-source-page-part" data-source-section="pg173_sec001">
        <section data-section-id="pg173_sec001" class="book-page167">
          <article class="book-page167-card" data-source-kind="example">
            <div class="book-page167-chip"><h1 data-source-heading="example">Example 1</h1></div>
            <div class="book-page167-simple">
              <p class="book-page167-prompt">shs 48965 95 cts <b class="book-page167-inline-minus">−</b> shs 25843 85 cts =</p>
              <h2>Steps</h2>
              <div class="book-page167-simple-steps">
                <div><b>1.</b><span>Subtract cents: 95 − 85 = 10 cts. Write 10 cts in the cents place.</span></div>
                <div><b>2.</b><span>Subtract shillings: 48965 − 25843 = shs 23122.<br>Write shs 23122 in the shillings place.</span></div>
              </div>
              <p>Therefore, the answer is shs 23122 10 cts.</p>
            </div>
          </article>
          <article class="book-page167-card book-page167-card-two" data-source-kind="example">
            <div class="book-page167-chip"><h1 data-source-heading="example">Example 2</h1></div>
            <div class="book-page167-second">
              ${money('', '83721 shillings 85 cents minus 61510 shillings 40 cents')}
              <h2>Steps</h2>
              <div class="book-page167-step-grid">
                <div class="book-page167-step-copy"><b>1.</b><div><p>Subtract cents: 85 cts − 40 cts = 45 cts.</p><p>Write 45 cts in the cents place.</p></div></div>
                ${money('|45', 'cents subtraction result 45')}
                <div class="book-page167-step-copy"><b>2.</b><div><p>Subtract shillings:</p><p>83721 − 61510 = sh 22211</p><p>Write sh 22211 in the shillings place.</p></div></div>
                ${money('22211|45', 'completed subtraction result 22211 shillings 45 cents')}
              </div>
              <p class="book-page167-answer">Therefore, the answer is shs 22211 45 cts.</p>
            </div>
          </article>
        </section>
      </div>`;
    root.querySelectorAll('.book-page167-chip').forEach((chip) => {
      chip.style.setProperty('right', 'auto', 'important');
      chip.style.setProperty('width', 'max-content', 'important');
      chip.style.setProperty('margin', '0', 'important');
    });
  }

  function normalizePrintedPage168(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (id !== 'pg174_sec001' || root.dataset.page168Normalized === 'true') return;
    root.dataset.page168Normalized = 'true';
    root.innerHTML = `
      <div class="adt-source-page-part" data-source-section="pg174_sec001">
        <section data-section-type="boxed_text" data-section-id="pg174_sec001" class="book-page168-example" data-source-kind="example">
          <div class="book-page168-title"><h1 data-source-heading="example">Example 3</h1></div>
          <div class="book-page168-body">
            <div class="book-page168-calculation book-page168-opening" aria-label="869335 shillings 30 cents minus 427123 shillings 70 cents">
              <div class="book-money-head"><span>shs</span><span>cts</span></div>
              <div><span>869335</span><span>30</span></div>
              <div class="book-money-minus"><b>−</b><span>427123</span><span>70</span></div>
              <i></i>
            </div>
            <h2>Steps</h2>
            <div class="book-page168-steps">
              <div class="book-page168-copy">
                <div class="book-page168-step-number">1.</div>
                <div>
                  <p>Subtract cents: 30 − 70, It is not sufficient. Take 1 shilling from 5 shillings and regroup it into 100 cents.</p>
                  <p>Add cents: 100 + 30 = 130 cts.</p>
                  <p>Subtract cents: 130 − 70 = 60 cts.</p>
                  <p>Write 60 cts in the cents place.</p>
                  <p>Remember, 1 shilling from 5 was regrouped into 100 cents.</p>
                  <p>Thus, 4 shillings remained.</p>
                </div>
              </div>
              <div class="book-page168-calculation book-page168-work" aria-label="first subtraction step">
                <div class="book-money-head"><span>shs</span><span>cts</span></div>
                <div><span>869335</span><span>30</span></div>
                <div class="book-money-minus"><b>−</b><span>427123</span><span>70</span></div>
                <div class="book-money-result"><span></span><span>60</span></div>
              </div>
              <div class="book-page168-copy">
                <div class="book-page168-step-number">2.</div>
                <div>
                  <p>Subtract: shillings:</p>
                  <p>869334 − 427123 = sh 442211.</p>
                  <p>Write sh 442211 in the shillings place.</p>
                  <p>Therefore, the answer is shs 442211&nbsp; 60 cts.</p>
                </div>
              </div>
              <div class="book-page168-calculation book-page168-work" aria-label="completed subtraction">
                <div class="book-money-head"><span>shs</span><span>cts</span></div>
                <div><span>869335</span><span>30</span></div>
                <div class="book-money-minus"><b>−</b><span>427123</span><span>70</span></div>
                <div class="book-money-result"><span>442211</span><span>60</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>`;
    const title = root.querySelector('.book-page168-title');
    title?.style.setProperty('right', 'auto', 'important');
    title?.style.setProperty('width', 'max-content', 'important');
    title?.style.setProperty('display', 'inline-block', 'important');
    title?.style.setProperty('margin', '0', 'important');
  }

  function normalizePrintedPage169(root) {
    const example = root.querySelector("[data-section-id='pg175_sec001']");
    const exercise = root.querySelector("[data-section-id='pg175_sec002']");
    if (!example || !exercise || exercise.dataset.page169Normalized === 'true') return;
    exercise.dataset.page169Normalized = 'true';

    const unsolved = example.querySelector("[aria-label='4180 shillings minus 2494 shillings']");
    if (unsolved && !unsolved.querySelector('.book-page169-answer-rule')) {
      const rule = document.createElement('i');
      rule.className = 'book-page169-answer-rule';
      rule.setAttribute('aria-hidden', 'true');
      unsolved.append(rule);
    }

    const questions = [
      ['pg175_n0019', '1', 'shs 4561 − shs 2364 ='],
      ['pg175_n0022', '2', 'shs 5751 − shs 4030 ='],
      ['pg175_n0025', '3', 'shs 7620 − shs 5245 ='],
      ['pg175_n0028', '4', 'shs 90900 − shs 75300 ='],
      ['pg175_n0031', '5', 'shs 58675 − shs 39248 ='],
      ['pg175_n0034', '6', 'shs 89990 − shs 68990 ='],
      ['pg175_n0037', '7', 'shs 914955 60 cts − shs 612950 05 cts ='],
      ['pg175_n0040', '8', 'shs 870300 40 cts − shs 413200 25 cts ='],
    ];
    questions.forEach(([id, number, text]) => {
      const original = exercise.querySelector(`[data-id='${id}']`);
      const label = original?.closest('label');
      if (!label) return;
      label.classList.add('book-page169-question');
      label.innerHTML = `<span class="book-page169-number">${number}.</span><span data-id="${id}">${text}</span>`;
    });
  }

  function normalizePrintedPage171(root) {
    const section = root.querySelector("[data-section-id='pg177_sec001']");
    if (!section || section.dataset.page171Normalized === 'true') return;
    section.dataset.page171Normalized = 'true';
    const problems = [
      ['21', '21201', '10', '−', '11102', '60'],
      ['22', '68654', '14', '−', '18129', '14'],
      ['23', '4500', '80', '−', '180', '45'],
      ['24', '100', '10', '−', '90', '20'],
      ['25', '945601', '70', '−', '431102', '60'],
    ];
    section.className = 'book-page171-exercises';
    section.innerHTML = `<div class="book-page171-grid">${problems.map(([number, first, firstCents, sign, second, secondCents]) => `
      <div class="book-page171-problem">
        <span class="book-page171-number">${number}${number === '25' ? '' : '.'}</span>
        <div class="book-page171-calc" aria-label="${first} shillings ${firstCents} cents minus ${second} shillings ${secondCents} cents">
          <span></span><span>shs</span><span>cts</span>
          <span></span><span>${first}</span><span>${firstCents}</span>
          <span>${sign}</span><span>${second}</span><span>${secondCents}</span>
          <i aria-hidden="true"></i>
        </div>
      </div>`).join('')}</div>`;
  }

  function normalizeArithmeticMinusSigns(root) {
    root.dataset.minusSignsNormalized = 'true';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement?.closest('math')) continue;
      if (/[−–]/.test(node.nodeValue || '')) targets.push(node);
    }
    targets.forEach((node) => {
      const parts = node.nodeValue.split(/([-−–])/);
      if (parts.length < 3) return;
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part === '-' || part === '−' || part === '–') {
          const sign = document.createElement('span');
          sign.className = 'book-minus-sign';
          sign.textContent = '−';
          fragment.append(sign);
        } else {
          fragment.append(document.createTextNode(part));
        }
      });
      node.replaceWith(fragment);
    });
  }

  function normalizeSubtractionExerciseSeven(root) {
    const section = root.querySelector("[data-section-id='pg071_sec001']");
    if (!section) return;
    section.dataset.verticalArithmetic = 'true';
    section.querySelectorAll('.fitb-sentence [data-id]').forEach((item) => {
      if (item.querySelector('i')) return;
      const match = item.textContent.trim().match(/^(\d+)\s*[-−–]\s*(\d+)\s*=\s*$/);
      if (!match) return;
      item.classList.add('book-vertical-problem');
      item.innerHTML = `<span>${match[1]}</span><span><b class="book-minus-sign">−</b>${match[2]}</span><i></i><i></i>`;
    });
  }

  /* Some converted pages wrapped the complete printed component in a second
     app-style card. Mark only large structural wrappers; tables, arithmetic
     grids, figures and genuine instructional sub-panels remain untouched. */
  function markConverterInnerShells(card, heading) {
    const cardLength = card.textContent.replace(/\s+/g, ' ').trim().length;
    if (cardLength < 20) return;
    card.querySelectorAll('div, article, section').forEach((node) => {
      if (node === card || node.contains(heading) || node.closest('table, figure')) return;
      if (node.querySelector('[data-source-heading]')) return;
      const textLength = node.textContent.replace(/\s+/g, ' ').trim().length;
      if (textLength < cardLength * .72) return;
      const style = getComputedStyle(node);
      const bordered = ['Top', 'Right', 'Bottom', 'Left']
        .some((side) => Number.parseFloat(style[`border${side}Width`]) > 0);
      const surfaced = style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        && style.backgroundColor !== 'transparent';
      if (bordered || surfaced || style.boxShadow !== 'none') {
        node.dataset.converterInnerShell = 'true';
      }
    });
  }

  function normalizePrintedPage15(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    if (sectionId !== 'pg021_sec001') return;
    const text = {
      pg021_n0023: '(a) 9000 + 800 + 70 + 2 =',
      pg021_n0024: '(b) 8000 + 800 + 80 + 0 =',
      pg021_n0025: '(c) 1000 + 0 + 0 + 6 =',
      pg021_n0026: '(d) 5000 + 600 + 50 + 8 =',
      pg021_n0027: '(e) 9000 + 700 + 0 + 2 ='
    };
    Object.entries(text).forEach(([id, value]) => {
      const node = root.querySelector(`[data-id="${id}"]`);
      if (node && node.textContent !== value) node.textContent = value;
    });
  }

  function normalizePrintedPage4(root) {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    if (sectionId !== 'pg010_sec001' || root.dataset.page4Normalized === 'true') return;
    root.dataset.page4Normalized = 'true';
    root.innerHTML = `
      <div class="adt-source-page-part" data-source-section="pg010_sec001">
        <section data-section-type="exercise_continuation" data-section-id="pg010_sec001" class="book-page4">
          <div class="book-exercise-panel book-page4-sheet" data-source-kind="exercise">
            <div class="book-page4-question book-page4-q2">
              <span data-id="pg010_n0002">2.</span>
              <div><p data-id="pg010_n0003">Write a number with the following place values:</p>
                <p data-id="pg010_n0004">(a) &nbsp; 2 hundreds, 9 ones, 3 thousands and 8 tens</p>
                <p data-id="pg010_n0005">(b) &nbsp; 0 ones, 2 hundreds, 6 tens and 5 thousands</p>
                <p data-id="pg010_n0006">(c) &nbsp; 6 tens, 6 thousands, 8 hundreds and 2 ones</p>
                <p data-id="pg010_n0007">(d) &nbsp; 3 thousands, 4 tens, 8 hundreds and 7 ones</p>
              </div>
            </div>
            <div class="book-page4-question book-page4-q3">
              <span data-id="pg010_n0026">3.</span>
              <div><p data-id="pg010_n0027">Fill in the following table the place value of each digit in the given numbers.</p>
                <table aria-label="Place values of digits"><thead><tr><th rowspan="2" data-id="pg010_n0031">Number</th><th colspan="4" data-id="pg010_n0033">Place values</th></tr><tr><th data-id="pg010_n0040">Thousands</th><th data-id="pg010_n0042">Hundreds</th><th data-id="pg010_n0044">Tens</th><th data-id="pg010_n0046">Ones</th></tr></thead><tbody>
                  ${['1001','6666','4000','3339'].map((number, row) => `<tr><td data-id="${['pg010_n0049','pg010_n0056','pg010_n0063','pg010_n0070'][row]}">${number}</td>${['Thousands','Hundreds','Tens','Ones'].map((place, column) => `<td><input aria-label="${number} ${place}" data-activity-item="item-${row * 4 + column + 1}" inputmode="numeric"></td>`).join('')}</tr>`).join('')}
                </tbody></table>
              </div>
            </div>
            <div class="book-page4-question"><span>4.</span><div class="book-page4-subquestions">
              <p data-id="pg010_n0010">(a) &nbsp; Which digit is in the hundreds place in 7029?</p>
              <p data-id="pg010_n0011">(b) &nbsp; Which digit is in the thousands place in 8173?</p>
              <p data-id="pg010_n0012">(c) &nbsp; Identify the digit which is in the tens place in the number 3487.</p>
              <p data-id="pg010_n0013">(d) &nbsp; A number has 0 in the ones place, 6 in the tens place and 7 in the hundreds place. What is the number?</p>
            </div></div>
            <div class="book-page4-question"><span>5.</span><div class="book-page4-subquestions">
              <p data-id="pg010_n0016">(a) &nbsp; How many hundreds are there in 3287?</p>
              <p data-id="pg010_n0017">(b) &nbsp; There are 9614 apples in the basket. How many thousands apples are there?</p>
            </div></div>
            <div class="book-page4-question book-page4-q6"><span>6.</span><div>
              <p data-id="pg010_sec002_q6_heading">Identify / determine / find / state the place value of each digit in the following whole numbers:</p>
              <div><span data-id="pg010_n0021">(a) &nbsp; 6247</span><span data-id="pg010_n0022">(b) &nbsp; 9999</span><span data-id="pg010_n0023">(c) &nbsp; 7001</span></div>
            </div></div>
          </div>
        </section>
      </div>`;
  }

  function normalizePrintedPages5To8(root) {
    const id = document.querySelector('meta[name="title-id"]')?.content || '';
    if (!['pg011_sec001', 'pg012_sec001', 'pg013_sec001', 'pg014_sec001'].includes(id)
        || root.dataset.earlyExerciseNormalized === 'true') return;
    root.dataset.earlyExerciseNormalized = 'true';
    const page = Number.parseInt(id.slice(2, 5), 10) - 6;
    const shell = (content, extra = '') => `<div class="adt-source-page-part"><section class="book-early-page book-page${page} ${extra}" data-section-id="${id}">${content}</section></div>`;
    const sheet = (content) => `<div class="book-exercise-panel book-early-exercise" data-source-kind="exercise">${content}</div>`;
    const question = (number, content, cls = '') => `<div class="book-early-question ${cls}"><span>${number}.</span><div>${content}</div></div>`;
    const line = '<span class="book-answer-line" aria-hidden="true"></span>';

    if (id === 'pg011_sec001') {
      const shaded = [
        ['a','1020',2],['b','2010',0],['c','1687',3],
        ['d','7922',1],['e','8888',3],['f','1692',1],
        ['g','5401',0],['h','9111',1],['i','3333',1],['j','2000',1]
      ];
      const blanks = (letter, number, digits) => `<div class="book-page5-fill"><p>(${letter}) &nbsp; In ${number}:</p><p>${digits[0]} is in ${line}, ${digits[1]} is in ${line},<br>${digits[2]} is in ${line} and ${digits[3]} is in ${line}.</p></div>`;
      root.innerHTML = shell(sheet(`
        <div class="book-page5-cont">${[['d','4444'],['e','3239'],['f','2776'],['g','1111'],['h','8107'],['i','9009'],['j','5108']].map(([l,n])=>`<span>(${l}) &nbsp; ${n}</span>`).join('')}</div>
        ${question(7, `<p>Write the place value of the shaded digit in the following whole numbers:</p><div class="book-page5-shaded">${shaded.map(([l,n,active])=>`<span class="book-page5-shaded-item"><span>(${l})</span><span class="book-page5-number">${[...n].map((digit,index)=>`<i${index===active?' class="is-shaded"':''}>${digit}</i>`).join('')}</span></span>`).join('')}</div>`)}
        ${question(8, `<p>Fill in the blanks with the place values of the given digits.</p>${blanks('a','2968',['2','9','6','8'])}${blanks('b','9801',['9','8','0','1'])}${blanks('c','7236',['7','2','3','6'])}${blanks('d','5649',['5','6','4','9'])}`)}
      `));
      return;
    }

    if (id === 'pg012_sec001') {
      const rows = [[1,0,2,0],[1,1,2,0],[2,4,4,0],[3,3,0,1],[6,8,9,9],[9,2,7,4],[2,9,7,3],[8,1,2,2],[7,1,7,3],[1,2,7,7],[7,2,9,1],[1,0,0,0],[2,3,1,1]];
      const fill = (l,n) => `<div class="book-place-value-row"><span class="book-place-value-letter">(${l})</span><span class="book-place-value-number">${n}</span><span class="book-place-value-copy"><span>has ${line} thousands, ${line} hundreds, ${line}</span><span>tens and ${line} ones.</span></span></div>`;
      root.innerHTML = shell(sheet(`
        ${question(9, `<p>Write the number represented by the place values in the following table:</p><table class="book-page6-table"><thead><tr><th>Thousands</th><th>Hundreds</th><th>Tens</th><th>Ones</th><th>Number</th></tr></thead><tbody>${rows.map((r,i)=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}<td><input aria-label="Answer for table row ${i+1}"></td></tr>`).join('')}</tbody></table>`)}
        ${question(10, `<p>Fill in the blanks with the correct place values of the following whole numbers.</p><div class="book-page6-fills">${fill('a','1872')}${fill('b','2663')}${fill('c','4793')}</div>`)}
      `));
      return;
    }

    if (id === 'pg013_sec001') {
      const entries = [['d','5187'],['e','4002'],['f','1562'],['g','7371'],['h','4572'],['i','3421'],['j','2012'],['k','6682'],['l','5583'],['m','5234'],['n','2709'],['o','5235'],['p','9123'],['q','3410']];
      const fill = (l,n) => `<div class="book-place-value-row"><span class="book-place-value-letter">(${l})</span><span class="book-place-value-number">${n}</span><span class="book-place-value-copy"><span>has ${line} thousands, ${line} hundreds, ${line}</span><span>tens and ${line} ones.</span></span></div>`;
      root.innerHTML = shell(sheet(`<div class="book-page7-list">${entries.map(([l,n])=>fill(l,n)).join('')}</div>`));
      return;
    }

    const choices = (items) => `<div class="book-page8-choices">${items.map(([l,n])=>`<span>(${l}) &nbsp; ${n}</span>`).join('')}</div>`;
    root.innerHTML = shell(`
      ${sheet(`
        ${question(11, `<p>Write the digit in the thousands place value in each of the following whole numbers:</p>${choices([['a','7682'],['b','9501'],['c','8306'],['d','6412']])}`)}
        ${question(12, `<p>Write the place value of 3 in each of the following whole numbers:</p>${choices([['a','436'],['b','3900'],['c','2843'],['d','2301']])}`)}
        ${question(13, `<p>Underline the digit in the hundreds place in each of the following whole numbers:</p>${choices([['a','269'],['b','7901'],['c','3749'],['d','9568']])}`)}
        ${question(14, `<div class="book-page8-riddles"><p>(a) &nbsp; I am a two-digit number with 3 in the ones place.<br>The digit in the tens exceeds that in the ones by 4.<br>What number do I represent?</p><p>(b) &nbsp; I am a two-digit number with 9 in the tens place.<br>The digit in the ones is less than the digit in the tens by 3. What number am I?</p></div>`)}
      `)}
      <div class="book-page8-topic"><h1>Writing the place value of a digit in a number using abacus</h1><p>The place value of digits in a number can be identified using the abacus. The following picture shows pupils placing counters on the abacus to form a number.</p></div>
    `, 'book-page8-wrap');
  }

  function romanNumeral(value) {
    return ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi'][value] || '';
  }

  function printedPageNumber() {
    const sectionId = document.querySelector('meta[name="title-id"]')?.content || '';
    const match = sectionId.match(/^pg(\d{3})_/i);
    if (!match) return '';
    const sourcePage = Number.parseInt(match[1], 10);
    if (sourcePage === 1) return '';
    if (sourcePage <= 6) return romanNumeral(sourcePage);
    return String(sourcePage - 6);
  }

  function addPrintedPageFooter(root) {
    if (root.querySelector('.source-book-page-footer')) return;
    const pageNumber = printedPageNumber();
    if (!pageNumber) return;

    const footer = document.createElement('footer');
    footer.className = 'source-book-page-footer';
    footer.setAttribute('aria-label', `Printed page ${pageNumber}`);
    footer.dataset.pageNumber = pageNumber;

    const numeral = document.createElement('span');
    numeral.className = 'source-book-page-number';
    numeral.setAttribute('aria-hidden', 'true');
    numeral.textContent = pageNumber;
    footer.append(numeral);
    root.append(footer);
  }

  /* The script is loaded after #content, so apply before the browser's first
     paint instead of waiting for DOMContentLoaded and showing two layouts. */
  applySourceTheme();
})();
