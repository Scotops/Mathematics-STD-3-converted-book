/* Add validated inline answers to the measurement-units revision exercise. */
(() => {
  const fields = [
    ['pg095_n0035', 'item-1', 'teachers office'],
    ['pg095_n0036', 'item-2', 'piece of chalk'],
    ['pg095_n0037', 'item-3', 'road from Dodoma to Dar es Salaam']
  ];

  const section = document.querySelector('[data-section-id="pg095_sec002"]');
  if (!section) return;
  section.dataset.sectionType = 'activity_fill_in_the_blank';

  fields.forEach(([textId, itemId, description]) => {
    const question = section.querySelector(`[data-id="${textId}"]`);
    if (!question || section.querySelector(`[data-activity-item="${itemId}"]`)) return;

    const row = question.parentElement;
    row.style.display = 'flex';
    row.style.alignItems = 'flex-end';
    row.style.flexWrap = 'wrap';
    row.style.columnGap = '.75rem';
    row.style.rowGap = '.5rem';

    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.dataset.activityItem = itemId;
    input.setAttribute('aria-label', `Dash. Answer for ${description}`);
    input.style.cssText = 'width:170px;max-width:100%;border:0;border-bottom:4px solid #9ca3af;background:transparent;padding:2px 4px;text-align:center;outline:none;font:inherit';
    row.append(input);
  });
})();
