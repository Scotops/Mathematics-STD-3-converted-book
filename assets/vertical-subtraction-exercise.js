(() => {
  'use strict';

  const section = document.querySelector('[data-section-id="pg071_sec001"]');
  if (!section) return;

  function arrangeVertically() {
    section.querySelectorAll('input[data-activity-item]').forEach((input) => {
      const exercise = input.closest('span.fitb-sentence') || input.closest('.fitb-sentence');
      if (!exercise) return;

      const expression = exercise.querySelector('span[data-id]');
      const match = String(expression?.textContent || '').trim().match(/^([\d,]+)\s*[−-]\s*([\d,]+)\s*=$/);
      if (exercise.dataset.verticalSubtraction === 'true') {
        if (match) {
          expression.textContent = match[1];
          const existingSubtrahend = exercise.querySelector('[data-vertical-subtrahend]');
          if (existingSubtrahend) existingSubtrahend.textContent = `− ${match[2]}`;
        }
        return;
      }
      if (!expression || !match) return;

      exercise.dataset.verticalSubtraction = 'true';
      exercise.style.display = 'flex';
      exercise.style.flexDirection = 'column';
      exercise.style.alignItems = 'flex-end';
      exercise.style.width = '170px';
      exercise.style.maxWidth = '100%';
      exercise.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      exercise.style.fontSize = '22px';
      exercise.style.lineHeight = '1.2';
      exercise.style.gap = '0';

      expression.textContent = match[1];
      expression.style.display = 'block';
      expression.style.width = '100%';
      expression.style.paddingRight = '8px';
      expression.style.textAlign = 'right';

      const subtrahend = document.createElement('span');
      subtrahend.dataset.verticalSubtrahend = 'true';
      subtrahend.textContent = `− ${match[2]}`;
      subtrahend.style.display = 'block';
      subtrahend.style.width = '100%';
      subtrahend.style.paddingRight = '8px';
      subtrahend.style.borderBottom = '2px solid #111';
      subtrahend.style.textAlign = 'right';
      input.before(subtrahend);

      input.style.display = 'block';
      input.style.width = '100%';
      input.style.marginTop = '12px';
    });
  }

  arrangeVertically();
  window.addEventListener('load', arrangeVertically, { once: true });
  window.setTimeout(arrangeVertically, 500);
})();
