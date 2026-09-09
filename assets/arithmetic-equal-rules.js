/* Match the answer rule to the calculation rule on vertical-arithmetic worksheets. */
(() => {
  'use strict';

  function installStyles() {
    if (document.getElementById('adt-arithmetic-equal-rules')) return;

    const style = document.createElement('style');
    style.id = 'adt-arithmetic-equal-rules';
    style.textContent = `
      html body #content#content#content#content#content.adt-source-page
        [data-section-id="pg076_sec002"] .grid > div::after,
      html body #content#content#content#content#content.adt-source-page
        [data-section-id="pg080_sec002"] > div > div:nth-child(2) > div::after,
      #content [data-section-id="pg076_sec002"] .grid > div::after,
      #content [data-section-id="pg080_sec002"] > div > div:nth-child(2) > div::after {
        content: none !important;
        display: none !important;
      }

      #content [data-section-id="pg076_sec002"] .font-mono,
      #content [data-section-id="pg080_sec002"] [data-revision-vertical] {
        position: relative !important;
      }

      #content [data-section-id="pg076_sec002"] .adt-matched-answer-rule,
      #content [data-section-id="pg080_sec002"] .adt-matched-answer-rule {
        border-top: 2px solid #222 !important;
        box-sizing: border-box !important;
        display: block !important;
        height: 0 !important;
        left: 0 !important;
        padding: 0 !important;
        position: absolute !important;
        width: 100% !important;
      }

      #content [data-section-id="pg076_sec002"] .adt-matched-answer-rule {
        top: 76px !important;
      }

      #content [data-section-id="pg080_sec002"] .adt-matched-answer-rule {
        grid-column: 1 / -1 !important;
        top: 84px !important;
      }
    `;
    document.head.append(style);
  }

  function appendRule(calculation) {
    if (!calculation || calculation.querySelector(':scope > .adt-matched-answer-rule')) return;

    const rule = document.createElement('span');
    rule.className = 'adt-matched-answer-rule';
    rule.setAttribute('aria-hidden', 'true');
    calculation.append(rule);
  }

  function applyEqualRules() {
    installStyles();
    document.querySelectorAll('[data-section-id="pg076_sec002"] .font-mono').forEach(appendRule);
    document.querySelectorAll('[data-section-id="pg080_sec002"] [data-revision-vertical]').forEach(appendRule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyEqualRules);
  } else {
    applyEqualRules();
  }

  window.addEventListener('load', applyEqualRules);
  window.setTimeout(applyEqualRules, 400);
  window.setTimeout(applyEqualRules, 1200);
  window.setTimeout(applyEqualRules, 2000);
})();
