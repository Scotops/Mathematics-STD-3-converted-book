(() => {
  'use strict';

  const section = document.querySelector('[data-section-id="pg063_sec001"]');
  if (!section) return;

  function arrangeVertically() {
    section.querySelectorAll('.fitb-sentence').forEach((exercise) => {
      const expression = exercise.querySelector('span[data-id]');
      const input = exercise.querySelector('input[data-activity-item]');
      const match = String(expression?.textContent || '').trim().match(/^([\d,]+)\s*\+\s*([\d,]+)\s*=$/);
      if (exercise.dataset.verticalAddition === 'true') {
        if (match) {
          expression.textContent = match[1];
          const existingAddend = exercise.querySelector('[data-vertical-addend]');
          if (existingAddend) existingAddend.textContent = `+ ${match[2]}`;
        }
        return;
      }
      if (!expression || !input || !match) return;

      exercise.dataset.verticalAddition = 'true';
      exercise.style.display = 'flex';
      exercise.style.flexDirection = 'column';
      exercise.style.alignItems = 'flex-end';
      exercise.style.width = '170px';
      exercise.style.maxWidth = '100%';
      exercise.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      exercise.style.lineHeight = '1.2';

      expression.textContent = match[1];
      expression.style.display = 'block';
      expression.style.width = '100%';
      expression.style.paddingRight = '8px';
      expression.style.textAlign = 'right';

      const secondAddend = document.createElement('span');
      secondAddend.dataset.verticalAddend = 'true';
      secondAddend.textContent = `+ ${match[2]}`;
      secondAddend.style.display = 'block';
      secondAddend.style.width = '100%';
      secondAddend.style.paddingRight = '8px';
      secondAddend.style.borderBottom = '2px solid #111';
      secondAddend.style.textAlign = 'right';
      input.before(secondAddend);

      input.style.display = 'block';
      input.style.width = '100%';
      input.style.marginTop = '12px';
    });
  }

  function boldParticipantNames() {
    const sentence = section.querySelector('[data-id="pg063_n0055"]');
    if (!sentence || sentence.querySelector('strong')) return;

    const parts = String(sentence.textContent || '').split(/\b(Ali|Rose|Dule)\b/g);
    sentence.replaceChildren(...parts.map((part) => {
      if (!/^(Ali|Rose|Dule)$/.test(part)) return document.createTextNode(part);
      const strong = document.createElement('strong');
      strong.textContent = part;
      strong.style.fontWeight = '700';
      return strong;
    }));
  }

  arrangeVertically();
  boldParticipantNames();
  window.addEventListener('load', () => {
    arrangeVertically();
    boldParticipantNames();
  }, { once: true });
  window.setTimeout(() => {
    arrangeVertically();
    boldParticipantNames();
  }, 500);
})();
