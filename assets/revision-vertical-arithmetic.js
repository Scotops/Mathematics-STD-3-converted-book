/* Match the vertical arithmetic layout used by Revision exercise questions 1-8. */
(() => {
  const problems = {
    pg080_n0028: ['6142', '+', '4226'],
    pg080_n0030: ['8937', '\u2212', '27'],
    pg080_n0032: ['55394', '+', '1295'],
    pg080_n0034: ['47326', '\u2212', '32198'],
    pg080_n0036: ['2696', '+', '2398'],
    pg080_n0038: ['638345', '\u2212', '225221'],
    pg081_n0004: ['55394', '+', '1295'],
    pg081_n0008: ['7623', '\u2212', '278']
  };

  function makeCalculation(id, minuend, operator, subtrahend) {
    const digits = Math.max(minuend.length, subtrahend.length);
    const calculation = document.createElement('div');
    calculation.dataset.revisionVertical = id;
    calculation.setAttribute('aria-hidden', 'true');
    calculation.style.cssText = [
      'display:grid',
      `grid-template-columns:1.2em ${digits}ch`,
      'width:max-content',
      'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'font-variant-numeric:tabular-nums lining-nums',
      'font-size:2rem',
      'line-height:1.15'
    ].join(';');

    calculation.innerHTML = `
      <span></span><span style="text-align:right">${minuend}</span>
      <span>${operator}</span><span style="text-align:right">${subtrahend}</span>
      <span style="grid-column:1 / -1;border-top:2px solid currentColor;margin-top:.15em"></span>`;
    return calculation;
  }

  function applyLayout() {
    Object.entries(problems).forEach(([id, values]) => {
      const source = document.querySelector(`[data-id="${id}"]`);
      if (!source) return;

      source.classList.add('sr-only');
      const wrapper = source.parentElement;
      if (!wrapper.querySelector(`[data-revision-vertical="${id}"]`)) {
        source.insertAdjacentElement('afterend', makeCalculation(id, ...values));
      }

      const input = wrapper.querySelector('input[data-activity-item]');
      if (input) {
        input.style.display = 'block';
        input.style.marginLeft = '0';
        input.style.marginTop = '1.5rem';
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyLayout);
  else applyLayout();
  window.addEventListener('load', applyLayout);
  window.setTimeout(applyLayout, 500);
  window.setTimeout(applyLayout, 1500);
})();
