/* Apply the recurring visual grammar of the printed Mathematics book. */
(() => {
  'use strict';

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
      if (hasVisualSurface(node)) return node;
    }
    return structuralFallback || heading.closest('section, article, aside');
  }

  function applySourceTheme() {
    const root = document.querySelector('#content');
    if (!root) return;
    const candidates = root.querySelectorAll('[data-id], h1, h2, h3, h4');
    candidates.forEach((heading) => {
      if (heading.dataset.sourceThemeProcessed === 'true') return;
      const text = heading.textContent.replace(/\s+/g, ' ').trim();
      const kind = kindFor(text);
      if (!kind) return;
      heading.dataset.sourceThemeProcessed = 'true';
      heading.dataset.sourceHeading = kind;
      if (kind === 'chapter') {
        heading.parentElement.dataset.sourceHeadingWrap = 'chapter';
        return;
      }
      const card = findCard(heading, root);
      if (card && (!card.dataset.sourceKind || card.dataset.sourceKind === kind)) {
        card.dataset.sourceKind = kind;
        if (heading.parentElement !== card) heading.parentElement.dataset.sourceHeadingWrap = kind;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySourceTheme, { once: true });
  } else {
    applySourceTheme();
  }
  window.addEventListener('load', applySourceTheme, { once: true });
})();
